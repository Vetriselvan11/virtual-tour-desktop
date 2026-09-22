const analyticsService = require('./analytics.service');
const { ValidationError } = require('../../shared/errors/AppError');

/**
 * Express Controller for Analytics & Heatmap API Endpoints.
 */
class AnalyticsController {
  async recordEvents(req, res, next) {
    try {
      const events = req.body.events || (Array.isArray(req.body) ? req.body : [req.body]);
      const result = await analyticsService.ingestEvents(events);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getOverview(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const data = await analyticsService.getOverview(tourId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getSceneStats(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const data = await analyticsService.getSceneStats(tourId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getHotspotStats(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const data = await analyticsService.getHotspotStats(tourId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getObjectStats(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const data = await analyticsService.getObjectStats(tourId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getCinematicStats(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const data = await analyticsService.getCinematicStats(tourId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getHeatmap(req, res, next) {
    try {
      const { tourId, sceneId } = req.params;
      if (!tourId || !sceneId) throw new ValidationError('Tour ID and Scene ID are required.');
      const data = await analyticsService.getHeatmapData(tourId, sceneId, req.query);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const { tourId } = req.params;
      if (!tourId) throw new ValidationError('Tour ID is required.');
      const csv = await analyticsService.exportCsv(tourId, req.query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${tourId}_${Date.now()}.csv"`);
      return res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
