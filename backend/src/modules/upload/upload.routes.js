const express = require('express');
const UploadController = require('./upload.controller');
const ModelController = require('../asset/model.controller');
const { upload, audioUpload, iconUpload, modelUpload } = require('../../config/multer.config');
const { uploadLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/upload/:tourId', uploadLimiter, upload.single('image'), UploadController.uploadSingleImage);
router.post('/upload-folder/:tourId', uploadLimiter, upload.array('images', 100), UploadController.uploadMultipleImages);
router.post('/tours/upload-audio', uploadLimiter, audioUpload.single('audio'), UploadController.uploadAudio);
router.post('/tours/upload-icon', uploadLimiter, iconUpload.single('icon'), UploadController.uploadIcon);
router.post('/upload-icon', uploadLimiter, iconUpload.single('icon'), UploadController.uploadIcon);
router.post('/upload-model/:tourId', uploadLimiter, modelUpload.single('model'), ModelController.uploadModel);
router.post('/tours/upload-model/:tourId', uploadLimiter, modelUpload.single('model'), ModelController.uploadModel);
router.delete('/upload-model/:tourId/:filename', uploadLimiter, ModelController.deleteModel);

module.exports = router;
