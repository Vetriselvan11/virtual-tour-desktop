const fs = require('fs');
const path = require('path');
const { TOURS_DIR, UPLOADS_DIR } = require('../../config/directories.config');
const { normalizeAssetReference, isPathSafe } = require('../../shared/utils/assetPath.util');
const PublishRepository = require('../../database/repositories/publish.repository');

class PublishValidatorService {
  /**
   * Helper to locate an asset on disk using standard fallback candidates.
   */
  static _findAssetDiskPath(rawUrl, tourId) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
      return 'remote_or_data'; // Valid external reference
    }

    const clean = rawUrl.split('?')[0].split('#')[0];
    if (clean.includes('..')) return null;

    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      return clean;
    }

    const stripped = clean.replace(/^[/\\]+/, '');
    const candidates = [
      path.join(UPLOADS_DIR, stripped.replace(/^uploads[/\\]+/, '')),
      path.join(UPLOADS_DIR, stripped),
      path.join(UPLOADS_DIR, tourId, path.basename(stripped)),
      path.join(UPLOADS_DIR, 'audio', path.basename(stripped)),
      path.join(UPLOADS_DIR, 'icons', path.basename(stripped)),
      path.join(TOURS_DIR, tourId, path.basename(stripped)),
      path.resolve(__dirname, '../../../../frontend/public', stripped),
      path.resolve(__dirname, '../../../../frontend/src/assets', stripped)
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    }

    return null;
  }

  /**
   * Comprehensive pre-flight validation of a tour configuration before publishing.
   * 
   * @param {Object} tour - Tour JSON configuration
   * @param {Object} [options]
   * @param {string} [options.publicSlug] - Desired public slug
   * @returns {Promise<{ isValid: boolean, errors: string[], warnings: string[] }>}
   */
  static async validateTour(tour, options = {}) {
    const errors = [];
    const warnings = [];

    if (!tour || typeof tour !== 'object') {
      return {
        isValid: false,
        errors: ['Tour configuration object is missing or invalid.'],
        warnings: []
      };
    }

    const tourId = tour.id || 'unknown';

    // 1. Tour Level Checks
    if (!tour.title || typeof tour.title !== 'string' || !tour.title.trim()) {
      errors.push('Tour title is required.');
    }

    if (!Array.isArray(tour.scenes) || tour.scenes.length === 0) {
      errors.push('Tour must contain at least one 360° scene to be published.');
      return { isValid: false, errors, warnings };
    }

    const sceneIds = new Set(tour.scenes.map(s => s.id).filter(Boolean));

    if (tour.startScene && !sceneIds.has(tour.startScene)) {
      errors.push(`Start scene "${tour.startScene}" does not exist in tour scenes.`);
    }

    // 2. Slug Validation
    const publicSlug = options.publicSlug || tour.publicSlug;
    if (publicSlug) {
      const cleanSlug = publicSlug.toLowerCase().trim();
      const slugRegex = /^[a-z0-9-_]{3,64}$/;
      if (!slugRegex.test(cleanSlug)) {
        errors.push(`Public slug "${publicSlug}" is invalid. Must be 3-64 characters and contain only lowercase letters, numbers, hyphens, and underscores.`);
      } else {
        const reserved = ['api', 'dashboard', 'editor', 'viewer', 'view', 'tour', 'admin', 'login', 'logout', 'settings', 'uploads', 'published', 'static'];
        if (reserved.includes(cleanSlug)) {
          errors.push(`Public slug "${publicSlug}" is a reserved system route.`);
        } else {
          const isAvailable = await PublishRepository.isSlugAvailable(cleanSlug, tourId);
          if (!isAvailable) {
            errors.push(`Public slug "${publicSlug}" is already in use by another published tour.`);
          }
        }
      }
    }

    // 3. Tour Branding & Floorplans
    if (tour.clientLogo) {
      const logoPath = this._findAssetDiskPath(tour.clientLogo, tourId);
      if (!logoPath) warnings.push(`Referenced client logo "${tour.clientLogo}" not found on disk.`);
    }
    if (tour.floorplan) {
      const fpPath = this._findAssetDiskPath(tour.floorplan, tourId);
      if (!fpPath) warnings.push(`Referenced primary floorplan "${tour.floorplan}" not found on disk.`);
    }
    if (tour.floor2Plan) {
      const fp2Path = this._findAssetDiskPath(tour.floor2Plan, tourId);
      if (!fp2Path) warnings.push(`Referenced second floorplan "${tour.floor2Plan}" not found on disk.`);
    }
    if (tour.ambientAudio) {
      const audioPath = this._findAssetDiskPath(tour.ambientAudio, tourId);
      if (!audioPath) warnings.push(`Referenced tour ambient audio "${tour.ambientAudio}" not found on disk.`);
    }

    // 4. Scene-Level & Hotspot Checks
    for (let i = 0; i < tour.scenes.length; i++) {
      const scene = tour.scenes[i];
      const sceneIndexLabel = `Scene ${i + 1} (${scene.name || scene.id || 'unnamed'})`;

      if (!scene.id) {
        errors.push(`${sceneIndexLabel} is missing a unique ID.`);
        continue;
      }

      if (!scene.image) {
        errors.push(`${sceneIndexLabel} is missing a 360° panorama image.`);
      } else {
        const imgPath = this._findAssetDiskPath(scene.image, tourId);
        if (!imgPath) {
          errors.push(`${sceneIndexLabel} panorama image "${scene.image}" was not found on disk.`);
        }
      }

      if (scene.ambientAudio) {
        const audioPath = this._findAssetDiskPath(scene.ambientAudio, tourId);
        if (!audioPath) warnings.push(`${sceneIndexLabel} ambient audio "${scene.ambientAudio}" not found on disk.`);
      }

      if (scene.narrationAudio) {
        const audioPath = this._findAssetDiskPath(scene.narrationAudio, tourId);
        if (!audioPath) warnings.push(`${sceneIndexLabel} narration audio "${scene.narrationAudio}" not found on disk.`);
      }

      // Hotspots
      if (Array.isArray(scene.hotspots)) {
        for (const hs of scene.hotspots) {
          const hsLabel = `Hotspot "${hs.title || hs.id || 'unnamed'}" in ${sceneIndexLabel}`;
          if (!hs.id) {
            errors.push(`${hsLabel} is missing an ID.`);
          }

          // Scene switch verification
          if (hs.type === 'scene' || hs.targetScene) {
            if (!hs.targetScene) {
              errors.push(`${hsLabel} is configured as a scene transition but has no targetScene.`);
            } else if (!sceneIds.has(hs.targetScene)) {
              errors.push(`${hsLabel} targets non-existent scene ID "${hs.targetScene}".`);
            }
          }

          if (hs.customIcon) {
            const iconPath = this._findAssetDiskPath(hs.customIcon, tourId);
            if (!iconPath) warnings.push(`${hsLabel} custom icon "${hs.customIcon}" not found on disk.`);
          }
          if (hs.infoImage) {
            const infoPath = this._findAssetDiskPath(hs.infoImage, tourId);
            if (!infoPath) warnings.push(`${hsLabel} info image "${hs.infoImage}" not found on disk.`);
          }
          if (hs.audioUrl) {
            const audioPath = this._findAssetDiskPath(hs.audioUrl, tourId);
            if (!audioPath) warnings.push(`${hsLabel} audio asset "${hs.audioUrl}" not found on disk.`);
          }
        }
      }

      // 3D Objects
      const objects3d = scene.objects3d || scene.objects || [];
      if (Array.isArray(objects3d)) {
        for (const obj of objects3d) {
          const objLabel = `3D Object "${obj.name || obj.id || 'unnamed'}" in ${sceneIndexLabel}`;
          const modelRef = (obj.asset && obj.asset.url) || obj.modelUrl;
          if (!modelRef) {
            errors.push(`${objLabel} has no 3D model asset URL specified.`);
          } else {
            const modelPath = this._findAssetDiskPath(modelRef, tourId);
            if (!modelPath) {
              errors.push(`${objLabel} model file "${modelRef}" was not found on disk.`);
            }
          }
        }
      }
    }

    // 5. Cinematic Timeline Checks
    const cinematic = tour.cinematicTour || tour.keyframes;
    const keyframes = Array.isArray(cinematic) ? cinematic : (cinematic && cinematic.keyframes);
    if (Array.isArray(keyframes)) {
      for (let k = 0; k < keyframes.length; k++) {
        const kf = keyframes[k];
        if (kf.sceneId && !sceneIds.has(kf.sceneId)) {
          errors.push(`Cinematic keyframe ${k + 1} references non-existent scene ID "${kf.sceneId}".`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = PublishValidatorService;
