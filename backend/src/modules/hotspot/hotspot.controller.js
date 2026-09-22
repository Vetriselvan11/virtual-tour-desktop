const HotspotService = require('./hotspot.service');

class HotspotController {
  static async updateHotspots(req, res, next) {
    try {
      const { tourId } = req.params;
      const { sceneId, hotspots } = req.body;
      
      const config = await HotspotService.updateHotspots(tourId, sceneId, hotspots);
      res.json(config);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = HotspotController;
