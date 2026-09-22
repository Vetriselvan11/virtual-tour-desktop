const express = require('express');
const AnalysisController = require('./analysis.controller');

const router = express.Router();

// Bulk or incremental scene analysis (supports ?async=true)
router.post('/:tourId/analyze', AnalysisController.analyzeTour);

// Job progress polling
router.get('/jobs/:jobId', AnalysisController.getJobStatus);

// Get current intelligence metadata and suggestions for a tour
router.get('/:tourId', AnalysisController.getTourIntelligence);
router.get('/:tourId/intelligence', AnalysisController.getTourIntelligence);

// Accept or reject AI suggestion
router.post('/:tourId/suggestions/:suggestionId/accept', AnalysisController.acceptSuggestion);
router.post('/:tourId/suggestions/:suggestionId/reject', AnalysisController.rejectSuggestion);

module.exports = router;
