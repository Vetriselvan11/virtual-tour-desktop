const publishService = require('./publish.service');
const publishJobService = require('./publishJob.service');
const { successResponse } = require('../../shared/utils/response');

class PublishController {
  static async validateTour(req, res, next) {
    try {
      const result = await publishService.validateTour(req.params.tourId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async publishTour(req, res, next) {
    try {
      const isAsync = req.query.async === 'true' || req.body.async === true;
      if (isAsync) {
        const job = await publishService.startPublishJob(req.params.tourId, req.body);
        return res.status(202).json(job);
      }

      const result = await publishService.publishTour(req.params.tourId, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getJobStatus(req, res, next) {
    try {
      const job = publishJobService.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Publish job not found' });
      }
      res.json(job);
    } catch (err) {
      next(err);
    }
  }

  static async getVersions(req, res, next) {
    try {
      const versions = await publishService.getVersions(req.params.tourId);
      res.json(versions);
    } catch (err) {
      next(err);
    }
  }

  static async rollback(req, res, next) {
    try {
      const result = await publishService.rollback(req.params.tourId, req.params.versionId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async unpublish(req, res, next) {
    try {
      const result = await publishService.unpublish(req.params.tourId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getPublicManifest(req, res, next) {
    try {
      const { slugOrId } = req.params;
      const { versionId } = req.query;
      const manifest = await publishService.getPublicManifest(slugOrId, versionId);
      res.json(manifest);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PublishController;
