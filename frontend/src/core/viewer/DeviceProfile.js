/**
 * DeviceProfile.js — 360TOOL Performance Engine
 * Lightweight, zero-benchmark hardware detection and runtime capability profiling.
 * 
 * Provides calibrated budgets for:
 * - WebGL canvas DPR (capped)
 * - GPU VRAM texture cache capacity
 * - Adjacent scene preloading counts
 * - Editor preview texture resolutions
 * - Background processing & upload concurrency
 * - Decorative shader rendering (DarkVeil)
 */

export const PROFILE_LOW = 'low';
export const PROFILE_MEDIUM = 'medium';
export const PROFILE_HIGH = 'high';

class DeviceProfileManager {
  constructor() {
    this.profile = this._detectProfile();
  }

  /**
   * Evaluates hardware parameters once at startup without blocking or running expensive benchmarks.
   * @private
   * @returns {'low'|'medium'|'high'}
   */
  _detectProfile() {
    // Check manual override in localStorage if set by user
    try {
      const saved = localStorage.getItem('editor_performance_profile');
      if (saved === 'low' || saved === 'medium' || saved === 'high') {
        return saved;
      }
    } catch {}

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const cpuCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    const memoryGb = typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : 4;

    // Detect weak / software WebGL renderers
    let isSoftwareOrIntegrated = false;
    try {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            const lower = renderer.toLowerCase();
            if (
              lower.includes('swiftshader') ||
              lower.includes('llvmpipe') ||
              lower.includes('software') ||
              lower.includes('intel hd') ||
              lower.includes('intel uhd') ||
              lower.includes('microsoft basic')
            ) {
              isSoftwareOrIntegrated = true;
            }
          }
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) loseContext.loseContext();
        }
      }
    } catch {}

    // Classification heuristics: Only classify as LOW if hardware is truly constrained (software WebGL, <= 2 cores, or <= 2GB memory)
    if (isSoftwareOrIntegrated || cpuCores <= 2 || memoryGb <= 2) {
      return PROFILE_LOW;
    }

    if (cpuCores >= 6 && memoryGb >= 6) {
      return PROFILE_HIGH;
    }

    return PROFILE_MEDIUM;
  }

  /**
   * Current active profile
   */
  get current() {
    return this.profile;
  }

  /**
   * Set user manual profile override
   */
  setProfile(mode) {
    if (mode === 'low' || mode === 'medium' || mode === 'high') {
      this.profile = mode;
      try {
        localStorage.setItem('editor_performance_profile', mode);
      } catch {}
    }
  }

  /**
   * Maximum DPR allowed for WebGL canvas rendering.
   * High-DPI screens render sharp visuals without causing WebGL context loss.
   */
  get effectiveDpr() {
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1.0) : 1.0;
    const isStandalone = typeof window !== 'undefined' && !!window.__TOUR_CONFIG__;

    if (isStandalone) {
      // In published exports, prioritize visual quality up to 2.0 DPR.
      return Math.min(rawDpr, 2.0);
    }

    switch (this.profile) {
      case PROFILE_LOW:
        // Capping at 1.5 avoids severe blur on high-DPI budget phones while maintaining 60fps
        return Math.min(rawDpr, 1.5);
      case PROFILE_MEDIUM:
        return Math.min(rawDpr, 1.75);
      case PROFILE_HIGH:
      default:
        return Math.min(rawDpr, 2.0);
    }
  }

  /**
   * Maximum number of panoramic textures retained in WebGL VRAM.
   */
  get maxGpuTextures() {
    switch (this.profile) {
      case PROFILE_LOW:
        return 2; // 1 active + 1 transition buffer
      case PROFILE_MEDIUM:
        return 3; // 1 active + 1 transition + 1 nearby
      case PROFILE_HIGH:
      default:
        return 5; // Bounded LRU
    }
  }

  /**
   * Maximum number of adjacent linked scenes to preload in background.
   */
  get maxAdjacentPreloads() {
    switch (this.profile) {
      case PROFILE_LOW:
        return 0; // Disabled on low-end
      case PROFILE_MEDIUM:
        return 1;
      case PROFILE_HIGH:
      default:
        return 2;
    }
  }

  /**
   * Recommended preview max width in pixels for editor scenes.
   */
  get previewMaxWidth() {
    switch (this.profile) {
      case PROFILE_LOW:
        return 2048;
      case PROFILE_MEDIUM:
        return 2048;
      case PROFILE_HIGH:
      default:
        return 4096;
    }
  }

  get isMobile() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || ''));
  }

  get shouldUpgradeMasterInEditor() {
    // Only restrict master background upgrade if device is severely constrained (<= 1GB RAM)
    if (this.profile === PROFILE_LOW && (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 1)) {
      return false;
    }
    return true;
  }

  /**
   * Whether to run heavy decorative procedural WebGL shaders (e.g. DarkVeil).
   */
  get enableDecorativeShaders() {
    return this.profile !== PROFILE_LOW;
  }

  /**
   * Recommended concurrent file uploads during bulk import.
   */
  get uploadConcurrency() {
    switch (this.profile) {
      case PROFILE_LOW:
        return 2;
      case PROFILE_MEDIUM:
        return 3;
      case PROFILE_HIGH:
      default:
        return 4;
    }
  }
}

export const DeviceProfile = new DeviceProfileManager();
export default DeviceProfile;
