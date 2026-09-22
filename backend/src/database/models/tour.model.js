const mongoose = require('mongoose');

const HotspotSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String },
  position: {
    x: Number,
    y: Number,
    z: Number
  },
  targetScene: String
}, { _id: false, strict: false });

const SceneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  image: String,
  hotspots: [HotspotSchema]
}, { _id: false, strict: false });

const TourSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  description: String,
  clientLogo: String,
  clientUrl: String,
  startScene: String,
  published: Boolean,
  createdAt: String,
  updatedAt: String,
  floorplan: String,
  floorplanPins: { type: mongoose.Schema.Types.Mixed, default: {} },
  floor2Plan: String,
  floor2Pins: { type: mongoose.Schema.Types.Mixed, default: {} },
  folders: { type: mongoose.Schema.Types.Mixed, default: {} },
  ambientAudio: String,
  ambientVolume: Number,
  keyframes: [mongoose.Schema.Types.Mixed],
  guidedTour: mongoose.Schema.Types.Mixed,
  scenes: [SceneSchema]
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

const TourModel = mongoose.models.Tour || mongoose.model('Tour', TourSchema);

module.exports = TourModel;
