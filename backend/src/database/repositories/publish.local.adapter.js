const fs = require('fs');
const path = require('path');
const { PUBLISHED_DIR } = require('../../config/directories.config');
const { isPathSafe } = require('../../shared/utils/assetPath.util');
const { ValidationError, NotFoundError } = require('../../shared/errors/AppError');

function _validateId(id, name = 'ID') {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`Invalid ${name}`);
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new ValidationError(`Security violation: Path traversal in ${name}`);
  }
}

class PublishLocalAdapter {
  constructor(baseDir = PUBLISHED_DIR) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getTourDir(tourId) {
    _validateId(tourId, 'tour ID');
    const tourDir = path.join(this.baseDir, tourId);
    if (!isPathSafe(this.baseDir, tourDir)) {
      throw new ValidationError('Security violation: Access denied for tour directory');
    }
    if (!fs.existsSync(tourDir)) {
      fs.mkdirSync(tourDir, { recursive: true });
    }
    return tourDir;
  }

  _getVersionsIndexPath(tourId) {
    const tourDir = this._getTourDir(tourId);
    return path.join(tourDir, 'versions_index.json');
  }

  _getSlugsRegistryPath() {
    return path.join(this.baseDir, 'slugs_registry.json');
  }

  _readVersionsIndex(tourId) {
    const indexPath = this._getVersionsIndexPath(tourId);
    if (fs.existsSync(indexPath)) {
      try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } catch (err) {
        console.error(`[PublishLocalAdapter] Error reading versions index for ${tourId}:`, err.message);
        return [];
      }
    }
    return [];
  }

  _writeVersionsIndex(tourId, versions) {
    const indexPath = this._getVersionsIndexPath(tourId);
    const tmpPath = `${indexPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(versions, null, 2), 'utf8');
    fs.renameSync(tmpPath, indexPath);
  }

  _readSlugsRegistry() {
    const registryPath = this._getSlugsRegistryPath();
    if (fs.existsSync(registryPath)) {
      try {
        return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      } catch (err) {
        console.error('[PublishLocalAdapter] Error reading slugs registry:', err.message);
        return {};
      }
    }
    return {};
  }

  _writeSlugsRegistry(registry) {
    const registryPath = this._getSlugsRegistryPath();
    const tmpPath = `${registryPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  }

  async getVersionsByTourId(tourId) {
    const versions = this._readVersionsIndex(tourId);
    return versions.sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
  }

  async getVersionById(versionId) {
    _validateId(versionId, 'version ID');
    // Scan all tours if tourId is unknown
    if (fs.existsSync(this.baseDir)) {
      const tourDirs = fs.readdirSync(this.baseDir);
      for (const tDir of tourDirs) {
        if (tDir.startsWith('.') || tDir.endsWith('.json')) continue;
        const versions = this._readVersionsIndex(tDir);
        const match = versions.find(v => v.versionId === versionId);
        if (match) return match;
      }
    }
    return null;
  }

  async getNextVersionNumber(tourId) {
    const versions = this._readVersionsIndex(tourId);
    if (!versions.length) return 1;
    const max = Math.max(...versions.map(v => v.versionNumber || 0));
    return max + 1;
  }

  async createVersion(versionData) {
    const { tourId, versionId } = versionData;
    _validateId(tourId, 'tour ID');
    _validateId(versionId, 'version ID');

    const versions = this._readVersionsIndex(tourId);
    const existingIdx = versions.findIndex(v => v.versionId === versionId);
    if (existingIdx !== -1) {
      throw new ValidationError(`Version "${versionId}" already recorded in versions index.`);
    }

    // If marked active, deactivate others
    if (versionData.active) {
      versions.forEach(v => { v.active = false; });
    }

    const record = {
      ...versionData,
      createdAt: versionData.createdAt || new Date().toISOString()
    };

    versions.push(record);
    this._writeVersionsIndex(tourId, versions);

    // Update slug registry if publicSlug is provided
    if (record.publicSlug && record.active) {
      this.registerSlug(record.publicSlug, tourId, versionId);
    }

    return record;
  }

  async updateVersion(versionId, updateData) {
    _validateId(versionId, 'version ID');
    if (fs.existsSync(this.baseDir)) {
      const tourDirs = fs.readdirSync(this.baseDir);
      for (const tDir of tourDirs) {
        if (tDir.startsWith('.') || tDir.endsWith('.json')) continue;
        const versions = this._readVersionsIndex(tDir);
        const idx = versions.findIndex(v => v.versionId === versionId);
        if (idx !== -1) {
          if (updateData.active) {
            versions.forEach(v => { v.active = false; });
          }
          versions[idx] = { ...versions[idx], ...updateData };
          this._writeVersionsIndex(tDir, versions);
          return versions[idx];
        }
      }
    }
    throw new NotFoundError(`Version "${versionId}" not found`);
  }

  async getActiveVersion(tourId) {
    const versions = this._readVersionsIndex(tourId);
    return versions.find(v => v.active && v.status === 'published') || null;
  }

  async setActiveVersion(tourId, versionId) {
    _validateId(tourId, 'tour ID');
    _validateId(versionId, 'version ID');

    const versions = this._readVersionsIndex(tourId);
    const target = versions.find(v => v.versionId === versionId);
    if (!target) {
      throw new NotFoundError(`Version "${versionId}" not found for tour "${tourId}"`);
    }

    versions.forEach(v => {
      v.active = (v.versionId === versionId);
    });

    target.status = 'published';
    target.publishedAt = target.publishedAt || new Date().toISOString();

    this._writeVersionsIndex(tourId, versions);

    if (target.publicSlug) {
      this.registerSlug(target.publicSlug, tourId, versionId);
    }

    return target;
  }

  async unpublishTour(tourId) {
    _validateId(tourId, 'tour ID');
    const versions = this._readVersionsIndex(tourId);
    let activeVersion = null;

    versions.forEach(v => {
      if (v.active) {
        activeVersion = v;
        v.active = false;
        v.status = 'unpublished';
      }
    });

    this._writeVersionsIndex(tourId, versions);

    if (activeVersion && activeVersion.publicSlug) {
      this.unregisterSlug(activeVersion.publicSlug);
    }

    return true;
  }

  registerSlug(slug, tourId, versionId) {
    const cleanSlug = slug.toLowerCase().trim();
    const registry = this._readSlugsRegistry();
    registry[cleanSlug] = { tourId, versionId, updatedAt: new Date().toISOString() };
    this._writeSlugsRegistry(registry);
  }

  unregisterSlug(slug) {
    const cleanSlug = slug.toLowerCase().trim();
    const registry = this._readSlugsRegistry();
    if (registry[cleanSlug]) {
      delete registry[cleanSlug];
      this._writeSlugsRegistry(registry);
    }
  }

  isSlugAvailable(slug, currentTourId) {
    const cleanSlug = (slug || '').toLowerCase().trim();
    if (!cleanSlug) return false;
    const registry = this._readSlugsRegistry();
    const existing = registry[cleanSlug];
    if (!existing) return true;
    return existing.tourId === currentTourId;
  }

  async getVersionBySlug(slug) {
    const cleanSlug = (slug || '').toLowerCase().trim();
    const registry = this._readSlugsRegistry();
    const entry = registry[cleanSlug];
    if (!entry) return null;

    const versions = this._readVersionsIndex(entry.tourId);
    return versions.find(v => v.versionId === entry.versionId && v.active) || null;
  }
}

module.exports = new PublishLocalAdapter();
