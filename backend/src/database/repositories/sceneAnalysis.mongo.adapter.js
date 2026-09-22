const SceneAnalysisModel = require('../models/sceneAnalysis.model');

class SceneAnalysisMongoAdapter {
  async saveSceneAnalysis(tourId, sceneId, analysisData) {
    const filter = { tourId, sceneId };
    const update = {
      tourId,
      sceneId,
      ...analysisData,
      analyzedAt: analysisData.analyzedAt || new Date().toISOString()
    };
    const doc = await SceneAnalysisModel.findOneAndUpdate(filter, { $set: update }, { upsert: true, new: true }).lean();
    return doc;
  }

  async getSceneAnalysis(tourId, sceneId) {
    const doc = await SceneAnalysisModel.findOne({ tourId, sceneId }).lean();
    return doc;
  }

  async getAllSceneAnalyses(tourId) {
    const docs = await SceneAnalysisModel.find({ tourId }).lean();
    const result = {};
    for (const d of docs) {
      result[d.sceneId] = d;
    }
    return result;
  }

  async saveTourSuggestions(tourId, suggestions) {
    // Stores in a specialized tour meta collection or local fallback
    const localAdapter = require('./sceneAnalysis.local.adapter');
    return await localAdapter.saveTourSuggestions(tourId, suggestions);
  }

  async getTourSuggestions(tourId) {
    const localAdapter = require('./sceneAnalysis.local.adapter');
    return await localAdapter.getTourSuggestions(tourId);
  }

  async updateSuggestionStatus(tourId, suggestionId, status) {
    const localAdapter = require('./sceneAnalysis.local.adapter');
    return await localAdapter.updateSuggestionStatus(tourId, suggestionId, status);
  }

  async deleteTourAnalysis(tourId) {
    await SceneAnalysisModel.deleteMany({ tourId });
    return true;
  }
}

module.exports = new SceneAnalysisMongoAdapter();
