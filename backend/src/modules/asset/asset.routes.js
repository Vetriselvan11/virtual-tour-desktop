const express = require('express');
const AssetController = require('./asset.controller');

const router = express.Router();

router.get('/scan', AssetController.scanAssets);
router.get('/stats', AssetController.getStats);
router.post('/cleanup', AssetController.cleanupAssets);
router.post('/thumbnails/generate', AssetController.generateThumbnail);
router.post('/tiles/generate', AssetController.generateTiles);
router.get('/tours/:tourId/tiles/:filename/metadata', AssetController.getTileMetadata);

module.exports = router;
