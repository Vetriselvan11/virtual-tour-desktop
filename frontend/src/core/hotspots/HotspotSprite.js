import * as THREE from 'three';
import { HotspotIcons } from './HotspotIcons';
import { hotspotUtils } from './hotspotUtils';

/**
 * Three.js Sprite Mesh Builder for WoX BUILDER.
 * Configures rendering pipelines (depthTest = false, renderOrder = 999)
 * and calculates stable zoom-scaling offsets (billboard preservation).
 */
export default class HotspotSprite {
  /**
   * Instantiates a stable 3D Sprite mesh.
   * @param {Object} hotspot - Hotspot configuration parameters
   * @param {boolean} isSelected - Active selection state
   * @param {boolean} isHovered - Hover highlight state
   * @returns {Object} { sprite, ring } Three.js sprite meshes
   */
  static create(hotspot, isSelected, isHovered) {
    // 1. Generate crisp high-resolution Canvas textures
    const texture = HotspotIcons.createTexture(hotspot, isHovered, isSelected);
    
    const app = hotspot.appearance || {};
    const opacity = app.opacity !== undefined ? app.opacity : (hotspot.opacity !== undefined ? hotspot.opacity : 0.9);
    const rotation = app.rotation || 0;

    // 2. Configure Mesh Material with isolated rendering order
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: opacity,
      depthTest: false,   // Prevents clipping behind panorama sphere faces
      depthWrite: false,  // Prevents z-buffer writing conflicts
      side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    const sprite = new THREE.Mesh(geometry, material);
    sprite.renderOrder = 999; // Draws overlay on top of all backdrop layers

    // 3. Compute 3D Cartesian coordinates inside safe distance zones
    const yaw = hotspot.yaw || 0;
    const pitch = hotspot.pitch || 0;
    const position = hotspotUtils.sphericalToCartesian(yaw, pitch);
    sprite.position.copy(position);
    
    // Orient flat against the spherical panorama and apply rotation
    sprite.lookAt(0, 0, 0);
    sprite.rotateZ(rotation);

    // 4. Calibrate visual scale values
    const scaleMultiplier = Number(app.scale !== undefined ? app.scale : 1.0) || 1.0;
    const baseScale = (Number(hotspot.size || 40) / 110) * scaleMultiplier;
    const scaleFactor = Number(texture.userData && texture.userData.scaleFactor ? texture.userData.scaleFactor : 2) || 2;
    
    if (!isNaN(baseScale) && !isNaN(scaleFactor) && baseScale > 0) {
      sprite.scale.set(baseScale * scaleFactor, baseScale * scaleFactor, 1);
    } else {
      sprite.scale.set(1, 1, 1);
    }
    sprite.userData = { hotspot };

    // 5. Outline ring removed as per user request
    let ring = null;

    return { sprite, ring };
  } 

  /**
   * Enforces stable billboard screenspace dimensions on camera zooms.
   * Prevents pixelation or massive magnification when zooming in.
   * @param {THREE.Sprite} sprite - Hotspot sprite mesh
   * @param {THREE.Sprite} ring - Pulsing outline ring sprite mesh
   * @param {THREE.Camera} camera - Active camera
   * @param {number} baseScale - Base scale parameter
   */
  static applyBillboardZoomScaling(sprite, ring, camera, baseScale) {
    if (!sprite || !camera) return;

    // Normalise scale relative to base perspective FOV (75 degrees)
    const zoomCompensation = camera.fov / 75.0;
    const adjustedScale = baseScale * zoomCompensation;
    sprite.scale.set(adjustedScale * 2, adjustedScale * 2, 1);
    if (ring) {
      ring.scale.set(adjustedScale * 1.35, adjustedScale * 1.35, 1);
    }
  }
}
