const AssetScannerService = require('./assetScanner.service');
const AssetCleanupService = require('./assetCleanup.service');
const ThumbnailService = require('./thumbnail.service');
const { getDiskPath } = require('../../shared/utils/assetPath.util');

class AssetController {
  static async scanAssets(req, res, next) {
    try {
      const tourId = req.query.tourId || null;
      const report = await AssetScannerService.scanOrphanAssets({ tourId });
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async cleanupAssets(req, res, next) {
    try {
      const { tourId, gracePeriodMs, dryRun } = req.body;
      const result = await AssetCleanupService.cleanupOrphanAssets({
        tourId: tourId || null,
        gracePeriodMs: gracePeriodMs !== undefined ? Number(gracePeriodMs) : undefined,
        dryRun: Boolean(dryRun)
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getStats(req, res, next) {
    try {
      const report = await AssetScannerService.scanOrphanAssets();
      res.json({
        summary: report.summary,
        timestamp: report.timestamp
      });
    } catch (err) {
      next(err);
    }
  }

  static async generateThumbnail(req, res, next) {
    try {
      const { tourId, imagePath } = req.body;
      if (!tourId || !imagePath) {
        return res.status(400).json({ error: 'tourId and imagePath are required' });
      }

      const diskPath = getDiskPath(imagePath);
      const result = await ThumbnailService.generateThumbnail(diskPath, tourId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async generateTiles(req, res, next) {
    try {
      const { tourId, imagePath, force } = req.body;
      if (!tourId || !imagePath) {
        return res.status(400).json({ error: 'tourId and imagePath are required' });
      }

      const TileGeneratorService = require('./tileGenerator.service');
      const diskPath = getDiskPath(imagePath);
      const result = await TileGeneratorService.generateTilesForImage(diskPath, tourId, { force: Boolean(force) });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getTileMetadata(req, res, next) {
    try {
      const { tourId, filename } = req.params;
      const TileGeneratorService = require('./tileGenerator.service');
      const metadata = TileGeneratorService.getTileMetadata(tourId, filename);
      if (!metadata) {
        return res.status(404).json({ error: 'Tile metadata not found' });
      }
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AssetController;
