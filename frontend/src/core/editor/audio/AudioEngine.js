/**
 * AudioEngine.js
 * WoX BUILDER Professional Spatial Audio Engine
 *
 * Features:
 * - Ambient scene background audio with cross-fade transitions
 * - Positional hotspot audio (Web Audio API PannerNode)
 * - Narration track playback with subtitle event callbacks
 * - Master volume, individual track volumes
 * - Mute / unmute
 * - Auto-stop on scene change
 */

export class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;

    // Track state
    this._ambientSource = null;
    this._ambientGain = null;
    this._ambientBuffer = null;
    this._ambientLoop = true;
    this._ambientVolume = 0.5;

    this._narrationSource = null;
    this._narrationGain = null;
    this._narrationBuffer = null;

    // Hotspot positional sounds: Map<hotspotId, { source, panner, gain }>
    this._hotspotSounds = new Map();

    // Preloaded audio buffer cache: Map<url, AudioBuffer>
    this._cache = new Map();

    this._masterVolume = 1.0;
    this._muted = false;

    this._initialized = false;
  }

  /**
   * Must be called after a user gesture (browser policy).
   */
  async init() {
    if (this._initialized) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.setValueAtTime(this._masterVolume, this._ctx.currentTime);
    this._masterGain.connect(this._ctx.destination);
    this._initialized = true;
  }

  _ensureInit() {
    if (!this._initialized) {
      console.warn('[AudioEngine] Not initialized. Call init() first after a user gesture.');
    }
  }

  // ─── Preload ──────────────────────────────────────────────────────────────

  async preloadBuffer(url) {
    if (!url) return null;
    if (this._cache.has(url)) return this._cache.get(url);
    try {
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
      this._cache.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.error('[AudioEngine] Failed to load audio:', url, err);
      return null;
    }
  }

  // ─── Ambient Track ────────────────────────────────────────────────────────

  async playAmbient(url, { loop = true, volume = 0.5, fadeInMs = 1200 } = {}) {
    this._ensureInit();
    await this.stopAmbient(800);
    if (!url) return;

    const buffer = await this.preloadBuffer(url);
    if (!buffer) return;

    this._ambientGain = this._ctx.createGain();
    this._ambientGain.gain.setValueAtTime(0, this._ctx.currentTime);
    this._ambientGain.connect(this._masterGain);

    this._ambientSource = this._ctx.createBufferSource();
    this._ambientSource.buffer = buffer;
    this._ambientSource.loop = loop;
    this._ambientSource.connect(this._ambientGain);
    this._ambientSource.start();

    // Fade in
    const target = this._muted ? 0 : volume;
    this._ambientGain.gain.linearRampToValueAtTime(target, this._ctx.currentTime + fadeInMs / 1000);
    this._ambientVolume = volume;
  }

  async stopAmbient(fadeOutMs = 800) {
    if (!this._ambientSource) return;
    return new Promise((resolve) => {
      const gain = this._ambientGain;
      const source = this._ambientSource;
      this._ambientSource = null;
      this._ambientGain = null;
      if (!gain) { resolve(); return; }
      const fadeEnd = this._ctx.currentTime + fadeOutMs / 1000;
      gain.gain.linearRampToValueAtTime(0, fadeEnd);
      setTimeout(() => {
        try { source.stop(); } catch (_) {}
        try { gain.disconnect(); } catch (_) {}
        resolve();
      }, fadeOutMs + 50);
    });
  }

  // ─── Narration Track ──────────────────────────────────────────────────────

  async playNarration(url, { volume = 0.9, onEnd = null } = {}) {
    this._ensureInit();
    this.stopNarration();
    if (!url) return;

    const buffer = await this.preloadBuffer(url);
    if (!buffer) return;

    this._narrationGain = this._ctx.createGain();
    this._narrationGain.gain.setValueAtTime(this._muted ? 0 : volume, this._ctx.currentTime);
    this._narrationGain.connect(this._masterGain);

    this._narrationSource = this._ctx.createBufferSource();
    this._narrationSource.buffer = buffer;
    this._narrationSource.connect(this._narrationGain);
    if (onEnd) this._narrationSource.onended = onEnd;
    this._narrationSource.start();
  }

  stopNarration() {
    if (!this._narrationSource) return;
    try { this._narrationSource.stop(); } catch (_) {}
    try { this._narrationGain.disconnect(); } catch (_) {}
    this._narrationSource = null;
    this._narrationGain = null;
  }

  // ─── Hotspot Positional Audio ──────────────────────────────────────────────

  /**
   * Play spatial audio at a specific yaw/pitch position.
   * @param {string} hotspotId
   * @param {string} url
   * @param {{ yaw: number, pitch: number, volume: number, loop: boolean }} opts
   */
  async playHotspotAudio(hotspotId, url, { yaw = 0, pitch = 0, volume = 0.7, loop = true } = {}) {
    this._ensureInit();
    this.stopHotspotAudio(hotspotId);
    if (!url) return;

    const buffer = await this.preloadBuffer(url);
    if (!buffer) return;

    const panner = this._ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 20;
    panner.rolloffFactor = 1.5;

    // Convert spherical yaw/pitch to x/y/z position
    const x = Math.sin(yaw) * Math.cos(pitch);
    const y = Math.sin(pitch);
    const z = -Math.cos(yaw) * Math.cos(pitch);
    panner.setPosition(x * 5, y * 5, z * 5);

    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(this._muted ? 0 : volume, this._ctx.currentTime);

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this._masterGain);
    source.start();

    this._hotspotSounds.set(hotspotId, { source, panner, gain });
  }

  stopHotspotAudio(hotspotId) {
    if (!this._hotspotSounds.has(hotspotId)) return;
    const { source, gain } = this._hotspotSounds.get(hotspotId);
    try { source.stop(); } catch (_) {}
    try { gain.disconnect(); } catch (_) {}
    this._hotspotSounds.delete(hotspotId);
  }

  stopAllHotspotAudio() {
    for (const id of this._hotspotSounds.keys()) {
      this.stopHotspotAudio(id);
    }
  }

  // ─── Volume & Mute ────────────────────────────────────────────────────────

  setMasterVolume(value) {
    this._masterVolume = Math.max(0, Math.min(1, value));
    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(this._masterVolume, this._ctx.currentTime + 0.05);
    }
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._masterGain) {
      const target = muted ? 0 : this._masterVolume;
      this._masterGain.gain.linearRampToValueAtTime(target, this._ctx.currentTime + 0.1);
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  get isMuted() { return this._muted; }
  get masterVolume() { return this._masterVolume; }
  get isPlaying() { return !!this._ambientSource; }

  // ─── Scene Transition ─────────────────────────────────────────────────────

  /**
   * Transition to a new scene's audio.
   * Stops all hotspot audio, cross-fades ambient to new scene audio.
   */
  async transitionToScene(sceneConfig) {
    this.stopAllHotspotAudio();
    this.stopNarration();
    if (sceneConfig?.ambientAudio) {
      await this.playAmbient(sceneConfig.ambientAudio, {
        loop: true,
        volume: sceneConfig.ambientVolume ?? 0.5,
        fadeInMs: 1200,
      });
    } else {
      await this.stopAmbient(800);
    }
    if (sceneConfig?.narrationAudio) {
      setTimeout(() => {
        this.playNarration(sceneConfig.narrationAudio, { volume: 0.9 });
      }, 1500);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  async destroy() {
    await this.stopAmbient(200);
    this.stopNarration();
    this.stopAllHotspotAudio();
    if (this._ctx) {
      try { await this._ctx.close(); } catch (_) {}
      this._ctx = null;
    }
    this._initialized = false;
  }
}

// Singleton instance for use across the app
export const audioEngine = new AudioEngine();
