const sceneAnalysisLocalAdapter = require('./sceneAnalysis.local.adapter');
const sceneAnalysisMongoAdapter = require('./sceneAnalysis.mongo.adapter');
const { getDatabaseStatus } = require('../connection');

class SceneAnalysisRepository {
  get adapter() {
    return getDatabaseStatus() ? sceneAnalysisMongoAdapter : sceneAnalysisLocalAdapter;
  }

  saveSceneAnalysis(tourId, sceneId, analysisData) { return this.adapter.saveSceneAnalysis(tourId, sceneId, analysisData); }
  getSceneAnalysis(tourId, sceneId) { return this.adapter.getSceneAnalysis(tourId, sceneId); }
  getAllSceneAnalyses(tourId) { return this.adapter.getAllSceneAnalyses(tourId); }
  saveTourSuggestions(tourId, suggestions) { return this.adapter.saveTourSuggestions(tourId, suggestions); }
  getTourSuggestions(tourId) { return this.adapter.getTourSuggestions(tourId); }
  updateSuggestionStatus(tourId, suggestionId, status) { return this.adapter.updateSuggestionStatus(tourId, suggestionId, status); }
  deleteTourAnalysis(tourId) { return this.adapter.deleteTourAnalysis(tourId); }
}

module.exports = new SceneAnalysisRepository();
