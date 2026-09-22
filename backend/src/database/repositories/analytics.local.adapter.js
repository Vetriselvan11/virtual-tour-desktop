const fs = require('fs');
const path = require('path');
const { ANALYTICS_DIR } = require('../../config/directories.config');

const ANALYTICS_LOCAL_DIR = ANALYTICS_DIR;
if (!fs.existsSync(ANALYTICS_LOCAL_DIR)) {
  fs.mkdirSync(ANALYTICS_LOCAL_DIR, { recursive: true });
}

/**
 * Production Local JSON Analytics Adapter for Electron & Offline Desktop Mode.
 */
class AnalyticsLocalAdapter {
  constructor() {
    this.baseDir = ANALYTICS_LOCAL_DIR;
  }

  _getTourDir(tourId) {
    const safeTourId = path.basename(tourId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(this.baseDir, safeTourId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  _readEvents(tourId) {
    const filePath = path.join(this._getTourDir(tourId), 'events.json');
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content || '[]');
    } catch (err) {
      console.warn(`[AnalyticsLocalAdapter] Notice reading events for ${tourId}:`, err.message);
      return [];
    }
  }

  _writeEvents(tourId, events) {
    const filePath = path.join(this._getTourDir(tourId), 'events.json');
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(events, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Records a batch of analytics events with duplicate protection.
   */
  async recordBatch(events) {
    if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };

    const byTour = new Map();
    for (const evt of events) {
      if (!evt.tourId) continue;
      if (!byTour.has(evt.tourId)) byTour.set(evt.tourId, []);
      byTour.get(evt.tourId).push(evt);
    }

    let insertedTotal = 0;

    for (const [tourId, tourEvents] of byTour.entries()) {
      const existing = this._readEvents(tourId);
      const existingIds = new Set(existing.map(e => e.eventId));

      const newEvents = [];
      for (const evt of tourEvents) {
        if (!existingIds.has(evt.eventId)) {
          existingIds.add(evt.eventId);
          newEvents.push(evt);
        }
      }

      if (newEvents.length > 0) {
        const combined = existing.concat(newEvents);
        // Keep reasonable max size (e.g. 50,000 events per tour)
        const trimmed = combined.length > 50000 ? combined.slice(combined.length - 50000) : combined;
        this._writeEvents(tourId, trimmed);
        insertedTotal += newEvents.length;
      }
    }

    return { inserted: insertedTotal };
  }

  _filterEvents(events, filters = {}) {
    let result = events;
    if (filters.since) {
      const sinceTime = Number(filters.since);
      result = result.filter(e => e.timestamp >= sinceTime);
    } else if (filters.days) {
      const ms = Number(filters.days) * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - ms;
      result = result.filter(e => e.timestamp >= cutoff);
    }
    if (filters.sceneId) {
      result = result.filter(e => e.sceneId === filters.sceneId);
    }
    return result;
  }

  async getOverview(tourId, filters = {}) {
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, filters);

    const countsMap = {};
    const sessions = new Map();

    for (const e of events) {
      countsMap[e.eventType] = (countsMap[e.eventType] || 0) + 1;
      if (e.sessionId) {
        if (!sessions.has(e.sessionId)) {
          sessions.set(e.sessionId, { timestamps: [], completed: false });
        }
        const s = sessions.get(e.sessionId);
        s.timestamps.push(e.timestamp || 0);
        if (e.eventType === 'session_end' || e.eventType === 'tour_complete') {
          s.completed = true;
        }
      }
    }

    let totalDuration = 0;
    let completedCount = 0;
    for (const s of sessions.values()) {
      if (s.timestamps.length > 1) {
        const minT = Math.min(...s.timestamps);
        const maxT = Math.max(...s.timestamps);
        totalDuration += Math.max(1, (maxT - minT) / 1000);
      } else {
        totalDuration += 5; // minimum interaction time
      }
      if (s.completed) completedCount++;
    }

    const totalSessions = sessions.size;
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const completionRate = totalSessions > 0 ? Number(((completedCount / totalSessions) * 100).toFixed(1)) : 0;

    return {
      totalSessions,
      uniqueVisitors: totalSessions,
      totalTourViews: (countsMap['tour_start'] || 0) + (countsMap['session_start'] || totalSessions),
      totalSceneViews: countsMap['scene_enter'] || countsMap['scene_view'] || 0,
      totalHotspotClicks: countsMap['hotspot_click'] || 0,
      totalObjectInteractions: (countsMap['object_click'] || 0) + (countsMap['object_interaction'] || 0),
      avgSessionDurationSeconds: avgDuration,
      completionRate
    };
  }

  async getSceneStats(tourId, filters = {}) {
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, filters);

    const sceneMap = new Map();

    for (const e of events) {
      if (!e.sceneId) continue;
      if (!sceneMap.has(e.sceneId)) {
        sceneMap.set(e.sceneId, {
          sceneId: e.sceneId,
          views: 0,
          exits: 0,
          uniqueSessions: new Set(),
          totalDwellTime: 0
        });
      }
      const s = sceneMap.get(e.sceneId);
      if (e.sessionId) s.uniqueSessions.add(e.sessionId);

      if (e.eventType === 'scene_enter' || e.eventType === 'scene_view') {
        s.views++;
      } else if (e.eventType === 'scene_exit') {
        s.exits++;
        if (e.payload?.dwellTime) {
          s.totalDwellTime += Number(e.payload.dwellTime);
        }
      }
    }

    return Array.from(sceneMap.values()).map(s => ({
      sceneId: s.sceneId,
      views: s.views,
      exits: s.exits,
      uniqueSessionsCount: s.uniqueSessions.size,
      avgDwellSeconds: s.exits > 0 ? Number((s.totalDwellTime / s.exits).toFixed(1)) : 0
    })).sort((a, b) => b.views - a.views);
  }

  async getHotspotStats(tourId, filters = {}) {
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, filters);

    const hsMap = new Map();

    for (const e of events) {
      const hsId = e.payload?.hotspotId;
      if (!hsId) continue;

      const key = `${e.sceneId || 'unknown'}_${hsId}`;
      if (!hsMap.has(key)) {
        hsMap.set(key, {
          hotspotId: hsId,
          sceneId: e.sceneId,
          hotspotType: e.payload?.hotspotType || 'info',
          impressions: 0,
          clicks: 0,
          actionsExecuted: 0,
          uniqueClickers: new Set()
        });
      }
      const h = hsMap.get(key);
      if (e.eventType === 'hotspot_view') h.impressions++;
      if (e.eventType === 'hotspot_click') {
        h.clicks++;
        if (e.sessionId) h.uniqueClickers.add(e.sessionId);
      }
      if (e.eventType === 'hotspot_action') h.actionsExecuted++;
    }

    return Array.from(hsMap.values()).map(h => ({
      hotspotId: h.hotspotId,
      sceneId: h.sceneId,
      hotspotType: h.hotspotType,
      impressions: h.impressions,
      clicks: h.clicks,
      actionsExecuted: h.actionsExecuted,
      uniqueClicks: h.uniqueClickers.size,
      ctr: h.impressions > 0 ? Number(((h.clicks / h.impressions) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.clicks - a.clicks);
  }

  async getObjectStats(tourId, filters = {}) {
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, filters);

    const objMap = new Map();

    for (const e of events) {
      const objId = e.payload?.objectId;
      if (!objId) continue;

      const key = `${e.sceneId || 'unknown'}_${objId}`;
      if (!objMap.has(key)) {
        objMap.set(key, {
          objectId: objId,
          sceneId: e.sceneId,
          objectName: e.payload?.objectName || '3D Object',
          views: 0,
          clicks: 0,
          interactions: 0,
          animationPlays: 0
        });
      }
      const o = objMap.get(key);
      if (e.eventType === 'object_view') o.views++;
      if (e.eventType === 'object_click') o.clicks++;
      if (e.eventType === 'object_interaction') o.interactions++;
      if (e.eventType === 'object_animation') o.animationPlays++;
    }

    return Array.from(objMap.values()).map(o => ({
      objectId: o.objectId,
      sceneId: o.sceneId,
      objectName: o.objectName,
      views: o.views,
      clicks: o.clicks,
      interactions: o.interactions,
      animationPlays: o.animationPlays,
      totalInteractions: o.clicks + o.interactions + o.animationPlays
    })).sort((a, b) => b.totalInteractions - a.totalInteractions);
  }

  async getCinematicStats(tourId, filters = {}) {
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, filters);

    const cinMap = new Map();

    for (const e of events) {
      const tId = e.payload?.timelineId || 'default_cinematic';
      if (!cinMap.has(tId)) {
        cinMap.set(tId, {
          timelineId: tId,
          starts: 0,
          completions: 0,
          pauses: 0
        });
      }
      const c = cinMap.get(tId);
      if (e.eventType === 'cinematic_start') c.starts++;
      if (e.eventType === 'cinematic_complete') c.completions++;
      if (e.eventType === 'cinematic_pause') c.pauses++;
    }

    return Array.from(cinMap.values()).map(c => ({
      timelineId: c.timelineId,
      starts: c.starts,
      completions: c.completions,
      pauses: c.pauses,
      completionRate: c.starts > 0 ? Number(((c.completions / c.starts) * 100).toFixed(1)) : 0
    }));
  }

  async getHeatmapData(tourId, sceneId, options = {}) {
    const binSize = Number(options.binSize) || 10;
    const allEvents = this._readEvents(tourId);
    const events = this._filterEvents(allEvents, { sceneId, ...options });

    const gazeEvents = events.filter(e =>
      e.eventType === 'gaze_sample' &&
      e.payload &&
      e.payload.yaw !== undefined &&
      e.payload.pitch !== undefined
    );

    const binMap = new Map();

    for (const g of gazeEvents) {
      const yaw = ((Number(g.payload.yaw) % 360) + 360) % 360;
      const pitch = Math.max(-90, Math.min(90, Number(g.payload.pitch)));
      const duration = Number(g.payload.duration) || 0.5;

      const yawBin = Math.floor(yaw / binSize);
      const pitchBin = Math.floor((pitch + 90) / binSize);

      const key = `${yawBin}_${pitchBin}`;
      if (!binMap.has(key)) {
        binMap.set(key, {
          yawBin,
          pitchBin,
          yawCenter: yawBin * binSize + binSize / 2,
          pitchCenter: pitchBin * binSize + binSize / 2 - 90,
          viewCount: 0,
          dwellTime: 0,
          uniqueSessions: new Set()
        });
      }
      const b = binMap.get(key);
      b.viewCount++;
      b.dwellTime += duration;
      if (g.sessionId) b.uniqueSessions.add(g.sessionId);
    }

    const rawBins = Array.from(binMap.values()).map(b => ({
      yawBin: b.yawBin,
      pitchBin: b.pitchBin,
      yawCenter: b.yawCenter,
      pitchCenter: b.pitchCenter,
      viewCount: b.viewCount,
      dwellTime: Number(b.dwellTime.toFixed(2)),
      uniqueViewers: b.uniqueSessions.size
    }));

    let maxViews = 1;
    let maxDwell = 0.1;
    let maxUnique = 1;

    rawBins.forEach(b => {
      if (b.viewCount > maxViews) maxViews = b.viewCount;
      if (b.dwellTime > maxDwell) maxDwell = b.dwellTime;
      if (b.uniqueViewers > maxUnique) maxUnique = b.uniqueViewers;
    });

    return {
      sceneId,
      binSize,
      totalSamples: rawBins.reduce((acc, b) => acc + b.viewCount, 0),
      maxViews,
      maxDwell,
      maxUnique,
      bins: rawBins
    };
  }
}

module.exports = new AnalyticsLocalAdapter();
