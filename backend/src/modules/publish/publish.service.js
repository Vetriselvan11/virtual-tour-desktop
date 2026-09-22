const TourRepository = require('../../database/repositories/tour.repository');
const PublishRepository = require('../../database/repositories/publish.repository');
const LocalStorageProvider = require('./storage/localStorage.provider');
const PublishValidatorService = require('./publishValidator.service');
const PublishAssetCollectorService = require('./publishAssetCollector.service');
const ManifestBuilderService = require('./manifestBuilder.service');
const publishJobService = require('./publishJob.service');
const { ValidationError, NotFoundError } = require('../../shared/errors/AppError');

class PublishService {
  constructor(storageProvider = new LocalStorageProvider()) {
    this.storageProvider = storageProvider;
  }

  /**
   * Pre-flight validation of tour before publishing.
   */
  async validateTour(tourId, options = {}) {
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');
    return await PublishValidatorService.validateTour(tour, options);
  }

  /**
   * Starts a background asynchronous publishing job.
   */
  async startPublishJob(tourId, options = {}) {
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    const job = publishJobService.createJob(tourId, options);

    // Run processing asynchronously
    setImmediate(async () => {
      try {
        publishJobService.updateProgress(job.jobId, 'validating', 10);
        const validation = await PublishValidatorService.validateTour(tour, options);
        if (!validation.isValid) {
          publishJobService.failJob(job.jobId, validation.errors);
          return;
        }

        const result = await this.publishTour(tourId, options, (stage, progress) => {
          publishJobService.updateProgress(job.jobId, stage, progress);
        });

        publishJobService.completeJob(job.jobId, result);
      } catch (err) {
        console.error(`[PublishService] Publish job ${job.jobId} failed:`, err);
        publishJobService.failJob(job.jobId, err);
      }
    });

    return job;
  }

  /**
   * Core publishing pipeline execution.
   */
  async publishTour(tourId, options = {}, onProgress = null) {
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    if (onProgress) onProgress('validating', 10);
    const validation = await PublishValidatorService.validateTour(tour, options);
    if (!validation.isValid) {
      throw new ValidationError(`Publish validation failed: ${validation.errors.join('; ')}`);
    }

    // 1. Determine Version Number & ID
    const versionNumber = await PublishRepository.getNextVersionNumber(tourId);
    const versionId = `v${versionNumber}_${Date.now()}`;
    const publishedAt = new Date().toISOString();
    const publicSlug = (options.publicSlug || tour.publicSlug || `tour-${tourId}`).toLowerCase().trim();
    const changeLog = options.changeLog || `Published Version ${versionNumber}`;

    if (onProgress) onProgress('creating_version_storage', 15);

    // 2. Initialize Dedicated Immutable Version Directory
    await this.storageProvider.createVersion(tourId, versionId);

    // 3. Collect & Copy Referenced Assets + Ensure Tile Pyramids
    const { assetMap, totalAssets, totalSize } = await PublishAssetCollectorService.collectAndPublishAssets(
      tourId,
      versionId,
      tour,
      this.storageProvider,
      onProgress
    );

    if (onProgress) onProgress('generating_manifest', 85);

    // 4. Generate & Save Sanitized Public Manifest
    const versionInfo = {
      versionId,
      versionNumber,
      publishedAt,
      publicSlug
    };
    const manifest = ManifestBuilderService.buildPublicManifest(tour, versionInfo, assetMap);
    await this.storageProvider.saveManifest(tourId, versionId, manifest);

    if (onProgress) onProgress('activating_version', 95);

    // 5. Persist Version Record in Repository
    const versionRecord = {
      versionId,
      tourId,
      versionNumber,
      status: 'published',
      title: tour.title,
      publicSlug,
      createdAt: publishedAt,
      publishedAt,
      createdBy: options.createdBy || 'local_user',
      manifestPath: `/published/${tourId}/${versionId}/manifest.json`,
      assetBasePath: `/published/${tourId}/${versionId}`,
      totalAssets,
      totalSize,
      active: true,
      changeLog
    };

    await PublishRepository.createVersion(versionRecord);
    await PublishRepository.setActiveVersion(tourId, versionId);

    // 6. Update Tour metadata
    await TourRepository.updateTour(tourId, {
      published: true,
      isPublished: true,
      publicSlug,
      activeVersionId: versionId,
      latestVersionNumber: versionNumber,
      lastPublishedAt: publishedAt
    });

    if (onProgress) onProgress('complete', 100);

    return {
      versionId,
      versionNumber,
      publicSlug,
      publishedAt,
      liveUrl: `/tour/${publicSlug}`,
      totalAssets,
      totalSize,
      manifest
    };
  }

  /**
   * Instant rollback to a previously published immutable version.
   */
  async rollback(tourId, targetVersionId) {
    const version = await PublishRepository.getVersionById(targetVersionId);
    if (!version || version.tourId !== tourId) {
      throw new NotFoundError(`Version "${targetVersionId}" not found for tour "${tourId}"`);
    }

    // Verify manifest exists in storage
    const manifest = await this.storageProvider.readManifest(tourId, targetVersionId);
    if (!manifest) {
      throw new NotFoundError(`Manifest file missing for version "${targetVersionId}"`);
    }

    // Switch active pointer instantly
    await PublishRepository.setActiveVersion(tourId, targetVersionId);

    await TourRepository.updateTour(tourId, {
      published: true,
      isPublished: true,
      publicSlug: version.publicSlug,
      activeVersionId: targetVersionId
    });

    return {
      success: true,
      activeVersionId: targetVersionId,
      versionNumber: version.versionNumber,
      publicSlug: version.publicSlug,
      message: `Successfully rolled back to Version ${version.versionNumber}`
    };
  }

  /**
   * Unpublishes a tour (disables public route without deleting historical versions).
   */
  async unpublish(tourId) {
    await PublishRepository.unpublishTour(tourId);
    await TourRepository.updateTour(tourId, {
      published: false,
      isPublished: false,
      activeVersionId: null
    });
    return { success: true, message: 'Tour unpublished successfully' };
  }

  /**
   * Gets all published versions for a tour.
   */
  async getVersions(tourId) {
    return await PublishRepository.getVersionsByTourId(tourId);
  }

  /**
   * Retrieves public manifest by slug or tourId + versionId.
   */
  async getPublicManifest(slugOrId, versionId = null) {
    let targetTourId = null;
    let targetVersionId = versionId;

    // 1. Check if slugOrId matches an active published slug
    const versionBySlug = await PublishRepository.getVersionBySlug(slugOrId);
    if (versionBySlug) {
      targetTourId = versionBySlug.tourId;
      targetVersionId = versionBySlug.versionId;
    } else {
      // 2. Treat as tourId
      targetTourId = slugOrId;
      if (!targetVersionId) {
        const active = await PublishRepository.getActiveVersion(targetTourId);
        if (!active) {
          throw new NotFoundError(`No published active version found for tour "${slugOrId}"`);
        }
        targetVersionId = active.versionId;
      }
    }

    return await this.storageProvider.readManifest(targetTourId, targetVersionId);
  }
}

module.exports = new PublishService();
