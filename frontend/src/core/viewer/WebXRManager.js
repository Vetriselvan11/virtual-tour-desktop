import * as THREE from 'three';

/**
 * WebXR Manager for VR support in 360 Viewer.
 * Handles immersive-vr sessions, head tracking, controller raycasting, and gaze interaction.
 */
export default class WebXRManager {
  constructor(core) {
    this.core = core;
    this.renderer = core.renderer;
    this.scene = core.scene;
    this.camera = core.camera;

    this.enabled = false;
    this.session = null;
    this.controllers = [];
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    
    // VR Gaze / Interactivity state
    this.hoveredHotspot = null;
    this.dwellStart = null;
    this.dwellDuration = 1500; // ms

    this.initXR();
  }

  initXR() {
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');

    // Setup 2 default controllers
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      
      controller.addEventListener('selectstart', () => {
        this.handleControllerSelect(controller);
      });
      
      this.scene.add(controller);
      
      // Visual Ray (Laser)
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5)
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(geometry, material);
      line.name = 'line';
      controller.add(line);
      
      this.controllers.push(controller);
    }

    // VR Gaze Ring
    this.gazeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.015, 0.025, 32, 1, 0, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    this.gazeRing.position.z = -1; // 1m away
    this.gazeRing.visible = false;
    this.camera.add(this.gazeRing);
  }

  async checkSupported() {
    if ('xr' in navigator) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        return supported;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async enterVR() {
    if (!this.enabled && await this.checkSupported()) {
      try {
        const session = await navigator.xr.requestSession('immersive-vr');
        this.onSessionStarted(session);
      } catch (e) {
        console.error('Failed to start WebXR session', e);
      }
    }
  }

  async toggleVR() {
    if (this.enabled) {
      this.exitVR();
    } else {
      await this.enterVR();
    }
  }

  onSessionStarted(session) {
    this.session = session;
    this.enabled = true;
    if (this.core.inputManager) {
      this._previousInputMode = this.core.inputManager.mode;
      this.core.inputManager.mode = 'WEBXR';
    }
    
    session.addEventListener('end', this.onSessionEnded.bind(this));
    this.renderer.xr.setSession(session);
    
    // Pause custom render loop, let WebXR take over AnimationLoop
    this.core.renderLoop.setXRMode(true, this.renderer);
    
    // Hook VR update tick
    this.renderer.setAnimationLoop((timestamp, frame) => {
      this.updateVR(timestamp, frame);
      this.renderer.render(this.scene, this.camera);
    });

    if (typeof this.onSessionStateChange === 'function') {
      try {
        this.onSessionStateChange(true);
      } catch (err) {
        console.warn('Error in onSessionStateChange callback:', err);
      }
    }
  }

  onSessionEnded() {
    this.session = null;
    this.enabled = false;
    if (this.core.inputManager) {
      this.core.inputManager.mode = this._previousInputMode || 'DESKTOP';
    }
    this.renderer.setAnimationLoop(null); // Stop WebXR loop
    this.core.renderLoop.setXRMode(false); // Resume custom RAF
    
    // Resync spherical camera with headset orientation to avoid snap back
    // (In a full implementation, you extract Euler from VR camera and apply to targetTheta/targetPhi)
    if (typeof this.onSessionStateChange === 'function') {
      try {
        this.onSessionStateChange(false);
      } catch (err) {
        console.warn('Error in onSessionStateChange callback:', err);
      }
    }
  }

  exitVR() {
    if (this.session) {
      this.session.end().catch(err => console.warn('WebXR session end error:', err));
    }
  }

  updateVR(time, frame) {
    if (!this.enabled || !frame) return;

    // Optional: Gaze support if controllers aren't connected
    let isUsingController = false;

    for (const controller of this.controllers) {
      if (controller.visible) {
        isUsingController = true;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
        
        const hit = this.core.hotspotManager.getHitHotspot(new THREE.Vector2(0,0), this.raycaster);
        this.handleHover(hit, time);
        
        // Shorten laser pointer if hit
        const line = controller.getObjectByName('line');
        if (line) {
          if (hit && hit.distance) {
             line.scale.z = hit.distance / 5;
          } else {
             line.scale.z = 1;
          }
        }
      }
    }

    if (!isUsingController) {
      // Fallback to Gaze
      this.gazeRing.visible = true;
      this.tempMatrix.identity().extractRotation(this.camera.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(this.camera.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
      const hit = this.core.hotspotManager.getHitHotspot(new THREE.Vector2(0,0), this.raycaster);
      this.handleHover(hit, time);
      
      // Auto-click on dwell
      if (hit && this.hoveredHotspot) {
        if (!this.dwellStart) this.dwellStart = time;
        const progress = Math.min(1, (time - this.dwellStart) / this.dwellDuration);
        
        // Update ring geometry for visual feedback
        this.gazeRing.geometry.dispose();
        this.gazeRing.geometry = new THREE.RingGeometry(0.015, 0.025, 32, 1, 0, Math.PI * 2 * progress);
        
        if (progress >= 1) {
          this.handleControllerSelect({ fakeGazeController: true }, hit);
          this.dwellStart = time + 1000; // prevent immediate re-trigger
        }
      } else {
        this.dwellStart = null;
        this.gazeRing.geometry.dispose();
        this.gazeRing.geometry = new THREE.RingGeometry(0.015, 0.025, 32, 1, 0, 0);
      }
    } else {
      this.gazeRing.visible = false;
    }
  }

  handleHover(hit, time) {
    if (hit) {
      this.hoveredHotspot = hit;
    } else {
      this.hoveredHotspot = null;
    }
  }

  handleControllerSelect(controller, overrideHit = null) {
    let hit = overrideHit;
    if (!hit) {
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
      hit = this.core.hotspotManager.getHitHotspot(new THREE.Vector2(0,0), this.raycaster);
    }
    
    if (hit && this.core.hotspotManager.onHotspotClick) {
      // Fake a click event to reuse the existing desktop hotspot engine
      this.core.hotspotManager.onHotspotClick(hit, { type: 'vrselect' });
    }
  }

  destroy() {
    this.exitVR();
    for (const controller of this.controllers) {
      this.scene.remove(controller);
    }
    this.controllers = [];
  }
}
