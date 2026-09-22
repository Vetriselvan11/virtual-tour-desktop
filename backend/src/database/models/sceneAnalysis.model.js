const mongoose = require('mongoose');

const SceneAnalysisSchema = new mongoose.Schema({
  tourId: { type: String, required: true, index: true },
  sceneId: { type: String, required: true },
  algorithmVersion: { type: String, default: '1.0.0-cv' },
  assetHash: String,
  category: { type: String, default: 'Unknown' },
  categoryConfidence: { type: Number, default: 0 },
  categoryReasoning: String,
  fingerprint: { type: mongoose.Schema.Types.Mixed, default: {} },
  analyzedAt: { type: String, required: true }
}, {
  _id: true,
  strict: false,
  versionKey: false,
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      return ret;
    }
  }
});

SceneAnalysisSchema.index({ tourId: 1, sceneId: 1 }, { unique: true });
SceneAnalysisSchema.index({ tourId: 1, analyzedAt: -1 });

const SceneAnalysisModel = mongoose.models.SceneAnalysis || mongoose.model('SceneAnalysis', SceneAnalysisSchema);

module.exports = SceneAnalysisModel;
