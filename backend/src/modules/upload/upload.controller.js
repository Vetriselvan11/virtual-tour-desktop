const UploadService = require('./upload.service');

class UploadController {
  static async uploadSingleImage(req, res, next) {
    try {
      const result = await UploadService.processSingleImage(req.params.tourId, req.file);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async uploadMultipleImages(req, res, next) {
    try {
      const results = await UploadService.processMultipleImages(req.params.tourId, req.files);
      res.json(results);
    } catch (err) {
      next(err);
    }
  }

  static async uploadAudio(req, res, next) {
    try {
      const result = await UploadService.processAudio(req.file);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async uploadIcon(req, res, next) {
    try {
      const result = await UploadService.processIcon(req.file);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UploadController;
