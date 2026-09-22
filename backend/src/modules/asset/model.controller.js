const path = require('path');
const modelService = require('./model.service');
const { ValidationError, AppError } = require('../../shared/errors/AppError');

/**
 * Controller for 3D Model uploads and metadata extraction.
 */
class ModelController {
  async uploadModel(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError('No 3D model file provided for upload.');
      }

      const { tourId } = req.params;
      if (!tourId) {
        throw new ValidationError('Tour ID is required.');
      }

      const filePath = req.file.path;
      const metadata = modelService.extractMetadata(filePath);
      const filename = path.basename(filePath);
      const modelUrl = `/uploads/${tourId}/models/${filename}`;

      return res.status(201).json({
        success: true,
        message: '3D model uploaded and parsed successfully.',
        asset: {
          url: modelUrl,
          filename: req.file.originalname,
          storageName: filename,
          format: metadata.format,
          fileSize: metadata.fileSize,
          metadata: {
            triangleCount: metadata.triangleCount,
            vertexCount: metadata.vertexCount,
            meshCount: metadata.meshCount,
            materialCount: metadata.materialCount,
            animationCount: metadata.animationCount,
            animationClips: metadata.animationClips,
            materials: metadata.materials
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteModel(req, res, next) {
    try {
      const { tourId, filename } = req.params;
      const deleted = modelService.deleteModelFile(tourId, filename);
      return res.json({
        success: true,
        deleted
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ModelController();
