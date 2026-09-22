const mongoose = require('mongoose');

const PublishVersionSchema = new mongoose.Schema({
  versionId: { type: String, required: true, unique: true },
  tourId: { type: String, required: true, index: true },
  versionNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ['draft', 'validating', 'building', 'published', 'failed', 'unpublished'],
    default: 'published'
  },
  title: String,
  publicSlug: { type: String, index: true },
  createdAt: { type: String, required: true },
  publishedAt: String,
  createdBy: { type: String, default: 'local_user' },
  manifestPath: String,
  assetBasePath: String,
  totalAssets: { type: Number, default: 0 },
  totalSize: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  changeLog: { type: String, default: '' },
  error: String,
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
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

PublishVersionSchema.index({ tourId: 1, versionNumber: -1 });
PublishVersionSchema.index({ tourId: 1, active: 1 });
PublishVersionSchema.index({ publicSlug: 1 });

const PublishVersionModel = mongoose.models.PublishVersion || mongoose.model('PublishVersion', PublishVersionSchema);

module.exports = PublishVersionModel;
