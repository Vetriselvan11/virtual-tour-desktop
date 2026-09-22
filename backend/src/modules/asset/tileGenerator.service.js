const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../../config/directories.config');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // Sharp not available in environment
}

class TileGeneratorService {
  /**
   * Deterministic base directory path for a panorama's tile pyramid.
   * e.g. UPLOADS_DIR/tourId/tiles/<image_base>/
   */
  static getTilesDir(tourId, imageFilename) {
    const ext = path.extname(imageFilename);
    const base = path.basename(imageFilename, ext).replace(/\.thumb$|\.preview$/, '');
    return path.join(UPLOADS_DIR, tourId, 'tiles', base);
  }

  /**
   * Relative base URL for tiles.
   * e.g. /uploads/tourId/tiles/<image_base>
   */
  static getTilesBaseUrl(tourId, imageFilename) {
    const ext = path.extname(imageFilename);
    const base = path.basename(imageFilename, ext).replace(/\.thumb$|\.preview$/, '');
    return `/uploads/${tourId}/tiles/${base}`;
  }

  /**
   * Calculate pyramid level definitions based on master image width and height.
   * Standard 512x512 tile size with 2:1 equirectangular aspect ratio.
   * 
   * @param {number} masterWidth
   * @param {number} masterHeight
   * @param {number} [tileSize=512]
   * @returns {Array<{ level: number, width: number, height: number, cols: number, rows: number }>}
   */
  static calculatePyramidLevels(masterWidth, masterHeight, tileSize = 512) {
    const levels = [];
    let currentWidth = masterWidth;
    let currentHeight = masterHeight;

    // Collect levels from native resolution down to ~1024x512 (or minimum 512x256)
    const rawLevels = [];
    while (currentWidth >= 1024 && currentHeight >= 512) {
      const cols = Math.ceil(currentWidth / tileSize);
      const rows = Math.ceil(currentHeight / tileSize);
      rawLevels.push({
        width: currentWidth,
        height: currentHeight,
        cols,
        rows
      });

      // Halve resolution for next lower level
      currentWidth = Math.floor(currentWidth / 2);
      currentHeight = Math.floor(currentHeight / 2);
    }

    // Reverse so level 0 is lowest resolution (~1024x512), and highest level is full resolution
    rawLevels.reverse();
    rawLevels.forEach((lvl, idx) => {
      levels.push({
        level: idx,
        width: lvl.width,
        height: lvl.height,
        cols: lvl.cols,
        rows: lvl.rows
      });
    });

    return levels;
  }

  /**
   * Generates the complete multi-resolution tile pyramid for a master equirectangular image.
   * 
   * @param {string} sourceDiskPath - Absolute path to master image
   * @param {string} tourId - Tour ID
   * @param {Object} [options]
   * @param {number} [options.tileSize=512]
   * @param {number} [options.quality=85]
   * @param {boolean} [options.force=false]
   * @returns {Promise<Object>} Tile metadata
   */
  static async generateTilesForImage(sourceDiskPath, tourId, options = {}) {
    if (!fs.existsSync(sourceDiskPath)) {
      throw new Error(`Master image not found at "${sourceDiskPath}"`);
    }

    if (!sharp) {
      console.warn('[TileGenerator] Sharp is not installed. Multi-res tiles cannot be generated.');
      return null;
    }

    const tileSize = options.tileSize || 512;
    const quality = options.quality || 85;
    const force = options.force || false;

    const filename = path.basename(sourceDiskPath);
    const tilesDir = this.getTilesDir(tourId, filename);
    const metadataPath = path.join(tilesDir, 'metadata.json');
    const baseUrl = this.getTilesBaseUrl(tourId, filename);

    // 1. If metadata already exists and not forced, return cached metadata
    if (!force && fs.existsSync(metadataPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        if (cached && cached.enabled && cached.levels && cached.levels.length > 0) {
          return cached;
        }
      } catch {}
    }

    if (!fs.existsSync(tilesDir)) {
      fs.mkdirSync(tilesDir, { recursive: true });
    }

    // 2. Read master image metadata
    const metadata = await sharp(sourceDiskPath).metadata();
    const masterWidth = metadata.width;
    const masterHeight = metadata.height;

    // Only generate tiles if width >= 3840 (4K+) to save disk for small standard images
    if (masterWidth < 3840) {
      const skippedMetadata = {
        enabled: false,
        reason: 'Image resolution below 4K threshold for tiled streaming',
        width: masterWidth,
        height: masterHeight
      };
      fs.writeFileSync(metadataPath, JSON.stringify(skippedMetadata, null, 2), 'utf8');
      return skippedMetadata;
    }

    const levels = this.calculatePyramidLevels(masterWidth, masterHeight, tileSize);

    console.log(`[TileGenerator] Generating multi-res tile pyramid for "${filename}" (${masterWidth}x${masterHeight}, ${levels.length} levels)...`);

    // 3. Generate tiles level by level
    for (const lvl of levels) {
      const levelDir = path.join(tilesDir, `level_${lvl.level}`);
      if (!fs.existsSync(levelDir)) {
        fs.mkdirSync(levelDir, { recursive: true });
      }

      // Resize master image to level resolution in memory/pipeline
      const levelImageBuffer = await sharp(sourceDiskPath)
        .resize(lvl.width, lvl.height, {
          fit: 'fill',
          withoutEnlargement: false
        })
        .toBuffer();

      const sharpLevel = sharp(levelImageBuffer);

      // Slice level into grid tiles
      for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
          const tileFilename = `${r}_${c}.webp`;
          const tilePath = path.join(levelDir, tileFilename);

          if (!force && fs.existsSync(tilePath) && fs.statSync(tilePath).size > 0) {
            continue;
          }

          const left = c * tileSize;
          const top = r * tileSize;
          const width = Math.min(tileSize, lvl.width - left);
          const height = Math.min(tileSize, lvl.height - top);

          await sharp(levelImageBuffer)
            .extract({ left, top, width, height })
            .webp({ quality, effort: 4 })
            .toFile(tilePath);
        }
      }
    }

    // 4. Save metadata.json
    const tileConfig = {
      enabled: true,
      format: 'webp',
      tileSize,
      width: masterWidth,
      height: masterHeight,
      maxLevel: levels.length - 1,
      basePath: baseUrl,
      levels,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(metadataPath, JSON.stringify(tileConfig, null, 2), 'utf8');
    console.log(`[TileGenerator] Successfully generated ${levels.length} levels for "${filename}" at ${tilesDir}`);

    return tileConfig;
  }

  /**
   * Retrieves tile metadata if available.
   */
  static getTileMetadata(tourId, imageFilename) {
    const tilesDir = this.getTilesDir(tourId, imageFilename);
    const metadataPath = path.join(tilesDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch {}
    }
    return null;
  }

  /**
   * Generates a single tile on-demand if missing from disk.
   */
  static async generateSingleTile(sourceDiskPath, tourId, level, row, col, tileSize = 512) {
    if (!fs.existsSync(sourceDiskPath) || !sharp) return null;

    const filename = path.basename(sourceDiskPath);
    const tilesDir = this.getTilesDir(tourId, filename);
    const levelDir = path.join(tilesDir, `level_${level}`);
    const tileFilename = `${row}_${col}.webp`;
    const tilePath = path.join(levelDir, tileFilename);

    if (fs.existsSync(tilePath) && fs.statSync(tilePath).size > 0) {
      return tilePath;
    }

    if (!fs.existsSync(levelDir)) {
      fs.mkdirSync(levelDir, { recursive: true });
    }

    const metadata = await sharp(sourceDiskPath).metadata();
    const levels = this.calculatePyramidLevels(metadata.width, metadata.height, tileSize);
    const lvl = levels.find(l => l.level === parseInt(level, 10));
    if (!lvl) return null;

    const left = col * tileSize;
    const top = row * tileSize;
    const width = Math.min(tileSize, lvl.width - left);
    const height = Math.min(tileSize, lvl.height - top);

    if (left >= lvl.width || top >= lvl.height || width <= 0 || height <= 0) {
      return null;
    }

    await sharp(sourceDiskPath)
      .resize(lvl.width, lvl.height, { fit: 'fill' })
      .extract({ left, top, width, height })
      .webp({ quality: 85, effort: 4 })
      .toFile(tilePath);

    return tilePath;
  }

  /**
   * Cleans up all tile pyramid assets associated with an image.
   */
  static removeTiles(tourId, imageFilename) {
    try {
      const tilesDir = this.getTilesDir(tourId, imageFilename);
      if (fs.existsSync(tilesDir)) {
        fs.rmSync(tilesDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`[TileGenerator] Error removing tiles for ${imageFilename}:`, err.message);
    }
  }
}

module.exports = TileGeneratorService;
