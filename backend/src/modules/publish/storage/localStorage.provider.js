 const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./storage.provider');
const { PUBLISHED_DIR } = require('../../../config/directories.config');
const { isPathSafe } = require('../../../shared/utils/assetPath.util');
const { ValidationError, NotFoundError } = require('../../../shared/errors/AppError');

class LocalStorageProvider extends StorageProvider {
  constructor(baseDir = PUBLISHED_DIR) {
    super();
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _validateId(id, name = 'ID') {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(`Invalid ${name}`);
    }
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw new ValidationError(`Security violation: Path traversal in ${name} "${id}"`);
    }
  }

  getTourDir(tourId) {
    this._validateId(tourId, 'tour ID');
    const tourDir = path.join(this.baseDir, tourId);
    if (!isPathSafe(this.baseDir, tourDir)) {
      throw new ValidationError('Security violation: Access denied for tour path');
    }
    return tourDir;
  }

  getVersionDir(tourId, versionId) {
    this._validateId(tourId, 'tour ID');
    this._validateId(versionId, 'version ID');
    const tourDir = this.getTourDir(tourId);
    const versionDir = path.join(tourDir, 'versions', versionId);
    if (!isPathSafe(tourDir, versionDir)) {
      throw new ValidationError('Security violation: Access denied for version path');
    }
    return versionDir;
  }

  async initTour(tourId) {
    const tourDir = this.getTourDir(tourId);
    if (!fs.existsSync(tourDir)) {
      fs.mkdirSync(tourDir, { recursive: true });
    }
    const versionsDir = path.join(tourDir, 'versions');
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }
  }

  async createVersion(tourId, versionId) {
    await this.initTour(tourId);
    const versionDir = this.getVersionDir(tourId, versionId);
    if (fs.existsSync(versionDir)) {
      throw new ValidationError(`Version "${versionId}" already exists for tour "${tourId}". Immutable versions cannot be overwritten.`);
    }

    fs.mkdirSync(versionDir, { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'panoramas'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'tiles'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'thumbnails'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'models'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'audio'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'media'), { recursive: true });
    fs.mkdirSync(path.join(versionDir, 'floorplans'), { recursive: true });

    return versionDir;
  }

  async saveManifest(tourId, versionId, manifestObj) {
    const versionDir = this.getVersionDir(tourId, versionId);
    if (!fs.existsSync(versionDir)) {
      throw new NotFoundError(`Version directory "${versionDir}" does not exist.`);
    }

    const manifestPath = path.join(versionDir, 'manifest.json');
    const tmpPath = path.join(versionDir, 'manifest.json.tmp');

    const manifestJson = JSON.stringify(manifestObj, null, 2);
    fs.writeFileSync(tmpPath, manifestJson, 'utf8');
    fs.renameSync(tmpPath, manifestPath);

    return manifestPath;
  }

  async readManifest(tourId, versionId) {
    const versionDir = this.getVersionDir(tourId, versionId);
    const manifestPath = path.join(versionDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundError(`Manifest not found for tour "${tourId}" version "${versionId}"`);
    }

    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw);
  }

  async storeAsset(tourId, versionId, sourceDiskPath, targetRelativePath, options = {}) {
    if (!fs.existsSync(sourceDiskPath)) {
      throw new NotFoundError(`Source asset not found at "${sourceDiskPath}"`);
    }

    const versionDir = this.getVersionDir(tourId, versionId);
    const cleanRel = targetRelativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    if (cleanRel.includes('..')) {
      throw new ValidationError(`Security violation: Invalid target asset relative path "${cleanRel}"`);
    }

    const destPath = path.join(versionDir, cleanRel);
    if (!isPathSafe(versionDir, destPath)) {
      throw new ValidationError(`Security violation: Target asset outside version directory "${cleanRel}"`);
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Calculate SHA-256 hash for deduplication/verification
    const buffer = fs.readFileSync(sourceDiskPath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Atomic file copy
    const tmpDest = `${destPath}.tmp_${Date.now()}`;
    fs.writeFileSync(tmpDest, buffer);
    fs.renameSync(tmpDest, destPath);

    const stats = fs.statSync(destPath);
    return {
      relativePath: cleanRel,
      diskPath: destPath,
      sizeBytes: stats.size,
      hash
    };
  }

  async storeTilePyramid(tourId, versionId, sceneBase, sourceTilesDir) {
    if (!fs.existsSync(sourceTilesDir)) {
      return { totalTiles: 0, sizeBytes: 0 };
    }

    const versionDir = this.getVersionDir(tourId, versionId);
    const targetTilesDir = path.join(versionDir, 'tiles', sceneBase);
    if (!fs.existsSync(targetTilesDir)) {
      fs.mkdirSync(targetTilesDir, { recursive: true });
    }

    let totalTiles = 0;
    let sizeBytes = 0;

    const copyRecursive = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, destPath);
          const stat = fs.statSync(destPath);
          sizeBytes += stat.size;
          totalTiles++;
        }
      }
    };

    copyRecursive(sourceTilesDir, targetTilesDir);

    return { totalTiles, sizeBytes };
  }

  getAssetDiskPath(tourId, versionId, targetRelativePath) {
    const versionDir = this.getVersionDir(tourId, versionId);
    const cleanRel = (targetRelativePath || '').replace(/^[/\\]+/, '').replace(/\\/g, '/');
    if (cleanRel.includes('..')) {
      throw new ValidationError(`Security violation: Path traversal in target relative path "${cleanRel}"`);
    }

    const resolved = path.join(versionDir, cleanRel);
    if (!isPathSafe(versionDir, resolved)) {
      throw new ValidationError(`Security violation: Path outside version directory`);
    }

    return resolved;
  }

  async deleteVersion(tourId, versionId) {
    const versionDir = this.getVersionDir(tourId, versionId);
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }
}

module.exports = LocalStorageProvider;
