const sceneAnalysisService = require('./sceneAnalysis.service');
const sceneAnalysisQueue = require('./sceneAnalysisQueue.service');

class AnalysisController {
  static async analyzeTour(req, res, next) {
    try {
      const isAsync = req.query.async !== 'false' && req.body.async !== false;
      if (isAsync) {
        const job = await sceneAnalysisService.startAnalysisJob(req.params.tourId, req.body);
        return res.status(202).json(job);
      }

      const results = await sceneAnalysisService.analyzeTour(req.params.tourId, req.body);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  static async getJobStatus(req, res, next) {
    try {
      const job = sceneAnalysisQueue.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Analysis job not found' });
      }
      res.json(job);
    } catch (err) {
      next(err);
    }
  }

  static async getTourIntelligence(req, res, next) {
    try {
      const data = await sceneAnalysisService.getTourIntelligence(req.params.tourId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async acceptSuggestion(req, res, next) {
    try {
      const result = await sceneAnalysisService.acceptSuggestion(
        req.params.tourId,
        req.params.suggestionId,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async rejectSuggestion(req, res, next) {
    try {
      const result = await sceneAnalysisService.rejectSuggestion(
        req.params.tourId,
        req.params.suggestionId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AnalysisController;
