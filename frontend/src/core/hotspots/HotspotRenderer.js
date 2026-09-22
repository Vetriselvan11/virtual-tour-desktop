import * as THREE from 'three';
import HotspotSprite from './HotspotSprite';
import { HotspotIcons } from './HotspotIcons';
import { HotspotAnimations } from './HotspotAnimations';

/**
 * Unified Hotspot Scene Renderer and Manager for WoX BUILDER.
 * Orchestrates sprite lifecycles, zoom-stabilization bilboarding,
 * and high-fidelity modular micro-animations in Three.js.
 */
export default class HotspotRenderer {
  constructor(scene, camera, renderLoop, stateManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.renderLoop = renderLoop;
    this.stateManager = stateManager;
    this.meshes = []; // List of currently active { sprite, ring, hotspot } objects
    
    this.selectedIds = new Set();
    this.hoveredId = null;
    this._inViewHotspots = new Set();
    this.onEnterView = null; // Callback: (hotspot) => void

    // Last known list of hotspots for reactive visibility refreshes
    this._lastList = [];

    if (this.stateManager) {
      this._unsubscribeState = this.stateManager.subscribe(() => {
        if (this._lastList && this._lastList.length > 0) {
          this.rebuild(this._lastList, Array.from(this.selectedIds));
        }
      });
    }

    // Registers all tickers (guided pans, floating sinus, spins, glows, zoom billboarding, enter-view)
    this.registerTicker();
  }

  /**
   * Rebuilds hotspot meshes inside the Three.js Scene.
   * @param {Array} list - Hotspot configuration items list
   * @param {string|Array} selectedIds - Selected hotspot ID(s)
   */
  rebuild(list, selectedIds = []) {
    this.clear();
    this._lastList = list || [];
    const ids = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);
    this.selectedIds = new Set(ids);

    this._lastList.forEach((hs) => {
      // Visibility check from state manager
      if (this.stateManager && !this.stateManager.isHotspotVisible(hs)) {
        return;
      }

      const isSelected = this.selectedIds.has(hs.id);
      const isHovered = hs.id === this.hoveredId;

      const { sprite, ring } = HotspotSprite.create(hs, isSelected, isHovered);

      this.scene.add(sprite);
      if (ring) this.scene.add(ring);

      this.meshes.push({ sprite, ring, hotspot: hs });
    });

    if (this.renderLoop) {
      this.renderLoop.requestRender(3);
    }
  }

  /**
   * Modifies a single hotspot in-place without rebuilding others.
   * @param {Object} updatedHs - Modified hotspot
   * @param {string|Array} selectedIds - Selected ID(s)
   */
  updateInPlace(updatedHs, selectedIds = []) {
    const match = this.meshes.find((m) => m.hotspot.id === updatedHs.id);
    if (!match) return;

    // Remove old visual elements from scene
    this.scene.remove(match.sprite);
    if (match.ring) this.scene.remove(match.ring);

    // Dispose old memory contexts
    if (match.sprite.material) {
      if (match.sprite.material.map) match.sprite.material.map.dispose();
      match.sprite.material.dispose();
    }
    if (match.ring && match.ring.material) {
      match.ring.material.dispose();
    }

    // Recreate meshes in-place
    const ids = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);
    this.selectedIds = new Set(ids);
    
    const isSelected = this.selectedIds.has(updatedHs.id);
    const isHovered = updatedHs.id === this.hoveredId;
    const { sprite, ring } = HotspotSprite.create(updatedHs, isSelected, isHovered);

    this.scene.add(sprite);
    if (ring) this.scene.add(ring);

    match.sprite = sprite;
    match.ring = ring;
    match.hotspot = updatedHs;

    if (this.renderLoop) {
      this.renderLoop.requestRender(3);
    }
  }

  /**
   * Registers frame-timed tickers to animate outlines, float chevrons,
   * and apply stable distance zoom-scaling on every frame.
   */
  registerTicker() {
    this.renderLoop.registerHook('hotspot_render_animations', (time) => {
      if (!this.meshes || this.meshes.length === 0) return false;

      this.meshes.forEach(({ sprite, ring, hotspot }) => {
        if (!sprite) return;

        const isSelected = this.selectedIds.has(hotspot.id);
        const baseScale = (hotspot.size || 40) / 110;

        // 1. Zoom Compensation: Keep screenspace size stable during scrolls
        HotspotSprite.applyBillboardZoomScaling(sprite, ring, this.camera, baseScale);

        // 2. Selection Ring Spin: Slowly rotate selected indicators
        if (isSelected && ring && ring.material) {
          ring.material.rotation = time * 0.48;
        }

        // 3. Subtle Sinus Floating (waves pitch slightly, disabled if hotspot position locked)
        let waveOffset = 0;
        if (!hotspot.locked) {
          waveOffset = Math.sin(time * 2.0 + hotspot.yaw) * 0.022;
        }
        const yaw = hotspot.yaw || 0;
        const pitch = (hotspot.pitch || 0) + waveOffset * 0.12;
        const r = 4.78; // Offset radius boundaries

        // Direct mathematical vector translations
        sprite.position.x = r * Math.cos(pitch) * Math.sin(yaw);
        sprite.position.y = r * Math.sin(pitch);
        sprite.position.z = r * Math.cos(pitch) * Math.cos(yaw);

        if (ring) {
          ring.position.copy(sprite.position);
        }

        // 4. Ripple Glowing: Pulse halos smoothly
        if (ring && ring.material) {
          const pulseScale = isSelected ? 1.5 : 1.35;
          const pulse = (baseScale * pulseScale) * (1.1 + 0.25 * Math.sin(time * 4.6));
          ring.scale.set(pulse, pulse, 1);
          ring.material.opacity = (isSelected ? 0.45 : 0.2) + 0.3 * Math.sin(time * 4.6);
        }

        // 5. Enter-View Angular Crossing Trigger Check
        if (this.onEnterView && this.camera) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          const hsDir = sprite.position.clone().normalize();
          const angle = camDir.angleTo(hsDir);
          const fovRad = (this.camera.fov * Math.PI) / 180;
          const isInside = angle < (fovRad * 0.45);

          if (isInside && !this._inViewHotspots.has(hotspot.id)) {
            this._inViewHotspots.add(hotspot.id);
            try {
              this.onEnterView(hotspot);
            } catch (err) {
              console.warn('[HotspotRenderer] onEnterView error:', err);
            }
          } else if (!isInside && this._inViewHotspots.has(hotspot.id)) {
            this._inViewHotspots.delete(hotspot.id);
          }
        }
      });

      // Do NOT demand continuous RAF when idle — allows render loop to enter power-saving sleep
      return false;
    });
  }

  /**
   * Sets cursor hover states and triggers smooth scale interpolations.
   * @param {string} hoverId - Hovered hotspot ID
   */
  setHoverState(hoverId) {
    if (this.hoveredId === hoverId) return;

    // Restore previous hover scales
    if (this.hoveredId) {
      const prev = this.meshes.find((m) => m.hotspot.id === this.hoveredId);
      if (prev) {
        const app = prev.hotspot.appearance || {};
        const baseScale = ((prev.hotspot.size || 40) / 110) * (app.scale || 1.0);
        HotspotAnimations.interpolateHoverScale(prev.sprite, baseScale, false);
      }
    }

    this.hoveredId = hoverId;

    // Apply scale expansions on hover
    if (hoverId) {
      const match = this.meshes.find((m) => m.hotspot.id === hoverId);
      if (match) {
        const app = match.hotspot.appearance || {};
        const baseScale = ((match.hotspot.size || 40) / 110) * (app.scale || 1.0);
        HotspotAnimations.interpolateHoverScale(match.sprite, baseScale, true);
      }
    }

    if (this.renderLoop) {
      this.renderLoop.requestRender(10);
    }
  }

  /**
   * Removes all active hotspot elements and releases GPU resources.
   */
  clear() {
    this.meshes.forEach(({ sprite, ring }) => {
      this.scene.remove(sprite);
      if (ring) this.scene.remove(ring);

      if (sprite && sprite.material) {
        if (sprite.material.map) {
          try { sprite.material.map.dispose(); } catch (e) { /* ignore */ }
        }
        try { sprite.material.dispose(); } catch (e) { /* ignore */ }
      }
      if (ring && ring.material) {
        try { ring.material.dispose(); } catch (e) { /* ignore */ }
      }
    });
    this.meshes = [];
    this._inViewHotspots.clear();
    if (this.renderLoop) {
      this.renderLoop.requestRender(1);
    }
  }

  /**
   * Destroys animation hooks and releases GPU resources on renderer unmount.
   */
  destroy() {
    this.clear();
    if (this._unsubscribeState) {
      this._unsubscribeState();
      this._unsubscribeState = null;
    }
    this.renderLoop.unregisterHook('hotspot_render_animations');
    HotspotIcons.clearRingCache();
  }
}

