import * as THREE from 'three';
import RenderLoop from './RenderLoop';
import TextureManager, { sharedTextureManager } from './TextureManager';
import TransitionManager from './TransitionManager';
import HotspotManager from './HotspotManager';
import Object3DManager from './Object3DManager';
import SceneManager from './SceneManager';
import TinyPlanetIntro from './TinyPlanetIntro';
import TileManager from './TileManager';
import { DeviceProfile } from './DeviceProfile';
import InputManager from './InputManager';
import WebXRManager from './WebXRManager';

const SCRATCH_NDC = new THREE.Vector2();
const SCRATCH_DIR = new THREE.Vector3();

/**
 * Persistent Three.js WebGL Engine Core.
 * Creates and keeps the WebGL context permanently alive.
 * Intercepts user inputs (panning, zoom, contextmenu, dragging) natively.
 */
export default class ViewerCore {
  constructor(mountElement, getImageUrlCallback) {
    this.mount = mountElement;
    this.getImageUrl = getImageUrlCallback;

    // Viewport layout dimensions
    const W = this.mount.clientWidth;
    const H = this.mount.clientHeight;

    // 1. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(95, (W && H) ? W / H : 1.77, 0.1, 100);
    this.camera.position.set(0, 0, 0);

    // 2. WebGL Renderer with device-aware capped DPR
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(W || window.innerWidth, H || window.innerHeight);
    this.renderer.setPixelRatio(DeviceProfile.effectiveDpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.mount.appendChild(this.renderer.domElement);

    // 3. Scene Graph
    this.scene = new THREE.Scene();

    // 4. Panorama Background Sphere
    const geometry = new THREE.SphereGeometry(5, 64, 64);
    geometry.scale(-1, 1, 1); // Flip geometry internally
    const material = new THREE.MeshBasicMaterial({
      color: 0x050508,
      transparent: true,
      opacity: 1
    });
    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    // 5. Initialize Engine Modules
    this.renderLoop = new RenderLoop(this.renderer, this.scene, this.camera);
    this.textureManager = sharedTextureManager;
    this.transitionManager = new TransitionManager(this.renderLoop);
    this.hotspotManager = new HotspotManager(this.scene, this.camera, this.renderLoop);
    this.object3dManager = new Object3DManager(this.scene, this.camera, this.renderLoop, null, this.getImageUrl, this);
    this.tileManager = new TileManager(this.scene, this.camera, this.renderLoop, this.getImageUrl);
    this.sceneManager = new SceneManager(this, this.textureManager, this.hotspotManager, this.transitionManager);
    this.tinyPlanetIntro = new TinyPlanetIntro(this);
    this.inputManager = new InputManager(this);
    this.webXRManager = new WebXRManager(this);

    // Initialize Gizmo in Editor Mode
    this.object3dManager.initTransformControls(this.renderer.domElement);

    // Camera lookup orientation values
    this.spherical = { phi: Math.PI / 2, theta: 0 };
    this.fov = 95;
    
    // Drag, click, and interaction trackers
    this.isDraggingCamera = false;
    this.prevMouse = { x: 0, y: 0 };
    this.dragDist = 0;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Cinematic Auto-Rotation and Easing/Inertia States
    this.autoRotateActive = false; // Disabled by default in editor for demand-driven rendering!
    this.autoRotateSpeed = 0.004; // Radians per frame (rate-independent delta sweep)
    this.targetTheta = 0;
    this.targetPhi = Math.PI / 2;
    this.baseTargetPhi = Math.PI / 2; // Baseline target pitch for sinusoidal auto-rotation drift
    this.idleTimeout = null;
    this.userPaused = false;
    this.userInteracting = false;
    
    // Smooth camera glide properties
    this.cameraEase = 0.055;
    this.qualityMode = DeviceProfile.current;
    this.editMode = false; // Prevents dragging hotspots in preview/viewer mode

    // Direct Event Handlers Callbacks (Wired to React UI / imperative listeners)
    this.onContextMenuTrigger = null;
    this.onCameraYawChange = null;
    this.onAutoRotateChange = null;

    // Start Rendering Loop & Camera Easing Tracker
    this.updateCameraFromSpherical();
    if (this.autoRotateActive) {
      this.renderLoop.setContinuousDemand('autorotate', true);
    }
    this.renderLoop.start();

    // Register a continuous hook inside RenderLoop for rate-independent animation & easing
    this.renderLoop.registerHook('camera_easing_drift', (time, delta) => {
      // Pause camera drift and auto-rotation while Tiny Planet intro is active
      if (this.isTinyPlanetPlaying()) {
        return false;
      }

      const rateDelta = Math.min(delta, 0.1);
      let isMoving = false;
      
      // Auto-Rotation and Sinusoidal floating drift
      if (this.autoRotateActive && !this.userInteracting) {
        this.targetTheta += this.autoRotateSpeed * (rateDelta * 60);
        this.targetPhi = this.baseTargetPhi + 0.04 * Math.sin(time * 0.85);
        isMoving = true;
      }
      
      // Smooth easing orientation interpolation (Inertia sliding)
      const ease = this.cameraEase;
      const dTheta = this.targetTheta - this.spherical.theta;
      const dPhi = this.targetPhi - this.spherical.phi;

      if (Math.abs(dTheta) > 0.00005 || Math.abs(dPhi) > 0.00005) {
        this.spherical.theta += dTheta * ease;
        this.spherical.phi += dPhi * ease;
        this.updateCameraFromSpherical();
        isMoving = true;
      } else if (this.spherical.theta !== this.targetTheta || this.spherical.phi !== this.targetPhi) {
        this.spherical.theta = this.targetTheta;
        this.spherical.phi = this.targetPhi;
        this.updateCameraFromSpherical();
        isMoving = true;
      }
      
      return isMoving;
    });

    // Bind Native UI input events
    this.bindEvents();
  }

  /**
   * Safe auto-rotation toggle.
   */
  setAutoRotate(active) {
    this.autoRotateActive = active;
    this.userPaused = !active;
    clearTimeout(this.idleTimeout);
    this.userInteracting = false;
    this.renderLoop.setContinuousDemand('autorotate', active);
    if (active) {
      this.renderLoop.wake();
    }
    if (this.onAutoRotateChange) {
      this.onAutoRotateChange(active);
    }
  }

  updateCameraFromSpherical() {
    const { phi, theta } = this.spherical;
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    this.camera.lookAt(x, y, z);

    if (this.tileManager && this.tileManager.enabled && !this.isTinyPlanetPlaying()) {
      this.tileManager.updateViewport();
    }

    if (this.onCameraYawChange && typeof this.onCameraYawChange === 'function') {
      this.onCameraYawChange(this.spherical.theta);
    }
  }

  _setFov(newFov) {
    const clamped = Math.max(25, Math.min(105, newFov));
    if (Math.abs(this.fov - clamped) > 0.001) {
      this.fov = clamped;
      if (this.camera) {
        this.camera.fov = clamped;
        this.camera.updateProjectionMatrix();
        if (this.tileManager && this.tileManager.enabled && !this.isTinyPlanetPlaying()) {
          this.tileManager.updateViewport();
        }
      }
    }
  }

  zoomIn() {
    this._setFov(this.fov - 8);
    this.handleUserInteraction();
    this.renderLoop.requestRender(10);
    this.triggerIdleResume();
  }

  zoomOut() {
    this._setFov(this.fov + 8);
    this.handleUserInteraction();
    this.renderLoop.requestRender(10);
    this.triggerIdleResume();
  }

  rotate(yawOffset, pitchOffset) {
    this.targetTheta += yawOffset;
    this.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.targetPhi + pitchOffset));
    this.baseTargetPhi = this.targetPhi;
    this.handleUserInteraction();
    this.renderLoop.requestRender(10);
    this.triggerIdleResume();
  }

  getYaw() {
    return this.spherical.theta;
  }

  getPitch() {
    return Math.PI / 2 - this.spherical.phi;
  }

  setCameraOrientation(yaw, pitch, fov) {
    if (yaw !== undefined && yaw !== null) {
      const parsedYaw = parseFloat(yaw);
      this.targetTheta = parsedYaw;
      this.spherical.theta = parsedYaw;
    }
    if (pitch !== undefined && pitch !== null) {
      const parsedPitch = parseFloat(pitch);
      const phi = Math.max(0.1, Math.min(Math.PI - 0.1, Math.PI / 2 - parsedPitch));
      this.targetPhi = phi;
      this.baseTargetPhi = phi;
      this.spherical.phi = phi;
    }
    if (fov !== undefined && fov !== null) {
      this._setFov(parseFloat(fov));
    }
    this.updateCameraFromSpherical();
    this.renderLoop.requestRender(5);
  }

  getYawPitchFromClick(clientX, clientY) {
    const rect = this.mount.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    SCRATCH_NDC.set(x, y);
    SCRATCH_DIR.set(SCRATCH_NDC.x, SCRATCH_NDC.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const yaw = Math.atan2(SCRATCH_DIR.x, SCRATCH_DIR.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, SCRATCH_DIR.y)));
    return { yaw, pitch };
  }

  handleUserInteraction() {
    this.userInteracting = true;
    clearTimeout(this.idleTimeout);
  }

  triggerIdleResume(delayMs = 3500) {
    clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.userInteracting = false;
      this.baseTargetPhi = this.targetPhi;
    }, delayMs);
  }

  bindEvents() {
    this.resizeHandler = () => {
      if (!this.mount) return;
      const W = this.mount.clientWidth;
      const H = this.mount.clientHeight;
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(W, H);
      if (this.tinyPlanetIntro) {
        this.tinyPlanetIntro.updateAspect();
      }
      this.renderLoop.requestRender(2);
    };
    window.addEventListener('resize', this.resizeHandler);

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeHandler();
      });
      this.resizeObserver.observe(this.mount);
    }
  }

  /**
   * Triggers the cinematic Tiny Planet into 360 world intro.
   */
  playTinyPlanetIntro(options = {}) {
    if (!this.tinyPlanetIntro) return;

    const texture = options.texture || this.sphere?.material?.map;
    if (!texture) {
      if (options.onComplete) options.onComplete();
      return;
    }

    const targetYaw = (options.targetYaw !== undefined && options.targetYaw !== null)
      ? Number(options.targetYaw)
      : (this.targetTheta !== undefined ? this.targetTheta : 0);

    const targetPitch = (options.targetPitch !== undefined && options.targetPitch !== null)
      ? Number(options.targetPitch)
      : (this.targetPhi !== undefined ? (Math.PI / 2 - this.targetPhi) : 0);

    const targetFov = (options.targetFov !== undefined && options.targetFov !== null)
      ? Number(options.targetFov)
      : (this.fov || 95);

    // Keep camera targets pinned to the exact user-configured orientation
    this.targetTheta = targetYaw;
    this.spherical.theta = targetYaw;
    this.targetPhi = Math.PI / 2 - targetPitch;
    this.baseTargetPhi = this.targetPhi;
    this.spherical.phi = this.targetPhi;
    this.updateCameraFromSpherical();

    this.tinyPlanetIntro.play({
      texture,
      targetYaw,
      targetPitch,
      targetFov,
      duration: options.duration || 5.0,
      holdDuration: options.holdDuration || 0.9,
      onProgress: options.onProgress,
      onComplete: () => {
        if (options.onComplete) options.onComplete();
      }
    });
  }

  /**
   * Smoothly skips the Tiny Planet intro and reveals the normal 360 viewer.
   */
  skipTinyPlanetIntro() {
    if (this.tinyPlanetIntro) {
      this.tinyPlanetIntro.skip();
    }
  }

  /**
   * Returns whether the Tiny Planet intro is currently animating.
   */
  isTinyPlanetPlaying() {
    return !!(this.tinyPlanetIntro && this.tinyPlanetIntro.isPlaying);
  }

  setEditMode(editMode) {
    this.editMode = Boolean(editMode);
    if (this.object3dManager) {
      this.object3dManager.editMode = Boolean(editMode);
    }
  }

  /**
   * Completely destroys WebGL allocations when unmounting the root wrapper.
   */
  destroy() {
    this.renderLoop.stop();
    this.textureManager.clearCache();
    this.hotspotManager.clear();
    if (this.object3dManager) {
      this.object3dManager.destroy();
      this.object3dManager = null;
    }
    if (this.tileManager) {
      this.tileManager.dispose();
      this.tileManager = null;
    }
    if (this.tinyPlanetIntro) {
      this.tinyPlanetIntro.dispose();
      this.tinyPlanetIntro = null;
    }

    if (this._yawRaf) {
      cancelAnimationFrame(this._yawRaf);
      this._yawRaf = null;
    }
    clearTimeout(this.idleTimeout);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Detach UI Listeners
    window.removeEventListener('resize', this.resizeHandler);
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }
    if (this.webXRManager) {
      this.webXRManager.destroy();
      this.webXRManager = null;
    }

    // Dispose core elements
    this.sphere.geometry.dispose();
    this.sphere.material.dispose();

    if (this.mount.contains(this.renderer.domElement)) {
      this.mount.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }

  getTileStats() {
    return this.tileManager ? this.tileManager.getStats() : null;
  }

  setQuality(qualityMode) {
    this.qualityMode = qualityMode;
    DeviceProfile.setProfile(qualityMode);
    if (this.renderer) {
      this.renderer.setPixelRatio(DeviceProfile.effectiveDpr);
      this.resizeHandler();
    }
  }

  setCameraEase(ease) {
    this.cameraEase = parseFloat(ease) || 0.055;
  }
}
