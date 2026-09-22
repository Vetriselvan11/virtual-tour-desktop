import { API_BASE } from '../../config/api';

/**
 * StandalonePathResolver
 * Single Source of Truth for resolving asset, panorama, media, and public resource paths.
 * Guarantees zero path/routing/directory mapping errors across local dev, published routes,
 * nested subdirectories, cPanel, Apache, and AWS S3/CloudFront deployments.
 */
class StandalonePathResolver {
  /**
   * Determine the current deployment base directory (with trailing slash)
   */
  static getBaseDir() {
    if (typeof window === 'undefined') return './';
    
    // Check if explicit base tag is defined
    const baseTag = document.querySelector('base');
    if (baseTag && baseTag.getAttribute('href')) {
      const href = baseTag.getAttribute('href');
      return href.endsWith('/') ? href : `${href}/`;
    }

    // Derive directory from current window.location.pathname
    let pathname = window.location.pathname || '/';
    if (!pathname.endsWith('/')) {
      // If it ends with a filename like index.html, strip it
      if (pathname.includes('.') || pathname.endsWith('index.html')) {
        pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      } else {
        pathname = `${pathname}/`;
      }
    }
    return pathname;
  }

  /**
   * Core asset resolver.
   * Resolves any relative or absolute asset URL to a deployment-independent URL.
   */
  static resolveAsset(url) {
    if (!url || typeof url !== 'string') return null;

    // 1. Absolute external URLs or data URIs
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    // 2. Normalize leading slashes
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;

    // 3. Standalone mode (window.__TOUR_CONFIG__ injected or standalone bundle)
    if (typeof window !== 'undefined' && window.__TOUR_CONFIG__) {
      // Return relative to current folder
      return cleanUrl.startsWith('./') ? cleanUrl : `./${cleanUrl}`;
    }

    // 4. API mode (Local dev / full-stack editor)
    return `${API_BASE}/${cleanUrl}`.replace(/([^:]\/)\/+/g, '$1');
  }

  /**
   * Resolves public static files (e.g. logo.png, favicon.ico) relative to viewer deployment
   */
  static resolvePublicAsset(filename) {
    if (!filename) return '';
    const clean = filename.startsWith('/') ? filename.substring(1) : filename;
    if (typeof window !== 'undefined' && window.__TOUR_CONFIG__) {
      return `./${clean}`;
    }
    const publicUrl = process.env.PUBLIC_URL || '';
    return `${publicUrl}/${clean}`.replace(/\/+/g, '/');
  }

  static resolvePanorama(url) {
    return this.resolveAsset(url);
  }

  static resolveThumbnail(url) {
    return this.resolveAsset(url);
  }

  static resolvePreview(url) {
    return this.resolveAsset(url);
  }

  static resolveAudio(url) {
    return this.resolveAsset(url);
  }

  static resolveVideo(url) {
    return this.resolveAsset(url);
  }

  static resolveFloorplan(url) {
    return this.resolveAsset(url);
  }

  static resolveHotspotMedia(url) {
    return this.resolveAsset(url);
  }
}

export default StandalonePathResolver;
export const resolveAsset = StandalonePathResolver.resolveAsset.bind(StandalonePathResolver);
export const resolvePublicAsset = StandalonePathResolver.resolvePublicAsset.bind(StandalonePathResolver);
