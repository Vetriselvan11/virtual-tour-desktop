const fs = require('fs');
const path = require('path');
const { ANALYSIS_DIR } = require('../../config/directories.config');
const { isPathSafe } = require('../../shared/utils/assetPath.util');
const { ValidationError, NotFoundError } = require('../../shared/errors/AppError');

function _validateTourId(tourId) {
  if (!tourId || typeof tourId !== 'string') {
    throw new ValidationError('Invalid tour ID');
  }
  if (tourId.includes('..') || tourId.includes('/') || tourId.includes('\\')) {
    throw new ValidationError('Security violation: Path traversal in tour ID');
  }
}

class SceneAnalysisLocalAdapter {
  constructor(baseDir = ANALYSIS_DIR) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getTourFilePath(tourId) {
    _validateTourId(tourId);
    const filePath = path.join(this.baseDir, `${tourId}.json`);
    if (!isPathSafe(this.baseDir, filePath)) {
      throw new ValidationError('Security violation: Access denied for analysis path');
    }
    return filePath;
  }

  _readTourData(tourId) {
    const filePath = this._getTourFilePath(tourId);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        console.error(`[SceneAnalysisLocalAdapter] Error reading analysis data for ${tourId}:`, err.message);
        return { scenes: {}, suggestions: [], updatedAt: new Date().toISOString() };
      }
    }
    return { scenes: {}, suggestions: [], updatedAt: new Date().toISOString() };
  }

  _writeTourData(tourId, data) {
    const filePath = this._getTourFilePath(tourId);
    const tmpPath = `${filePath}.tmp_${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  async saveSceneAnalysis(tourId, sceneId, analysisData) {
    const data = this._readTourData(tourId);
    data.scenes = data.scenes || {};
    data.scenes[sceneId] = {
      tourId,
      sceneId,
      ...analysisData,
      analyzedAt: analysisData.analyzedAt || new Date().toISOString()
    };
    data.updatedAt = new Date().toISOString();
    this._writeTourData(tourId, data);
    return data.scenes[sceneId];
  }

  async getSceneAnalysis(tourId, sceneId) {
    const data = this._readTourData(tourId);
    return (data.scenes && data.scenes[sceneId]) || null;
  }

  async getAllSceneAnalyses(tourId) {
    const data = this._readTourData(tourId);
    return data.scenes || {};
  }

  async saveTourSuggestions(tourId, suggestions) {
    const data = this._readTourData(tourId);
    data.suggestions = suggestions || [];
    data.updatedAt = new Date().toISOString();
    this._writeTourData(tourId, data);
    return data.suggestions;
  }

  async getTourSuggestions(tourId) {
    const data = this._readTourData(tourId);
    return data.suggestions || [];
  }

  async updateSuggestionStatus(tourId, suggestionId, status) {
    const data = this._readTourData(tourId);
    const suggestions = data.suggestions || [];
    const target = suggestions.find(s => s.suggestionId === suggestionId);
    if (target) {
      target.status = status;
      target.resolvedAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      this._writeTourData(tourId, data);
      return target;
    }
    return null;
  }

  async deleteTourAnalysis(tourId) {
    const filePath = this._getTourFilePath(tourId);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      return true;
    }
    return false;
  }
}

module.exports = new SceneAnalysisLocalAdapter();
