import { DeviceProfile } from './DeviceProfile';

const isElectronRuntime = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

/**
 * Scene Manager for 360TOOL.
 * Orchestrates progressive 2-stage loading (preview first, background master upgrade),
 * smooth visual fading, 3D WebGL scene transitions, atomic texture swapping,
 * camera FOV & orientation resets, and WebGL hotspot rebuilding.
 */
export default class SceneManager {
  constructor(viewerCore, textureManager, hotspotManager, transitionManager) {
    this.viewerCore = viewerCore;
    this.textureManager = textureManager;
    this.hotspotManager = hotspotManager;
    this.transitionManager = transitionManager;
    
    this.currentSceneId = null;
    this.isTransitioning = false;
    this._loadRequestId = 0;
  }

  /**
   * Helper to derive deterministic Level 2 preview URL for a given scene config
   * @private
   */
  _resolvePreviewUrl(sceneConf) {
    if (!sceneConf) return null;
    if (sceneConf.preview) {
      return this.viewerCore.getImageUrl(sceneConf.preview);
    }
    if (!sceneConf.image) return null;

    const img = sceneConf.image;
    // Derive preview URL for standard /uploads/:tourId/:filename paths or ./assets/media/ paths
    if (!img.includes('/thumbnails/') && !img.includes('/previews/')) {
      const lastDot = img.lastIndexOf('.');
      if (lastDot > 0) {
        const ext = img.slice(lastDot);
        const base = img.slice(0, lastDot);
        if (img.includes('/uploads/')) {
          const dir = base.slice(0, base.lastIndexOf('/') + 1);
          const file = base.slice(base.lastIndexOf('/') + 1);
          return this.viewerCore.getImageUrl(`${dir}previews/${file}.preview${ext}`);
        } else {
          return this.viewerCore.getImageUrl(`${base}.preview${ext}`);
        }
      }
    }

    return this.viewerCore.getImageUrl(img);
  }

  /**
   * Loads a scene seamlessly using progressive 2-stage loading and guarded transitions.
   * Stage 1: Load lightweight Level 2 Editor Preview for instantaneous visual response.
   * Stage 2: Upgrade to Level 3 Master Original in the background when hardware permits.
   * 
   * @param {Object} sceneConf - Scene configuration object
   * @param {Array} hotspotsList - Hotspots belonging to this scene
   * @param {string|Array} selectedHotspotId - Currently selected hotspot ID(s)
   * @param {Function} [onComplete] - Callback on transition finished
   */
  loadScene(sceneConf, hotspotsList, selectedHotspotId, onComplete) {
    if (!sceneConf) {
      if (onComplete) onComplete();
      return;
    }

    const requestId = ++this._loadRequestId;
    this.isTransitioning = true;
    this.currentSceneId = sceneConf.id;

    // Resolve target camera FOV and Pitch/Yaw angles
    let defaultFov = sceneConf.fov !== undefined ? parseFloat(sceneConf.fov) : 80;
    if (isNaN(defaultFov)) defaultFov = 80;
    if (defaultFov > 110 && this.viewerCore._calculateVFovFromMFov) {
      defaultFov = this.viewerCore._calculateVFovFromMFov(defaultFov, this.viewerCore.camera?.aspect || 1.777);
    }
    defaultFov = Math.max(35, Math.min(95, defaultFov));

    let initialYaw = (sceneConf.initialYaw !== undefined && sceneConf.initialYaw !== null)
      ? parseFloat(sceneConf.initialYaw)
      : (this.viewerCore.targetTheta || 0);
    if (isNaN(initialYaw)) initialYaw = this.viewerCore.targetTheta || 0;

    let initialPitch = (sceneConf.initialPitch !== undefined && sceneConf.initialPitch !== null)
      ? parseFloat(sceneConf.initialPitch)
      : 0;
    if (isNaN(initialPitch)) initialPitch = 0;

    const sphere = this.viewerCore.sphere;
    const masterUrl = sceneConf.image ? this.viewerCore.getImageUrl(sceneConf.image) : null;
    const previewUrl = this._resolvePreviewUrl(sceneConf) || masterUrl;
    const initialLoadUrl = previewUrl || masterUrl;
    const oldUrl = this.textureManager.activeUrl;

    if (!initialLoadUrl) {
      this.isTransitioning = false;
      if (onComplete) onComplete();
      return;
    }

    // Protect active & transitioning textures from eviction
    if (oldUrl) this.textureManager.setTransitioning(oldUrl, true);
    if (initialLoadUrl) this.textureManager.setTransitioning(initialLoadUrl, true);
    if (masterUrl && masterUrl !== initialLoadUrl) this.textureManager.setTransitioning(masterUrl, true);

    let transitionDur = sceneConf.transitionDuration !== undefined ? parseFloat(sceneConf.transitionDuration) : 0.4;
    if (isNaN(transitionDur)) transitionDur = 0.4;
    const effect = sceneConf.transitionEffect || 'fade';
    const isInstant = transitionDur <= 0.05 || effect === 'instant';

    const finalizeTransition = () => {
      if (this._loadRequestId !== requestId) return;
      this.isTransitioning = false;
      if (oldUrl) this.textureManager.setTransitioning(oldUrl, false);
      this.textureManager.setTransitioning(initialLoadUrl, false);
      this.viewerCore.renderLoop.requestRender(3);

      // ── STAGE 2: Multi-Resolution Tiled Streaming OR Master Upgrade ──
      if (isElectronRuntime && sceneConf.tiles && sceneConf.tiles.enabled) {
        if (this.viewerCore.tileManager) {
          this.viewerCore.tileManager.setScene(sceneConf.tiles, sceneConf.id);
        }
        if (masterUrl) this.textureManager.setTransitioning(masterUrl, false);
      } else {
        if (this.viewerCore.tileManager) {
          this.viewerCore.tileManager.setScene(null, sceneConf.id);
        }
        if (
          (!this.viewerCore.editMode || DeviceProfile.shouldUpgradeMasterInEditor) &&
          masterUrl &&
          masterUrl !== initialLoadUrl
        ) {
          this._queueMasterUpgrade(masterUrl, requestId, sphere);
        } else {
          if (masterUrl) this.textureManager.setTransitioning(masterUrl, false);
        }
      }

      if (onComplete) onComplete();
    };

    // Case A: Instant transition OR initial scene load (no prior scene to fade out)
    if (isInstant || !oldUrl) {
      this.viewerCore.setCameraOrientation(initialYaw, initialPitch, defaultFov);
      if (this.transitionManager) this.transitionManager.cancelActive(sphere);

      this.textureManager.loadTexture(
        initialLoadUrl,
        (texture) => {
          if (this._loadRequestId !== requestId) return;
          if (this.viewerCore.renderer && this.viewerCore.renderer.initTexture) {
            try { this.viewerCore.renderer.initTexture(texture); } catch (e) {}
          }
          if (sphere && sphere.material) {
            sphere.material.map = texture;
            sphere.material.color.set(0xffffff);
            sphere.material.needsUpdate = true;
          }
          this.textureManager.setActive(initialLoadUrl);
          this.hotspotManager.rebuild(hotspotsList || [], selectedHotspotId);
          if (this.viewerCore.object3dManager) {
            this.viewerCore.object3dManager.rebuild(sceneConf.objects3d || sceneConf.objects || [], selectedHotspotId);
          }

          if (isInstant) {
            if (sphere && sphere.material) sphere.material.opacity = 1;
            finalizeTransition();
          } else {
            if (sphere && sphere.material) sphere.material.opacity = 0;
            const fadeInDur = Math.max(0.25, transitionDur * 0.6);
            this.transitionManager.fade(sphere, 1, fadeInDur, finalizeTransition);
          }
        },
        (err) => {
          this._handleLoadError(requestId, oldUrl, initialLoadUrl, masterUrl, sphere, onComplete);
        }
      ).catch(() => {});
      return;
    }

    // Case B: Navigating between scenes -> Seamless Two-Stage Fade-Out / Fade-In Transition
    const fadeOutDur = Math.max(0.18, transitionDur * 0.45);
    const fadeInDur = Math.max(0.22, transitionDur * 0.55);

    let fadeOutDone = false;
    let loadedTexture = null;

    if (this.transitionManager) {
      this.transitionManager.cancelActive(sphere);
    }

    // Hide active hotspots during fade-out to prevent lingering floating icons
    if (this.viewerCore.hotspotManager?.renderer) {
      this.viewerCore.hotspotManager.renderer.meshes.forEach((m) => {
        if (m.sprite) m.sprite.visible = false;
        if (m.ring) m.ring.visible = false;
      });
    }

    const tryApplySceneSwitch = () => {
      if (!fadeOutDone || !loadedTexture || this._loadRequestId !== requestId) return;

      // 1. Scene is at opacity 0 (total darkness) -> orient camera invisibly without any visual jump
      this.viewerCore.setCameraOrientation(initialYaw, initialPitch, defaultFov);

      // 2. Pre-upload new texture to GPU VRAM
      if (this.viewerCore.renderer && this.viewerCore.renderer.initTexture) {
        try { this.viewerCore.renderer.initTexture(loadedTexture); } catch (e) {}
      }

      // 3. Swap texture
      if (sphere && sphere.material) {
        sphere.material.map = loadedTexture;
        sphere.material.color.set(0xffffff);
        sphere.material.needsUpdate = true;
      }
      this.textureManager.setActive(initialLoadUrl);

      // 4. Rebuild hotspots and 3D objects for the new scene
      this.hotspotManager.rebuild(hotspotsList || [], selectedHotspotId);
      if (this.viewerCore.object3dManager) {
        this.viewerCore.object3dManager.rebuild(sceneConf.objects3d || sceneConf.objects || [], selectedHotspotId);
      }

      // 5. Smoothly Fade In from 0 to 1
      this.transitionManager.fade(sphere, 1, fadeInDur, finalizeTransition);
    };

    // Stage 1a: Start smooth fade out of current scene to black
    this.transitionManager.fade(sphere, 0, fadeOutDur, () => {
      if (this._loadRequestId !== requestId) return;
      fadeOutDone = true;
      tryApplySceneSwitch();
    });

    // Stage 1b: Concurrently load new texture
    this.textureManager.loadTexture(
      initialLoadUrl,
      (texture) => {
        if (this._loadRequestId !== requestId) return;
        loadedTexture = texture;
        tryApplySceneSwitch();
      },
      (err) => {
        // Fallback to master URL if preview fails
        if (initialLoadUrl !== masterUrl && masterUrl && this._loadRequestId === requestId) {
          console.warn('Preview load failed, falling back to master image:', err.message);
          this.textureManager.loadTexture(
            masterUrl,
            (masterTex) => {
              if (this._loadRequestId !== requestId) return;
              loadedTexture = masterTex;
              tryApplySceneSwitch();
            },
            () => {
              this._handleLoadError(requestId, oldUrl, initialLoadUrl, masterUrl, sphere, onComplete);
            }
          ).catch(() => {});
          return;
        }
        this._handleLoadError(requestId, oldUrl, initialLoadUrl, masterUrl, sphere, onComplete);
      }
    ).catch(() => {});
  }

  /**
   * Background quality upgrade to master original texture
   * @private
   */
  _queueMasterUpgrade(masterUrl, requestId, sphere) {
    this.textureManager.loadTexture(
      masterUrl,
      (masterTexture) => {
        // Verify user is still looking at this scene
        if (this._loadRequestId !== requestId) {
          this.textureManager.setTransitioning(masterUrl, false);
          return;
        }

        // Seamless atomic texture update to master
        if (sphere && sphere.material) {
          sphere.material.map = masterTexture;
          sphere.material.needsUpdate = true;
        }

        this.textureManager.setActive(masterUrl);
        this.textureManager.setTransitioning(masterUrl, false);
        this.viewerCore.renderLoop.requestRender(2);
      },
      (err) => {
        // Upgrade failed gracefully; remain on preview without disrupting user
        this.textureManager.setTransitioning(masterUrl, false);
      }
    ).catch(() => {});
  }

  /**
   * Error recovery handler
   * @private
   */
  _handleLoadError(requestId, oldUrl, initialLoadUrl, masterUrl, sphere, onComplete) {
    if (this._loadRequestId !== requestId) return;
    if (sphere && sphere.material) {
      sphere.material.opacity = 1;
    }
    this.isTransitioning = false;
    if (oldUrl) this.textureManager.setTransitioning(oldUrl, false);
    if (initialLoadUrl) this.textureManager.setTransitioning(initialLoadUrl, false);
    if (masterUrl) this.textureManager.setTransitioning(masterUrl, false);
    this.viewerCore.renderLoop.requestRender(3);
    if (onComplete) onComplete();
  }
}

