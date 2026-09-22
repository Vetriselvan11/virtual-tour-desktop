/**
 * Centralized capability manager for immersive features.
 * Automatically evaluates device support for touch, gyro, and WebXR.
 */
class DeviceCapabilities {
  constructor() {
    this.supportsTouch = false;
    this.supportsDeviceOrientation = false;
    this.requiresOrientationPermission = false;
    this.supportsWebXR = false;
    this.supportsImmersiveVR = false;

    this.checkCapabilities();
  }

  async checkCapabilities() {
    this.supportsTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
    
    if (typeof window.DeviceOrientationEvent !== 'undefined') {
      this.supportsDeviceOrientation = true;
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        this.requiresOrientationPermission = true;
      }
    }

    if (navigator.xr) {
      this.supportsWebXR = true;
      try {
        const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
        this.supportsImmersiveVR = vrSupported;
      } catch (e) {
        this.supportsImmersiveVR = false;
      }
    }
  }
}

export default new DeviceCapabilities();
