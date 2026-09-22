const express = require('express');
const HotspotController = require('./hotspot.controller');

const router = express.Router();

router.put('/:tourId', HotspotController.updateHotspots);

module.exports = router;
