const routes = require('./asset.routes');
const controller = require('./asset.controller');
const referenceService = require('./assetReference.service');
const scannerService = require('./assetScanner.service');
const cleanupService = require('./assetCleanup.service');
const thumbnailService = require('./thumbnail.service');

module.exports = {
  routes,
  controller,
  referenceService,
  scannerService,
  cleanupService,
  thumbnailService
};
