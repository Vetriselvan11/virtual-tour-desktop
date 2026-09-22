const PublishVersionModel = require('../models/publishVersion.model');
const { NotFoundError, ValidationError } = require('../../shared/errors/AppError');

class PublishMongoAdapter {
  async getVersionsByTourId(tourId) {
    const docs = await PublishVersionModel.find({ tourId }).sort({ versionNumber: -1 }).lean();
    return docs;
  }

  async getVersionById(versionId) {
    const doc = await PublishVersionModel.findOne({ versionId }).lean();
    return doc;
  }

  async getNextVersionNumber(tourId) {
    const latest = await PublishVersionModel.findOne({ tourId }).sort({ versionNumber: -1 }).lean();
    return latest ? latest.versionNumber + 1 : 1;
  }

  async createVersion(versionData) {
    const existing = await PublishVersionModel.findOne({ versionId: versionData.versionId });
    if (existing) {
      throw new ValidationError(`Version "${versionData.versionId}" already exists.`);
    }

    if (versionData.active) {
      await PublishVersionModel.updateMany({ tourId: versionData.tourId }, { $set: { active: false } });
    }

    const doc = await PublishVersionModel.create(versionData);
    return doc.toJSON ? doc.toJSON() : doc;
  }

  async updateVersion(versionId, updateData) {
    if (updateData.active && updateData.tourId) {
      await PublishVersionModel.updateMany({ tourId: updateData.tourId }, { $set: { active: false } });
    }

    const doc = await PublishVersionModel.findOneAndUpdate(
      { versionId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) throw new NotFoundError(`Version "${versionId}" not found`);
    return doc;
  }

  async getActiveVersion(tourId) {
    const doc = await PublishVersionModel.findOne({ tourId, active: true, status: 'published' }).lean();
    return doc;
  }

  async setActiveVersion(tourId, versionId) {
    const target = await PublishVersionModel.findOne({ tourId, versionId });
    if (!target) throw new NotFoundError(`Version "${versionId}" not found`);

    await PublishVersionModel.updateMany({ tourId }, { $set: { active: false } });

    target.active = true;
    target.status = 'published';
    target.publishedAt = target.publishedAt || new Date().toISOString();
    await target.save();

    return target.toJSON ? target.toJSON() : target;
  }

  async unpublishTour(tourId) {
    await PublishVersionModel.updateMany({ tourId, active: true }, { $set: { active: false, status: 'unpublished' } });
    return true;
  }

  async isSlugAvailable(slug, currentTourId) {
    const cleanSlug = (slug || '').toLowerCase().trim();
    if (!cleanSlug) return false;
    const existing = await PublishVersionModel.findOne({ publicSlug: cleanSlug, active: true }).lean();
    if (!existing) return true;
    return existing.tourId === currentTourId;
  }

  async getVersionBySlug(slug) {
    const cleanSlug = (slug || '').toLowerCase().trim();
    const doc = await PublishVersionModel.findOne({ publicSlug: cleanSlug, active: true, status: 'published' }).lean();
    return doc;
  }
}

module.exports = new PublishMongoAdapter();
