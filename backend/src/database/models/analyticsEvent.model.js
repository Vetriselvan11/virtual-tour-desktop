const mongoose = require('mongoose');

/**
 * Mongoose Schema for Granular Analytics Events.
 * Optimized for high-throughput batch writes and aggregation queries.
 */
const AnalyticsEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  tourId: { type: String, required: true, index: true },
  sceneId: { type: String, index: true },
  timestamp: { type: Number, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  device: {
    type: { type: String },
    browser: { type: String },
    os: { type: String },
    isMobile: { type: Boolean }
  },
  viewport: {
    width: Number,
    height: Number,
    dpr: Number
  },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 } // 1-year TTL
}, {
  _id: true,
  strict: false,
  versionKey: false,
  timestamps: false
});

// Compound Indexes for fast aggregation pipelines
AnalyticsEventSchema.index({ tourId: 1, eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ tourId: 1, sceneId: 1, eventType: 1 });
AnalyticsEventSchema.index({ tourId: 1, 'payload.yawBin': 1, 'payload.pitchBin': 1 });
AnalyticsEventSchema.index({ sessionId: 1, timestamp: 1 });

const AnalyticsEventModel = mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', AnalyticsEventSchema);

module.exports = AnalyticsEventModel;
