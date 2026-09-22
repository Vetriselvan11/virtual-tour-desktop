import { sharedTextureManager, MAX_PRELOAD_ADJACENT } from '../../viewer/TextureManager';

/**
 * Background scene texture preloader for WoX BUILDER.
 * Uses bounded LRU caching and deduplication to preload adjacent panorama images safely.
 */
export const scenePreloader = {
  /**
   * Preloads textures of scenes linked by navigation hotspots (capped to MAX_PRELOAD_ADJACENT).
   * @param {Object} currentScene - Current active scene configuration
   * @param {Array} scenes - Full list of tour scenes
   * @param {Function} getImageUrl - API utility to get full image URL
   * @param {number} [maxCount=MAX_PRELOAD_ADJACENT]
   */
  preloadAdjacent: (currentScene, scenes, getImageUrl, maxCount = MAX_PRELOAD_ADJACENT) => {
    if (!currentScene || !scenes || !getImageUrl) return;
    sharedTextureManager.preloadAdjacent(currentScene, scenes, getImageUrl, maxCount);
  },

  /**
   * Fetches a texture from cache or loads it deduplicated if not present.
   * @param {string} url - Panoramic image URL
   * @param {Function} callback - Success callback receiving texture
   * @param {Function} [onError] - Error callback
   */
  getTexture: (url, callback, onError) => {
    sharedTextureManager.loadTexture(url, callback, onError);
  },

  /**
   * Empties the texture cache to free up WebGL memory contexts.
   */
  clearCache: () => {
    sharedTextureManager.clearCache();
  }
};
