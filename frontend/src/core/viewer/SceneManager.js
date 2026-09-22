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
    // Derive preview URL for standard /uploads/:tourId/:filename paths
    if (img.includes('/uploads/') && !img.includes('/thumbnails/') && !img.includes('/previews/')) {
      const ext = img.slice(img.lastIndexOf('.'));
      const base = img.slice(0, img.lastIndexOf('.'));
      const dir = base.slice(0, base.lastIndexOf('/') + 1);
      const file = base.slice(base.lastIndexOf('/') + 1);
      const previewRel = `${dir}previews/${file}.preview${ext}`;
      return this.viewerCore.getImageUrl(previewRel);
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

    // Reset camera FOV and Pitch/Yaw angles to scene's starting orientation
    if (this.viewerCore) {
      const defaultFov = sceneConf.fov !== undefined ? parseFloat(sceneConf.fov) : 95;
      const initialYaw = (sceneConf.initialYaw !== undefined && sceneConf.initialYaw !== null)
        ? parseFloat(sceneConf.initialYaw)
        : (this.viewerCore.targetTheta || 0);
      const initialPitch = (sceneConf.initialPitch !== undefined && sceneConf.initialPitch !== null)
        ? parseFloat(sceneConf.initialPitch)
        : 0;

      this.viewerCore.setCameraOrientation(initialYaw, initialPitch, defaultFov);
    }

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

    const transitionDur = sceneConf.transitionDuration !== undefined ? parseFloat(sceneConf.transitionDuration) : 0.35;
    const effect = sceneConf.transitionEffect || 'fade';

    // ── STAGE 1: Fast initial texture presentation ───────────────────────────
    this.textureManager.loadTexture(
      initialLoadUrl,
      (texture) => {
        // Drop out-of-order stale responses
        if (this._loadRequestId !== requestId) {
          if (oldUrl) this.textureManager.setTransitioning(oldUrl, false);
          this.textureManager.setTransitioning(initialLoadUrl, false);
          if (masterUrl) this.textureManager.setTransitioning(masterUrl, false);
          return;
        }

        // Pre-upload texture to GPU VRAM so render presentation doesn't hitch
        if (this.viewerCore.renderer && this.viewerCore.renderer.initTexture) {
          try {
            this.viewerCore.renderer.initTexture(texture);
          } catch (e) {}
        }

        // Cancel previous in-flight transition
        if (this.transitionManager && this.transitionManager.cancelActive) {
          this.transitionManager.cancelActive(sphere);
        }

        // Atomically swap texture
        if (sphere && sphere.material) {
          sphere.material.map = texture;
          sphere.material.color.set(0xffffff);
          sphere.material.needsUpdate = true;
        }

        this.textureManager.setActive(initialLoadUrl);

        // Clear and redraw hotspots inside WebGL scene
        this.hotspotManager.rebuild(hotspotsList || [], selectedHotspotId);

        // Rebuild 3D interactive objects inside WebGL scene
        if (this.viewerCore.object3dManager) {
          this.viewerCore.object3dManager.rebuild(sceneConf.objects3d || sceneConf.objects || [], selectedHotspotId);
        }

        const finalizeTransition = () => {
          if (this._loadRequestId === requestId) {
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
                DeviceProfile.shouldUpgradeMasterInEditor &&
                masterUrl &&
                masterUrl !== initialLoadUrl
              ) {
                this._queueMasterUpgrade(masterUrl, requestId, sphere);
              } else {
                if (masterUrl) this.textureManager.setTransitioning(masterUrl, false);
              }
            }

            if (onComplete) onComplete();
          }
        };

        if (transitionDur <= 0.05 || effect === 'instant') {
          if (sphere && sphere.material) sphere.material.opacity = 1;
          finalizeTransition();
        } else {
          // Smooth seamless fade presentation without black screen pause
          if (sphere && sphere.material) sphere.material.opacity = 0.6;
          this.transitionManager.fade(sphere, 1, transitionDur, finalizeTransition);
        }
      },
      (err) => {
        // If preview failed, try fallback directly to master URL
        if (initialLoadUrl !== masterUrl && masterUrl && this._loadRequestId === requestId) {
          console.warn('Preview load failed, falling back to master image:', err.message);
          this.textureManager.loadTexture(
            masterUrl,
            (masterTex) => {
              if (this._loadRequestId !== requestId) return;
              if (sphere && sphere.material) {
                sphere.material.map = masterTex;
                sphere.material.color.set(0xffffff);
                sphere.material.needsUpdate = true;
              }
              this.textureManager.setActive(masterUrl);
              this.hotspotManager.rebuild(hotspotsList || [], selectedHotspotId);
              this.isTransitioning = false;
              if (oldUrl) this.textureManager.setTransitioning(oldUrl, false);
              this.textureManager.setTransitioning(masterUrl, false);
              this.viewerCore.renderLoop.requestRender(3);
              if (onComplete) onComplete();
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

