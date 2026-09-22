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
   * Cancels any in-flight transitions and resets sphere material to full opacity.
   * @param {THREE.Mesh} [sphere] - Optional sphere mesh to ensure opacity is reset
   */
  cancelActive(sphere) {
    for (const hookId of this.activeHooks) {
      this.renderLoop.unregisterHook(hookId);
      this.renderLoop.setContinuousDemand(hookId, false);
    }
    this.activeHooks.clear();
    if (sphere && sphere.material) {
      sphere.material.opacity = 1;
    }
  }

  /**
   * Smoothly interpolates the panorama sphere opacity.
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
    let elapsed = 0;

    const hookId = `transition_fade_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.activeHooks.add(hookId);
    this.renderLoop.setContinuousDemand(hookId, true);

    // Register transition fader ticker hook in render loop
    this.renderLoop.registerHook(hookId, (time, delta) => {
      elapsed += delta;
      const progress = Math.min(1, elapsed / durationSeconds);

      // Interpolate opacity in WebGL space
      sphere.material.opacity = startOpacity + deltaOpacity * progress;

      if (progress >= 1) {
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
