const localAdapter = require('./local.adapter');
const mongoAdapter = require('./mongo.adapter');
const { getDatabaseStatus } = require('../connection');

class TourRepository {
  get adapter() {
    return getDatabaseStatus() ? mongoAdapter : localAdapter;
  }

  getAllTours() { return this.adapter.getAllTours(); }
  getTourById(id) { return this.adapter.getTourById(id); }
  createTour(data) { return this.adapter.createTour(data); }
  updateTour(id, data) { return this.adapter.updateTour(id, data); }
  updateFolders(tourId, folders) { return this.adapter.updateFolders(tourId, folders); }
  deleteTour(id) { return this.adapter.deleteTour(id); }
  
  addScene(tourId, sceneData) { return this.adapter.addScene(tourId, sceneData); }
  updateScene(tourId, sceneId, data) { return this.adapter.updateScene(tourId, sceneId, data); }
  deleteScene(tourId, sceneId) { return this.adapter.deleteScene(tourId, sceneId); }
  
  addHotspot(tourId, sceneId, hotspotData) { return this.adapter.addHotspot(tourId, sceneId, hotspotData); }
  updateHotspot(tourId, sceneId, hotspotId, data) { return this.adapter.updateHotspot(tourId, sceneId, hotspotId, data); }
  deleteHotspot(tourId, sceneId, hotspotId) { return this.adapter.deleteHotspot(tourId, sceneId, hotspotId); }
}

module.exports = new TourRepository();
