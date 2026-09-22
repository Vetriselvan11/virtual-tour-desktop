const fs = require('fs');
const path = require('path');
const { TOURS_DIR, UPLOADS_DIR } = require('../../config/directories.config');
const TileGeneratorService = require('../asset/tileGenerator.service');
const ThumbnailService = require('../asset/thumbnail.service');

class PublishAssetCollectorService {
  /**
   * Helper to locate source asset on disk
   */
  static _findAssetDiskPath(rawUrl, tourId) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
      return null;
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
   * Collects all referenced assets, ensures tile pyramids exist, and copies them to version storage.
   * 
   * @param {string} tourId
   * @param {string} versionId
   * @param {Object} tour
   * @param {Object} storageProvider - LocalStorageProvider instance
   * @param {Function} [onProgress] - (stage, percent) => void
   * @returns {Promise<{ assetMap: Map<string, string>, totalAssets: number, totalSize: number }>}
   */
  static async collectAndPublishAssets(tourId, versionId, tour, storageProvider, onProgress) {
    const assetMap = new Map(); // rawUrl -> published relative URL
    let totalAssets = 0;
    let totalSize = 0;

    const copyTaskMap = new Map(); // diskPath -> { subfolder, fallbackBase }

    const scheduleAsset = (rawUrl, subfolder, fallbackBase) => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return;
      }
      const diskPath = this._findAssetDiskPath(rawUrl, tourId);
      if (diskPath && !copyTaskMap.has(diskPath)) {
        copyTaskMap.set(diskPath, { subfolder, fallbackBase, rawUrl });
      }
    };

    // 1. Scan Tour Level Assets
    if (tour.clientLogo) scheduleAsset(tour.clientLogo, 'media', 'client_logo');
    if (tour.floorplan) scheduleAsset(tour.floorplan, 'floorplans', 'floorplan_1');
    if (tour.floor2Plan) scheduleAsset(tour.floor2Plan, 'floorplans', 'floorplan_2');
    if (tour.ambientAudio) scheduleAsset(tour.ambientAudio, 'audio', 'tour_ambient');

    // 2. Scan Scenes & Hotspots & 3D Models
    if (Array.isArray(tour.scenes)) {
      for (let sIdx = 0; sIdx < tour.scenes.length; sIdx++) {
        const scene = tour.scenes[sIdx];
        const sKey = scene.id || `scene_${sIdx}`;

        if (scene.image) scheduleAsset(scene.image, 'panoramas', `pano_${sKey}`);
        if (scene.preview) scheduleAsset(scene.preview, 'thumbnails', `prev_${sKey}`);
        if (scene.thumbnail) scheduleAsset(scene.thumbnail, 'thumbnails', `thumb_${sKey}`);
        if (scene.ambientAudio) scheduleAsset(scene.ambientAudio, 'audio', `ambient_${sKey}`);
        if (scene.narrationAudio) scheduleAsset(scene.narrationAudio, 'audio', `narration_${sKey}`);

        if (Array.isArray(scene.hotspots)) {
          for (let hIdx = 0; hIdx < scene.hotspots.length; hIdx++) {
            const hs = scene.hotspots[hIdx];
            const hKey = hs.id || `hs_${sIdx}_${hIdx}`;
            if (hs.customIcon) scheduleAsset(hs.customIcon, 'media', `icon_${hKey}`);
            if (hs.infoImage) scheduleAsset(hs.infoImage, 'media', `info_${hKey}`);
            if (hs.audioUrl) scheduleAsset(hs.audioUrl, 'audio', `audio_${hKey}`);
            if (hs.videoUrl) scheduleAsset(hs.videoUrl, 'media', `video_${hKey}`);
          }
        }

        const objects3d = scene.objects3d || scene.objects || [];
        if (Array.isArray(objects3d)) {
          for (let oIdx = 0; oIdx < objects3d.length; oIdx++) {
            const obj = objects3d[oIdx];
            const oKey = obj.id || `obj_${sIdx}_${oIdx}`;
            const modelRef = (obj.asset && obj.asset.url) || obj.modelUrl;
            if (modelRef) scheduleAsset(modelRef, 'models', `model_${oKey}`);
          }
        }
      }
    }

    if (onProgress) onProgress('collecting_assets', 20);

    // 3. Process and Copy Assets
    let processedCount = 0;
    const totalToProcess = copyTaskMap.size;

    for (const [diskPath, info] of copyTaskMap.entries()) {
      const ext = path.extname(diskPath) || '.jpg';
      const base = path.basename(diskPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetRelPath = `${info.subfolder}/${base}${ext}`;

      const res = await storageProvider.storeAsset(tourId, versionId, diskPath, targetRelPath);
      totalAssets++;
      totalSize += res.sizeBytes;

      const publishedWebUrl = `/published/${tourId}/${versionId}/${targetRelPath}`;
      assetMap.set(info.rawUrl, publishedWebUrl);

      processedCount++;
      if (onProgress && totalToProcess > 0) {
        const pct = 20 + Math.floor((processedCount / totalToProcess) * 40);
        onProgress('copying_assets', pct);
      }
    }

    if (onProgress) onProgress('verifying_tiles', 65);

    // 4. Verify & Copy Multi-Resolution Tile Pyramids
    if (Array.isArray(tour.scenes)) {
      for (const scene of tour.scenes) {
        if (!scene.image) continue;
        const diskPath = this._findAssetDiskPath(scene.image, tourId);
        if (!diskPath) continue;

        const filename = path.basename(diskPath);
        const ext = path.extname(filename);
        const sceneBase = path.basename(filename, ext).replace(/\.thumb$|\.preview$/, '');

        // Check if tiles exist in source uploads dir
        let sourceTilesDir = TileGeneratorService.getTilesDir(tourId, filename);
        let metadata = TileGeneratorService.getTileMetadata(tourId, filename);

        // If not generated, try generating on-the-fly for high-res panoramas
        if (!metadata || !metadata.enabled) {
          try {
            metadata = await TileGeneratorService.generateTilesForImage(diskPath, tourId);
          } catch (err) {
            console.warn(`[PublishAssetCollector] Tile generation skipped for "${filename}":`, err.message);
          }
        }

        if (metadata && metadata.enabled && fs.existsSync(sourceTilesDir)) {
          const tileRes = await storageProvider.storeTilePyramid(tourId, versionId, sceneBase, sourceTilesDir);
          totalAssets += tileRes.totalTiles;
          totalSize += tileRes.sizeBytes;

          // Rewrite tile metadata basePath to point to versioned tiles
          const targetMetaPath = storageProvider.getAssetDiskPath(tourId, versionId, `tiles/${sceneBase}/metadata.json`);
          if (fs.existsSync(targetMetaPath)) {
            try {
              const metaJson = JSON.parse(fs.readFileSync(targetMetaPath, 'utf8'));
              metaJson.basePath = `/published/${tourId}/${versionId}/tiles/${sceneBase}`;
              fs.writeFileSync(targetMetaPath, JSON.stringify(metaJson, null, 2), 'utf8');
            } catch {}
          }
        }
      }
    }

    if (onProgress) onProgress('assets_complete', 80);

    return {
      assetMap,
      totalAssets,
      totalSize
    };
  }
}

module.exports = PublishAssetCollectorService;
