const TourRepository = require('../../database/repositories/tour.repository');

class HotspotService {
  static async updateHotspots(tourId, sceneId, hotspots) {
    await TourRepository.updateScene(tourId, sceneId, { hotspots });
    const config = await TourRepository.getTourById(tourId);
    return config;
  }
}

module.exports = HotspotService;
