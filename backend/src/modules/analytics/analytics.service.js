const analyticsRepository = require('../../database/repositories/analytics.repository');
const { ValidationError } = require('../../shared/errors/AppError');

const ALLOWED_EVENT_TYPES = new Set([
  'session_start',
  'session_end',
  'tour_start',
  'tour_complete',
  'scene_view',
  'scene_enter',
  'scene_exit',
  'scene_change',
  'hotspot_view',
  'hotspot_hover',
  'hotspot_click',
  'hotspot_action',
  'object_view',
  'object_click',
  'object_interaction',
  'object_animation',
  'cinematic_start',
  'cinematic_complete',
  'cinematic_pause',
  'cinematic_seek',
  'cinematic_shot_start',
  'media_play',
  'media_complete',
  'external_link_click',
  'cta_click',
  'gaze_sample'
]);

/**
 * Production Analytics Service.
 */
class AnalyticsService {
  /**
   * Validates and ingests a batch of analytics events.
   * @param {Array<Object>} rawEvents
   */
  async ingestEvents(rawEvents) {
    if (!Array.isArray(rawEvents)) {
      throw new ValidationError('Events payload must be an array.');
    }

    if (rawEvents.length > 250) {
      throw new ValidationError('Batch size exceeds maximum limit of 250 events.');
    }

    const validatedEvents = [];

    for (const raw of rawEvents) {
      if (!raw || typeof raw !== 'object') continue;

      const eventId = String(raw.eventId || '').trim();
      const sessionId = String(raw.sessionId || '').trim();
      const tourId = String(raw.tourId || '').trim();
      const eventType = String(raw.eventType || '').trim();

      if (!eventId || !sessionId || !tourId || !eventType) continue;
      if (!ALLOWED_EVENT_TYPES.has(eventType)) continue;

      // Sanitize coordinates for gaze samples
      let sanitizedPayload = typeof raw.payload === 'object' && raw.payload !== null ? raw.payload : {};
      if (eventType === 'gaze_sample') {
        const yaw = Number(sanitizedPayload.yaw);
        const pitch = Number(sanitizedPayload.pitch);
        if (isNaN(yaw) || isNaN(pitch)) continue;

        sanitizedPayload = {
          ...sanitizedPayload,
          yaw: ((yaw % 360) + 360) % 360,
          pitch: Math.max(-90, Math.min(90, pitch)),
          duration: Math.max(0.1, Math.min(10, Number(sanitizedPayload.duration) || 0.5))
        };
      }

      validatedEvents.push({
        eventId,
        sessionId,
        tourId,
        sceneId: raw.sceneId ? String(raw.sceneId).trim() : undefined,
        timestamp: Number(raw.timestamp) || Date.now(),
        eventType,
        payload: sanitizedPayload,
        device: typeof raw.device === 'object' ? raw.device : {},
        viewport: typeof raw.viewport === 'object' ? raw.viewport : {}
      });
    }

    if (validatedEvents.length === 0) {
      return { success: true, processed: 0 };
    }

    const result = await analyticsRepository.recordBatch(validatedEvents);
    return {
      success: true,
      processed: validatedEvents.length,
      inserted: result.inserted
    };
  }

  async getOverview(tourId, filters) {
    return analyticsRepository.getOverview(tourId, filters);
  }

  async getSceneStats(tourId, filters) {
    return analyticsRepository.getSceneStats(tourId, filters);
  }

  async getHotspotStats(tourId, filters) {
    return analyticsRepository.getHotspotStats(tourId, filters);
  }

  async getObjectStats(tourId, filters) {
    return analyticsRepository.getObjectStats(tourId, filters);
  }

  async getCinematicStats(tourId, filters) {
    return analyticsRepository.getCinematicStats(tourId, filters);
  }

  async getHeatmapData(tourId, sceneId, options) {
    return analyticsRepository.getHeatmapData(tourId, sceneId, options);
  }

  /**
   * Generates formatted CSV string for tour analytics.
   */
  async exportCsv(tourId, filters = {}) {
    const [overview, scenes, hotspots, objects] = await Promise.all([
      this.getOverview(tourId, filters),
      this.getSceneStats(tourId, filters),
      this.getHotspotStats(tourId, filters),
      this.getObjectStats(tourId, filters)
    ]);

    let csv = `=== TOUR OVERVIEW ===\n`;
    csv += `Tour ID,${tourId}\n`;
    csv += `Total Sessions,${overview.totalSessions}\n`;
    csv += `Unique Visitors,${overview.uniqueVisitors}\n`;
    csv += `Total Tour Views,${overview.totalTourViews}\n`;
    csv += `Total Scene Views,${overview.totalSceneViews}\n`;
    csv += `Total Hotspot Clicks,${overview.totalHotspotClicks}\n`;
    csv += `Avg Session Duration (s),${overview.avgSessionDurationSeconds}\n`;
    csv += `Completion Rate (%),${overview.completionRate}%\n\n`;

    csv += `=== SCENE ANALYTICS ===\n`;
    csv += `Scene ID,Views,Exits,Unique Sessions,Avg Dwell (s)\n`;
    for (const sc of scenes) {
      csv += `"${sc.sceneId}",${sc.views},${sc.exits},${sc.uniqueSessionsCount},${sc.avgDwellSeconds}\n`;
    }
    csv += `\n`;

    csv += `=== HOTSPOT ANALYTICS ===\n`;
    csv += `Hotspot ID,Scene ID,Type,Impressions,Clicks,Unique Clicks,CTR (%),Actions Executed\n`;
    for (const hs of hotspots) {
      csv += `"${hs.hotspotId}","${hs.sceneId || ''}","${hs.hotspotType}",${hs.impressions},${hs.clicks},${hs.uniqueClicks},${hs.ctr}%,${hs.actionsExecuted}\n`;
    }
    csv += `\n`;

    csv += `=== 3D OBJECT ANALYTICS ===\n`;
    csv += `Object ID,Name,Scene ID,Views,Clicks,Interactions,Animation Plays,Total Interactions\n`;
    for (const obj of objects) {
      csv += `"${obj.objectId}","${obj.objectName || ''}","${obj.sceneId || ''}",${obj.views},${obj.clicks},${obj.interactions},${obj.animationPlays},${obj.totalInteractions}\n`;
    }

    return csv;
  }
}

module.exports = new AnalyticsService();
