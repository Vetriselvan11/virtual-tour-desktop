/**
 * Immersive Transition Manager for WoX BUILDER.
 * Performs delta-timed WebGL material opacity fades inside the active RenderLoop.
 */
export default class TransitionManager {
  constructor(renderLoop) {
    this.renderLoop = renderLoop;
    this.activeHooks = new Set();
  }

  /**
   * Cancels any in-flight transitions and optionally resets sphere material opacity.
   * @param {THREE.Mesh} [sphere] - Optional sphere mesh
   * @param {number|null} [resetOpacity=null] - Opacity to set on cancel, or null to preserve current
   */
  cancelActive(sphere, resetOpacity = null) {
    for (const hookId of this.activeHooks) {
      this.renderLoop.unregisterHook(hookId);
      this.renderLoop.setContinuousDemand(hookId, false);
    }
    this.activeHooks.clear();
    if (sphere && sphere.material && resetOpacity !== null) {
      sphere.material.opacity = resetOpacity;
    }
  }

  /**
   * Smoothly interpolates the panorama sphere opacity using Hermite smoothstep.
   * @param {THREE.Mesh} sphere - The background panorama sphere mesh
   * @param {number} targetOpacity - Target opacity level (0 to 1)
   * @param {number} durationSeconds - Fade duration in seconds
   * @param {Function} [onComplete] - Callback on fade animation complete
   */
  fade(sphere, targetOpacity, durationSeconds, onComplete) {
    if (!sphere || !sphere.material) {
      if (onComplete) onComplete();
      return;
    }

    if (durationSeconds <= 0.01) {
      sphere.material.opacity = targetOpacity;
      this.renderLoop.requestRender(2);
      if (onComplete) onComplete();
      return;
    }

    const startOpacity = sphere.material.opacity;
    const deltaOpacity = targetOpacity - startOpacity;

    if (Math.abs(deltaOpacity) < 0.005) {
      sphere.material.opacity = targetOpacity;
      this.renderLoop.requestRender(2);
      if (onComplete) onComplete();
      return;
    }

    let elapsed = 0;
    const hookId = `transition_fade_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.activeHooks.add(hookId);
    this.renderLoop.setContinuousDemand(hookId, true);

    // Register transition fader ticker hook in render loop
    this.renderLoop.registerHook(hookId, (time, delta) => {
      elapsed += delta;
      const t = Math.min(1, elapsed / durationSeconds);
      // Hermite smoothstep for natural, silky smooth acceleration and deceleration
      const progress = t * t * (3.0 - 2.0 * t);

      // Interpolate opacity in WebGL space
      sphere.material.opacity = startOpacity + deltaOpacity * progress;

      if (t >= 1) {
        sphere.material.opacity = targetOpacity;
        // Complete, clean up loop ticker
        this.activeHooks.delete(hookId);
        this.renderLoop.unregisterHook(hookId);
        this.renderLoop.setContinuousDemand(hookId, false);
        this.renderLoop.requestRender(2);
        if (onComplete) onComplete();
      }
      return true; // Continuously render while fade progresses
    });
  }
}
