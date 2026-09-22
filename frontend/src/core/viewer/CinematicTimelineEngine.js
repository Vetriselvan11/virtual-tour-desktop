import gsap from 'gsap';
import { sharedAnalyticsManager } from '../analytics/AnalyticsManager.js';

/**
 * Normalizes an angle into [-PI, PI] range.
 */
export function normalizeAngle(rad) {
  const TWO_PI = Math.PI * 2;
  let angle = rad % TWO_PI;
  if (angle > Math.PI) angle -= TWO_PI;
  if (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

/**
 * Calculates the shortest angular distance from angle A to angle B (in radians).
 * Handles the 0/360 boundary gracefully without spinning 360 degrees around.
 * 
 * Example: 350 deg (6.108 rad) to 10 deg (0.174 rad) returns +20 deg (+0.349 rad).
 */
export function shortestYawDelta(fromRad, toRad) {
  const TWO_PI = Math.PI * 2;
  let diff = (toRad - fromRad) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

/**
 * Converts 3D world coordinates (x, y, z) into equirectangular spherical yaw and pitch.
 */
export function lookAtToYawPitch(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 0.0001) return { yaw: 0, pitch: 0 };
  const nx = x / len;
  const ny = y / len;
  const nz = z / len;
  const yaw = Math.atan2(nx, nz);
  const pitch = Math.asin(Math.max(-1, Math.min(1, ny)));
  return { yaw, pitch };
}

/**
 * @typedef {Object} TimelineKeyframe
 * @property {string} id - Unique keyframe ID
 * @property {string} sceneId - Target scene ID
 * @property {string} [label] - Human readable label
 * @property {number} yaw - Target yaw in radians
 * @property {number} pitch - Target pitch in radians
 * @property {number} fov - Target field of view in degrees
 * @property {number} duration - Transition duration to reach this keyframe (seconds)
 * @property {number} [hold=0] - Hold duration in seconds after reaching keyframe
 * @property {string} [easing='power2.inOut'] - GSAP easing curve
 * @property {Array<{ type: string, target?: string, payload?: any }>} [events] - Action triggers
 */

/**
 * CinematicTimelineEngine
 * High-performance, GSAP-driven multi-scene cinematic camera sequencer.
 */
export class CinematicTimelineEngine {
  /**
   * @param {Object} options
   * @param {Object} options.viewerCore - Active ViewerCore instance
   * @param {Function} options.onSceneChange - Callback to trigger scene change in UI / SceneManager
   * @param {Function} [options.onTimeUpdate] - Playback time update callback (time, duration, progress)
   * @param {Function} [options.onKeyframeChange] - Active keyframe index change callback
   * @param {Function} [options.onStateChange] - Playback state change callback (isPlaying, isPaused)
   * @param {Function} [options.onEventTrigger] - Timeline event trigger callback
   */
  constructor({
    viewerCore,
    onSceneChange,
    onTimeUpdate,
    onKeyframeChange,
    onStateChange,
    onEventTrigger
  } = {}) {
    this.viewer = viewerCore;
    this.onSceneChange = onSceneChange;
    this.onTimeUpdate = onTimeUpdate;
    this.onKeyframeChange = onKeyframeChange;
    this.onStateChange = onStateChange;
    this.onEventTrigger = onEventTrigger;

    /** @type {TimelineKeyframe[]} */
    this.keyframes = [];
    this.loop = false;
    this.isPlayingState = false;
    this.isPausedState = false;

    // Timeline execution state
    this.currentTime = 0;
    this.totalDuration = 0;
    this.currentKeyframeIndex = 0;
    this.activeTween = null;
    this.holdTimeout = null;
    this._rafId = null;
    this._timelineStartTime = 0;
    this._pauseTime = 0;

    // Keyframe time offsets map
    this._timeSegments = [];
  }

  /**
   * Loads timeline keyframes from JSON array or legacy guidedTour structure.
   * @param {Array|Object} data - Keyframes array or tour object
   */
  load(data) {
    this.stop();

    if (!data) {
      this.keyframes = [];
      this._recalculateSegments();
      return;
    }

    let rawList = [];

    if (Array.isArray(data)) {
      rawList = data;
    } else if (data.cinematicTour && Array.isArray(data.cinematicTour.keyframes)) {
      rawList = data.cinematicTour.keyframes;
      this.loop = Boolean(data.cinematicTour.loop);
    } else if (Array.isArray(data.keyframes)) {
      rawList = data.keyframes;
    } else if (data.guidedTour && Array.isArray(data.guidedTour.keyframes)) {
      rawList = data.guidedTour.keyframes;
    }

    // Normalize keyframe schema
    this.keyframes = rawList.map((kf, index) => {
      const duration = kf.duration !== undefined ? Math.max(0.5, parseFloat(kf.duration)) : 3.0;
      const hold = kf.hold !== undefined ? Math.max(0, parseFloat(kf.hold)) : 0;
      const yaw = kf.yaw !== undefined ? parseFloat(kf.yaw) : 0;
      const pitch = kf.pitch !== undefined ? parseFloat(kf.pitch) : 0;
      const fov = kf.fov !== undefined ? parseFloat(kf.fov) : 80;
      const easing = kf.easing || kf.ease || 'power2.inOut';
      const events = Array.isArray(kf.events) ? kf.events : [];

      return {
        id: kf.id || `kf_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        sceneId: kf.sceneId || '',
        label: kf.label || `Shot ${index + 1}`,
        yaw,
        pitch,
        fov,
        duration,
        hold,
        easing,
        events
      };
    });

    this._recalculateSegments();
  }

  /**
   * Recalculates start and end timestamps for each keyframe segment.
   * @private
   */
  _recalculateSegments() {
    this._timeSegments = [];
    let accumulatedTime = 0;

    this.keyframes.forEach((kf, index) => {
      const segDuration = (index === 0 && kf.duration === 0) ? 0.001 : kf.duration;
      const totalSegTime = segDuration + (kf.hold || 0);

      this._timeSegments.push({
        index,
        startTime: accumulatedTime,
        transitionEndTime: accumulatedTime + segDuration,
        endTime: accumulatedTime + totalSegTime,
        duration: segDuration,
        hold: kf.hold || 0,
        keyframe: kf
      });

      accumulatedTime += totalSegTime;
    });

    this.totalDuration = accumulatedTime;
    this._emitTimeUpdate();
  }

  /**
   * Captures current viewer orientation and scene as a new keyframe.
   */
  addKeyframeFromCurrent(label = '', duration = 3.0) {
    if (!this.viewer) return null;

    const yaw = this.viewer.getYaw ? this.viewer.getYaw() : (this.viewer.targetTheta || 0);
    const pitch = this.viewer.getPitch ? this.viewer.getPitch() : (Math.PI / 2 - (this.viewer.targetPhi || Math.PI / 2));
    const fov = this.viewer.camera?.fov || this.viewer.fov || 80;
    const sceneId = this.viewer.sceneManager?.currentSceneId || '';

    const newKf = {
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sceneId,
      label: label || `Shot ${this.keyframes.length + 1}`,
      yaw,
      pitch,
      fov,
      duration: Math.max(0.5, duration),
      hold: 0,
      easing: 'power2.inOut',
      events: []
    };

    this.keyframes.push(newKf);
    this._recalculateSegments();
    return newKf;
  }

  /**
   * Updates an existing keyframe by ID.
   */
  updateKeyframe(id, updates) {
    const idx = this.keyframes.findIndex((k) => k.id === id);
    if (idx === -1) return;

    this.keyframes[idx] = { ...this.keyframes[idx], ...updates };
    this._recalculateSegments();
  }

  /**
   * Removes a keyframe by ID.
   */
  removeKeyframe(id) {
    this.keyframes = this.keyframes.filter((k) => k.id !== id);
    this._recalculateSegments();
  }

  /**
   * Reorders keyframes.
   */
  reorderKeyframes(newKeyframes) {
    this.keyframes = newKeyframes;
    this._recalculateSegments();
  }

  // ─── Playback Controls ──────────────────────────────────────────────────────

  /**
   * Starts or resumes playback of the cinematic tour.
   */
  play({ loop = false, startTime = null } = {}) {
    if (this.keyframes.length === 0) return;

    this.loop = loop !== undefined ? loop : this.loop;

    if (this.isPausedState) {
      this.resume();
      return;
    }

    this.stop();
    this.isPlayingState = true;
    this.isPausedState = false;

    sharedAnalyticsManager.trackCinematic('cinematic_start', {
      duration: this.totalDuration,
      startTime: startTime || 0
    });

    if (this.onStateChange) this.onStateChange(true, false);

    const startAt = startTime !== null ? Math.max(0, Math.min(this.totalDuration, startTime)) : 0;
    this._executeFromTime(startAt);
  }

  /**
   * Pauses timeline playback.
   */
  pause() {
    if (!this.isPlayingState || this.isPausedState) return;

    this.isPausedState = true;
    if (this.activeTween) this.activeTween.pause();
    if (this.holdTimeout) {
      clearTimeout(this.holdTimeout);
      this.holdTimeout = null;
    }

    sharedAnalyticsManager.trackCinematic('cinematic_pause', {
      currentTime: Number(this.currentTime.toFixed(2)),
      duration: this.totalDuration
    });

    if (this.onStateChange) this.onStateChange(true, true);
  }

  /**
   * Resumes timeline playback from paused state.
   */
  resume() {
    if (!this.isPlayingState || !this.isPausedState) return;

    this.isPausedState = false;
    if (this.activeTween) {
      this.activeTween.resume();
    } else {
      this._executeFromTime(this.currentTime);
    }

    if (this.onStateChange) this.onStateChange(true, false);
  }

  /**
   * Stops timeline playback and resets to beginning.
   */
  stop() {
    this.isPlayingState = false;
    this.isPausedState = false;

    if (this.activeTween) {
      this.activeTween.kill();
      this.activeTween = null;
    }
    if (this.holdTimeout) {
      clearTimeout(this.holdTimeout);
      this.holdTimeout = null;
    }

    this.currentTime = 0;
    this._emitTimeUpdate();

    if (this.onStateChange) this.onStateChange(false, false);
  }

  /**
   * Restarts timeline from timestamp 0.
   */
  restart() {
    this.stop();
    this.play({ loop: this.loop, startTime: 0 });
  }

  /**
   * Seeks to a specific timestamp in the timeline.
   * @param {number} timeSeconds
   */
  seek(timeSeconds) {
    const clamped = Math.max(0, Math.min(this.totalDuration, timeSeconds));
    this.currentTime = clamped;

    const segment = this._findSegmentAtTime(clamped);
    if (!segment) {
      this._emitTimeUpdate();
      return;
    }

    this.currentKeyframeIndex = segment.index;
    if (this.onKeyframeChange) this.onKeyframeChange(segment.index, segment.keyframe);

    // Apply scene switch if needed
    if (segment.keyframe.sceneId && this.onSceneChange) {
      const curSceneId = this.viewer?.sceneManager?.currentSceneId;
      if (curSceneId !== segment.keyframe.sceneId) {
        this.onSceneChange(segment.keyframe.sceneId);
      }
    }

    // Calculate interpolated orientation at this exact timestamp
    const prevSeg = segment.index > 0 ? this._timeSegments[segment.index - 1] : null;
    const startYaw = prevSeg ? prevSeg.keyframe.yaw : (this.viewer?.getYaw ? this.viewer.getYaw() : 0);
    const startPitch = prevSeg ? prevSeg.keyframe.pitch : (this.viewer?.getPitch ? this.viewer.getPitch() : 0);
    const startFov = prevSeg ? prevSeg.keyframe.fov : 80;

    const segTime = clamped - segment.startTime;
    const progress = segment.duration > 0 ? Math.min(1.0, segTime / segment.duration) : 1.0;

    // Shortest path yaw delta
    const deltaYaw = shortestYawDelta(startYaw, segment.keyframe.yaw);
    const currentYaw = startYaw + deltaYaw * progress;
    const currentPitch = startPitch + (segment.keyframe.pitch - startPitch) * progress;
    const currentFov = startFov + (segment.keyframe.fov - startFov) * progress;

    if (this.viewer && this.viewer.setCameraOrientation) {
      this.viewer.setCameraOrientation(currentYaw, currentPitch, currentFov);
    }

    this._emitTimeUpdate();

    // If currently playing, continue playback from this position
    if (this.isPlayingState && !this.isPausedState) {
      if (this.activeTween) this.activeTween.kill();
      if (this.holdTimeout) clearTimeout(this.holdTimeout);
      this._executeSegment(segment.index, segTime);
    }
  }

  // ─── Timeline Execution Engine ──────────────────────────────────────────────

  /**
   * Finds the time segment corresponding to a timestamp.
   * @private
   */
  _findSegmentAtTime(time) {
    if (this._timeSegments.length === 0) return null;
    for (const seg of this._timeSegments) {
      if (time >= seg.startTime && time <= seg.endTime) {
        return seg;
      }
    }
    return this._timeSegments[this._timeSegments.length - 1];
  }

  /**
   * Executes timeline starting from a specific timestamp.
   * @private
   */
  _executeFromTime(time) {
    const segment = this._findSegmentAtTime(time);
    if (!segment) {
      this.stop();
      return;
    }

    const elapsedInSeg = time - segment.startTime;
    this._executeSegment(segment.index, elapsedInSeg);
  }

  /**
   * Executes a specific keyframe segment with shortest-path orientation interpolation.
   * @private
   */
  _executeSegment(segmentIndex, elapsedOffset = 0) {
    if (!this.isPlayingState || this.isPausedState) return;

    if (segmentIndex >= this._timeSegments.length) {
      if (this.loop) {
        this.restart();
      } else {
        this.stop();
      }
      return;
    }

    const segment = this._timeSegments[segmentIndex];
    const kf = segment.keyframe;
    this.currentKeyframeIndex = segmentIndex;

    if (this.onKeyframeChange) this.onKeyframeChange(segmentIndex, kf);

    // 1. Trigger scene change if entering a different scene
    if (kf.sceneId && this.onSceneChange) {
      const curSceneId = this.viewer?.sceneManager?.currentSceneId;
      if (curSceneId !== kf.sceneId) {
        this.onSceneChange(kf.sceneId);
      }
    }

    // 2. Dispatch events attached to this keyframe
    if (kf.events && kf.events.length > 0 && this.onEventTrigger) {
      kf.events.forEach((evt) => {
        try {
          this.onEventTrigger(evt, kf);
        } catch {}
      });
    }

    // 3. Determine starting camera parameters
    const prevSeg = segmentIndex > 0 ? this._timeSegments[segmentIndex - 1] : null;
    const startYaw = prevSeg
      ? prevSeg.keyframe.yaw
      : (this.viewer?.getYaw ? this.viewer.getYaw() : (this.viewer?.spherical?.theta || 0));
    const startPitch = prevSeg
      ? prevSeg.keyframe.pitch
      : (this.viewer?.getPitch ? this.viewer.getPitch() : 0);
    const startFov = prevSeg ? prevSeg.keyframe.fov : (this.viewer?.camera?.fov || 80);

    // 4. Calculate shortest-path yaw delta
    const deltaYaw = shortestYawDelta(startYaw, kf.yaw);
    const targetYaw = startYaw + deltaYaw;
    const targetPitch = kf.pitch;
    const targetFov = kf.fov;

    const remainingDuration = Math.max(0.05, segment.duration - elapsedOffset);
    const initialProgress = elapsedOffset / Math.max(0.01, segment.duration);

    // GSAP Tween Proxy
    const tweenObj = {
      progress: initialProgress
    };

    if (this.activeTween) this.activeTween.kill();

    this.activeTween = gsap.to(tweenObj, {
      progress: 1.0,
      duration: remainingDuration,
      ease: kf.easing || 'power2.inOut',
      onUpdate: () => {
        if (!this.isPlayingState) return;

        const p = tweenObj.progress;
        const currentYaw = startYaw + deltaYaw * p;
        const currentPitch = startPitch + (targetPitch - startPitch) * p;
        const currentFov = startFov + (targetFov - startFov) * p;

        if (this.viewer && this.viewer.setCameraOrientation) {
          this.viewer.setCameraOrientation(currentYaw, currentPitch, currentFov);
        }

        this.currentTime = segment.startTime + p * segment.duration;
        this._emitTimeUpdate();
      },
      onComplete: () => {
        if (!this.isPlayingState) return;

        // Snap precisely to target on completion
        if (this.viewer && this.viewer.setCameraOrientation) {
          this.viewer.setCameraOrientation(targetYaw, targetPitch, targetFov);
        }

        this.currentTime = segment.transitionEndTime;
        this._emitTimeUpdate();

        // 5. Handle keyframe hold time before advancing
        const holdDurationSec = kf.hold || 0;
        if (holdDurationSec > 0) {
          const holdMs = holdDurationSec * 1000;
          this.holdTimeout = setTimeout(() => {
            if (!this.isPlayingState) return;
            this.currentTime = segment.endTime;
            this._emitTimeUpdate();
            this._executeSegment(segmentIndex + 1, 0);
          }, holdMs);
        } else {
          this._executeSegment(segmentIndex + 1, 0);
        }
      }
    });
  }

  /**
   * Dispatches time update notification to listeners.
   * @private
   */
  _emitTimeUpdate() {
    if (this.onTimeUpdate) {
      const progress = this.totalDuration > 0 ? this.currentTime / this.totalDuration : 0;
      this.onTimeUpdate(this.currentTime, this.totalDuration, progress);
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  getCurrentTime() { return this.currentTime; }
  getDuration() { return this.totalDuration; }
  getProgress() { return this.totalDuration > 0 ? this.currentTime / this.totalDuration : 0; }
  isPlaying() { return this.isPlayingState; }
  isPaused() { return this.isPausedState; }
  getCurrentKeyframe() { return this.keyframes[this.currentKeyframeIndex] || null; }

  // ─── Serialization & Persistence ───────────────────────────────────────────

  toJSON() {
    return {
      enabled: this.keyframes.length > 0,
      loop: this.loop,
      totalDuration: this.totalDuration,
      keyframes: this.keyframes
    };
  }

  destroy() {
    this.stop();
    this.viewer = null;
    this.keyframes = [];
    this._timeSegments = [];
  }
}

export default CinematicTimelineEngine;
