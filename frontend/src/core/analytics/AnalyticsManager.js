import httpClient from '../../services/http/httpClient';
import { API_BASE } from '../../config/api';

/**
 * Production Client-Side Analytics Manager.
 * Handles event queuing, batching, offline resilience, and non-blocking transports.
 */
class AnalyticsManager {
  constructor() {
    this.sessionId = this._generateId('sess');
    this.anonymousUserId = this._getOrCreateUserId();
    this.tourId = null;
    this.currentSceneId = null;
    this.sceneEnterTimestamp = null;
    this.enabled = true;

    // Queue & Batch Settings
    this.queue = [];
    this.maxQueueSize = 500;
    this.batchSize = 50;
    this.flushIntervalMs = 8000;
    this.seenEventIds = new Set();
    this.flushTimer = null;
    this.isFlushing = false;

    // Device / Viewport Metadata
    this.deviceInfo = this._detectDeviceInfo();

    // Storage Key for offline fallback
    this.storageKey = '360tool_analytics_retry_queue';

    this._initLifecycle();
  }

  _generateId(prefix = 'evt') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  _getOrCreateUserId() {
    try {
      let uid = localStorage.getItem('360tool_anon_uid');
      if (!uid) {
        uid = this._generateId('usr');
        localStorage.setItem('360tool_anon_uid', uid);
      }
      return uid;
    } catch {
      return this._generateId('usr');
    }
  }

  _detectDeviceInfo() {
    if (typeof window === 'undefined') return {};
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('SamsungBrowser')) browser = 'Samsung Browser';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Unknown';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return {
      type: isMobile ? 'mobile' : 'desktop',
      browser,
      os,
      isMobile
    };
  }

  _getViewportInfo() {
    if (typeof window === 'undefined') return {};
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    };
  }

  _initLifecycle() {
    if (typeof window === 'undefined') return;

    // Start recurring flush timer
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // Try recovering unsent offline events on load / online
    window.addEventListener('online', () => {
      this._recoverOfflineQueue();
      this.flush();
    });
    this._recoverOfflineQueue();

    // Page unload beacon flush
    const handleUnload = () => {
      this.trackSessionEnd();
      this.flushBeacon();
    };

    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
  }

  setTour(tourId) {
    if (this.tourId !== tourId) {
      this.tourId = tourId;
    }
  }

  /**
   * Tracks an arbitrary validated analytics event.
   */
  track(eventType, payload = {}, sceneId = null) {
    if (!this.enabled || !this.tourId) return;

    const eventId = this._generateId('evt');
    const targetScene = sceneId || this.currentSceneId;

    const event = {
      eventId,
      sessionId: this.sessionId,
      tourId: this.tourId,
      sceneId: targetScene || undefined,
      timestamp: Date.now(),
      eventType,
      payload,
      device: this.deviceInfo,
      viewport: this._getViewportInfo()
    };

    if (this.seenEventIds.has(eventId)) return;
    this.seenEventIds.add(eventId);

    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift(); // Drop oldest event if queue exceeds memory limits
    }

    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  // ─── Semantic Event Tracking API ───────────────────────────────────────────

  trackSessionStart(tourId, extraMeta = {}) {
    this.setTour(tourId);
    this.track('session_start', {
      anonymousUserId: this.anonymousUserId,
      ...extraMeta
    });
  }

  trackSessionEnd() {
    if (this.sceneEnterTimestamp && this.currentSceneId) {
      const dwellTime = Number(((Date.now() - this.sceneEnterTimestamp) / 1000).toFixed(2));
      this.track('scene_exit', { dwellTime }, this.currentSceneId);
      this.sceneEnterTimestamp = null;
    }
    this.track('session_end', {
      durationSeconds: Math.round((Date.now() - (this._sessionStartTs || Date.now())) / 1000)
    });
  }

  trackTourStart(tourId) {
    this.setTour(tourId);
    this._sessionStartTs = Date.now();
    this.track('tour_start', {});
  }

  trackTourComplete(tourId) {
    this.setTour(tourId);
    this.track('tour_complete', {});
  }

  trackSceneEnter(sceneId) {
    if (!sceneId) return;
    if (this.currentSceneId && this.sceneEnterTimestamp) {
      const dwellTime = Number(((Date.now() - this.sceneEnterTimestamp) / 1000).toFixed(2));
      this.track('scene_exit', { dwellTime }, this.currentSceneId);
    }

    this.currentSceneId = sceneId;
    this.sceneEnterTimestamp = Date.now();
    this.track('scene_enter', {}, sceneId);
  }

  trackSceneExit(sceneId, dwellTime) {
    const elapsed = dwellTime || (this.sceneEnterTimestamp ? (Date.now() - this.sceneEnterTimestamp) / 1000 : 0);
    this.track('scene_exit', { dwellTime: Number(elapsed.toFixed(2)) }, sceneId || this.currentSceneId);
    if (this.currentSceneId === sceneId) {
      this.currentSceneId = null;
      this.sceneEnterTimestamp = null;
    }
  }

  trackHotspotClick(hotspotId, hotspotType, sceneId, actionType = null) {
    this.track('hotspot_click', {
      hotspotId,
      hotspotType,
      actionType
    }, sceneId);
  }

  trackHotspotAction(hotspotId, actionType, sceneId, details = {}) {
    this.track('hotspot_action', {
      hotspotId,
      actionType,
      ...details
    }, sceneId);
  }

  trackObjectClick(objectId, objectName, sceneId, interactionType = 'click') {
    this.track('object_click', {
      objectId,
      objectName,
      interactionType
    }, sceneId);
  }

  trackObjectInteraction(objectId, objectName, sceneId, interactionType = 'interaction') {
    this.track('object_interaction', {
      objectId,
      objectName,
      interactionType
    }, sceneId);
  }

  trackObjectAnimation(objectId, animationName, sceneId) {
    this.track('object_animation', {
      objectId,
      animationName
    }, sceneId);
  }

  trackCinematic(eventType, data = {}) {
    this.track(eventType, data);
  }

  trackMedia(eventType, data = {}) {
    this.track(eventType, data);
  }

  trackCta(eventType, data = {}) {
    this.track(eventType, data);
  }

  trackGazeSample(sceneId, yaw, pitch, duration = 0.5) {
    this.track('gaze_sample', {
      yaw: Number(yaw.toFixed(2)),
      pitch: Number(pitch.toFixed(2)),
      duration: Number(duration.toFixed(2))
    }, sceneId);
  }

  // ─── Transport & Flush Strategy ────────────────────────────────────────────

  async flush() {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    const batch = this.queue.splice(0, this.batchSize);

    try {
      await httpClient.post('/api/analytics/events', { events: batch });
    } catch (err) {
      // Offline / Network Error: Save to localStorage retry queue
      this._saveToOfflineQueue(batch);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * High-reliability beacon transport for page unloads.
   */
  flushBeacon() {
    if (this.queue.length === 0 || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const batch = this.queue.splice(0, this.batchSize);
    try {
      const url = `${API_BASE}/api/analytics/events`;
      const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } catch {
      this._saveToOfflineQueue(batch);
    }
  }

  _saveToOfflineQueue(events) {
    try {
      const existing = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      const combined = existing.concat(events).slice(-300); // limit offline storage
      localStorage.setItem(this.storageKey, JSON.stringify(combined));
    } catch {
      // Ignore storage errors (quota / disabled)
    }
  }

  _recoverOfflineQueue() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const recovered = JSON.parse(raw);
      localStorage.removeItem(this.storageKey);
      if (Array.isArray(recovered) && recovered.length > 0) {
        this.queue.unshift(...recovered.slice(0, 100));
      }
    } catch {
      // Ignore recovery errors
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

export const sharedAnalyticsManager = new AnalyticsManager();
export default AnalyticsManager;
