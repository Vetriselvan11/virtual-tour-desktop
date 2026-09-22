const express = require('express');
const tourRoutes = require('../modules/tour');
const hotspotRoutes = require('../modules/hotspot');
const uploadRoutes = require('../modules/upload');
const assetRoutes = require('../modules/asset').routes;
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const publishRoutes = require('../modules/publish').routes;
const analysisRoutes = require('../modules/analysis').routes;
const pkg = require('../../package.json');

const router = express.Router();

// Dynamic Version API Endpoint — reads directly from package.json
router.get('/version', (req, res) => {
  res.json({
    version: pkg.version || '1.0.0',
    formatted: `v${pkg.version || '1.0.0'}`
  });
});

router.use('/tours', tourRoutes);
router.use('/hotspots', hotspotRoutes);
router.use('/assets', assetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/publish', publishRoutes);
router.use('/analysis', analysisRoutes);
router.use('/', uploadRoutes);

module.exports = router;

