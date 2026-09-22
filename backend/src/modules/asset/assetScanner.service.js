const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('../../config/directories.config');
const { normalizeAssetReference } = require('../../shared/utils/assetPath.util');
const AssetReferenceService = require('./assetReference.service');

class AssetScannerService {
  /**
   * Recursively discovers all physical files inside a directory.
   * 
   * @param {string} dir - Directory path to scan
   * @param {string} baseUploadsDir - Root uploads directory for relative path computation
   * @returns {Array<{ absolutePath: string, relativePath: string, size: number, mtime: Date }>}
   */
  static _discoverFiles(dir, baseUploadsDir = UPLOADS_DIR) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this._discoverFiles(fullPath, baseUploadsDir));
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          const rawRelative = path.relative(baseUploadsDir, fullPath);
          const relativePath = rawRelative.replace(/\\/g, '/');
          results.push({
            absolutePath: fullPath,
            relativePath,
            size: stats.size,
            mtime: stats.mtime
          });
        } catch (statErr) {
          console.warn(`[AssetScanner] Could not stat file ${fullPath}:`, statErr.message);
        }
      }
    }
    return results;
  }

  /**
   * Infers asset category from relative path and extension.
   * 
   * @param {string} relativePath
   * @returns {string} Asset type category
   */
  static _inferAssetType(relativePath) {
    const lower = relativePath.toLowerCase();
    if (lower.includes('/thumbnails/') || lower.includes('\\thumbnails\\') || lower.endsWith('.thumb.jpg') || lower.endsWith('.thumb.webp')) {
      return 'thumbnail';
    }
    if (lower.startsWith('audio/') || lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.flac')) {
      return 'audio';
    }
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) {
      return 'video';
    }
    if (lower.startsWith('icons/') || lower.endsWith('.svg')) {
      return 'icon';
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
      return 'panorama';
    }
    if (lower.endsWith('.tmp') || lower.endsWith('.partial') || lower.endsWith('.processing')) {
      return 'temporary';
    }
    return 'other';
  }

  /**
   * Scans uploads directory and performs a complete reference comparison against all active tours.
   * Strictly read-only; does not modify or delete files.
   * 
   * @param {Object} [options]
   * @param {string} [options.tourId] - Optional specific tour to filter scan for
   * @returns {Promise<Object>} Comprehensive scan report
   */
  static async scanOrphanAssets({ tourId } = {}) {
    const scanDir = tourId ? path.join(UPLOADS_DIR, tourId) : UPLOADS_DIR;
    const physicalFiles = this._discoverFiles(scanDir, UPLOADS_DIR);
    const { activePaths, referenceDetails } = await AssetReferenceService.getAllActiveAssetReferences();

    const activeAssets = [];
    const orphanAssets = [];
    const tempAssets = [];

    let totalSizeBytes = 0;
    let activeSizeBytes = 0;
    let orphanSizeBytes = 0;
    let tempSizeBytes = 0;

    const now = Date.now();

    for (const file of physicalFiles) {
      totalSizeBytes += file.size;
      const norm = normalizeAssetReference(file.relativePath);
      const isTemp = file.relativePath.endsWith('.tmp') || file.relativePath.endsWith('.partial') || file.relativePath.endsWith('.processing');
      const assetType = this._inferAssetType(file.relativePath);
      const ageMs = now - file.mtime.getTime();

      const item = {
        relativePath: file.relativePath,
        absolutePath: file.absolutePath,
        url: `/uploads/${file.relativePath}`,
        sizeBytes: file.size,
        modifiedAt: file.mtime.toISOString(),
        ageMinutes: Math.round((ageMs / (1000 * 60)) * 10) / 10,
        assetType,
        isTemp
      };

      if (isTemp) {
        tempAssets.push(item);
        tempSizeBytes += file.size;
      } else if (norm && activePaths.has(norm)) {
        const details = referenceDetails.get(norm) || { refCount: 1, tours: [], fields: [] };
        activeAssets.push({
          ...item,
          refCount: details.refCount,
          referencedInTours: details.tours,
          referencedInFields: details.fields
        });
        activeSizeBytes += file.size;
      } else {
        orphanAssets.push({
          ...item,
          refCount: 0,
          isOrphan: true
        });
        orphanSizeBytes += file.size;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      scanScope: tourId ? `tour:${tourId}` : 'all',
      summary: {
        totalFilesCount: physicalFiles.length,
        totalSizeBytes,
        activeFilesCount: activeAssets.length,
        activeSizeBytes,
        orphanFilesCount: orphanAssets.length,
        orphanSizeBytes,
        tempFilesCount: tempAssets.length,
        tempSizeBytes
      },
      activeAssets,
      orphanAssets,
      tempAssets
    };
  }
}

module.exports = AssetScannerService;
