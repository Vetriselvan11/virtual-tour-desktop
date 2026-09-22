const localAdapter = require('./analytics.local.adapter');
const mongoAdapter = require('./analytics.mongo.adapter');
const { getDatabaseStatus } = require('../connection');

/**
 * Production Analytics Repository Bridge.
 * Transparently switches between MongoDB Atlas and Local JSON persistence.
 */
class AnalyticsRepository {
  get adapter() {
    return getDatabaseStatus() ? mongoAdapter : localAdapter;
  }

  recordBatch(events) {
    return this.adapter.recordBatch(events);
  }

  getOverview(tourId, filters) {
    return this.adapter.getOverview(tourId, filters);
  }

  getSceneStats(tourId, filters) {
    return this.adapter.getSceneStats(tourId, filters);
  }

  getHotspotStats(tourId, filters) {
    return this.adapter.getHotspotStats(tourId, filters);
  }

  getObjectStats(tourId, filters) {
    return this.adapter.getObjectStats(tourId, filters);
  }

  getCinematicStats(tourId, filters) {
    return this.adapter.getCinematicStats(tourId, filters);
  }

  getHeatmapData(tourId, sceneId, options) {
    return this.adapter.getHeatmapData(tourId, sceneId, options);
  }
}

module.exports = new AnalyticsRepository();
