const publishLocalAdapter = require('./publish.local.adapter');
const publishMongoAdapter = require('./publish.mongo.adapter');
const { getDatabaseStatus } = require('../connection');

class PublishRepository {
  get adapter() {
    return getDatabaseStatus() ? publishMongoAdapter : publishLocalAdapter;
  }

  getVersionsByTourId(tourId) { return this.adapter.getVersionsByTourId(tourId); }
  getVersionById(versionId) { return this.adapter.getVersionById(versionId); }
  getNextVersionNumber(tourId) { return this.adapter.getNextVersionNumber(tourId); }
  createVersion(versionData) { return this.adapter.createVersion(versionData); }
  updateVersion(versionId, updateData) { return this.adapter.updateVersion(versionId, updateData); }
  getActiveVersion(tourId) { return this.adapter.getActiveVersion(tourId); }
  setActiveVersion(tourId, versionId) { return this.adapter.setActiveVersion(tourId, versionId); }
  unpublishTour(tourId) { return this.adapter.unpublishTour(tourId); }
  isSlugAvailable(slug, currentTourId) { return this.adapter.isSlugAvailable(slug, currentTourId); }
  getVersionBySlug(slug) { return this.adapter.getVersionBySlug(slug); }
}

module.exports = new PublishRepository();
