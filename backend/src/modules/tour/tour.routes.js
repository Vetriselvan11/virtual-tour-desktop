const express = require('express');
const TourController = require('./tour.controller');

const router = express.Router();

router.get('/', TourController.getAllTours);
router.post('/', TourController.createTour);
router.get('/:id', TourController.getTourById);
router.put('/:id', TourController.updateTour);
router.put('/:id/folders', TourController.updateFolders);
router.delete('/:id', TourController.deleteTour);

router.get('/:id/scenes', TourController.getTourScenes);
router.get('/:id/export', TourController.exportTour);

module.exports = router;
