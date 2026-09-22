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

    // 2. Configure Sprite Material with isolated rendering order
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: isHovered && app.hoverOpacity !== undefined ? app.hoverOpacity : opacity,
      rotation: rotation,
      depthTest: false,   // Prevents clipping behind panorama sphere faces
      depthWrite: false,  // Prevents z-buffer writing conflicts
    });

    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 999; // Draws overlay on top of all backdrop layers

    // 3. Compute 3D Cartesian coordinates inside safe distance zones
    const yaw = hotspot.yaw || 0;
    const pitch = hotspot.pitch || 0;
    const position = hotspotUtils.sphericalToCartesian(yaw, pitch);
    sprite.position.copy(position);

    // 4. Calibrate visual scale values
    const scaleMultiplier = app.scale !== undefined ? app.scale : 1.0;
    const hoverMultiplier = isHovered && app.hoverScale !== undefined ? app.hoverScale : 1.0;
    const baseScale = ((hotspot.size || 40) / 110) * scaleMultiplier * hoverMultiplier;
    sprite.scale.set(baseScale, baseScale, 1);
    sprite.userData = { hotspot };

    // 5. Outline ring for visual pulsing outlines
    let ring = null;
    const shouldPulse = app.pulse !== false;
    if (shouldPulse || isSelected) {
      const ringTexture = HotspotIcons.createRingTexture(app.color || hotspot.color);
      const ringMat = new THREE.SpriteMaterial({
        map: ringTexture,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.5,
        depthTest: false,
        depthWrite: false
      });
      ring = new THREE.Sprite(ringMat);
      ring.renderOrder = 998; // Behind main sprite
      ring.position.copy(sprite.position);
      ring.scale.set(baseScale * 1.35, baseScale * 1.35, 1);
      ring.userData = { hotspot, isRing: true };
    }

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

    sprite.scale.set(adjustedScale, adjustedScale, 1);
    if (ring) {
      ring.scale.set(adjustedScale * 1.35, adjustedScale * 1.35, 1);
    }
  }
}
