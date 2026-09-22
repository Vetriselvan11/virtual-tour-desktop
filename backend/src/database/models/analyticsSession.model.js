const mongoose = require('mongoose');

/**
 * Mongoose Schema for Tour Viewing Sessions.
 */
const AnalyticsSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  tourId: { type: String, required: true, index: true },
  anonymousUserId: { type: String, index: true },
  startedAt: { type: Number, required: true },
  endedAt: { type: Number },
  durationSeconds: { type: Number, default: 0 },
  device: {
    type: { type: String },
    browser: { type: String },
    os: { type: String },
    isMobile: { type: Boolean }
  },
  viewport: {
    width: Number,
    height: Number
  },
  scenesVisited: [String],
  interactionCount: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 }
}, {
  _id: true,
  strict: false,
  versionKey: false
});

AnalyticsSessionSchema.index({ tourId: 1, startedAt: -1 });

const AnalyticsSessionModel = mongoose.models.AnalyticsSession || mongoose.model('AnalyticsSession', AnalyticsSessionSchema);

module.exports = AnalyticsSessionModel;
