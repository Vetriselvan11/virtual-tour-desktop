/**
 * Placement and Alignment Helpers for professional krpano-style visual editing.
 * Handles snap math, precision scaling, and angular constraints in WebGL space.
 */

// Snapping thresholds in radians
const HORIZON_SNAP_THRESHOLD = 0.045; // ~2.5 degrees
const GRID_SNAP_STEP = 15 * (Math.PI / 180); // Snap to every 15 degrees

export const placementHelpers = {
  /**
   * Snaps pitch angle to the horizon (0 radians) if within snap threshold.
   * @param {number} pitch - Pitch angle in radians
   * @param {number} [threshold=HORIZON_SNAP_THRESHOLD] - Pitch snap margin
   * @returns {number} Snapped pitch angle
   */
  snapToHorizon: (pitch, threshold = HORIZON_SNAP_THRESHOLD) => {
    if (Math.abs(pitch) < threshold) {
      return 0;
    }
    return pitch;
  },

  /**
   * Snaps a spherical angle (yaw or pitch) to the nearest grid step.
   * @param {number} angle - Input angle in radians
   * @param {number} [step=GRID_SNAP_STEP] - Snap grid interval in radians
   * @returns {number} Snapped angle
   */
  snapToGrid: (angle, step = GRID_SNAP_STEP) => {
    return Math.round(angle / step) * step;
  },

  /**
   * Applies precision dampening to raw cursor coordinates.
   * Scales down dragging deltas by 10 when precision mode is toggled.
   * @param {number} delta - Mouse drag delta movement
   * @param {boolean} isPrecisionActive - Shift key state
   * @returns {number} Adjusted delta
   */
  applyPrecision: (delta, isPrecisionActive) => {
    return isPrecisionActive ? delta / 10 : delta;
  },

  /**
   * Constraints yaw to [-PI, PI] and pitch to [-PI/2, PI/2] (spherical range limits)
   * @param {number} yaw
   * @param {number} pitch
   * @returns {Object} { yaw, pitch } bounded coordinates
   */
  clampSphericalCoordinates: (yaw, pitch) => {
    // Yaw wrapping around [-PI, PI]
    let boundedYaw = yaw;
    while (boundedYaw > Math.PI) boundedYaw -= 2 * Math.PI;
    while (boundedYaw < -Math.PI) boundedYaw += 2 * Math.PI;

    // Pitch capping between vertical bounds [-PI/2, PI/2]
    const maxPitch = Math.PI / 2 - 0.05; // Leave small margin from absolute pole
    const boundedPitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

    return { yaw: boundedYaw, pitch: boundedPitch };
  }
};
