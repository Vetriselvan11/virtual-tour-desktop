/**
 * HotspotStateManager.js
 * Runtime state and dynamic visibility condition evaluator for 360TOOL Hotspot Engine.
 */

export class HotspotStateManager {
  constructor() {
    this.visitedScenes = new Set();
    this.triggeredHotspots = new Set();
    this.hiddenHotspots = new Set();
    this.triggeredObjects = new Set();
    this.hiddenObjects = new Set();
    this.activeGroups = new Map(); // groupName -> boolean (visible)
    this.completedEvents = new Set();
    this.listeners = new Set();
  }

  /**
   * Resets all runtime state.
   */
  reset() {
    this.visitedScenes.clear();
    this.triggeredHotspots.clear();
    this.hiddenHotspots.clear();
    this.triggeredObjects.clear();
    this.hiddenObjects.clear();
    this.activeGroups.clear();
    this.completedEvents.clear();
    this._notify();
  }

  /**
   * Records a scene visit.
   * @param {string} sceneId 
   */
  markSceneVisited(sceneId) {
    if (!sceneId) return;
    if (!this.visitedScenes.has(sceneId)) {
      this.visitedScenes.add(sceneId);
      this._notify();
    }
  }

  /**
   * Records that a 3D object was triggered.
   * @param {string} objectId 
   */
  markObjectTriggered(objectId) {
    if (!objectId) return;
    if (!this.triggeredObjects.has(objectId)) {
      this.triggeredObjects.add(objectId);
      this._notify();
    }
  }

  /**
   * Records that a hotspot action was triggered.
   * @param {string} hotspotId 
   */
  markHotspotTriggered(hotspotId) {
    if (!hotspotId) return;
    if (!this.triggeredHotspots.has(hotspotId)) {
      this.triggeredHotspots.add(hotspotId);
      this._notify();
    }
  }

  /**
   * Records completed custom event.
   * @param {string} eventName 
   */
  markEventCompleted(eventName) {
    if (!eventName) return;
    if (!this.completedEvents.has(eventName)) {
      this.completedEvents.add(eventName);
      this._notify();
    }
  }

  /**
   * Sets hotspot visibility directly.
   * @param {string} hotspotId 
   * @param {boolean} visible 
   */
  setHotspotVisibility(hotspotId, visible) {
    if (!hotspotId) return;
    if (visible) {
      this.hiddenHotspots.delete(hotspotId);
    } else {
      this.hiddenHotspots.add(hotspotId);
    }
    this._notify();
  }

  /**
   * Toggles hotspot visibility.
   * @param {string} hotspotId 
   */
  toggleHotspotVisibility(hotspotId) {
    if (!hotspotId) return;
    if (this.hiddenHotspots.has(hotspotId)) {
      this.hiddenHotspots.delete(hotspotId);
    } else {
      this.hiddenHotspots.add(hotspotId);
    }
    this._notify();
  }

  /**
   * Sets visibility for an entire group of hotspots.
   * @param {string} groupName 
   * @param {boolean} visible 
   */
  setGroupVisibility(groupName, visible) {
    if (!groupName) return;
    this.activeGroups.set(groupName, visible);
    this._notify();
  }

  /**
   * Toggles visibility for an entire group.
   * @param {string} groupName 
   */
  toggleGroupVisibility(groupName) {
    if (!groupName) return;
    const current = this.activeGroups.get(groupName) !== false;
    this.activeGroups.set(groupName, !current);
    this._notify();
  }

  /**
   * Evaluates if a hotspot should be visible based on its group and conditions.
   * @param {Object} hotspot 
   * @returns {boolean}
   */
  isHotspotVisible(hotspot) {
    if (!hotspot) return false;

    // 1. Explicit runtime hide
    if (this.hiddenHotspots.has(hotspot.id)) {
      return false;
    }

    // 2. Static hidden property
    if (hotspot.visibility?.hidden === true) {
      return false;
    }

    // 3. Group visibility
    if (hotspot.group && this.activeGroups.has(hotspot.group)) {
      if (this.activeGroups.get(hotspot.group) === false) {
        return false;
      }
    }

    // 4. Visibility conditions rules
    const conditions = hotspot.visibility?.conditions;
    if (Array.isArray(conditions) && conditions.length > 0) {
      for (const cond of conditions) {
        let satisfied = false;
        switch (cond.type) {
          case 'sceneVisited':
            satisfied = this.visitedScenes.has(cond.targetId);
            break;
          case 'hotspotTriggered':
            satisfied = this.triggeredHotspots.has(cond.targetId);
            break;
          case 'groupVisible':
            satisfied = this.activeGroups.get(cond.targetId) !== false;
            break;
          case 'eventCompleted':
            satisfied = this.completedEvents.has(cond.targetId);
            break;
          default:
            satisfied = true;
        }

        if (cond.negate) {
          satisfied = !satisfied;
        }

        // All conditions must pass (AND logic)
        if (!satisfied) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sets 3D object visibility directly.
   * @param {string} objectId 
   * @param {boolean} visible 
   */
  setObjectVisibility(objectId, visible) {
    if (!objectId) return;
    if (visible) {
      this.hiddenObjects.delete(objectId);
    } else {
      this.hiddenObjects.add(objectId);
    }
    this._notify();
  }

  /**
   * Toggles 3D object visibility.
   * @param {string} objectId 
   */
  toggleObjectVisibility(objectId) {
    if (!objectId) return;
    if (this.hiddenObjects.has(objectId)) {
      this.hiddenObjects.delete(objectId);
    } else {
      this.hiddenObjects.add(objectId);
    }
    this._notify();
  }

  /**
   * Evaluates if a 3D object should be visible based on its group and conditions.
   * @param {Object} object3d 
   * @returns {boolean}
   */
  isObjectVisible(object3d) {
    if (!object3d) return false;

    // 1. Explicit runtime hide
    if (this.hiddenObjects.has(object3d.id)) {
      return false;
    }

    // 2. Static hidden property
    if (object3d.visible === false || object3d.visibility?.hidden === true) {
      return false;
    }

    // 3. Group visibility
    if (object3d.group && this.activeGroups.has(object3d.group)) {
      if (this.activeGroups.get(object3d.group) === false) {
        return false;
      }
    }

    // 4. Visibility conditions rules
    const conditions = object3d.visibility?.conditions;
    if (Array.isArray(conditions) && conditions.length > 0) {
      for (const cond of conditions) {
        let satisfied = false;
        switch (cond.type) {
          case 'sceneVisited':
            satisfied = this.visitedScenes.has(cond.targetId);
            break;
          case 'hotspotTriggered':
            satisfied = this.triggeredHotspots.has(cond.targetId);
            break;
          case 'objectTriggered':
            satisfied = this.triggeredObjects.has(cond.targetId);
            break;
          case 'groupVisible':
            satisfied = this.activeGroups.get(cond.targetId) !== false;
            break;
          case 'eventCompleted':
            satisfied = this.completedEvents.has(cond.targetId);
            break;
          default:
            satisfied = true;
        }

        if (cond.negate) {
          satisfied = !satisfied;
        }

        if (!satisfied) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Subscribes to state updates.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies all listeners of state changes.
   * @private
   */
  _notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this);
      } catch (err) {
        console.error('[HotspotStateManager] Listener notice:', err);
      }
    });
  }
}

export const sharedHotspotStateManager = new HotspotStateManager();
export default HotspotStateManager;
