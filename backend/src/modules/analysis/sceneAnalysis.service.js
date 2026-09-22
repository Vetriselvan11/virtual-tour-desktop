const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TourRepository = require('../../database/repositories/tour.repository');
const SceneAnalysisRepository = require('../../database/repositories/sceneAnalysis.repository');
const LocalFeatureProvider = require('./providers/localFeature.provider');
const SceneClassifierService = require('./sceneClassifier.service');
const SceneRelationshipEngine = require('./sceneRelationship.engine');
const sceneAnalysisQueue = require('./sceneAnalysisQueue.service');
const ThumbnailService = require('../asset/thumbnail.service');
const { TOURS_DIR, UPLOADS_DIR } = require('../../config/directories.config');
const { normalizeAssetReference } = require('../../shared/utils/assetPath.util');
const { NotFoundError, ValidationError } = require('../../shared/errors/AppError');

class SceneAnalysisService {
  constructor(provider = new LocalFeatureProvider()) {
    this.provider = provider;
  }

  /**
   * Helper to resolve local disk path for a scene's panorama or preview image.
   */
  static _findAssetDiskPath(rawUrl, tourId) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    const clean = rawUrl.split('?')[0].split('#')[0];
    if (clean.includes('..')) return null;

    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      return clean;
    }

    const norm = normalizeAssetReference(rawUrl) || clean.replace(/^[/\\]+/, '');
    const stripped = norm.replace(/^uploads[/\\]+/, '');

    const candidates = [
      path.join(UPLOADS_DIR, stripped),
      path.join(UPLOADS_DIR, norm),
      path.join(UPLOADS_DIR, tourId || '', path.basename(stripped)),
      path.join(UPLOADS_DIR, tourId || '', stripped),
      path.join(TOURS_DIR, tourId || '', path.basename(stripped)),
      path.join(TOURS_DIR, tourId || '', stripped),
      path.resolve(__dirname, '../../../../frontend/public', stripped),
      path.resolve(__dirname, '../../../../frontend/src/assets', stripped)
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    }

    return null;
  }

  /**
   * Analyzes an entire tour's scenes locally, generates fingerprints, categories, and suggestions.
   * 
   * @param {string} tourId
   * @param {Object} [options]
   * @param {Function} [onProgress]
   * @returns {Promise<Object>} Tour intelligence results
   */
  async analyzeTour(tourId, options = {}, onProgress = null) {
    const startTime = Date.now();
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    const scenes = tour.scenes || [];
    if (scenes.length === 0) {
      return {
        tourId,
        analyzedScenes: [],
        duplicatePairs: [],
        suggestions: [],
        graphData: { nodes: [], links: [] },
        totalTimeMs: 0
      };
    }

    const sceneDataList = [];
    const forceReanalyze = options.force || options.forceReanalyze || false;

    // 1. Process scenes with incremental caching
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneName = scene.name || `Scene ${i + 1}`;
      if (onProgress) onProgress(i + 1, sceneName, 'analyzing_scenes');

      // Prefer preview/thumbnail if available for fast processing
      let targetPath = null;
      if (scene.preview) {
        targetPath = SceneAnalysisService._findAssetDiskPath(scene.preview, tourId);
      }
      if (!targetPath && scene.image) {
        targetPath = SceneAnalysisService._findAssetDiskPath(scene.image, tourId);
      }

      let fingerprint = null;
      let categoryInfo = null;

      if (targetPath && fs.existsSync(targetPath)) {
        // Check current asset SHA-256 hash for incremental caching
        const fileBuffer = fs.readFileSync(targetPath);
        const currentAssetHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check stored analysis cache
        const cached = await SceneAnalysisRepository.getSceneAnalysis(tourId, scene.id);

        if (!forceReanalyze && cached && cached.assetHash === currentAssetHash && cached.algorithmVersion === this.provider.algorithmVersion) {
          fingerprint = cached.fingerprint;
          categoryInfo = {
            category: cached.category,
            confidence: cached.categoryConfidence,
            reasoning: cached.categoryReasoning
          };
        } else {
          // Extract new fingerprint
          fingerprint = await this.provider.extractFingerprint(targetPath);
          categoryInfo = SceneClassifierService.classifyScene(fingerprint, scene);

          await SceneAnalysisRepository.saveSceneAnalysis(tourId, scene.id, {
            algorithmVersion: this.provider.algorithmVersion,
            assetHash: currentAssetHash,
            category: categoryInfo.category,
            categoryConfidence: categoryInfo.confidence,
            categoryReasoning: categoryInfo.reasoning,
            fingerprint
          });
        }
      } else {
        // Deterministic fallback for scenes with missing local disk image files
        const syntheticBuffer = Buffer.from(`${tourId}_${scene.id}_${sceneName}`);
        const assetHash = crypto.createHash('sha256').update(syntheticBuffer).digest('hex');
        fingerprint = this.provider._generateBufferFallbackFingerprint(syntheticBuffer, assetHash);
        categoryInfo = SceneClassifierService.classifyScene(fingerprint, scene);

        await SceneAnalysisRepository.saveSceneAnalysis(tourId, scene.id, {
          algorithmVersion: this.provider.algorithmVersion,
          assetHash,
          category: categoryInfo.category,
          categoryConfidence: categoryInfo.confidence,
          categoryReasoning: categoryInfo.reasoning,
          fingerprint
        });
      }

      sceneDataList.push({
        sceneId: scene.id,
        name: sceneName,
        image: scene.image,
        thumbnail: scene.thumbnail || scene.preview || scene.image,
        fingerprint,
        categoryInfo
      });
    }

    if (onProgress) onProgress(scenes.length, 'Comparing scene relationships...', 'generating_suggestions');

    // 2. Compute Pairwise Relationships, Duplicate Detection, and Suggestions
    const relationshipResults = SceneRelationshipEngine.generateRelationships(
      sceneDataList,
      this.provider,
      tour,
      options
    );

    // 3. Persist Suggestions
    await SceneAnalysisRepository.saveTourSuggestions(tourId, relationshipResults.suggestions);

    const totalTimeMs = Date.now() - startTime;

    return {
      tourId,
      totalScenes: scenes.length,
      analyzedScenes: sceneDataList.map(s => ({
        sceneId: s.sceneId,
        name: s.name,
        category: s.categoryInfo.category,
        categoryConfidence: s.categoryInfo.confidence,
        categoryReasoning: s.categoryInfo.reasoning,
        thumbnail: s.thumbnail
      })),
      duplicatePairs: relationshipResults.duplicatePairs,
      suggestions: relationshipResults.suggestions,
      graphData: relationshipResults.graphData,
      totalTimeMs
    };
  }

  /**
   * Starts a background asynchronous tour analysis job.
   */
  async startAnalysisJob(tourId, options = {}) {
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    const totalScenes = (tour.scenes || []).length;
    const job = sceneAnalysisQueue.createJob(tourId, totalScenes);

    // Run async in event loop
    setImmediate(async () => {
      try {
        const results = await this.analyzeTour(tourId, options, (processed, currentScene, stage) => {
          sceneAnalysisQueue.updateProgress(job.jobId, processed, currentScene, stage);
        });
        sceneAnalysisQueue.completeJob(job.jobId, results);
      } catch (err) {
        console.error(`[SceneAnalysisService] Job ${job.jobId} failed:`, err);
        sceneAnalysisQueue.failJob(job.jobId, err);
      }
    });

    return job;
  }

  /**
   * Accepts an AI navigation suggestion and generates a real hotspot in the tour.
   */
  async acceptSuggestion(tourId, suggestionId, options = {}) {
    const suggestions = await SceneAnalysisRepository.getTourSuggestions(tourId);
    const suggestion = suggestions.find(s => s.suggestionId === suggestionId);

    if (!suggestion) {
      throw new NotFoundError(`Suggestion "${suggestionId}" not found`);
    }

    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    const sourceScene = (tour.scenes || []).find(s => s.id === suggestion.sourceSceneId);
    const targetScene = (tour.scenes || []).find(s => s.id === suggestion.targetSceneId);

    if (!sourceScene || !targetScene) {
      throw new ValidationError('Source or target scene no longer exists in tour.');
    }

    // Create genuine sceneNavigate hotspot
    sourceScene.hotspots = sourceScene.hotspots || [];

    const headingYaw = suggestion.estimatedYaw !== undefined ? parseFloat(suggestion.estimatedYaw) : 0;
    const hotspotId = `hs_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newHotspot = {
      id: hotspotId,
      type: 'scene',
      title: options.title || `To ${targetScene.name || targetScene.id}`,
      targetScene: targetScene.id,
      yaw: headingYaw,
      pitch: -5,
      position: { x: 0, y: -5, z: -100 },
      customIcon: null,
      actions: [
        {
          id: `act_${Date.now()}`,
          trigger: 'click',
          type: 'sceneNavigate',
          payload: { targetSceneId: targetScene.id }
        }
      ],
      aiGenerated: true
    };

    sourceScene.hotspots.push(newHotspot);

    // Optional reciprocal hotspot (B -> A)
    let reciprocalHotspot = null;
    if (options.createBidirectional) {
      targetScene.hotspots = targetScene.hotspots || [];
      const reciprocalYaw = (headingYaw + 180) % 360;
      reciprocalHotspot = {
        id: `hs_ai_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'scene',
        title: options.reciprocalTitle || `Back to ${sourceScene.name || sourceScene.id}`,
        targetScene: sourceScene.id,
        yaw: reciprocalYaw,
        pitch: -5,
        position: { x: 0, y: -5, z: -100 },
        customIcon: null,
        actions: [
          {
            id: `act_rev_${Date.now()}`,
            trigger: 'click',
            type: 'sceneNavigate',
            payload: { targetSceneId: sourceScene.id }
          }
        ],
        aiGenerated: true
      };
      targetScene.hotspots.push(reciprocalHotspot);
    }

    // Update tour
    await TourRepository.updateTour(tourId, tour);

    // Mark suggestion as accepted
    await SceneAnalysisRepository.updateSuggestionStatus(tourId, suggestionId, 'accepted');

    return {
      success: true,
      hotspot: newHotspot,
      reciprocalHotspot,
      message: `Created navigation hotspot from "${sourceScene.name || sourceScene.id}" to "${targetScene.name || targetScene.id}"`
    };
  }

  /**
   * Rejects an AI navigation suggestion cleanly.
   */
  async rejectSuggestion(tourId, suggestionId) {
    const updated = await SceneAnalysisRepository.updateSuggestionStatus(tourId, suggestionId, 'rejected');
    if (!updated) throw new NotFoundError('Suggestion not found');
    return { success: true, message: 'Suggestion rejected' };
  }

  /**
   * Retrieves current scene intelligence data for a tour.
   */
  async getTourIntelligence(tourId) {
    const tour = await TourRepository.getTourById(tourId);
    if (!tour) throw new NotFoundError('Tour not found');

    const storedAnalyses = await SceneAnalysisRepository.getAllSceneAnalyses(tourId);
    const suggestions = await SceneAnalysisRepository.getTourSuggestions(tourId);

    const scenes = (tour.scenes || []).map(sc => {
      const analysis = storedAnalyses[sc.id] || null;
      return {
        sceneId: sc.id,
        name: sc.name || sc.id,
        thumbnail: sc.thumbnail || sc.preview || sc.image || '',
        category: analysis ? analysis.category : 'Not Analyzed',
        categoryConfidence: analysis ? analysis.categoryConfidence : 0,
        categoryReasoning: analysis ? analysis.categoryReasoning : '',
        analyzed: !!analysis
      };
    });

    const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
    const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
    const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;

    return {
      tourId,
      scenes,
      pendingSuggestions,
      allSuggestions: suggestions,
      stats: {
        totalScenes: scenes.length,
        analyzedScenes: scenes.filter(s => s.analyzed).length,
        pendingSuggestionsCount: pendingSuggestions.length,
        acceptedCount,
        rejectedCount
      }
    };
  }
}

module.exports = new SceneAnalysisService();
