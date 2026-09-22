import gsap from 'gsap';
import { shortestYawDelta, lookAtToYawPitch } from '../viewer/CinematicTimelineEngine.js';
import HotspotStateManager from './HotspotStateManager.js';
import { sharedAnalyticsManager } from '../analytics/AnalyticsManager.js';

/**
 * Whitelisted Action Types
 */
export const ALLOWED_ACTION_TYPES = new Set([
  'sceneNavigate',
  'cameraMove',
  'lookAt',
  'openInfo',
  'openMedia',
  'openUrl',
  'playAudio',
  'pauseAudio',
  'stopAudio',
  'showHotspot',
  'hideHotspot',
  'toggleHotspot',
  'startCinematic',
  'stopCinematic',
  'customEvent',
  'playObjectAnimation',
  'stopObjectAnimation',
  'showObject',
  'hideObject',
  'toggleObject',
  'transformObject'
]);

/**
 * Whitelisted Interaction Triggers
 */
export const ALLOWED_TRIGGERS = new Set([
  'click',
  'hover',
  'enterView',
  'timeline',
  'manual'
]);

/**
 * Validates external URLs to prevent malicious scripts.
 */
function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return true;
}

/**
 * HotspotActionEngine
 * Production-grade decoupled action execution system for 360TOOL.
 */
export class HotspotActionEngine {
  /**
   * @param {Object} context
   * @param {Object} [context.viewerCore]
   * @param {Object} [context.sceneManager]
   * @param {Function} [context.onSceneChange]
   * @param {Object} [context.audioEngine]
   * @param {Object} [context.timelineEngine]
   * @param {HotspotStateManager} [context.stateManager]
   * @param {Function} [context.onOpenInfo]
   * @param {Function} [context.onOpenMedia]
   * @param {Function} [context.onCustomEvent]
   */
  constructor(context = {}) {
    this.context = context;
    this.stateManager = context.stateManager || new HotspotStateManager();
    
    this._actionRegistry = new Map();
    this._activeTweens = new Set();
    this._activeTimeouts = new Set();
    this._executionDepth = 0;
    this.MAX_EXECUTION_DEPTH = 10;

    this._registerDefaultActions();
  }

  setContext(updates = {}) {
    this.context = { ...this.context, ...updates };
    if (updates.stateManager) {
      this.stateManager = updates.stateManager;
    }
  }

  // ─── Action Handlers Registration ──────────────────────────────────────────

  _registerDefaultActions() {
    // 1. Scene Navigation
    this.registerAction('sceneNavigate', async (action, ctx) => {
      const targetScene = action.targetScene;
      if (!targetScene) return;

      if (ctx.onSceneChange) {
        ctx.onSceneChange(targetScene);
      } else if (ctx.sceneManager?.switchScene) {
        ctx.sceneManager.switchScene(targetScene);
      } else if (ctx.viewerCore?.sceneManager?.switchScene) {
        ctx.viewerCore.sceneManager.switchScene(targetScene);
      }
      this.stateManager.markSceneVisited(targetScene);
    });

    // 2. Camera Move (Uses shortestYawDelta & GSAP)
    this.registerAction('cameraMove', async (action, ctx) => {
      const viewer = ctx.viewerCore;
      if (!viewer) return;

      const currentYaw = viewer.getYaw ? viewer.getYaw() : (viewer.targetTheta || 0);
      const currentPitch = viewer.getPitch ? viewer.getPitch() : (Math.PI / 2 - (viewer.targetPhi || Math.PI / 2));
      const currentFov = viewer.camera?.fov || viewer.fov || 80;

      const targetYaw = action.yaw !== undefined ? parseFloat(action.yaw) : currentYaw;
      const targetPitch = action.pitch !== undefined ? parseFloat(action.pitch) : currentPitch;
      const targetFov = action.fov !== undefined ? parseFloat(action.fov) : currentFov;
      const duration = action.duration !== undefined ? Math.max(0.1, parseFloat(action.duration)) : 1.5;
      const easing = action.easing || 'power2.inOut';

      // Shortest-path yaw delta
      const deltaYaw = shortestYawDelta(currentYaw, targetYaw);

      return new Promise((resolve) => {
        const tweenObj = { progress: 0 };
        const tween = gsap.to(tweenObj, {
          progress: 1.0,
          duration,
          ease: easing,
          onUpdate: () => {
            const p = tweenObj.progress;
            const y = currentYaw + deltaYaw * p;
            const pit = currentPitch + (targetPitch - currentPitch) * p;
            const f = currentFov + (targetFov - currentFov) * p;

            if (viewer.setCameraOrientation) {
              viewer.setCameraOrientation(y, pit, f);
            }
          },
          onComplete: () => {
            if (viewer.setCameraOrientation) {
              viewer.setCameraOrientation(currentYaw + deltaYaw, targetPitch, targetFov);
            }
            this._activeTweens.delete(tween);
            resolve();
          }
        });
        this._activeTweens.add(tween);
      });
    });

    // 3. Look At 3D Target Coordinates or Hotspot
    this.registerAction('lookAt', async (action, ctx) => {
      const viewer = ctx.viewerCore;
      if (!viewer) return;

      let yaw = 0;
      let pitch = 0;

      if (action.lookAtTarget && typeof action.lookAtTarget === 'object') {
        const { x, y, z } = action.lookAtTarget;
        const res = lookAtToYawPitch(x || 0, y || 0, z !== undefined ? z : 1);
        yaw = res.yaw;
        pitch = res.pitch;
      } else if (action.yaw !== undefined && action.pitch !== undefined) {
        yaw = parseFloat(action.yaw);
        pitch = parseFloat(action.pitch);
      }

      return this.executeAction({
        type: 'cameraMove',
        yaw,
        pitch,
        fov: action.fov || viewer.camera?.fov || 80,
        duration: action.duration || 1.5,
        easing: action.easing || 'power2.inOut'
      });
    });

    // 4. Open Information Modal
    this.registerAction('openInfo', async (action, ctx) => {
      if (ctx.onOpenInfo) {
        ctx.onOpenInfo({
          title: action.title || action.tooltip || 'Information',
          description: action.description || '',
          icon: action.icon,
          hotspot: action._hotspot
        });
      }
    });

    // 5. Open Media Modal (Image, Video, Audio)
    this.registerAction('openMedia', async (action, ctx) => {
      if (ctx.onOpenMedia) {
        ctx.onOpenMedia({
          title: action.title || action.tooltip || 'Media Preview',
          mediaUrl: action.mediaUrl || action.videoUrl || action.url || '',
          mediaType: action.mediaType || (action.videoUrl ? 'video' : 'image'),
          description: action.description || '',
          hotspot: action._hotspot
        });
      }
    });

    // 6. External URL
    this.registerAction('openUrl', async (action) => {
      const url = action.url || action.linkUrl;
      if (!url || !isSafeUrl(url)) {
        console.warn('[HotspotActionEngine] Blocked unsafe or empty URL:', url);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    // 7. Spatial / Ambient Audio
    this.registerAction('playAudio', async (action, ctx) => {
      const audioUrl = action.audioUrl || action.url;
      if (!audioUrl) return;

      if (ctx.audioEngine?.playAmbient) {
        ctx.audioEngine.playAmbient(audioUrl, {
          volume: action.volume !== undefined ? parseFloat(action.volume) : 0.7,
          loop: action.loop !== undefined ? Boolean(action.loop) : false
        });
      }
    });

    this.registerAction('pauseAudio', async (action, ctx) => {
      if (ctx.audioEngine?.pauseAmbient) {
        ctx.audioEngine.pauseAmbient();
      }
    });

    this.registerAction('stopAudio', async (action, ctx) => {
      if (ctx.audioEngine?.stopAmbient) {
        ctx.audioEngine.stopAmbient();
      }
    });

    // 8. Hotspot Visibility Controls
    this.registerAction('showHotspot', async (action) => {
      if (action.targetHotspotId) {
        this.stateManager.setHotspotVisibility(action.targetHotspotId, true);
      }
      if (action.targetGroup) {
        this.stateManager.setGroupVisibility(action.targetGroup, true);
      }
    });

    this.registerAction('hideHotspot', async (action) => {
      if (action.targetHotspotId) {
        this.stateManager.setHotspotVisibility(action.targetHotspotId, false);
      }
      if (action.targetGroup) {
        this.stateManager.setGroupVisibility(action.targetGroup, false);
      }
    });

    this.registerAction('toggleHotspot', async (action) => {
      if (action.targetHotspotId) {
        this.stateManager.toggleHotspotVisibility(action.targetHotspotId);
      }
      if (action.targetGroup) {
        this.stateManager.toggleGroupVisibility(action.targetGroup);
      }
    });

    // 9. Cinematic Timeline Integration
    this.registerAction('startCinematic', async (action, ctx) => {
      if (ctx.timelineEngine?.play) {
        ctx.timelineEngine.play({ loop: action.loop || false });
      }
    });

    this.registerAction('stopCinematic', async (action, ctx) => {
      if (ctx.timelineEngine?.stop) {
        ctx.timelineEngine.stop();
      }
    });

    // 10. Custom Event Dispatch
    this.registerAction('customEvent', async (action, ctx) => {
      const eventName = action.eventName || action.event;
      if (!eventName) return;

      this.stateManager.markEventCompleted(eventName);

      if (ctx.onCustomEvent) {
        ctx.onCustomEvent(eventName, action.eventPayload, action._hotspot || action._object);
      }
    });

    // 11. 3D Object Animation & Visibility Actions
    this.registerAction('playObjectAnimation', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId || action._object?.id;
      const clipName = action.clipName || action.animationClip;
      const loop = action.loop || 'repeat';
      const speed = action.speed !== undefined ? parseFloat(action.speed) : 1.0;
      if (targetId && ctx.viewerCore?.object3dManager) {
        ctx.viewerCore.object3dManager.playAnimation(targetId, clipName, loop, speed);
      }
    });

    this.registerAction('stopObjectAnimation', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId || action._object?.id;
      if (targetId && ctx.viewerCore?.object3dManager) {
        ctx.viewerCore.object3dManager.stopAnimation(targetId);
      }
    });

    this.registerAction('showObject', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId;
      if (targetId) {
        this.stateManager.setObjectVisibility(targetId, true);
        if (ctx.viewerCore?.object3dManager) {
          ctx.viewerCore.object3dManager.setVisibility(targetId, true);
        }
      }
    });

    this.registerAction('hideObject', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId;
      if (targetId) {
        this.stateManager.setObjectVisibility(targetId, false);
        if (ctx.viewerCore?.object3dManager) {
          ctx.viewerCore.object3dManager.setVisibility(targetId, false);
        }
      }
    });

    this.registerAction('toggleObject', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId;
      if (targetId) {
        this.stateManager.toggleObjectVisibility(targetId);
        if (ctx.viewerCore?.object3dManager) {
          const isVis = this.stateManager.isObjectVisible({ id: targetId });
          ctx.viewerCore.object3dManager.setVisibility(targetId, isVis);
        }
      }
    });

    this.registerAction('transformObject', async (action, ctx) => {
      const targetId = action.targetObjectId || action.targetId || action._object?.id;
      const entry = ctx.viewerCore?.object3dManager?.activeObjects?.get(targetId);
      if (!entry || !entry.rootMesh) return;
      const duration = action.duration !== undefined ? Math.max(0.01, parseFloat(action.duration)) : 1.0;
      const ease = action.easing || 'power2.inOut';
      const mesh = entry.rootMesh;

      await new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: () => { this._activeTweens.delete(tl); resolve(); } });
        if (action.position) {
          tl.to(mesh.position, {
            x: action.position.x !== undefined ? action.position.x : mesh.position.x,
            y: action.position.y !== undefined ? action.position.y : mesh.position.y,
            z: action.position.z !== undefined ? action.position.z : mesh.position.z,
            duration,
            ease
          }, 0);
        }
        if (action.rotation) {
          const targetRotX = action.rotation.x !== undefined ? (action.rotation.x * Math.PI) / 180 : mesh.rotation.x;
          const targetRotY = action.rotation.y !== undefined ? (action.rotation.y * Math.PI) / 180 : mesh.rotation.y;
          const targetRotZ = action.rotation.z !== undefined ? (action.rotation.z * Math.PI) / 180 : mesh.rotation.z;
          tl.to(mesh.rotation, { x: targetRotX, y: targetRotY, z: targetRotZ, duration, ease }, 0);
        }
        if (action.scale !== undefined) {
          const sX = typeof action.scale === 'number' ? action.scale : (action.scale.x || 1);
          const sY = typeof action.scale === 'number' ? action.scale : (action.scale.y || 1);
          const sZ = typeof action.scale === 'number' ? action.scale : (action.scale.z || 1);
          tl.to(mesh.scale, { x: sX, y: sY, z: sZ, duration, ease }, 0);
        }
        this._activeTweens.add(tl);
      });
    });
  }

  /**
   * Registers a custom action handler.
   */
  registerAction(type, handler) {
    this._actionRegistry.set(type, handler);
  }

  // ─── Normalizer for Legacy Hotspots ─────────────────────────────────────────

  /**
   * Normalizes a hotspot object into the action architecture.
   * @param {Object} hotspot 
   * @returns {Array<Object>} Normalized actions list
   */
  normalizeHotspotActions(hotspot) {
    if (!hotspot) return [];

    // If already has actions defined, return them directly
    if (Array.isArray(hotspot.actions) && hotspot.actions.length > 0) {
      return hotspot.actions.map((act, index) => ({
        ...act,
        id: act.id || `act_${hotspot.id}_${index}`,
        trigger: act.trigger || 'click'
      }));
    }

    const legacyActions = [];

    // Derive actions from legacy hotspot schema
    if (hotspot.type === 'navigation' && hotspot.targetScene) {
      legacyActions.push({
        id: `act_${hotspot.id}_nav`,
        trigger: 'click',
        type: 'sceneNavigate',
        targetScene: hotspot.targetScene
      });
    } else if (hotspot.type === 'link' && hotspot.linkUrl) {
      legacyActions.push({
        id: `act_${hotspot.id}_link`,
        trigger: 'click',
        type: 'openUrl',
        url: hotspot.linkUrl
      });
    } else if (hotspot.type === 'info' || hotspot.icon === 'info') {
      legacyActions.push({
        id: `act_${hotspot.id}_info`,
        trigger: 'click',
        type: 'openInfo',
        title: hotspot.title || hotspot.tooltip || 'Information',
        description: hotspot.description || hotspot.tooltip || ''
      });
    } else if (hotspot.type === 'video' || hotspot.icon === 'video') {
      legacyActions.push({
        id: `act_${hotspot.id}_video`,
        trigger: 'click',
        type: 'openMedia',
        mediaType: 'video',
        mediaUrl: hotspot.videoUrl || hotspot.linkUrl || '',
        title: hotspot.title || hotspot.tooltip || 'Video'
      });
    } else if (hotspot.type === 'audio' || hotspot.audioUrl) {
      legacyActions.push({
        id: `act_${hotspot.id}_audio`,
        trigger: 'click',
        type: 'playAudio',
        audioUrl: hotspot.audioUrl,
        volume: hotspot.volume || 0.7,
        loop: hotspot.audioLoop !== false
      });
    }

    return legacyActions;
  }

  // ─── Execution Pipeline ─────────────────────────────────────────────────────

  /**
   * Executes all actions attached to a hotspot for a given trigger.
   * @param {Object} hotspot - The target hotspot
   * @param {'click'|'hover'|'enterView'|'timeline'|'manual'} trigger - Interaction trigger type
   */
  async triggerHotspot(hotspot, trigger = 'click') {
    if (!hotspot) return;

    // Check visibility state before executing
    if (!this.stateManager.isHotspotVisible(hotspot)) {
      return;
    }

    const actions = this.normalizeHotspotActions(hotspot);
    const matchingActions = actions.filter((act) => act.trigger === trigger);

    if (matchingActions.length === 0) return;

    this.stateManager.markHotspotTriggered(hotspot.id);

    // Track analytics event
    sharedAnalyticsManager.trackHotspotClick(
      hotspot.id,
      hotspot.type,
      this.context?.currentSceneId || hotspot.sceneId,
      matchingActions[0]?.type
    );

    // Execute sequential chain
    for (const action of matchingActions) {
      await this.executeAction({ ...action, _hotspot: hotspot });
    }
  }

  /**
   * Executes all actions attached to a 3D object for a given trigger.
   * @param {Object} object3d - The target 3D object config
   * @param {'click'|'hover'|'enterView'|'timeline'|'manual'} trigger - Interaction trigger type
   */
  async triggerObject(object3d, trigger = 'click') {
    if (!object3d) return;

    // Check visibility state before executing
    if (!this.stateManager.isObjectVisible(object3d)) {
      return;
    }

    const actions = Array.isArray(object3d.actions) ? object3d.actions : [];
    const matchingActions = actions.filter((act) => (act.trigger || 'click') === trigger);

    if (matchingActions.length === 0) return;

    this.stateManager.markObjectTriggered(object3d.id);

    // Track analytics event
    sharedAnalyticsManager.trackObjectClick(
      object3d.id,
      object3d.name,
      this.context?.currentSceneId,
      trigger
    );

    // Execute sequential chain
    for (const action of matchingActions) {
      await this.executeAction({ ...action, _object: object3d });
    }
  }

  /**
   * Executes a single action safely with validation and delay.
   * @param {Object} action 
   */
  async executeAction(action) {
    if (!action || typeof action !== 'object') return;

    if (!ALLOWED_ACTION_TYPES.has(action.type)) {
      console.warn(`[HotspotActionEngine] Action type "${action.type}" is not allowed.`);
      return;
    }

    const handler = this._actionRegistry.get(action.type);
    if (!handler) {
      console.warn(`[HotspotActionEngine] No handler registered for "${action.type}".`);
      return;
    }

    // Recursion Guard
    if (this._executionDepth >= this.MAX_EXECUTION_DEPTH) {
      console.error('[HotspotActionEngine] Max execution depth exceeded. Circular trigger halted.');
      return;
    }

    // Optional delay
    if (action.delay && action.delay > 0) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, action.delay * 1000);
        this._activeTimeouts.add(t);
      });
    }

    this._executionDepth++;
    try {
      await handler(action, this.context);
    } catch (err) {
      console.error(`[HotspotActionEngine] Error executing action "${action.type}":`, err);
    } finally {
      this._executionDepth--;
    }
  }

  /**
   * Stops active animations and timers on cleanup.
   */
  destroy() {
    this._activeTweens.forEach((t) => t.kill());
    this._activeTweens.clear();
    this._activeTimeouts.forEach((t) => clearTimeout(t));
    this._activeTimeouts.clear();
  }
}

export default HotspotActionEngine;
