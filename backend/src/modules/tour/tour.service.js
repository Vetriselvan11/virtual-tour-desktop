const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const TourRepository = require('../../database/repositories/tour.repository');
const { TOURS_DIR, UPLOADS_DIR, EXPORT_DIR } = require('../../config/directories.config');
const { NotFoundError } = require('../../shared/errors/AppError');

// Lazy-loaded — only needed during export, not on server startup
function getExportCompiler() {
  try {
    delete require.cache[require.resolve('../../../export/ExportCompiler')];
  } catch (e) {}
  return require('../../../export/ExportCompiler');
}

class TourService {
  static async getAllTours() {
    return await TourRepository.getAllTours();
  }

  static async createTour(data = {}) {
    const tourId = data.id || uuidv4();
    const config = {
      id: tourId,
      title: data.title || 'Untitled Tour',
      description: data.description || '',
      startScene: data.startScene || null,
      scenes: data.scenes || [],
      folders: data.folders || {},
      floorplan: data.floorplan || null,
      floorplanPins: data.floorplanPins || {},
      floor2Plan: data.floor2Plan || null,
      floor2Pins: data.floor2Pins || {},
      ambientAudio: data.ambientAudio || null,
      ambientVolume: data.ambientVolume !== undefined ? data.ambientVolume : 1,
      keyframes: data.keyframes || [],
      guidedTour: data.guidedTour || null,
      ...data,
      id: tourId,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await TourRepository.createTour(config);
    return config;
  }

  static async getTourById(id) {
    const config = await TourRepository.getTourById(id);
    if (!config) throw new NotFoundError('Tour not found');
    return config;
  }

  static async updateTour(id, data) {
    return await TourRepository.updateTour(id, data);
  }

  static async updateFolders(id, folders) {
    return await TourRepository.updateFolders(id, folders);
  }

  static async deleteTour(id) {
    return await TourRepository.deleteTour(id);
  }

  static async getTourScenes(id) {
    const config = await TourRepository.getTourById(id);
    if (!config) throw new NotFoundError('Tour not found');
    return config.scenes || [];
  }

  static async exportTour(tourId) {
    const config = await TourRepository.getTourById(tourId);
    if (!config) throw new NotFoundError('Tour not found');

    const exportDir = path.join(EXPORT_DIR, tourId);
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const zipPath = path.join(exportDir, `${tourId}_export.zip`);

    await getExportCompiler().compile(tourId, config, TOURS_DIR, UPLOADS_DIR, zipPath);
    
    const safeTitle = (config.title || 'untitled_tour').toLowerCase().replace(/\s+/g, '_');
    return { zipPath, safeTitle };
  }
}

module.exports = TourService;
