const express = require('express');
const PublishController = require('./publish.controller');

const router = express.Router();

// Pre-flight validation
router.post('/:tourId/validate', PublishController.validateTour);

// Publish tour (supports ?async=true for background jobs)
router.post('/:tourId', PublishController.publishTour);

// Job progress polling
router.get('/jobs/:jobId', PublishController.getJobStatus);

// Version management
router.get('/:tourId/versions', PublishController.getVersions);
router.post('/:tourId/versions/:versionId/rollback', PublishController.rollback);
router.post('/:tourId/unpublish', PublishController.unpublish);

// Public manifest by slug or tourId
router.get('/public/:slugOrId', PublishController.getPublicManifest);

module.exports = router;
