class SceneRelationshipEngine {
  /**
   * Generates pairwise similarities, duplicate warnings, and navigation suggestions across all tour scenes.
   * 
   * @param {Array<{ sceneId: string, name: string, fingerprint: Object, categoryInfo: Object }>} sceneDataList
   * @param {Object} [provider] - SceneAnalysisProvider instance
   * @param {Object} [tourConfig] - Tour configuration to check existing hotspots
   * @param {Object} [options]
   * @returns {{
   *   duplicatePairs: Array<Object>,
   *   suggestions: Array<Object>,
   *   similarityMatrix: Array<Object>,
   *   graphData: { nodes: Array<Object>, links: Array<Object> }
   * }}
   */
  static generateRelationships(sceneDataList = [], provider, tourConfig = null, options = {}) {
    const duplicateThreshold = options.duplicateThreshold || 0.95;
    const similarityThreshold = options.similarityThreshold || 0.55;

    const duplicatePairs = [];
    const suggestions = [];
    const similarityMatrix = [];

    // Build map of already existing navigation hotspots to prevent redundant suggestions
    const existingConnections = new Set();
    if (tourConfig && Array.isArray(tourConfig.scenes)) {
      for (const sc of tourConfig.scenes) {
        if (Array.isArray(sc.hotspots)) {
          for (const hs of sc.hotspots) {
            if ((hs.type === 'scene' || hs.targetScene) && hs.targetScene) {
              existingConnections.add(`${sc.id}->${hs.targetScene}`);
            }
          }
        }
      }
    }

    const n = sceneDataList.length;

    for (let i = 0; i < n; i++) {
      const sceneA = sceneDataList[i];
      if (!sceneA.fingerprint) continue;

      for (let j = i + 1; j < n; j++) {
        const sceneB = sceneDataList[j];
        if (!sceneB.fingerprint) continue;

        const sim = provider.computeSimilarity(sceneA.fingerprint, sceneB.fingerprint);
        const score = sim.similarityScore;

        if (score >= similarityThreshold) {
          const pairRecord = {
            sourceSceneId: sceneA.sceneId,
            sourceSceneName: sceneA.name || sceneA.sceneId,
            targetSceneId: sceneB.sceneId,
            targetSceneName: sceneB.name || sceneB.sceneId,
            similarityScore: score,
            dHashSimilarity: sim.dHashSimilarity,
            colorSimilarity: sim.colorSimilarity,
            rotationalSimilarity: sim.rotationalSimilarity,
            estimatedYaw: sim.bestHeadingOffsetDeg
          };

          similarityMatrix.push(pairRecord);

          // 1. Check for Duplicate Scene
          if (score >= duplicateThreshold) {
            duplicatePairs.push({
              ...pairRecord,
              type: 'duplicate',
              warning: `High visual similarity (${Math.round(score * 100)}%) indicates potential duplicate or near-identical camera captures.`,
              confidence: score
            });
          }
          // 2. Check for Navigation Connection Suggestion (if not duplicate and not already linked)
          else {
            const hasForward = existingConnections.has(`${sceneA.sceneId}->${sceneB.sceneId}`);
            const hasReverse = existingConnections.has(`${sceneB.sceneId}->${sceneA.sceneId}`);

            if (!hasForward) {
              const reasons = [];
              if (sim.dHashSimilarity > 0.65) reasons.push('Strong structural line similarity');
              if (sim.colorSimilarity > 0.75) reasons.push('Compatible ambient lighting and color profile');
              if (sceneA.categoryInfo?.category && sceneB.categoryInfo?.category) {
                if (sceneA.categoryInfo.category === sceneB.categoryInfo.category) {
                  reasons.push(`Matching spatial context (${sceneA.categoryInfo.category})`);
                } else {
                  reasons.push(`Natural room transition (${sceneA.categoryInfo.category} ↔ ${sceneB.categoryInfo.category})`);
                }
              }

              suggestions.push({
                suggestionId: `sug_${sceneA.sceneId}_${sceneB.sceneId}_${Date.now()}`,
                sourceSceneId: sceneA.sceneId,
                sourceSceneName: sceneA.name || sceneA.sceneId,
                targetSceneId: sceneB.sceneId,
                targetSceneName: sceneB.name || sceneB.sceneId,
                relationship: score >= 0.75 ? 'possible_neighbor' : 'possible_transition',
                confidence: score,
                similarityScore: score,
                estimatedYaw: sim.bestHeadingOffsetDeg,
                reasons: reasons.length > 0 ? reasons : ['Visual feature correlation'],
                status: 'pending'
              });
            }
          }
        }
      }
    }

    // Sort suggestions by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Build Graph Data
    const graphData = this._buildSceneGraph(sceneDataList, existingConnections, suggestions, duplicatePairs);

    return {
      duplicatePairs,
      suggestions,
      similarityMatrix,
      graphData
    };
  }

  /**
   * Constructs interactive graph nodes and links for SceneGraphModal.
   */
  static _buildSceneGraph(sceneDataList, existingConnections, suggestions, duplicatePairs) {
    const nodes = sceneDataList.map((sc, idx) => ({
      id: sc.sceneId,
      name: sc.name || `Scene ${idx + 1}`,
      category: sc.categoryInfo?.category || 'Unknown',
      categoryConfidence: sc.categoryInfo?.confidence || 0,
      image: sc.image || '',
      thumbnail: sc.thumbnail || sc.image || ''
    }));

    const links = [];

    // Confirmed Hotspot Edges
    for (const conn of existingConnections) {
      const [source, target] = conn.split('->');
      links.push({
        id: `conf_${source}_${target}`,
        source,
        target,
        type: 'confirmed',
        label: 'Confirmed Link'
      });
    }

    // AI Suggestions
    for (const sug of suggestions) {
      links.push({
        id: `sug_${sug.sourceSceneId}_${sug.targetSceneId}`,
        source: sug.sourceSceneId,
        target: sug.targetSceneId,
        type: 'ai_suggested',
        score: sug.confidence,
        label: `AI Suggestion (${Math.round(sug.confidence * 100)}%)`,
        reasons: sug.reasons,
        estimatedYaw: sug.estimatedYaw
      });
    }

    // Duplicate Warnings
    for (const dup of duplicatePairs) {
      links.push({
        id: `dup_${dup.sourceSceneId}_${dup.targetSceneId}`,
        source: dup.sourceSceneId,
        target: dup.targetSceneId,
        type: 'duplicate',
        score: dup.confidence,
        label: `Possible Duplicate (${Math.round(dup.confidence * 100)}%)`
      });
    }

    return { nodes, links };
  }
}

module.exports = SceneRelationshipEngine;
