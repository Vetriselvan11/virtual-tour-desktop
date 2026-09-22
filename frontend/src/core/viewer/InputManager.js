import * as THREE from 'three';

/**
 * Unified Input Architecture for 360 Viewer.
 * Normalizes Mouse, Touch, and Gyroscope into Camera Orientation values.
 */
export default class InputManager {
  constructor(core) {
    this.core = core;
    this.mount = core.mount;
    
    // State
    this.mode = 'DESKTOP'; // DESKTOP, MOBILE_GYRO, WEBXR
    this.gyroEnabled = false;
    
    // Interaction Trackers
    this.isDraggingCamera = false;
    this.prevMouse = { x: 0, y: 0 };
    this.dragDist = 0;
    this.lastTouchDist = 0;

    // Gyroscope State
    this.deviceOrientation = null;
    this.screenOrientation = 0;
    this.gyroOffsetTheta = 0; // Calibration offset
    this.gyroStartTheta = null;
    
    // Bindings
    this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.onScreenOrientation = this.onScreenOrientation.bind(this);
    
    this.bindEvents();
  }

  bindEvents() {
    // Mouse / Touch are always bound, but behavior changes based on mode/gyro
    this.onMouseDown = (e) => this.handlePointerDown(e.clientX, e.clientY, e, false);
    this.onMouseMove = (e) => this.handlePointerMove(e.clientX, e.clientY, e, false);
    this.onMouseUp = (e) => this.handlePointerUp(e, false);
    
    this.onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, e, true);
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.lastTouchDist = Math.sqrt(dx * dx + dy * dy);
        this.core.handleUserInteraction();
      }
      this.core.renderLoop.setContinuousDemand('interaction', true);
    };

    this.onTouchMove = (e) => {
      if (e.touches.length === 1) {
        this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, e, true);
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = this.lastTouchDist - dist;
        this.core._setFov(this.core.fov + delta * 0.15);
        this.lastTouchDist = dist;
        this.core.handleUserInteraction();
        this.core.renderLoop.requestRender(2);
      }
    };

    this.onTouchEnd = (e) => this.handlePointerUp(e, true);
    
    this.onWheel = (e) => {
      if (this.mode === 'WEBXR') return;
      if (this.core.isTinyPlanetPlaying()) return;
      e.preventDefault();
      this.core._setFov(this.core.fov + e.deltaY * 0.055);
      this.core.handleUserInteraction();
      this.core.renderLoop.requestRender(5);
      this.core.triggerIdleResume();
    };

    this.onClick = (e) => {
      if (this.mode === 'WEBXR') return;
      if (this.core.isTinyPlanetPlaying()) return;
      if (e && (e.button === 2 || e.which === 3)) return; // Ignore context
      if (this.dragDist > 6 || this.core.hotspotManager.dragDistance > 6) return;

      const rect = this.mount.getBoundingClientRect();
      this.core.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.core.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.core.raycaster.setFromCamera(this.core.mouse, this.core.camera);
      const hitHotspot = this.core.hotspotManager.getHitHotspot(this.core.mouse, this.core.raycaster);
      const hitObject = (!hitHotspot && this.core.object3dManager) ? this.core.object3dManager.getHitObject(this.core.mouse, this.core.raycaster) : null;

      if (hitHotspot) {
        if (this.core.hotspotManager.onHotspotClick) this.core.hotspotManager.onHotspotClick(hitHotspot, e);
      } else if (hitObject) {
        if (this.core.object3dManager.onObjectClick) this.core.object3dManager.onObjectClick(hitObject, e);
      } else {
        if (this.core.onBackgroundClick) {
          const coords = this.core.getYawPitchFromClick(e.clientX, e.clientY);
          this.core.onBackgroundClick(coords);
        }
      }
      this.core.renderLoop.requestRender(2);
    };

    this.onDblClick = (e) => {
      if (this.mode === 'WEBXR') return;
      if (this.core.isTinyPlanetPlaying()) return;
      const coords = this.core.getYawPitchFromClick(e.clientX, e.clientY);
      if (coords) {
        this.core.targetTheta = coords.yaw;
        this.core.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, Math.PI / 2 - coords.pitch));
        this.core.baseTargetPhi = this.core.targetPhi;
        this.core.handleUserInteraction();
        this.core.renderLoop.requestRender(10);
        this.core.triggerIdleResume();
      }
    };

    this.onContextMenu = (e) => {
      if (this.mode === 'WEBXR') return;
      if (this.core.isTinyPlanetPlaying()) return;
      e.preventDefault();
      const rect = this.mount.getBoundingClientRect();
      this.core.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.core.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = this.core.hotspotManager.getHitHotspot(this.core.mouse, this.core.raycaster);
      if (this.core.onContextMenuTrigger) {
        this.core.onContextMenuTrigger(e.clientX, e.clientY, hit);
      }
      this.core.renderLoop.requestRender(2);
    };

    this.mount.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.mount.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.mount.addEventListener('touchmove', this.onTouchMove, { passive: true });
    this.mount.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.mount.addEventListener('wheel', this.onWheel, { passive: false });
    this.mount.addEventListener('click', this.onClick);
    this.mount.addEventListener('dblclick', this.onDblClick);
    this.mount.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('orientationchange', this.onScreenOrientation);
    
    // Hook into render loop for gyroscope continuous updates
    this.core.renderLoop.registerHook('gyroscope_update', () => {
      if (this.gyroEnabled && this.deviceOrientation && !this.isDraggingCamera) {
        this.updateCameraFromGyro();
        return true;
      }
      return false;
    });
  }

  handlePointerDown(clientX, clientY, e, isTouch) {
    if (this.mode === 'WEBXR') return; // Block mouse/touch when VR owns camera
    if (this.core.isTinyPlanetPlaying()) return;
    if (!isTouch && (e.button === 2 || e.which === 3)) return; // context

    const rect = this.mount.getBoundingClientRect();
    this.core.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.core.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const isHotspotGrabbed = this.core.editMode && this.core.hotspotManager.handleMouseDown(
      this.core.mouse, this.core.raycaster, this.core.sphere, this.core.selectedHotspotIds || []
    );

    if (!isHotspotGrabbed) {
      this.isDraggingCamera = true;
      this.prevMouse = { x: clientX, y: clientY };
      this.dragDist = 0;
      this.core.handleUserInteraction();
    }
    this.core.renderLoop.setContinuousDemand('interaction', true);
  }

  handlePointerMove(clientX, clientY, e, isTouch) {
    if (this.mode === 'WEBXR') return; // VR controls camera, disable normal touch/mouse
    if (this.core.isTinyPlanetPlaying()) return;
    const rect = this.mount.getBoundingClientRect();
    
    if (this.core.hotspotManager.isDragging) {
      this.core.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.core.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.core.hotspotManager.handleMouseDrag(this.core.mouse, this.core.raycaster, this.core.sphere, e, this.core.snapSettings);
      this.core.renderLoop.requestRender(2);
    } else if (this.isDraggingCamera) {
      const dx = clientX - this.prevMouse.x;
      const dy = clientY - this.prevMouse.y;
      this.dragDist += Math.abs(dx) + Math.abs(dy);
      
      const speed = isTouch ? 0.004 : 0.003;
      
      // If gyro is on, touch drag temporarily adjusts the offset instead of base camera
      if (this.gyroEnabled) {
        this.gyroOffsetTheta -= dx * speed;
        // Optional: vertical gyro offset adjustment
      } else {
        this.core.targetTheta -= dx * speed;
        this.core.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.core.targetPhi + dy * speed));
      }
      
      this.prevMouse = { x: clientX, y: clientY };
      this.core.handleUserInteraction();
      this.core.renderLoop.requestRender(2);
    } else if (!isTouch) {
      this.core.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.core.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const isHoveringHotspot = this.core.hotspotManager.handleMouseMove(this.core.mouse, this.core.raycaster, rect);
      const isHoveringObject = (!isHoveringHotspot && this.core.object3dManager) ? this.core.object3dManager.handleMouseMove(this.core.mouse, this.core.raycaster, rect) : false;
      this.mount.style.cursor = (isHoveringHotspot || isHoveringObject) ? 'pointer' : 'grab';
      this.core.renderLoop.requestRender(1);
    }
  }

  handlePointerUp(e, isTouch) {
    if (this.mode === 'WEBXR') return;
    if (this.core.isTinyPlanetPlaying()) return;
    this.core.hotspotManager.handleMouseUp();
    this.isDraggingCamera = false;
    this.core.baseTargetPhi = this.core.targetPhi;
    this.core.renderLoop.setContinuousDemand('interaction', false);
    this.core.renderLoop.requestRender(5);
    this.core.triggerIdleResume();
  }

  // --- GYROSCOPE ---

  async requestGyroPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          this.enableGyro();
          return true;
        } else {
          console.warn('Gyroscope permission denied.');
          return false;
        }
      } catch (e) {
        console.error('Error requesting gyro permission:', e);
        return false;
      }
    } else {
      // Non-iOS 13+ devices
      this.enableGyro();
      return true;
    }
  }

  enableGyro() {
    if (this.gyroEnabled) return;
    this.gyroEnabled = true;
    this.mode = 'MOBILE_GYRO';
    this.gyroStartTheta = null;
    this.onScreenOrientation(); // capture initial rotation
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    this.core.renderLoop.wake();
  }

  disableGyro() {
    if (!this.gyroEnabled) return;
    this.gyroEnabled = false;
    this.mode = 'DESKTOP';
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
  }

  calibrateGyro() {
    // Current camera yaw becomes the new forward
    this.gyroStartTheta = null; 
    this.gyroOffsetTheta = this.core.spherical.theta;
  }

  onScreenOrientation() {
    this.screenOrientation = window.orientation || 0;
  }

  onDeviceOrientation(event) {
    // Only store the latest event. We compute per-frame to match screen refresh and avoid jank.
    if (event.alpha !== null) {
      this.deviceOrientation = event;
    }
  }

  updateCameraFromGyro() {
    if (!this.deviceOrientation) return;
    const { alpha, beta, gamma } = this.deviceOrientation;
    
    // Euler angles conversion logic
    const a = THREE.MathUtils.degToRad(alpha || 0);
    const b = THREE.MathUtils.degToRad(beta || 0);
    const c = THREE.MathUtils.degToRad(gamma || 0);
    const orient = THREE.MathUtils.degToRad(this.screenOrientation || 0);
    
    // 1. Calculate raw target quaternion from device sensors
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around x
    const zee = new THREE.Vector3(0, 0, 1);
    
    euler.set(b, a, -c, 'YXZ');
    const targetQ = new THREE.Quaternion();
    targetQ.setFromEuler(euler);
    targetQ.multiply(q1);
    targetQ.multiply(q0.setFromAxisAngle(zee, -orient));

    // 2. Base calibration lock
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(targetQ);
    const rawYaw = Math.atan2(forward.x, forward.z);
    const rawPitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));

    if (this.gyroStartTheta === null) {
       this.gyroStartTheta = rawYaw;
    }

    // 3. Apply Calibration Offset & Touch Offset
    const computedYaw = rawYaw - this.gyroStartTheta + this.gyroOffsetTheta;
    const computedPhi = Math.PI / 2 - rawPitch;

    // 4. Dead-zone filtering for micro-motion (configurable)
    const DEAD_ZONE = 0.0005; // radians
    if (this.lastComputedYaw !== undefined && this.lastComputedPhi !== undefined) {
      if (Math.abs(computedYaw - this.lastComputedYaw) < DEAD_ZONE && 
          Math.abs(computedPhi - this.lastComputedPhi) < DEAD_ZONE) {
        return; // Ignore micro-jitters
      }
    }
    this.lastComputedYaw = computedYaw;
    this.lastComputedPhi = computedPhi;

    // 5. Shortest path angular wrap handling to prevent 360-degree spins during easing
    const TWO_PI = Math.PI * 2;
    let currentTheta = this.core.spherical.theta;
    
    let diff = (computedYaw - currentTheta) % TWO_PI;
    if (diff > Math.PI) diff -= TWO_PI;
    if (diff < -Math.PI) diff += TWO_PI;
    
    const finalTargetTheta = currentTheta + diff;

    // 6. Smooth SLERP-like easing parameterization
    const smoothFactor = 0.25; // 1.0 for RAW, 0.25 for SMOOTH responsive
    
    this.core.targetTheta = this.core.targetTheta + (finalTargetTheta - this.core.targetTheta) * smoothFactor;
    this.core.targetPhi = this.core.targetPhi + (computedPhi - this.core.targetPhi) * smoothFactor;
    
    this.core.spherical.theta = this.core.spherical.theta + (this.core.targetTheta - this.core.spherical.theta) * smoothFactor;
    this.core.spherical.phi = this.core.spherical.phi + (this.core.targetPhi - this.core.spherical.phi) * smoothFactor;

    this.core.updateCameraFromSpherical();
  }

  destroy() {
    this.disableGyro();
    this.mount.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.mount.removeEventListener('touchstart', this.onTouchStart);
    this.mount.removeEventListener('touchmove', this.onTouchMove);
    this.mount.removeEventListener('touchend', this.onTouchEnd);
    this.mount.removeEventListener('wheel', this.onWheel);
    this.mount.removeEventListener('click', this.onClick);
    this.mount.removeEventListener('dblclick', this.onDblClick);
    this.mount.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('orientationchange', this.onScreenOrientation);
    this.core.renderLoop.unregisterHook('gyroscope_update');
  }
}
