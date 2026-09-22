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

    // Classification heuristics
    if (isMobile || cpuCores <= 4 || memoryGb <= 4 || isSoftwareOrIntegrated) {
      return PROFILE_LOW;
    }

    if (cpuCores >= 8 && memoryGb >= 8) {
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
   * Prevents 4K screens on weak GPUs from rendering at 3.0+ DPR.
   */
  get effectiveDpr() {
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1.0) : 1.0;
    const isStandalone = typeof window !== 'undefined' && !!window.__TOUR_CONFIG__;

    if (isStandalone) {
      // In published exports, we prioritize visual quality. Allow up to 2.0 DPR for Retina/mobile displays.
      return Math.min(rawDpr, 2.0);
    }

    switch (this.profile) {
      case PROFILE_LOW:
        return 1.0;
      case PROFILE_MEDIUM:
        return Math.min(rawDpr, 1.25);
      case PROFILE_HIGH:
      default:
        return Math.min(rawDpr, 1.75);
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

  /**
   * Whether to upgrade active scene to full master resolution in the editor after preview settles.
   */
  get shouldUpgradeMasterInEditor() {
    const isStandalone = typeof window !== 'undefined' && !!window.__TOUR_CONFIG__;
    
    // Export and standalone viewer ALWAYS use Level 3 Master.
    if (isStandalone) return true;

    // Low devices stay on Level 2 preview in the editor to avoid GPU stalls.
    return this.profile !== PROFILE_LOW;
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
