const path = require('path');
const fs = require('fs');
const { isPathSafe } = require('../../shared/utils/assetPath.util');
const { UPLOADS_DIR } = require('../../config/directories.config');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // sharp not installed; will use fallback image processing
}

class ThumbnailService {
  /**
   * Generates deterministic relative thumbnail path for a given image file.
   * e.g. "tour_123/image.jpg" -> "tour_123/thumbnails/image.thumb.jpg"
   * 
   * @param {string} relativeImagePath - e.g. "tour_123/image.jpg"
   * @returns {string} Relative thumbnail path
   */
  static getThumbnailRelativePath(relativeImagePath) {
    if (!relativeImagePath) return '';
    const dir = path.dirname(relativeImagePath);
    const ext = path.extname(relativeImagePath);
    const base = path.basename(relativeImagePath, ext);
    return path.join(dir, 'thumbnails', `${base}.thumb${ext}`).replace(/\\/g, '/');
  }

  /**
   * Generates deterministic relative preview path for a given image file.
   * e.g. "tour_123/image.jpg" -> "tour_123/previews/image.preview.jpg"
   * 
   * @param {string} relativeImagePath - e.g. "tour_123/image.jpg"
   * @returns {string} Relative preview path
   */
  static getPreviewRelativePath(relativeImagePath) {
    if (!relativeImagePath) return '';
    const dir = path.dirname(relativeImagePath);
    const ext = path.extname(relativeImagePath);
    const base = path.basename(relativeImagePath, ext);
    return path.join(dir, 'previews', `${base}.preview${ext}`).replace(/\\/g, '/');
  }

  /**
   * Generates or retrieves a server-side thumbnail for an uploaded image.
   * Deterministic, idempotent, and failure-safe.
   * 
   * @param {string} sourceDiskPath - Absolute path to source image on disk
   * @param {string} tourId - Tour ID
   * @param {number} [targetWidth=400] - Thumbnail width
   * @param {number} [targetHeight=200] - Thumbnail height
   * @returns {Promise<{ thumbnailDiskPath: string, thumbnailUrl: string, generated: boolean }>}
   */
  static async generateThumbnail(sourceDiskPath, tourId, targetWidth = 400, targetHeight = 200) {
    if (!fs.existsSync(sourceDiskPath)) {
      throw new Error(`Cannot generate thumbnail: Source image not found at "${sourceDiskPath}"`);
    }

    const ext = path.extname(sourceDiskPath);
    const base = path.basename(sourceDiskPath, ext);
    const thumbDir = path.join(UPLOADS_DIR, tourId, 'thumbnails');

    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const thumbFilename = `${base}.thumb${ext}`;
    const thumbDiskPath = path.join(thumbDir, thumbFilename);
    const thumbUrl = `/uploads/${tourId}/thumbnails/${thumbFilename}`;

    // 1. If thumbnail already exists and is non-empty, reuse it
    if (fs.existsSync(thumbDiskPath)) {
      const stats = fs.statSync(thumbDiskPath);
      if (stats.size > 0) {
        return { thumbnailDiskPath: thumbDiskPath, thumbnailUrl: thumbUrl, generated: false };
      }
    }

    // 2. If SVG, copy directly as thumbnail
    if (ext.toLowerCase() === '.svg') {
      fs.copyFileSync(sourceDiskPath, thumbDiskPath);
      return { thumbnailDiskPath: thumbDiskPath, thumbnailUrl: thumbUrl, generated: true };
    }

    // 3. Generate thumbnail with sharp if available
    if (sharp) {
      try {
        await sharp(sourceDiskPath)
          .resize(targetWidth, targetHeight, {
            fit: 'cover',
            position: 'center',
            withoutEnlargement: false
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(thumbDiskPath);

        return { thumbnailDiskPath: thumbDiskPath, thumbnailUrl: thumbUrl, generated: true };
      } catch (err) {
        console.warn(`[Asset] Sharp thumbnail generation warning for ${sourceDiskPath}:`, err.message);
      }
    }

    // 4. Fallback: Copy source file to thumbnail location so a valid thumbnail path always resolves
    try {
      fs.copyFileSync(sourceDiskPath, thumbDiskPath);
      return { thumbnailDiskPath: thumbDiskPath, thumbnailUrl: thumbUrl, generated: true };
    } catch (copyErr) {
      console.error(`[Asset] Fallback thumbnail copy failed:`, copyErr.message);
      return { thumbnailDiskPath: sourceDiskPath, thumbnailUrl: `/uploads/${tourId}/${path.basename(sourceDiskPath)}`, generated: false };
    }
  }

  /**
   * Generates or retrieves a Level 2 editor preview image for an uploaded panorama.
   * Optimized 2048x1024 progressive JPEG for fast initial loading without UI stalls.
   * 
   * @param {string} sourceDiskPath - Absolute path to master source image on disk
   * @param {string} tourId - Tour ID
   * @param {number} [targetWidth=2048] - Preview width
   * @param {number} [targetHeight=1024] - Preview height
   * @returns {Promise<{ previewDiskPath: string, previewUrl: string, generated: boolean }>}
   */
  static async generatePreview(sourceDiskPath, tourId, targetWidth = 2048, targetHeight = 1024) {
    if (!fs.existsSync(sourceDiskPath)) {
      throw new Error(`Cannot generate preview: Source image not found at "${sourceDiskPath}"`);
    }

    const ext = path.extname(sourceDiskPath);
    const base = path.basename(sourceDiskPath, ext);
    const previewDir = path.join(UPLOADS_DIR, tourId, 'previews');

    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    const previewFilename = `${base}.preview${ext}`;
    const previewDiskPath = path.join(previewDir, previewFilename);
    const previewUrl = `/uploads/${tourId}/previews/${previewFilename}`;

    // 1. If preview already exists and is non-empty, reuse it
    if (fs.existsSync(previewDiskPath)) {
      const stats = fs.statSync(previewDiskPath);
      if (stats.size > 0) {
        return { previewDiskPath, previewUrl, generated: false };
      }
    }

    // 2. If SVG, copy directly
    if (ext.toLowerCase() === '.svg') {
      fs.copyFileSync(sourceDiskPath, previewDiskPath);
      return { previewDiskPath, previewUrl, generated: true };
    }

    // 3. Generate preview with sharp if available
    if (sharp) {
      try {
        await sharp(sourceDiskPath)
          .resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 82, progressive: true })
          .toFile(previewDiskPath);

        return { previewDiskPath, previewUrl, generated: true };
      } catch (err) {
        console.warn(`[Asset] Sharp preview generation warning for ${sourceDiskPath}:`, err.message);
      }
    }

    // 4. Fallback: Use master image URL as preview fallback
    return {
      previewDiskPath: sourceDiskPath,
      previewUrl: `/uploads/${tourId}/${path.basename(sourceDiskPath)}`,
      generated: false
    };
  }

  /**
   * Cleans up thumbnail and preview derivative files associated with a source image path.
   * 
   * @param {string} sourceDiskPath - Absolute path to source image
   * @param {string} tourId - Tour unique identifier
   */
  static removeThumbnail(sourceDiskPath, tourId) {
    try {
      const ext = path.extname(sourceDiskPath);
      const base = path.basename(sourceDiskPath, ext);
      const thumbDiskPath = path.join(UPLOADS_DIR, tourId, 'thumbnails', `${base}.thumb${ext}`);
      if (fs.existsSync(thumbDiskPath)) {
        fs.unlinkSync(thumbDiskPath);
      }
      const previewDiskPath = path.join(UPLOADS_DIR, tourId, 'previews', `${base}.preview${ext}`);
      if (fs.existsSync(previewDiskPath)) {
        fs.unlinkSync(previewDiskPath);
      }
      // Also clean up any multi-resolution tile pyramid for this image
      try {
        const TileGeneratorService = require('./tileGenerator.service');
        TileGeneratorService.removeTiles(tourId, path.basename(sourceDiskPath));
      } catch {}
    } catch (err) {
      console.warn(`[Asset] Derivatives removal warning:`, err.message);
    }
  }
}

module.exports = ThumbnailService;

