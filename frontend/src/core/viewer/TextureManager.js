import * as THREE from 'three';
import { DeviceProfile } from './DeviceProfile';

/**
 * Bounded Panorama Texture Caching & GPU Resource Manager for 360TOOL.
 * 
 * Features:
 * - Deterministic Bounded LRU Cache calibrated to DeviceProfile (2 for LOW, 3 for MEDIUM, 5 for HIGH)
 * - In-flight load deduplication (prevents duplicate network/decode calls for identical URLs)
 * - Lifecycle protection: Distinguishes ACTIVE, TRANSITIONING, PRELOADED, and EVICTABLE states
 * - Safe GPU resource disposal (calls texture.dispose() and releases references upon eviction)
 * - Bounded adjacent-scene preloading
 */
export const MAX_CACHED_PANORAMAS = DeviceProfile.maxGpuTextures;
export const MAX_PRELOAD_ADJACENT = DeviceProfile.maxAdjacentPreloads;

export class TextureManager {
  /**
   * @param {number} [maxCacheSize] - Max panoramas allowed in GPU VRAM
   */
  constructor(maxCacheSize) {
    this.maxCacheSize = maxCacheSize !== undefined ? Math.max(2, maxCacheSize) : DeviceProfile.maxGpuTextures;
    /** @type {Map<string, { texture: THREE.Texture, lastUsed: number, state: 'ACTIVE'|'TRANSITIONING'|'PRELOADED'|'EVICTABLE' }>} */
    this.cache = new Map();
    /** @type {Map<string, Promise<THREE.Texture>>} */
    this.pendingLoads = new Map();
    this.loader = new THREE.TextureLoader();
    this.activeUrl = null;
  }

  /**
   * Retrieves a texture from cache or initiates a deduplicated async load.
   * @param {string} url - URL path to the panoramic image
   * @param {Function} [onSuccess] - Callback triggered on success receiving the THREE.Texture
   * @param {Function} [onError] - Callback triggered on error
   * @returns {Promise<THREE.Texture>}
   */
  loadTexture(url, onSuccess, onError) {
    if (!url) {
      const err = new Error('Texture URL is invalid or empty');
      if (onError) onError(err);
      const rej = Promise.reject(err);
      rej.catch(() => {});
      return rej;
    }

    // 1. Cache Hit: Update lastUsed and return immediately
    if (this.cache.has(url)) {
      const entry = this.cache.get(url);
      entry.lastUsed = Date.now();
      if (onSuccess) onSuccess(entry.texture);
      return Promise.resolve(entry.texture);
    }

    // 2. In-flight Request Deduplication: Attach to existing loader promise
    if (this.pendingLoads.has(url)) {
      const pendingPromise = this.pendingLoads.get(url);
      if (onSuccess || onError) {
        return pendingPromise
          .then((texture) => {
            if (onSuccess) onSuccess(texture);
            return texture;
          })
          .catch((err) => {
            const errorObj = (err instanceof Error) ? err : new Error(`Failed to load texture at URL "${url}"`);
            if (onError) onError(errorObj);
            return null;
          });
      }
      return pendingPromise;
    }

    // 3. Cache Miss: Dispatch single async TextureLoader request
    const loadPromise = new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;

          // Store in bounded cache
          this.cache.set(url, {
            texture,
            lastUsed: Date.now(),
            state: 'PRELOADED',
          });

          this.pendingLoads.delete(url);

          // Enforce bounded VRAM limit
          this._enforceLimit();

          if (onSuccess) onSuccess(texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          this.pendingLoads.delete(url);
          const errorObj = (err instanceof Error) ? err : new Error(`Failed to load texture at URL "${url}"`);
          console.warn(`Failed to load texture at URL "${url}":`, errorObj.message);
          if (onError) onError(errorObj);
          reject(errorObj);
        }
      );
    });

    // Suppress unhandled promise rejection if caller only uses callbacks
    loadPromise.catch(() => {});

    this.pendingLoads.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Marks a texture URL as the currently displayed active panorama.
   * @param {string} url
   */
  setActive(url) {
    this.activeUrl = url;
    this.cache.forEach((entry, key) => {
      if (key === url) {
        entry.state = 'ACTIVE';
        entry.lastUsed = Date.now();
      } else if (entry.state === 'ACTIVE') {
        entry.state = 'EVICTABLE';
      }
    });
  }

  /**
   * Sets transitioning protection flag for a given texture URL during scene fades/zooms.
   * Prevents premature eviction while transition is underway.
   * @param {string} url
   * @param {boolean} isTransitioning
   */
  setTransitioning(url, isTransitioning) {
    if (!url || !this.cache.has(url)) return;
    const entry = this.cache.get(url);
    if (isTransitioning) {
      entry.state = 'TRANSITIONING';
      entry.lastUsed = Date.now();
    } else {
      entry.state = (url === this.activeUrl) ? 'ACTIVE' : 'EVICTABLE';
    }
  }

  /**
   * Enforces LRU eviction policy when resident textures exceed maxCacheSize.
   * Strictly preserves ACTIVE and TRANSITIONING textures.
   * @private
   */
  _enforceLimit() {
    if (this.cache.size <= this.maxCacheSize) return;

    // Collect evictable candidates
    const candidates = [];
    this.cache.forEach((entry, url) => {
      if (entry.state !== 'ACTIVE' && entry.state !== 'TRANSITIONING' && url !== this.activeUrl) {
        candidates.push({ url, entry });
      }
    });

    // Sort by lastUsed ascending (least recently used first)
    candidates.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed);

    while (this.cache.size > this.maxCacheSize && candidates.length > 0) {
      const { url, entry } = candidates.shift();
      try {
        entry.texture.dispose();
      } catch (err) {
        console.warn(`Error disposing evicted texture "${url}":`, err);
      }
      this.cache.delete(url);
    }
  }

  /**
   * Background preloads adjacent scene panorama images linked via navigation hotspots.
   * Bounded to MAX_PRELOAD_ADJACENT scenes to prevent VRAM spikes.
   * @param {Object} currentScene - Active scene config
   * @param {Array} scenes - Full list of scenes in the tour
   * @param {Function} getImageUrl - API path converter
   * @param {number} [maxCount=MAX_PRELOAD_ADJACENT]
   */
  preloadAdjacent(currentScene, scenes, getImageUrl, maxCount = MAX_PRELOAD_ADJACENT) {
    if (!currentScene || !currentScene.hotspots || !scenes || !getImageUrl) return;

    // 1. Filter connected scene targets
    const linkedIds = currentScene.hotspots
      .filter((h) => h.type === 'navigation' && h.targetScene)
      .map((h) => h.targetScene);

    const linkedScenes = scenes
      .filter((s) => linkedIds.includes(s.id))
      .slice(0, maxCount); // Cap adjacent preload count

    linkedScenes.forEach((scene) => {
      if (!scene.image) return;
      const fullUrl = getImageUrl(scene.image);
      if (!fullUrl || this.cache.has(fullUrl) || this.pendingLoads.has(fullUrl)) return;

      // Deduplicated background load
      this.loadTexture(fullUrl).catch(() => {
        // Suppress background preload failure from propagating to UI
      });
    });
  }

  /**
   * Safely disposes and removes a single texture by URL.
   * @param {string} url - URL path
   */
  disposeTexture(url) {
    if (this.cache.has(url)) {
      const entry = this.cache.get(url);
      try {
        entry.texture.dispose();
      } catch (err) {
        console.warn(`Error disposing texture "${url}":`, err);
      }
      this.cache.delete(url);
    }
  }

  /**
   * Clears the entire texture cache, releasing all allocations in WebGL GPU memory.
   */
  clearCache() {
    this.cache.forEach((entry) => {
      try {
        entry.texture.dispose();
      } catch (err) {
        console.warn('Error during clearCache texture disposal:', err);
      }
    });
    this.cache.clear();
    this.pendingLoads.clear();
    this.activeUrl = null;
  }

  /**
   * Internal diagnostic helper to inspect resident textures.
   * @returns {Object}
   */
  getStats() {
    let active = 0;
    let transitioning = 0;
    let preloaded = 0;
    let evictable = 0;

    this.cache.forEach((entry) => {
      if (entry.state === 'ACTIVE') active++;
      else if (entry.state === 'TRANSITIONING') transitioning++;
      else if (entry.state === 'PRELOADED') preloaded++;
      else if (entry.state === 'EVICTABLE') evictable++;
    });

    return {
      totalCached: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      pendingLoads: this.pendingLoads.size,
      active,
      transitioning,
      preloaded,
      evictable,
    };
  }
}

export const sharedTextureManager = new TextureManager(MAX_CACHED_PANORAMAS);
export default TextureManager;
