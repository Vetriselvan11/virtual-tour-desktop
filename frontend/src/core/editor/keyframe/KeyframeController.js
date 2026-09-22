/**
 * KeyframeController.js
 * WoX BUILDER Camera Keyframe System
 *
 * Features:
 * - Save camera snapshots (yaw, pitch, fov) as named keyframes
 * - GSAP-powered smooth interpolation between keyframes
 * - Playback queue with per-transition duration and easing
 * - Loop / ping-pong support
 * - React-compatible via callbacks
 */

import gsap from 'gsap';

/**
 * @typedef {Object} Keyframe
 * @property {string}  id        - Unique ID (auto-generated)
 * @property {string}  label     - Human-readable label
 * @property {number}  yaw       - Camera yaw in radians
 * @property {number}  pitch     - Camera pitch in radians
 * @property {number}  fov       - Field of view in degrees
 * @property {number}  duration  - Duration of transition to REACH this keyframe (seconds)
 * @property {string}  ease      - GSAP ease string
 * @property {number}  hold      - How long to hold this keyframe before moving to next (ms)
 */

export class KeyframeController {
  constructor(viewerCore) {
    /** @type {import('../ViewerCore').default} */
    this._viewer = viewerCore;
    /** @type {Keyframe[]} */
    this._keyframes = [];
    this._playing = false;
    this._currentIndex = 0;
    this._tween = null;
    this._holdTimer = null;
    this._loop = false;
    this._pingPong = false;
    this._direction = 1;

    // Callbacks
    this.onKeyframesChange = null; // (keyframes: Keyframe[]) => void
    this.onPlaybackFrame = null;   // (index: number) => void
    this.onPlaybackEnd = null;     // () => void
  }

  // ─── Keyframe Management ──────────────────────────────────────────────────

  /**
   * Capture current camera state as a new keyframe.
   */
  addKeyframe(label = '') {
    if (!this._viewer) return;
    const kf = {
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: label || `Keyframe ${this._keyframes.length + 1}`,
      yaw: this._viewer.targetTheta ?? this._viewer.spherical?.theta ?? 0,
      pitch: this._viewer.targetPhi ?? this._viewer.spherical?.phi ?? Math.PI / 2,
      fov: this._viewer.camera?.fov ?? 75,
      duration: 2,
      ease: 'power2.inOut',
      hold: 0,
    };
    this._keyframes = [...this._keyframes, kf];
    this._emit();
    return kf;
  }

  updateKeyframe(id, updates) {
    this._keyframes = this._keyframes.map(kf =>
      kf.id === id ? { ...kf, ...updates } : kf
    );
    this._emit();
  }

  removeKeyframe(id) {
    this._keyframes = this._keyframes.filter(kf => kf.id !== id);
    this._emit();
  }

  reorderKeyframes(newOrder) {
    this._keyframes = newOrder;
    this._emit();
  }

  /** Jump camera to a specific keyframe instantly */
  jumpToKeyframe(id) {
    const kf = this._keyframes.find(k => k.id === id);
    if (!kf || !this._viewer) return;
    this._applyKeyframe(kf, 0.5, 'power2.out');
  }

  _emit() {
    if (this.onKeyframesChange) this.onKeyframesChange([...this._keyframes]);
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  play({ loop = false, pingPong = false, startIndex = 0 } = {}) {
    if (this._keyframes.length < 2) return;
    this._loop = loop;
    this._pingPong = pingPong;
    this._direction = 1;
    this._currentIndex = startIndex;
    this._playing = true;
    this._playNext();
  }

  stop() {
    this._playing = false;
    if (this._tween) { this._tween.kill(); this._tween = null; }
    if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null; }
    if (this.onPlaybackEnd) this.onPlaybackEnd();
  }

  pause() {
    if (this._tween) this._tween.pause();
    this._playing = false;
  }

  resume() {
    if (this._tween) { this._tween.resume(); this._playing = true; }
  }

  _playNext() {
    if (!this._playing) return;
    const kf = this._keyframes[this._currentIndex];
    if (!kf) { this.stop(); return; }
    if (this.onPlaybackFrame) this.onPlaybackFrame(this._currentIndex);
    this._applyKeyframe(kf, kf.duration, kf.ease, () => this._onFrameComplete(kf));
  }

  _applyKeyframe(kf, duration, ease, onComplete) {
    if (!this._viewer) return;
    const target = {
      yaw: this._viewer.targetTheta,
      pitch: this._viewer.targetPhi,
      fov: this._viewer.camera?.fov ?? 75,
    };
    if (this._tween) this._tween.kill();
    this._tween = gsap.to(target, {
      yaw: kf.yaw,
      pitch: kf.pitch,
      fov: kf.fov,
      duration: duration ?? 2,
      ease: ease ?? 'power2.inOut',
      onUpdate: () => {
        this._viewer.targetTheta = target.yaw;
        this._viewer.targetPhi = target.pitch;
        if (this._viewer.camera) {
          this._viewer.camera.fov = target.fov;
          this._viewer.camera.updateProjectionMatrix();
        }
      },
      onComplete: () => { if (onComplete) onComplete(); },
    });
  }

  _onFrameComplete(kf) {
    if (!this._playing) return;
    const holdMs = kf.hold || 0;
    this._holdTimer = setTimeout(() => {
      if (!this._playing) return;
      // Advance index
      let nextIndex = this._currentIndex + this._direction;
      if (this._pingPong) {
        if (nextIndex >= this._keyframes.length) {
          this._direction = -1;
          nextIndex = this._keyframes.length - 2;
        } else if (nextIndex < 0) {
          this._direction = 1;
          nextIndex = 1;
        }
      } else if (nextIndex >= this._keyframes.length) {
        if (this._loop) {
          nextIndex = 0;
        } else {
          this.stop();
          return;
        }
      }
      this._currentIndex = nextIndex;
      this._playNext();
    }, holdMs);
  }

  get keyframes() { return [...this._keyframes]; }
  get isPlaying() { return this._playing; }
  get currentIndex() { return this._currentIndex; }

  // ─── Serialization ────────────────────────────────────────────────────────

  toJSON() {
    return this._keyframes;
  }

  fromJSON(keyframes) {
    this._keyframes = keyframes || [];
    this._emit();
  }

  destroy() {
    this.stop();
    this._viewer = null;
  }
}
