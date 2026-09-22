/**
 * Abstract SceneAnalysisProvider Interface.
 * Defines the contract for scene feature extraction and visual fingerprinting.
 * Allows easy integration of future on-device ML/AI models without rewriting relationship pipelines.
 */
class SceneAnalysisProvider {
  /**
   * Generates a structural and perceptual visual fingerprint for a scene panorama.
   * 
   * @param {string} sourceDiskPath - Absolute path to panorama or preview image on disk
   * @param {Object} [options]
   * @returns {Promise<{
   *   visualHash: string,
   *   colorHistogram: number[],
   *   spatialBands: { ceiling: number[], horizon: number[], floor: number[] },
   *   edgeEnergy: number,
   *   features: Object,
   *   assetHash: string
   * }>}
   */
  async extractFingerprint(sourceDiskPath, options = {}) {
    throw new Error('SceneAnalysisProvider.extractFingerprint must be implemented');
  }

  /**
   * Computes pairwise similarity between two fingerprints.
   * 
   * @param {Object} fpA - Fingerprint of Scene A
   * @param {Object} fpB - Fingerprint of Scene B
   * @returns {{
   *   similarityScore: number,
   *   dHashSimilarity: number,
   *   colorSimilarity: number,
   *   rotationalSimilarity: number,
   *   bestHeadingOffsetDeg: number
   * }}
   */
  computeSimilarity(fpA, fpB) {
    throw new Error('SceneAnalysisProvider.computeSimilarity must be implemented');
  }
}

module.exports = SceneAnalysisProvider;
