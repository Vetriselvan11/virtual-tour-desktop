const AnalyticsEventModel = require('../models/analyticsEvent.model');
const AnalyticsSessionModel = require('../models/analyticsSession.model');

/**
 * Production MongoDB Analytics Adapter using aggregation pipelines.
 */
class AnalyticsMongoAdapter {
  /**
   * Records a batch of analytics events with duplicate protection.
   */
  async recordBatch(events) {
    if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };

    const operations = events.map(evt => ({
      updateOne: {
        filter: { eventId: evt.eventId },
        update: { $setOnInsert: evt },
        upsert: true
      }
    }));

    const result = await AnalyticsEventModel.bulkWrite(operations, { ordered: false });

    // Process session lifecycle updates asynchronously
    this._updateSessionsFromBatch(events).catch(err => {
      console.warn('[AnalyticsMongoAdapter] Session update notice:', err.message);
    });

    return {
      inserted: result.upsertedCount + result.modifiedCount
    };
  }

  /**
   * Updates or creates session records based on event stream.
   * @private
   */
  async _updateSessionsFromBatch(events) {
    const sessionMap = new Map();

    for (const evt of events) {
      if (!evt.sessionId || !evt.tourId) continue;
      if (!sessionMap.has(evt.sessionId)) {
        sessionMap.set(evt.sessionId, {
          sessionId: evt.sessionId,
          tourId: evt.tourId,
          timestamps: [],
          scenes: new Set(),
          isStart: false,
          isEnd: false,
          device: evt.device,
          viewport: evt.viewport,
          interactionCount: 0
        });
      }

      const s = sessionMap.get(evt.sessionId);
      s.timestamps.push(evt.timestamp || Date.now());
      if (evt.sceneId) s.scenes.add(evt.sceneId);
      if (evt.eventType === 'session_start') s.isStart = true;
      if (evt.eventType === 'session_end') s.isEnd = true;
      if (['hotspot_click', 'object_click', 'object_interaction'].includes(evt.eventType)) {
        s.interactionCount++;
      }
    }

    for (const s of sessionMap.values()) {
      const minTime = Math.min(...s.timestamps);
      const maxTime = Math.max(...s.timestamps);

      await AnalyticsSessionModel.updateOne(
        { sessionId: s.sessionId },
        {
          $setOnInsert: {
            tourId: s.tourId,
            startedAt: minTime,
            device: s.device,
            viewport: s.viewport
          },
          $set: {
            endedAt: maxTime,
            durationSeconds: Math.max(1, Math.round((maxTime - minTime) / 1000)),
            ...(s.isEnd ? { completed: true } : {})
          },
          $addToSet: { scenesVisited: { $each: Array.from(s.scenes) } },
          $inc: { interactionCount: s.interactionCount }
        },
        { upsert: true }
      );
    }
  }

  /**
   * Builds timestamp range filter object.
   * @private
   */
  _buildTimeFilter(tourId, filters = {}) {
    const query = { tourId };
    if (filters.since) {
      query.timestamp = { $gte: Number(filters.since) };
    } else if (filters.days) {
      const ms = Number(filters.days) * 24 * 60 * 60 * 1000;
      query.timestamp = { $gte: Date.now() - ms };
    }
    if (filters.sceneId) query.sceneId = filters.sceneId;
    return query;
  }

  /**
   * Retrieves high-level overview metrics.
   */
  async getOverview(tourId, filters = {}) {
    const timeFilter = this._buildTimeFilter(tourId, filters);

    const [eventCounts, sessionStats, uniqueVisitors] = await Promise.all([
      // Event counts by type
      AnalyticsEventModel.aggregate([
        { $match: timeFilter },
        { $group: { _id: '$eventType', count: { $sum: 1 } } }
      ]),
      // Session duration & counts
      AnalyticsSessionModel.aggregate([
        {
          $match: {
            tourId,
            ...(filters.since ? { startedAt: { $gte: Number(filters.since) } } : {})
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            avgDuration: { $avg: '$durationSeconds' },
            completedCount: { $sum: { $cond: ['$completed', 1, 0] } }
          }
        }
      ]),
      // Unique sessions / visitors
      AnalyticsEventModel.distinct('sessionId', timeFilter)
    ]);

    const countsMap = {};
    eventCounts.forEach(e => { countsMap[e._id] = e.count; });

    const totalSessions = sessionStats[0]?.totalSessions || uniqueVisitors.length || 0;
    const avgDuration = Math.round(sessionStats[0]?.avgDuration || 0);
    const completedCount = sessionStats[0]?.completedCount || countsMap['tour_complete'] || 0;
    const completionRate = totalSessions > 0 ? Number(((completedCount / totalSessions) * 100).toFixed(1)) : 0;

    return {
      totalSessions,
      uniqueVisitors: uniqueVisitors.length,
      totalTourViews: (countsMap['tour_start'] || 0) + (countsMap['session_start'] || totalSessions),
      totalSceneViews: countsMap['scene_enter'] || countsMap['scene_view'] || 0,
      totalHotspotClicks: countsMap['hotspot_click'] || 0,
      totalObjectInteractions: (countsMap['object_click'] || 0) + (countsMap['object_interaction'] || 0),
      avgSessionDurationSeconds: avgDuration,
      completionRate
    };
  }

  /**
   * Retrieves per-scene analytics and drop-off metrics.
   */
  async getSceneStats(tourId, filters = {}) {
    const timeFilter = this._buildTimeFilter(tourId, filters);

    return AnalyticsEventModel.aggregate([
      {
        $match: {
          ...timeFilter,
          eventType: { $in: ['scene_enter', 'scene_exit', 'scene_view'] }
        }
      },
      {
        $group: {
          _id: '$sceneId',
          views: {
            $sum: {
              $cond: [{ $in: ['$eventType', ['scene_enter', 'scene_view']] }, 1, 0]
            }
          },
          exits: {
            $sum: { $cond: [{ $eq: ['$eventType', 'scene_exit'] }, 1, 0] }
          },
          uniqueSessions: { $addToSet: '$sessionId' },
          totalDwellTime: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$eventType', 'scene_exit'] }, { $gt: ['$payload.dwellTime', 0] }] },
                '$payload.dwellTime',
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          sceneId: '$_id',
          views: 1,
          exits: 1,
          uniqueSessionsCount: { $size: '$uniqueSessions' },
          avgDwellSeconds: {
            $cond: [
              { $gt: ['$exits', 0] },
              { $round: [{ $divide: ['$totalDwellTime', '$exits'] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { views: -1 } }
    ]);
  }

  /**
   * Retrieves per-hotspot performance and CTR.
   */
  async getHotspotStats(tourId, filters = {}) {
    const timeFilter = this._buildTimeFilter(tourId, filters);

    return AnalyticsEventModel.aggregate([
      {
        $match: {
          ...timeFilter,
          eventType: { $in: ['hotspot_view', 'hotspot_click', 'hotspot_action'] }
        }
      },
      {
        $group: {
          _id: {
            hotspotId: '$payload.hotspotId',
            sceneId: '$sceneId'
          },
          hotspotType: { $first: '$payload.hotspotType' },
          impressions: {
            $sum: { $cond: [{ $eq: ['$eventType', 'hotspot_view'] }, 1, 0] }
          },
          clicks: {
            $sum: { $cond: [{ $eq: ['$eventType', 'hotspot_click'] }, 1, 0] }
          },
          actionsExecuted: {
            $sum: { $cond: [{ $eq: ['$eventType', 'hotspot_action'] }, 1, 0] }
          },
          uniqueClickers: {
            $addToSet: {
              $cond: [{ $eq: ['$eventType', 'hotspot_click'] }, '$sessionId', '$$REMOVE']
            }
          }
        }
      },
      {
        $project: {
          hotspotId: '$_id.hotspotId',
          sceneId: '$_id.sceneId',
          hotspotType: 1,
          impressions: 1,
          clicks: 1,
          actionsExecuted: 1,
          uniqueClicks: { $size: '$uniqueClickers' },
          ctr: {
            $cond: [
              { $gt: ['$impressions', 0] },
              { $round: [{ $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { clicks: -1 } }
    ]);
  }

  /**
   * Retrieves 3D object interaction statistics.
   */
  async getObjectStats(tourId, filters = {}) {
    const timeFilter = this._buildTimeFilter(tourId, filters);

    return AnalyticsEventModel.aggregate([
      {
        $match: {
          ...timeFilter,
          eventType: { $in: ['object_view', 'object_click', 'object_interaction', 'object_animation'] }
        }
      },
      {
        $group: {
          _id: {
            objectId: '$payload.objectId',
            sceneId: '$sceneId'
          },
          objectName: { $first: '$payload.objectName' },
          views: { $sum: { $cond: [{ $eq: ['$eventType', 'object_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$eventType', 'object_click'] }, 1, 0] } },
          interactions: { $sum: { $cond: [{ $eq: ['$eventType', 'object_interaction'] }, 1, 0] } },
          animationPlays: { $sum: { $cond: [{ $eq: ['$eventType', 'object_animation'] }, 1, 0] } }
        }
      },
      {
        $project: {
          objectId: '$_id.objectId',
          sceneId: '$_id.sceneId',
          objectName: 1,
          views: 1,
          clicks: 1,
          interactions: 1,
          animationPlays: 1,
          totalInteractions: { $add: ['$clicks', '$interactions', '$animationPlays'] }
        }
      },
      { $sort: { totalInteractions: -1 } }
    ]);
  }

  /**
   * Retrieves Cinematic Timeline milestone statistics.
   */
  async getCinematicStats(tourId, filters = {}) {
    const timeFilter = this._buildTimeFilter(tourId, filters);

    return AnalyticsEventModel.aggregate([
      {
        $match: {
          ...timeFilter,
          eventType: { $in: ['cinematic_start', 'cinematic_complete', 'cinematic_pause', 'cinematic_shot_start'] }
        }
      },
      {
        $group: {
          _id: '$payload.timelineId',
          starts: { $sum: { $cond: [{ $eq: ['$eventType', 'cinematic_start'] }, 1, 0] } },
          completions: { $sum: { $cond: [{ $eq: ['$eventType', 'cinematic_complete'] }, 1, 0] } },
          pauses: { $sum: { $cond: [{ $eq: ['$eventType', 'cinematic_pause'] }, 1, 0] } }
        }
      },
      {
        $project: {
          timelineId: '$_id',
          starts: 1,
          completions: 1,
          pauses: 1,
          completionRate: {
            $cond: [
              { $gt: ['$starts', 0] },
              { $round: [{ $multiply: [{ $divide: ['$completions', '$starts'] }, 100] }, 1] },
              0
            ]
          }
        }
      }
    ]);
  }

  /**
   * Aggregates 360° spherical gaze heatmap bins for a scene.
   * Quantizes yaw (0-360) and pitch (-90 to +90) into spherical grid bins.
   */
  async getHeatmapData(tourId, sceneId, options = {}) {
    const binSize = Number(options.binSize) || 10;
    const timeFilter = this._buildTimeFilter(tourId, { sceneId, ...options });

    const rawBins = await AnalyticsEventModel.aggregate([
      {
        $match: {
          ...timeFilter,
          eventType: 'gaze_sample',
          'payload.yaw': { $exists: true },
          'payload.pitch': { $exists: true }
        }
      },
      {
        $project: {
          sessionId: 1,
          duration: { $ifNull: ['$payload.duration', 0.5] },
          yawBin: {
            $floor: {
              $divide: [
                {
                  $mod: [
                    { $add: [{ $mod: ['$payload.yaw', 360] }, 360] },
                    360
                  ]
                },
                binSize
              ]
            }
          },
          pitchBin: {
            $floor: {
              $divide: [
                { $add: ['$payload.pitch', 90] }, // shift -90..+90 to 0..180
                binSize
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: { yawBin: '$yawBin', pitchBin: '$pitchBin' },
          viewCount: { $sum: 1 },
          dwellTime: { $sum: '$duration' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          yawBin: '$_id.yawBin',
          pitchBin: '$_id.pitchBin',
          yawCenter: { $add: [{ $multiply: ['$_id.yawBin', binSize] }, binSize / 2] },
          pitchCenter: { $subtract: [{ $add: [{ $multiply: ['$_id.pitchBin', binSize] }, binSize / 2] }, 90] },
          viewCount: 1,
          dwellTime: { $round: ['$dwellTime', 2] },
          uniqueViewers: { $size: '$uniqueSessions' }
        }
      }
    ]);

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

module.exports = new AnalyticsMongoAdapter();
