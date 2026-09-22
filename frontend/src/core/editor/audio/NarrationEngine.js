/**
 * NarrationEngine.js
 * WoX BUILDER Per-Scene Narration & Subtitle Engine
 *
 * Features:
 * - Play narration audio per scene via AudioEngine
 * - Fire subtitle cue events at specific timestamps (SubRip-style)
 * - React-compatible: emit events via callbacks
 * - Subtitle visibility fade-in/out with automatic timing
 */

import { audioEngine } from './AudioEngine';

export class NarrationEngine {
  constructor() {
    // Array of { text, start, end } subtitle cue objects
    this._cues = [];
    this._currentCueIndex = -1;
    this._playbackStart = 0;
    this._rafId = null;
    this._playing = false;

    // Callbacks
    this.onSubtitleChange = null; // (cue | null) => void
    this.onNarrationEnd = null;   // () => void
  }

  /**
   * Load subtitle cues from VTT-style array
   * @param {Array<{text: string, start: number, end: number}>} cues
   */
  loadCues(cues) {
    this._cues = [...cues].sort((a, b) => a.start - b.start);
    this._currentCueIndex = -1;
  }

  /**
   * Start narration for a scene.
   * @param {string} audioUrl   - The narration audio URL
   * @param {object} sceneConfig - { narrationAudio, narrationVolume, subtitleCues }
   */
  async startForScene(sceneConfig) {
    this.stop();
    if (!sceneConfig?.narrationAudio) return;

    this.loadCues(sceneConfig.subtitleCues || []);
    this._playbackStart = Date.now();
    this._playing = true;

    await audioEngine.playNarration(sceneConfig.narrationAudio, {
      volume: sceneConfig.narrationVolume ?? 0.9,
      onEnd: () => {
        this._playing = false;
        cancelAnimationFrame(this._rafId);
        if (this.onSubtitleChange) this.onSubtitleChange(null);
        if (this.onNarrationEnd) this.onNarrationEnd();
      },
    });

    this._tick();
  }

  _tick() {
    if (!this._playing) return;
    const elapsed = (Date.now() - this._playbackStart) / 1000;
    const activeCue = this._cues.find(c => elapsed >= c.start && elapsed < c.end) || null;

    // Only fire callback if cue changed
    const activeText = activeCue?.text || null;
    const prevText = this._currentCueIndex >= 0 ? this._cues[this._currentCueIndex]?.text : null;
    if (activeText !== prevText) {
      this._currentCueIndex = this._cues.indexOf(activeCue);
      if (this.onSubtitleChange) this.onSubtitleChange(activeCue);
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  stop() {
    this._playing = false;
    cancelAnimationFrame(this._rafId);
    audioEngine.stopNarration();
    if (this.onSubtitleChange) this.onSubtitleChange(null);
    this._cues = [];
    this._currentCueIndex = -1;
  }

  get isPlaying() { return this._playing; }
}

export const narrationEngine = new NarrationEngine();
