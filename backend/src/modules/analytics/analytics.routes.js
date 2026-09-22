const express = require('express');
const AnalyticsController = require('./analytics.controller');
const { analyticsLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

// Event ingestion endpoint (batch)
router.post('/events', analyticsLimiter || ((req, res, next) => next()), AnalyticsController.recordEvents);

// Overview & Domain Aggregation endpoints
router.get('/tours/:tourId/overview', AnalyticsController.getOverview);
router.get('/tours/:tourId/scenes', AnalyticsController.getSceneStats);
router.get('/tours/:tourId/hotspots', AnalyticsController.getHotspotStats);
router.get('/tours/:tourId/objects', AnalyticsController.getObjectStats);
router.get('/tours/:tourId/cinematics', AnalyticsController.getCinematicStats);
router.get('/tours/:tourId/scenes/:sceneId/heatmap', AnalyticsController.getHeatmap);
router.get('/tours/:tourId/export', AnalyticsController.exportCsv);

module.exports = router;
