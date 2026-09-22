import * as THREE from 'three';
import { message } from 'antd';
import HotspotRenderer from '../hotspots/HotspotRenderer';
import { hotspotUtils, HOTSPOT_SAFE_RADIUS } from '../hotspots/hotspotUtils';

const _scratchHitDir = new THREE.Vector3();

/**
 * Decoupled Interaction and Drag Manager for WoX BUILDER.
 * Intercepts user pointer events and snaps hotspot coordinates live,
 * delegating all actual WebGL mesh compositions and dynamic zoom bilboarding
 * to the modular HotspotRenderer.
 */
export default class HotspotManager {
  constructor(scene, camera, renderLoop, stateManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.renderLoop = renderLoop;
    this.stateManager = stateManager;

    // Instantiate modular hotspots renderer
    this.renderer = new HotspotRenderer(scene, camera, renderLoop, stateManager);

    // Keep direct meshes pointer to preserve absolute backward compatibility
    this.meshes = this.renderer.meshes;
    
    // Dragging & Hover Interaction states
    this.hovered = null;
    this.draggedId = null;
    this.isDragging = false;
    this.originalYaw = 0;
    this.originalPitch = 0;
    this.dragStartYaw = 0;
    this.dragStartPitch = 0;
    this.dragDistance = 0;
    this.selectedDragTargets = [];

    // Callbacks
    this.onHotspotClick = null;
    this.onHotspotHover = null;
    this.onHotspotDragUpdate = null;
    this.onHotspotEnterView = null;
  }

  setCallbacks({ onClick, onHover, onDragUpdate, onEnterView }) {
    this.onHotspotClick = onClick;
    this.onHotspotHover = onHover;
    this.onHotspotDragUpdate = onDragUpdate;
    this.onHotspotEnterView = onEnterView;
    if (this.renderer) {
      this.renderer.onEnterView = onEnterView;
    }
  }

  /**
   * Delegates mesh composition to HotspotRenderer.
   */
  rebuild(list, selectedIds) {
    this.renderer.rebuild(list, selectedIds);
    this.meshes = this.renderer.meshes;
    this._cachedSprites = this.meshes.map((m) => m.sprite);
  }

  /**
   * Modifies a single hotspot in-place without rebuilding others.
   */
  updateInPlace(updatedHs, selectedIds) {
    this.renderer.updateInPlace(updatedHs, selectedIds);
    this.meshes = this.renderer.meshes;
    this._cachedSprites = this.meshes.map((m) => m.sprite);
  }

  _getActiveSprites() {
    if (!this._cachedSprites || this._cachedSprites.length !== this.meshes.length) {
      this._cachedSprites = this.meshes.map((m) => m.sprite);
    }
    return this._cachedSprites;
  }

  /**
   * Pointer movement: highlights hovered nodes and converts Screenspace bounds.
   */
  handleMouseMove(mouseVec, raycaster, rect) {
    if (this.isDragging) return false;

    raycaster.setFromCamera(mouseVec, this.camera);
    const activeSprites = this._getActiveSprites();
    const intersects = raycaster.intersectObjects(activeSprites);

    if (intersects.length > 0) {
      const hitSprite = intersects[0].object;
      const hs = hitSprite.userData.hotspot;

      this.renderer.setHoverState(hs.id);

      if (!this.hovered || this.hovered.id !== hs.id) {
        this.hovered = hs;

        // Project 3D vector coordinates to check Screenspace position
        const screenPos = hotspotUtils.projectToScreenspace(hitSprite.position, this.camera, rect);

        if (this.onHotspotHover) {
          this.onHotspotHover(hs, screenPos);
        }
      }
      return true;
    } else {
      this.renderer.setHoverState(null);
      if (this.hovered) {
        this.hovered = null;
        if (this.onHotspotHover) this.onHotspotHover(null, null);
      }
      return false;
    }
  }

  /**
   * Initiates direct hotspot coordinates dragging.
   */
  handleMouseDown(mouseVec, raycaster, sphereMesh, selectedIds = []) {
    raycaster.setFromCamera(mouseVec, this.camera);
    const activeSprites = this._getActiveSprites();
    const intersects = raycaster.intersectObjects(activeSprites);

    if (intersects.length > 0) {
      const hitSprite = intersects[0].object;
      const hs = hitSprite.userData.hotspot;

      // Lock status check
      if (hs.locked) {
        message.warning('This hotspot is locked and cannot be moved.');
        return false;
      }

      this.isDragging = true;
      this.draggedId = hs.id;
      this.dragDistance = 0;
      this.originalYaw = hs.yaw || 0;
      this.originalPitch = hs.pitch || 0;

      // Track relative drag targets for multi-hotspot moving
      this.selectedDragTargets = [];
      const ids = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);
      
      // If the grabbed hotspot is not in selection list, drag it solo
      if (ids.includes(hs.id)) {
        ids.forEach(id => {
          const match = this.meshes.find(m => m.hotspot.id === id);
          if (match && !match.hotspot.locked) {
            this.selectedDragTargets.push({
              id,
              originalYaw: match.hotspot.yaw || 0,
              originalPitch: match.hotspot.pitch || 0,
              mesh: match
            });
          }
        });
      }

      // Intersect background sphere to capture start drag angles
      const sphereHits = raycaster.intersectObject(sphereMesh);
      if (sphereHits.length > 0) {
        const hitPoint = sphereHits[0].point;
        _scratchHitDir.copy(hitPoint).normalize();
        this.dragStartYaw = Math.atan2(_scratchHitDir.x, _scratchHitDir.z);
        this.dragStartPitch = Math.asin(Math.max(-1, Math.min(1, _scratchHitDir.y)));
      }
      return true;
    }
    return false;
  }

  /**
   * Repositions the sprite directly in-place. Applies snapping constraints.
   */
  handleMouseDrag(mouseVec, raycaster, sphereMesh, e, snapSettings) {
    if (!this.isDragging || !this.draggedId) return;

    raycaster.setFromCamera(mouseVec, this.camera);
    const intersects = raycaster.intersectObject(sphereMesh);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      _scratchHitDir.copy(hitPoint).normalize();

      const rawYaw = Math.atan2(_scratchHitDir.x, _scratchHitDir.z);
      const rawPitch = Math.asin(Math.max(-1, Math.min(1, _scratchHitDir.y)));

      let deltaYaw = rawYaw - this.dragStartYaw;
      let deltaPitch = rawPitch - this.dragStartPitch;

      // Shift key precision dragging (10x movement dampening)
      if (e.shiftKey) {
        deltaYaw /= 10;
        deltaPitch /= 10;
      }

      const maxPitch = Math.PI / 2 - 0.05;

      // Apply drag coordinate updates to all selected multi-drag targets
      if (this.selectedDragTargets && this.selectedDragTargets.length > 0) {
        this.selectedDragTargets.forEach(target => {
          let yaw = target.originalYaw + deltaYaw;
          let pitch = target.originalPitch + deltaPitch;

          // Horizon snapping
          if (snapSettings?.horizonSnap && Math.abs(pitch) < 0.045) {
            pitch = 0;
          }

          // Grid snapping (15-degree steps)
          if (e.altKey || snapSettings?.gridSnap) {
            const step = 15 * (Math.PI / 180);
            yaw = Math.round(yaw / step) * step;
            pitch = Math.round(pitch / step) * step;
          }

          // Magnetic snap alignment to other static hotspots in scene
          if (snapSettings?.magneticSnap) {
            for (let other of this.meshes) {
              if (this.selectedDragTargets.some(t => t.id === other.hotspot.id)) continue;
              const otherYaw = other.hotspot.yaw || 0;
              const otherPitch = other.hotspot.pitch || 0;
              if (Math.abs(otherYaw - yaw) < 0.035) {
                yaw = otherYaw;
              }
              if (Math.abs(otherPitch - pitch) < 0.035) {
                pitch = otherPitch;
              }
            }
          }

          while (yaw > Math.PI) yaw -= 2 * Math.PI;
          while (yaw < -Math.PI) yaw += 2 * Math.PI;
          pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

          hotspotUtils.sphericalToCartesian(yaw, pitch, HOTSPOT_SAFE_RADIUS, target.mesh.sprite.position);
          if (target.mesh.ring) target.mesh.ring.position.copy(target.mesh.sprite.position);

          target.mesh.hotspot.yaw = yaw;
          target.mesh.hotspot.pitch = pitch;
        });
        this.dragDistance++;
      } else {
        // Solo target dragging
        let yaw = this.originalYaw + deltaYaw;
        let pitch = this.originalPitch + deltaPitch;

        // Horizon snapping
        if (snapSettings?.horizonSnap && Math.abs(pitch) < 0.045) {
          pitch = 0;
        }

        // Grid snapping (15-degree steps)
        if (e.altKey || snapSettings?.gridSnap) {
          const step = 15 * (Math.PI / 180);
          yaw = Math.round(yaw / step) * step;
          pitch = Math.round(pitch / step) * step;
        }

        // Magnetic snap alignment
        if (snapSettings?.magneticSnap) {
          for (let other of this.meshes) {
            if (other.hotspot.id === this.draggedId) continue;
            const otherYaw = other.hotspot.yaw || 0;
            const otherPitch = other.hotspot.pitch || 0;
            if (Math.abs(otherYaw - yaw) < 0.035) {
              yaw = otherYaw;
            }
            if (Math.abs(otherPitch - pitch) < 0.035) {
              pitch = otherPitch;
            }
          }
        }

        while (yaw > Math.PI) yaw -= 2 * Math.PI;
        while (yaw < -Math.PI) yaw += 2 * Math.PI;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

        const match = this.meshes.find((m) => m.hotspot.id === this.draggedId);
        if (match) {
          hotspotUtils.sphericalToCartesian(yaw, pitch, HOTSPOT_SAFE_RADIUS, match.sprite.position);
          if (match.ring) match.ring.position.copy(match.sprite.position);

          match.hotspot.yaw = yaw;
          match.hotspot.pitch = pitch;
          this.dragDistance++;
        }
      }
    }
  }

  /**
   * Concludes dragging gesture and commits changes.
   */
  handleMouseUp() {
    if (!this.isDragging || !this.draggedId) return null;

    let updatedHotspotsList = [];

    if (this.dragDistance > 5 && this.onHotspotDragUpdate) {
      if (this.selectedDragTargets && this.selectedDragTargets.length > 0) {
        this.selectedDragTargets.forEach(target => {
          updatedHotspotsList.push({
            ...target.mesh.hotspot,
            yaw: target.mesh.hotspot.yaw,
            pitch: target.mesh.hotspot.pitch
          });
        });
      } else {
        const match = this.meshes.find((m) => m.hotspot.id === this.draggedId);
        if (match) {
          updatedHotspotsList.push({
            ...match.hotspot,
            yaw: match.hotspot.yaw,
            pitch: match.hotspot.pitch
          });
        }
      }

      if (updatedHotspotsList.length > 0 && this.onHotspotDragUpdate) {
        this.onHotspotDragUpdate(updatedHotspotsList);
      }
    }

    this.isDragging = false;
    this.draggedId = null;
    this.selectedDragTargets = [];
    return updatedHotspotsList;
  }

  /**
   * Checks if pointer click intersects a sprite for Context Menu actions.
   */
  getHitHotspot(mouseVec, raycaster) {
    raycaster.setFromCamera(mouseVec, this.camera);
    const activeSprites = this._getActiveSprites();
    const intersects = raycaster.intersectObjects(activeSprites);

    if (intersects.length > 0) {
      return intersects[0].object.userData.hotspot;
    }
    return null;
  }

  /**
   * Empties GPU allocations.
   */
  clear() {
    this.renderer.clear();
  }

  destroy() {
    this.renderer.destroy();
  }
}
