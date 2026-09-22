/**
 * Immersive Micro-Animations Ticker for WoX BUILDER Hotspots.
 * Drives real-time spinning rings, pulsing glows, and floating sinus waves.
 */
export const HotspotAnimations = {
  /**
   * Registers frame-timed tickers to animate Three.js hotspot sprites.
   * @param {RenderLoop} renderLoop - Active render loop manager
   * @param {Array} meshesListRef - Reference to current sprite meshes array
   * @param {string} selectedId - Selected hotspot ID
   */
  registerTicker: (renderLoop, meshesListRef, selectedId) => {
    // Register hook inside the central continuous render loop
    renderLoop.registerHook('hotspot_sprite_animator', (time) => {
      meshesListRef.forEach(({ sprite, ring, hotspot }) => {
        if (!sprite) return;

        const isSelected = hotspot.id === selectedId;
        const baseScale = (hotspot.size || 40) / 110;

        // 1. Futuristic Selector Spinning Outline: rotates selected rings
        if (isSelected && ring) {
          // Slowly rotate selection ring sprite in screenspace
          ring.material.rotation = time * 0.45; 
        }

        // 2. Immersive Floating Effect: applies a slow sinus wave to vertical offset
        const floatOffset = Math.sin(time * 2.0 + hotspot.yaw) * 0.024;
        
        // Translate base 3D cartesian coordinates with the wave offset
        const yaw = hotspot.yaw || 0;
        const pitch = (hotspot.pitch || 0) + floatOffset * 0.12; // Cap wave vertical amplitude
        const r = 4.78; // Offset radius zone

        sprite.position.x = r * Math.cos(pitch) * Math.sin(yaw);
        sprite.position.y = r * Math.sin(pitch);
        sprite.position.z = r * Math.cos(pitch) * Math.cos(yaw);

        if (ring) {
          ring.position.copy(sprite.position);
        }

        // 3. Glowing Pulse Waves: pulses outer rings smoothly
        if (ring) {
          const pulse = baseScale * (1.1 + 0.28 * Math.sin(time * 4.8));
          ring.scale.set(pulse, pulse, 1);
          ring.material.opacity = 0.2 + 0.35 * Math.sin(time * 4.8);
        }
      });
    });
  },

  /**
   * Triggers smooth scale transition on mouse-over hover state.
   * @param {THREE.Sprite} sprite - Active sprite mesh
   * @param {number} baseScale - Base scale parameter
   * @param {boolean} isHovered - Hover state
   */
  interpolateHoverScale: (sprite, baseScale, isHovered) => {
    if (!sprite) return;
    const targetScale = isHovered ? baseScale * 1.25 : baseScale;
    sprite.scale.set(targetScale, targetScale, 1);
  }
};
