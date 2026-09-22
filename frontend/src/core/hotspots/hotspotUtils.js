import * as THREE from 'three';

/**
 * Spatial Mathematics and Coordinate Projection Helpers for WoX BUILDER Hotspots.
 * Solves 3D spherical positions and enforces distance safe-zones to prevent sphere clipping.
 */

// Permanent concentric safe offset radius (prevents z-buffer clipping against background sphere of radius 5.0)
export const HOTSPOT_SAFE_RADIUS = 4.78; 

// Scratch vectors for zero-allocation mathematical transformations
const _scratchVec3 = new THREE.Vector3();
const _scratchDir = new THREE.Vector3();

export const hotspotUtils = {
  /**
   * Translates spherical angles (yaw/pitch) into a 3D cartesian position vector.
   * @param {number} yaw - Horizontal angle in radians
   * @param {number} pitch - Vertical angle in radians
   * @param {number} [radius=HOTSPOT_SAFE_RADIUS] - Spatial offset from camera origin
   * @param {THREE.Vector3} [targetVector=null] - Optional target vector to populate without allocating
   * @returns {THREE.Vector3} Position vector
   */
  sphericalToCartesian: (yaw, pitch, radius = HOTSPOT_SAFE_RADIUS, targetVector = null) => {
    const x = radius * Math.cos(pitch) * Math.sin(yaw);
    const y = radius * Math.sin(pitch);
    const z = radius * Math.cos(pitch) * Math.cos(yaw);
    if (targetVector) {
      targetVector.set(x, y, z);
      return targetVector;
    }
    return new THREE.Vector3(x, y, z);
  },

  /**
   * Translates a 3D cartesian position vector back into spherical angles (yaw/pitch).
   * @param {THREE.Vector3} vector - Cartesian coordinates vector
   * @returns {Object} { yaw, pitch } angles in radians
   */
  cartesianToSpherical: (vector) => {
    _scratchDir.copy(vector).normalize();
    const yaw = Math.atan2(_scratchDir.x, _scratchDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, _scratchDir.y)));
    return { yaw, pitch };
  },

  /**
   * Projects a 3D position vector into 2D screenspace coordinate points.
   * @param {THREE.Vector3} position - 3D position vector
   * @param {THREE.Camera} camera - Three.js active camera
   * @param {DOMRect} rect - Viewport element boundaries bounding rect
   * @returns {Object} { x, y } screenspace coordinates
   */
  projectToScreenspace: (position, camera, rect) => {
    _scratchVec3.copy(position).project(camera);
    const x = (_scratchVec3.x * 0.5 + 0.5) * rect.width;
    const y = -(_scratchVec3.y * 0.5 - 0.5) * rect.height;
    return { x, y };
  }
};
