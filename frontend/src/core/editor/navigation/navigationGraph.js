/**
 * Navigation Scene Graph solver for WoX BUILDER.
 * Manages spatial connectivity, path calculations, and graph validation.
 */

export const navigationGraph = {
  /**
   * Builds an adjacency list from tour scenes and navigation hotspots.
   * @param {Array} scenes - Full list of scenes
   * @returns {Object} Graph mapping { [sceneId]: Set(linkedSceneIds) }
   */
  buildGraph: (scenes) => {
    const graph = {};
    if (!scenes) return graph;

    scenes.forEach((scene) => {
      graph[scene.id] = new Set();
      const hotspots = scene.hotspots || [];

      hotspots.forEach((hs) => {
        if (hs.type === 'navigation' && hs.targetScene) {
          // Add directed edge
          graph[scene.id].add(hs.targetScene);
        }
      });
    });

    return graph;
  },

  /**
   * Computes the shortest walking path between two scenes using Breadth-First Search (BFS).
   * @param {string} startId - Origin scene ID
   * @param {string} endId - Target scene ID
   * @param {Object} graph - Graph adjacency list
   * @returns {Array|null} Array of scene IDs in order, or null if unreachable
   */
  findPath: (startId, endId, graph) => {
    if (!graph || !graph[startId] || !graph[endId]) return null;
    if (startId === endId) return [startId];

    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];

      if (node === endId) return path;

      const neighbors = graph[node] || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // Unreachable
  },

  /**
   * Validates tour graph integrity. Identifies orphan scenes and dead ends.
   * @param {Array} scenes - Tour scenes config
   * @returns {Object} { orphans: Array, deadEnds: Array, isPerfect: boolean }
   */
  validateGraph: (scenes) => {
    const graph = navigationGraph.buildGraph(scenes);
    const sceneIds = scenes.map((s) => s.id);
    const incomingCount = {};
    const deadEnds = [];

    sceneIds.forEach((id) => {
      incomingCount[id] = 0;
    });

    // Count incoming edges
    Object.keys(graph).forEach((sourceId) => {
      const targets = graph[sourceId];
      
      // If a scene has no outgoing links, it's a dead-end
      if (targets.size === 0 && sceneIds.length > 1) {
        deadEnds.push(sourceId);
      }

      targets.forEach((targetId) => {
        if (incomingCount[targetId] !== undefined) {
          incomingCount[targetId]++;
        }
      });
    });

    // Orphans are scenes with zero incoming connections (excluding start scene candidates if connected elsewhere)
    const orphans = Object.keys(incomingCount).filter(
      (id) => incomingCount[id] === 0 && sceneIds.indexOf(id) !== 0
    );

    return {
      orphans,
      deadEnds,
      isPerfect: orphans.length === 0 && deadEnds.length === 0
    };
  }
};
