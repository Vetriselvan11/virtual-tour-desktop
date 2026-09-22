const { NotFoundError } = require('../../shared/errors/AppError');

// Lazy-load TourModel only when actually used (never in standalone/ASAR desktop mode)
function getTourModel() {
  return require('../models/tour.model');
}

class MongoAdapter {
  async getAllTours() {
    const TourModel = getTourModel();
    const tours = await TourModel.find().sort({ createdAt: -1 });
    return tours.map(t => t.toJSON());
  }

  async getTourById(id) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id });
    return tour ? tour.toJSON() : null;
  }

  async createTour(data) {
    const TourModel = getTourModel();
    const tour = new TourModel(data);
    await tour.save();
    return tour.toJSON();
  }

  async updateTour(id, data) {
    const TourModel = getTourModel();
    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;
    updateData.updatedAt = new Date().toISOString();
    const updated = await TourModel.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );
    if (!updated) throw new NotFoundError('Tour not found');
    return updated.toJSON();
  }

  async updateFolders(tourId, folders) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    tour.folders = (folders && typeof folders === 'object') ? folders : {};
    tour.updatedAt = new Date().toISOString();
    tour.markModified('folders');
    await tour.save();
    return tour.folders;
  }

  async deleteTour(id) {
    const TourModel = getTourModel();
    const result = await TourModel.findOneAndDelete({ id });
    if (!result) throw new NotFoundError('Tour not found');
    return true;
  }

  async addScene(tourId, sceneData) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    tour.scenes.push(sceneData);
    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return sceneData;
  }

  async updateScene(tourId, sceneId, data) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    const scene = tour.scenes.find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    Object.assign(scene, data);
    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return scene;
  }

  async deleteScene(tourId, sceneId) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    tour.scenes = tour.scenes.filter(s => s.id !== sceneId);

    // Synchronize folders if any folder contained the deleted scene
    if (tour.folders && typeof tour.folders === 'object') {
      const updatedFolders = {};
      for (const [folderName, sceneIds] of Object.entries(tour.folders)) {
        if (Array.isArray(sceneIds)) {
          updatedFolders[folderName] = sceneIds.filter(id => id !== sceneId);
        } else {
          updatedFolders[folderName] = sceneIds;
        }
      }
      tour.folders = updatedFolders;
      tour.markModified('folders');
    }

    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return true;
  }

  async addHotspot(tourId, sceneId, hotspotData) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    const scene = tour.scenes.find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    scene.hotspots.push(hotspotData);
    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return hotspotData;
  }

  async updateHotspot(tourId, sceneId, hotspotId, data) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    const scene = tour.scenes.find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    const hotspot = scene.hotspots.find(h => h.id === hotspotId);
    if (!hotspot) throw new NotFoundError('Hotspot not found');
    
    Object.assign(hotspot, data);
    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return hotspot;
  }

  async deleteHotspot(tourId, sceneId, hotspotId) {
    const TourModel = getTourModel();
    const tour = await TourModel.findOne({ id: tourId });
    if (!tour) throw new NotFoundError('Tour not found');
    
    const scene = tour.scenes.find(s => s.id === sceneId);
    if (!scene) throw new NotFoundError('Scene not found');
    
    scene.hotspots = scene.hotspots.filter(h => h.id !== hotspotId);
    tour.updatedAt = new Date().toISOString();
    await tour.save();
    return true;
  }
}

module.exports = new MongoAdapter();
