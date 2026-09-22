const { normalizeAssetReference } = require('../../shared/utils/assetPath.util');
const ThumbnailService = require('./thumbnail.service');
const TourRepository = require('../../database/repositories/tour.repository');

class AssetReferenceService {
  /**
   * Extracts all referenced asset paths from a single tour configuration.
   * 
   * @param {Object} tour - Tour JSON / Mongoose document
   * @returns {Map<string, { refCount: number, tourId: string, fields: string[] }>}
   */
  static extractTourAssetReferences(tour) {
    const referenceMap = new Map();
    if (!tour || typeof tour !== 'object') return referenceMap;

    const tourId = tour.id || 'unknown';

    const registerRef = (rawUrl, fieldName) => {
      const norm = normalizeAssetReference(rawUrl);
      if (!norm) return;

      if (!referenceMap.has(norm)) {
        referenceMap.set(norm, {
          refCount: 1,
          tourId,
          fields: [fieldName]
        });
      } else {
        const entry = referenceMap.get(norm);
        entry.refCount += 1;
        if (!entry.fields.includes(fieldName)) {
          entry.fields.push(fieldName);
        }
      }

      // If the asset is a panorama image, also register its deterministic thumbnail and preview as active derivatives
      if (fieldName === 'scene.image') {
        const thumbNorm = ThumbnailService.getThumbnailRelativePath(norm);
        if (thumbNorm && !referenceMap.has(thumbNorm)) {
          referenceMap.set(thumbNorm, {
            refCount: 1,
            tourId,
            fields: ['scene.image.thumbnail_derivative']
          });
        }
        const prevNorm = ThumbnailService.getPreviewRelativePath(norm);
        if (prevNorm && !referenceMap.has(prevNorm)) {
          referenceMap.set(prevNorm, {
            refCount: 1,
            tourId,
            fields: ['scene.image.preview_derivative']
          });
        }
      }
    };

    // 1. Tour-level assets
    if (tour.clientLogo) registerRef(tour.clientLogo, 'tour.clientLogo');
    if (tour.floorplan) registerRef(tour.floorplan, 'tour.floorplan');
    if (tour.floor2Plan) registerRef(tour.floor2Plan, 'tour.floor2Plan');
    if (tour.ambientAudio) registerRef(tour.ambientAudio, 'tour.ambientAudio');

    // 2. Scene-level and Hotspot-level assets
    if (Array.isArray(tour.scenes)) {
      for (const scene of tour.scenes) {
        if (scene.image) registerRef(scene.image, 'scene.image');
        if (scene.thumbnail) registerRef(scene.thumbnail, 'scene.thumbnail');
        if (scene.ambientAudio) registerRef(scene.ambientAudio, 'scene.ambientAudio');
        if (scene.narrationAudio) registerRef(scene.narrationAudio, 'scene.narrationAudio');

        if (Array.isArray(scene.hotspots)) {
          for (const hs of scene.hotspots) {
            if (hs.customIcon) registerRef(hs.customIcon, 'hotspot.customIcon');
            if (hs.audioUrl) registerRef(hs.audioUrl, 'hotspot.audioUrl');
            if (hs.infoImage) registerRef(hs.infoImage, 'hotspot.infoImage');
            if (hs.videoUrl) registerRef(hs.videoUrl, 'hotspot.videoUrl');
          }
        }

        if (Array.isArray(scene.objects3d)) {
          for (const obj of scene.objects3d) {
            if (obj.asset && obj.asset.url) registerRef(obj.asset.url, 'object3d.asset.url');
            if (obj.modelUrl) registerRef(obj.modelUrl, 'object3d.modelUrl');
          }
        }

        if (Array.isArray(scene.objects)) {
          for (const obj of scene.objects) {
            if (obj.asset && obj.asset.url) registerRef(obj.asset.url, 'object.asset.url');
            if (obj.modelUrl) registerRef(obj.modelUrl, 'object.modelUrl');
          }
        }
      }
    }

    return referenceMap;
  }

  /**
   * Scans all active tours in the database / local JSON persistence and aggregates
   * a global set of referenced asset relative paths with cross-tour ref counts.
   * 
   * @returns {Promise<{ activePaths: Set<string>, referenceDetails: Map<string, { refCount: number, tours: string[], fields: string[] }> }>}
   */
  static async getAllActiveAssetReferences() {
    const tours = await TourRepository.getAllTours();
    const referenceDetails = new Map();
    const activePaths = new Set();

    for (const tour of tours) {
      const tourRefs = this.extractTourAssetReferences(tour);
      for (const [normPath, data] of tourRefs.entries()) {
        activePaths.add(normPath);

        if (!referenceDetails.has(normPath)) {
          referenceDetails.set(normPath, {
            refCount: data.refCount,
            tours: [data.tourId],
            fields: [...data.fields]
          });
        } else {
          const entry = referenceDetails.get(normPath);
          entry.refCount += data.refCount;
          if (!entry.tours.includes(data.tourId)) {
            entry.tours.push(data.tourId);
          }
          for (const f of data.fields) {
            if (!entry.fields.includes(f)) {
              entry.fields.push(f);
            }
          }
        }
      }
    }

    return { activePaths, referenceDetails };
  }
}

module.exports = AssetReferenceService;
