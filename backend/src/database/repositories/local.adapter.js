const fs = require('fs');
const path = require('path');
const { TOURS_DIR, UPLOADS_DIR, EXPORT_DIR } = require('../../config/directories.config');
const { NotFoundError, ValidationError } = require('../../shared/errors/AppError');
const { isPathSafe } = require('../../shared/utils/assetPath.util');

function _validateTourId(tourId) {
  if (!tourId || typeof tourId !== 'string') {
    throw new ValidationError('Invalid tour ID');
  }
  if (tourId.includes('..') || tourId.includes('/') || tourId.includes('\\')) {
    throw new ValidationError('Security violation: Path traversal in tour ID');
  }
}

function _readConfig(tourId) {
  _validateTourId(tourId);
  const configPath = path.join(TOURS_DIR, tourId, 'config.json');
  if (!isPathSafe(TOURS_DIR, configPath)) {
    throw new ValidationError('Security violation: Invalid config path');
  }

  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error(`[LocalAdapter] Error parsing config.json for tour ${tourId}:`, err.message);
      // Create backup of corrupted file for safe diagnostic recovery
      try {
        const backupPath = `${configPath}.corrupted.${Date.now()}.bak`;
        fs.copyFileSync(configPath, backupPath);
        console.warn(`[LocalAdapter] Saved backup of corrupted tour config at: ${backupPath}`);
      } catch (backupErr) {
        console.error(`[LocalAdapter] Failed to backup corrupted config:`, backupErr.message);
      }
      return null;
    }
  }

  // Backward compatibility: check legacy EXPORT_DIR/<tourId>/config.json
  if (EXPORT_DIR && EXPORT_DIR !== TOURS_DIR) {
    const legacyPath = path.join(EXPORT_DIR, tourId, 'config.json');
    if (isPathSafe(EXPORT_DIR, legacyPath) && fs.existsSync(legacyPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
        // Automatically migrate legacy tour to primary TOURS_DIR
        _writeConfig(tourId, config);
        console.log(`[LocalAdapter] Migrated legacy tour ${tourId} from ${legacyPath} to ${configPath}`);
        return config;
      } catch (err) {
        console.error(`[LocalAdapter] Error parsing legacy config.json for tour ${tourId}:`, err.message);
      }
    }
  }

  return null;
}

function _writeConfig(tourId, config) {
  _validateTourId(tourId);
  const tourDir = path.join(TOURS_DIR, tourId);
  if (!isPathSafe(TOURS_DIR, tourDir)) {
    throw new ValidationError('Security violation: Invalid tour directory path');
  }

  if (!fs.existsSync(tourDir)) fs.mkdirSync(tourDir, { recursive: true });

  // Atomic file write using a temporary file and rename
  const tmpPath = path.join(tourDir, 'config.json.tmp');
  const targetPath = path.join(tourDir, 'config.json');
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmpPath, targetPath);

  // Clean up legacy location if migrated
  if (EXPORT_DIR && EXPORT_DIR !== TOURS_DIR) {
    const legacyTourDir = path.join(EXPORT_DIR, tourId);
    if (isPathSafe(EXPORT_DIR, legacyTourDir) && fs.existsSync(legacyTourDir)) {
      try {
        fs.rmSync(legacyTourDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(`[LocalAdapter] Could not clean up legacy export dir for ${tourId}:`, cleanupErr.message);
      }
    }
  }
}

class LocalAdapter {
  async getAllTours() {
    const toursMap = new Map();

    // 1. Scan primary TOURS_DIR
    if (fs.existsSync(TOURS_DIR)) {
      const dirs = fs.readdirSync(TOURS_DIR);
      for (const dir of dirs) {
        if (dir.startsWith('.')) continue;
        try {
          const config = _readConfig(dir);
          if (config) {
            toursMap.set(dir, {
              ...config,
              id: dir,
              createdAt: config.createdAt || new Date().toISOString()
            });
          }
        } catch {}
      }
    }

    // 2. Scan legacy EXPORT_DIR for unmigrated tours
    if (EXPORT_DIR && EXPORT_DIR !== TOURS_DIR && fs.existsSync(EXPORT_DIR)) {
      const legacyDirs = fs.readdirSync(EXPORT_DIR);
      for (const dir of legacyDirs) {
        if (dir.startsWith('.')) continue;
        if (!toursMap.has(dir)) {
          try {
            const config = _readConfig(dir);
            if (config) {
              toursMap.set(dir, {
                ...config,
                id: dir,
                createdAt: config.createdAt || new Date().toISOString()
              });
            }
          } catch {}
        }
      }
    }

    const tours = Array.from(toursMap.values());
    tours.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return tours;
  }

  async getTourById(id) {
    return _readConfig(id);
  }

  async createTour(data) {
    _writeConfig(data.id, data);
    return data;
  }

  async updateTour(id, data) {
    const existing = _readConfig(id);
    if (!existing) throw new NotFoundError('Tour not found');
    const updateData = { ...data };
    delete updateData._id;
    const updated = {
      ...existing,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    _writeConfig(id, updated);
    return updated;
  }

  async updateFolders(tourId, folders) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    config.folders = (folders && typeof folders === 'object') ? folders : {};
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return config.folders;
  }

  async deleteTour(id) {
    _validateTourId(id);
    const tourDir = path.join(TOURS_DIR, id);
    const legacyDir = EXPORT_DIR && EXPORT_DIR !== TOURS_DIR ? path.join(EXPORT_DIR, id) : null;
    const uploadDir = path.join(UPLOADS_DIR, id);

    if (!isPathSafe(TOURS_DIR, tourDir) || !isPathSafe(UPLOADS_DIR, uploadDir)) {
      throw new ValidationError('Security violation: Invalid delete path');
    }
    
    const exists = fs.existsSync(tourDir) || (legacyDir && fs.existsSync(legacyDir));
    if (!exists) throw new NotFoundError('Tour not found');

    if (fs.existsSync(tourDir)) fs.rmSync(tourDir, { recursive: true, force: true });
    if (legacyDir && isPathSafe(EXPORT_DIR, legacyDir) && fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
    if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true, force: true });
    return true;
  }

  async addScene(tourId, sceneData) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    config.scenes = config.scenes || [];
    config.scenes.push(sceneData);
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return sceneData;
  }

  async updateScene(tourId, sceneId, data) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    const sceneIndex = (config.scenes || []).findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) throw new NotFoundError('Scene not found');
    
    config.scenes[sceneIndex] = { ...config.scenes[sceneIndex], ...data };
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return config.scenes[sceneIndex];
  }

  async deleteScene(tourId, sceneId) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    const scenes = config.scenes || [];
    config.scenes = scenes.filter(s => s.id !== sceneId);

    // Synchronize folders if any folder contained the deleted scene
    if (config.folders && typeof config.folders === 'object') {
      const updatedFolders = {};
      for (const [folderName, sceneIds] of Object.entries(config.folders)) {
        if (Array.isArray(sceneIds)) {
          updatedFolders[folderName] = sceneIds.filter(id => id !== sceneId);
        } else {
          updatedFolders[folderName] = sceneIds;
        }
      }
      config.folders = updatedFolders;
    }

    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return true;
  }

  async addHotspot(tourId, sceneId, hotspotData) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    const scene = (config.scenes || []).find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    scene.hotspots = scene.hotspots || [];
    scene.hotspots.push(hotspotData);
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return hotspotData;
  }

  async updateHotspot(tourId, sceneId, hotspotId, data) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    const scene = (config.scenes || []).find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    const hotspotIndex = (scene.hotspots || []).findIndex(h => h.id === hotspotId);
    if (hotspotIndex === -1) throw new NotFoundError('Hotspot not found');
    
    scene.hotspots[hotspotIndex] = { ...scene.hotspots[hotspotIndex], ...data };
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return scene.hotspots[hotspotIndex];
  }

  async deleteHotspot(tourId, sceneId, hotspotId) {
    const config = _readConfig(tourId);
    if (!config) throw new NotFoundError('Tour not found');
    const scene = (config.scenes || []).find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    scene.hotspots = (scene.hotspots || []).filter(h => h.id !== hotspotId);
    config.updatedAt = new Date().toISOString();
    _writeConfig(tourId, config);
    return true;
  }
}

module.exports = new LocalAdapter();
