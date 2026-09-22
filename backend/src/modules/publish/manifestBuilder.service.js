class ManifestBuilderService {
  /**
   * Constructs a sanitized, production-ready public manifest.json
   * 
   * @param {Object} tour - Original tour object
   * @param {Object} versionInfo - { versionId, versionNumber, publishedAt, publicSlug }
   * @param {Map<string, string>} assetMap - Map of rawUrl -> publishedUrl
   * @returns {Object} Sanitized manifest
   */
  static buildPublicManifest(tour, versionInfo, assetMap = new Map()) {
    const resolve = (raw) => {
      if (!raw || typeof raw !== 'string') return raw;
      return assetMap.get(raw) || raw;
    };

    const sanitizedScenes = (tour.scenes || []).map((scene, idx) => {
      const sanitizedScene = {
        id: scene.id || `scene_${idx}`,
        name: scene.name || `Scene ${idx + 1}`,
        image: resolve(scene.image),
        preview: resolve(scene.preview) || resolve(scene.image),
        thumbnail: resolve(scene.thumbnail),
        initialYaw: scene.initialYaw !== undefined ? parseFloat(scene.initialYaw) : 0,
        initialPitch: scene.initialPitch !== undefined ? parseFloat(scene.initialPitch) : 0,
        fov: scene.fov !== undefined ? parseFloat(scene.fov) : 80,
        duration: scene.duration !== undefined ? parseFloat(scene.duration) : 6.0,
        ambientAudio: resolve(scene.ambientAudio),
        ambientVolume: scene.ambientVolume !== undefined ? scene.ambientVolume : 0.5,
        narrationAudio: resolve(scene.narrationAudio),
        subtitles: scene.subtitles || [],
        hotspots: (scene.hotspots || []).map(hs => ({
          id: hs.id,
          title: hs.title || '',
          type: hs.type || 'info',
          position: hs.position || { x: 0, y: 0, z: -100 },
          yaw: hs.yaw,
          pitch: hs.pitch,
          targetScene: hs.targetScene,
          customIcon: resolve(hs.customIcon),
          iconColor: hs.iconColor,
          infoTitle: hs.infoTitle,
          infoDescription: hs.infoDescription,
          infoImage: resolve(hs.infoImage),
          audioUrl: resolve(hs.audioUrl),
          videoUrl: resolve(hs.videoUrl),
          actions: hs.actions || [],
          stateBindings: hs.stateBindings || []
        })),
        objects3d: (scene.objects3d || scene.objects || []).map(obj => ({
          id: obj.id,
          name: obj.name || '3D Object',
          type: obj.type || 'model',
          modelUrl: resolve((obj.asset && obj.asset.url) || obj.modelUrl),
          asset: {
            url: resolve((obj.asset && obj.asset.url) || obj.modelUrl),
            filename: obj.asset ? obj.asset.filename : 'model.glb',
            format: obj.asset ? obj.asset.format : 'glb'
          },
          transform: obj.transform || {
            position: obj.position || [0, 0, -5],
            rotation: obj.rotation || [0, 0, 0],
            scale: obj.scale || [1, 1, 1]
          },
          lighting: obj.lighting || {
            intensity: 1.0,
            castShadow: true
          },
          animation: obj.animation || {
            autoplay: true,
            loop: true
          },
          actions: obj.actions || []
        }))
      };

      return sanitizedScene;
    });

    const manifest = {
      schemaVersion: '1.0.0',
      tour: {
        id: tour.id,
        title: tour.title || 'Virtual Tour',
        description: tour.description || '',
        clientLogo: resolve(tour.clientLogo),
        clientUrl: tour.clientUrl || '',
        startScene: tour.startScene || (sanitizedScenes[0] ? sanitizedScenes[0].id : null),
        floorplan: resolve(tour.floorplan),
        floorplanPins: tour.floorplanPins || {},
        floor2Plan: resolve(tour.floor2Plan),
        floor2Pins: tour.floor2Pins || {},
        folders: tour.folders || {},
        ambientAudio: resolve(tour.ambientAudio),
        ambientVolume: tour.ambientVolume !== undefined ? tour.ambientVolume : 1
      },
      publishing: {
        versionId: versionInfo.versionId,
        versionNumber: versionInfo.versionNumber,
        publishedAt: versionInfo.publishedAt || new Date().toISOString(),
        publicSlug: versionInfo.publicSlug || null,
        active: true
      },
      cinematicTour: tour.cinematicTour || {
        keyframes: tour.keyframes || []
      },
      analytics: {
        enabled: tour.analytics ? tour.analytics.enabled !== false : true,
        tourId: tour.id,
        versionId: versionInfo.versionId,
        trackingEndpoint: '/api/analytics/events'
      },
      scenes: sanitizedScenes
    };

    return manifest;
  }
}

module.exports = ManifestBuilderService;
