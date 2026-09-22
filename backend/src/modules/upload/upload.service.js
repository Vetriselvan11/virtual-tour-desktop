const fs = require('fs');
const { AppError } = require('../../shared/errors/AppError');
const { validateImageFile } = require('../../shared/utils/imageValidator.util');
const ThumbnailService = require('../asset/thumbnail.service');

// ─── Resource Budgets ──────────────────────────────────────────────────────────
// Thumbnail generation is CPU-bound (Sharp image decode + resize).
// Limiting concurrency to 2 keeps Node.js event loop responsive during large imports.
const THUMBNAIL_CONCURRENCY = 2;

/**
 * Runs an array of async tasks with bounded concurrency.
 * @param {Array<Function>} tasks  - Array of () => Promise<T> factories
 * @param {number} limit           - Maximum concurrent tasks
 * @returns {Promise<Array<T>>}    - Results in original order
 */
async function boundedAll(tasks, limit) {
  const results  = new Array(tasks.length);
  let nextIndex  = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

class UploadService {
  /**
   * Validates and processes a single uploaded panorama/scene image.
   * Generates deterministic server-side thumbnail and extracts metadata.
   */
  static async processSingleImage(tourId, file) {
    if (!file) throw new AppError('No image uploaded', 400);

    try {
      // 1. Magic byte & integrity validation (fast, synchronous path)
      const validation = validateImageFile(file.path);

      // 2. Deterministic thumbnail and preview generation
      let thumbnailUrl = null;
      let previewUrl = null;
      try {
        const thumbResult = await ThumbnailService.generateThumbnail(file.path, tourId);
        thumbnailUrl = thumbResult.thumbnailUrl;
      } catch (thumbErr) {
        console.warn(`[Asset] Non-blocking thumbnail generation notice:`, thumbErr.message);
      }

      try {
        const prevResult = await ThumbnailService.generatePreview(file.path, tourId);
        previewUrl = prevResult.previewUrl;
      } catch (prevErr) {
        console.warn(`[Asset] Non-blocking preview generation notice:`, prevErr.message);
      }

      // 3. Multi-Resolution Tile Pyramid generation for 4K/8K/12K/16K images
      let tiles = null;
      if (validation.width >= 3840) {
        try {
          const TileGeneratorService = require('../asset/tileGenerator.service');
          tiles = await TileGeneratorService.generateTilesForImage(file.path, tourId);
        } catch (tileErr) {
          console.warn(`[Asset] Non-blocking tile generation notice:`, tileErr.message);
        }
      }

      return {
        filename: file.filename,
        url: `/uploads/${tourId}/${file.filename}`,
        thumbnailUrl: thumbnailUrl || `/uploads/${tourId}/${file.filename}`,
        previewUrl: previewUrl || `/uploads/${tourId}/${file.filename}`,
        tiles: tiles || null,
        originalName: file.originalname,
        size: file.size,
        format: validation.format,
        width: validation.width,
        height: validation.height,
        isEquirectangular: validation.isEquirectangular
      };
    } catch (err) {
      // Clean up failed / invalid upload file immediately
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
      throw err;
    }
  }

  /**
   * Validates and processes multiple uploaded images (bulk folder import).
   *
   * Performance architecture:
   * - Thumbnail generation is bounded to THUMBNAIL_CONCURRENCY concurrent Sharp jobs.
   * - This prevents CPU saturation and keeps the Node.js event loop responsive
   *   during large 85–100+ file imports.
   * - Results are returned in original file order.
   */
  static async processMultipleImages(tourId, files) {
    if (!files || files.length === 0) throw new AppError('No images uploaded', 400);

    // Build task factories for bounded execution
    const tasks = files.map(file => () => this.processSingleImage(tourId, file));

    // Process with bounded concurrency — never more than THUMBNAIL_CONCURRENCY simultaneous jobs
    const results = await boundedAll(tasks, THUMBNAIL_CONCURRENCY);
    return results;
  }

  /**
   * Validates and processes an uploaded audio/video file.
   */
  static processAudio(file) {
    if (!file) throw new AppError('No audio file uploaded', 400);

    return {
      filename: file.filename,
      url: `/uploads/audio/${file.filename}`,
      originalName: file.originalname,
      size: file.size
    };
  }

  /**
   * Validates and processes an uploaded custom hotspot icon.
   */
  static processIcon(file) {
    if (!file) throw new AppError('No icon file uploaded', 400);

    try {
      const validation = validateImageFile(file.path, ['png', 'svg', 'gif', 'jpeg', 'webp']);
      return {
        filename: file.filename,
        url: `/uploads/icons/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        format: validation.format
      };
    } catch (err) {
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
      throw err;
    }
  }
}

module.exports = UploadService;
