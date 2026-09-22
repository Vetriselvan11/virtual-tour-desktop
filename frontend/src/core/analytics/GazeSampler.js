/**
 * Low-Overhead Gaze / Orientation Sampler.
 * Decoupled from the 60 FPS WebGL render loop.
 * Samples camera orientation at throttled intervals with angular movement thresholding.
 */
export default class GazeSampler {
  /**
   * @param {Object} options
   * @param {Object} options.viewerCore - Reference to ViewerCore or viewer ref
   * @param {Object} options.analyticsManager - Reference to AnalyticsManager
   * @param {number} options.sampleIntervalMs - Sampling timer interval in ms (default 500ms)
   * @param {number} options.minAngleDeltaDeg - Minimum angular delta required to trigger a sample (default 1.5°)
   */
  constructor({
    viewerCore,
    analyticsManager,
    sampleIntervalMs = 500,
    minAngleDeltaDeg = 1.5
  }) {
    this.viewer = viewerCore;
    this.analytics = analyticsManager;
    this.intervalMs = Math.max(200, Math.min(2000, sampleIntervalMs));
    this.minAngleDelta = (minAngleDeltaDeg * Math.PI) / 180; // convert to radians

    this.timer = null;
    this.lastSampledYaw = null;
    this.lastSampledPitch = null;
    this.lastSampleTime = Date.now();
    this.currentSceneId = null;
    this.active = false;
  }

  setViewer(viewerCore) {
    this.viewer = viewerCore;
  }

  setScene(sceneId) {
    this.currentSceneId = sceneId;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.lastSampleTime = Date.now();

    this.timer = setInterval(() => {
      this._sample();
    }, this.intervalMs);
  }

  stop() {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Samples current camera orientation.
   * @private
   */
  _sample() {
    if (!this.active || !this.viewer || !this.analytics) return;

    let yawRad = 0;
    let pitchRad = 0;

    // Read orientation from ViewerCore spherical angles
    if (this.viewer.spherical) {
      yawRad = this.viewer.spherical.theta || 0;
      // spherical.phi: 0 is up (+90° pitch), PI/2 is horizon (0° pitch), PI is down (-90° pitch)
      const phi = this.viewer.spherical.phi !== undefined ? this.viewer.spherical.phi : Math.PI / 2;
      pitchRad = Math.PI / 2 - phi;
    } else if (typeof this.viewer.getYaw === 'function') {
      yawRad = this.viewer.getYaw();
      pitchRad = typeof this.viewer.getPitch === 'function' ? this.viewer.getPitch() : 0;
    } else {
      return;
    }

    // Convert to degrees
    let yawDeg = (yawRad * 180) / Math.PI;
    let pitchDeg = (pitchRad * 180) / Math.PI;

    // Normalize yaw to [0, 360)
    yawDeg = ((yawDeg % 360) + 360) % 360;
    // Clamp pitch to [-90, +90]
    pitchDeg = Math.max(-90, Math.min(90, pitchDeg));

    const now = Date.now();
    const duration = Math.max(0.1, (now - this.lastSampleTime) / 1000);
    this.lastSampleTime = now;

    // Check if camera moved significantly or if maximum dwell time elapsed
    if (
      this.lastSampledYaw !== null &&
      this.lastSampledPitch !== null
    ) {
      const dYaw = Math.abs(yawDeg - this.lastSampledYaw);
      const shortestYawDiff = Math.min(dYaw, 360 - dYaw);
      const dPitch = Math.abs(pitchDeg - this.lastSampledPitch);

      // If angle delta is tiny and duration is short, skip redundant duplicate
      if (shortestYawDiff < 1.0 && dPitch < 1.0 && duration < 1.5) {
        return;
      }
    }

    this.lastSampledYaw = yawDeg;
    this.lastSampledPitch = pitchDeg;

    this.analytics.trackGazeSample(
      this.currentSceneId,
      yawDeg,
      pitchDeg,
      duration
    );
  }

  destroy() {
    this.stop();
    this.viewer = null;
    this.analytics = null;
  }
}
