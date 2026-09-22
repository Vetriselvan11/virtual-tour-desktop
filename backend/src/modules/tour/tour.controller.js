const TourService = require('./tour.service');
const fs = require('fs');

class TourController {
  static async getAllTours(req, res, next) {
    try {
      const tours = await TourService.getAllTours();
      res.json(tours);
    } catch (err) {
      next(err);
    }
  }

  static async createTour(req, res, next) {
    try {
      const config = await TourService.createTour(req.body);
      res.status(201).json(config);
    } catch (err) {
      next(err);
    }
  }

  static async getTourById(req, res, next) {
    try {
      const config = await TourService.getTourById(req.params.id);
      res.json(config);
    } catch (err) {
      next(err);
    }
  }

  static async updateTour(req, res, next) {
    try {
      const updated = await TourService.updateTour(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async updateFolders(req, res, next) {
    try {
      const folders = req.body && req.body.folders !== undefined ? req.body.folders : req.body;
      const updated = await TourService.updateFolders(req.params.id, folders);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async deleteTour(req, res, next) {
    try {
      await TourService.deleteTour(req.params.id);
      res.json({ message: 'Tour deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getTourScenes(req, res, next) {
    try {
      const scenes = await TourService.getTourScenes(req.params.id);
      res.json(scenes);
    } catch (err) {
      next(err);
    }
  }

  static async exportTour(req, res, next) {
    try {
      const { zipPath, safeTitle } = await TourService.exportTour(req.params.id);
      res.download(zipPath, `${safeTitle}_virtual_tour.zip`, (err) => {
        try {
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        } catch (cleanupErr) {
          console.error('Cleanup export zip file error:', cleanupErr);
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TourController;
