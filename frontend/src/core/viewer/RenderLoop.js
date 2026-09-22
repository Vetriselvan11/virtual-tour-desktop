import * as THREE from 'three';

/**
 * Adaptive Demand-Driven Render Loop Controller for WoX BUILDER.
 * 
 * Features:
 * - Runs continuous 60 FPS rendering when active (auto-rotation, camera inertia/drag, transitions, animations)
 * - Transitions into low-power idle sleep when the scene is completely stationary
 * - Supports requestRender(frames) / invalidate() for instant zero-latency on-demand rendering
 * - Continuous demand reference registry for transitions, guided tours, and interactions
 */
export default class RenderLoop {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.active = false;
    this.frameId = null;
    this.clock = new THREE.Clock(false);
    
    // Registered per-frame animation tickers
    this.hooks = new Map();
    
    // Continuous demand sources registry (e.g. 'autorotate', 'transition', 'drag')
    this.continuousDemands = new Set();
    
    // On-demand burst frames counter
    this.requestedFrames = 0;
    this.isIdle = false;
    this.demandMode = true; // Set to false to force unconditional RAF if ever required
    this.xrMode = false;
  }

  /**
   * Registers a custom callback run on every frame.
   * Return `true` from the callback if active motion occurred that requires rendering.
   * @param {string} id - Unique identifier for the callback hook
   * @param {Function} callback - Ticker callback receiving (elapsedTime, clockDelta)
   */
  registerHook(id, callback) {
    this.hooks.set(id, callback);
    this.requestRender(2);
  }

  /**
   * Unregisters a custom callback.
   * @param {string} id - Hook ID to remove
   */
  unregisterHook(id) {
    this.hooks.delete(id);
    this.requestRender(1);
  }

  /**
   * Declares continuous rendering demand from a specific subsystem.
   * While at least one continuous demand is active, 60 FPS rendering is guaranteed.
   * @param {string} sourceId - e.g. 'autorotate', 'transition', 'interaction', 'animation'
   * @param {boolean} active - True to require continuous frames, false to release
   */
  setContinuousDemand(sourceId, active) {
    if (active) {
      this.continuousDemands.add(sourceId);
      this.wake();
    } else {
      this.continuousDemands.delete(sourceId);
      this.requestRender(3); // Render extra settling frames after releasing
    }
  }

  /**
   * Triggers one or more on-demand frames immediately.
   * @param {number} [frameCount=2] - Number of consecutive frames to render
   */
  requestRender(frameCount = 2) {
    this.requestedFrames = Math.max(this.requestedFrames, frameCount);
    this.wake();
  }

  /**
   * Wakes the RAF loop if currently idle.
   */
  wake() {
    if (!this.active) return;
    if (this.isIdle || !this.frameId) {
      this.isIdle = false;
      this.clock.start();
      this._scheduleFrame();
    }
  }

  /**
   * Starts the animation loop.
   */
  start() {
    if (this.active || this.xrMode) return;
    this.active = true;
    this.isIdle = false;
    this.requestedFrames = 3;
    this.clock.start();
    this._scheduleFrame();
  }

  /**
   * Enables or disables XR Mode, which pauses the custom RAF loop to let WebXR take over.
   */
  setXRMode(active, renderer = null) {
    this.xrMode = active;
    if (active) {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      this.active = false;
    } else {
      this.start();
    }
  }

  /**
   * Internal RAF frame scheduler.
   * @private
   */
  _scheduleFrame() {
    if (!this.active || this.frameId) return;

    const loop = () => {
      this.frameId = null;
      if (!this.active) return;

      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      let hookDemandsMotion = false;

      // Execute registered animation ticks
      this.hooks.forEach((hook, id) => {
        try {
          const result = hook(time, delta);
          if (result === true) {
            hookDemandsMotion = true;
          }
        } catch (err) {
          console.error(`Error inside RenderLoop tick callback "${id}":`, err);
        }
      });

      const hasContinuousDemand = this.continuousDemands.size > 0;
      const hasRequestedFrames = this.requestedFrames > 0;

      if (hasRequestedFrames) {
        this.requestedFrames--;
      }

      const shouldRender = !this.demandMode || hasContinuousDemand || hookDemandsMotion || hasRequestedFrames;

      if (shouldRender) {
        this.isIdle = false;
        // Render Three.js viewport scene
        this.renderer.render(this.scene, this.camera);
        this.frameId = requestAnimationFrame(loop);
      } else {
        // One final crisp settling frame before entering idle sleep
        this.renderer.render(this.scene, this.camera);
        this.isIdle = true;
        this.clock.stop();
        // Do not request next frame; loop sleeps until wake() or requestRender()
      }
    };

    this.frameId = requestAnimationFrame(loop);
  }

  /**
   * Stops the animation loop and cancels active frame requests.
   */
  stop() {
    this.active = false;
    this.isIdle = true;
    this.continuousDemands.clear();
    this.requestedFrames = 0;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.clock.stop();
  }
}

