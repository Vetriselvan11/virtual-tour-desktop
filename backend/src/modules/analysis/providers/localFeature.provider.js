const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SceneAnalysisProvider = require('./analysis.provider');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // Sharp not available
}

class LocalFeatureProvider extends SceneAnalysisProvider {
  constructor() {
    super();
    this.algorithmVersion = '1.0.0-cv';
  }

  /**
   * Generates a structural and perceptual visual fingerprint for a scene panorama.
   */
  async extractFingerprint(sourceDiskPath, options = {}) {
    if (!fs.existsSync(sourceDiskPath)) {
      throw new Error(`Source image not found at "${sourceDiskPath}"`);
    }

    // 1. Calculate SHA-256 asset hash for incremental caching
    const fileBuffer = fs.readFileSync(sourceDiskPath);
    const assetHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (!sharp) {
      // Fallback deterministic fingerprint if sharp is not compiled in environment
      return this._generateBufferFallbackFingerprint(fileBuffer, assetHash);
    }

    try {
      // 2. Downscale to 64x32 grayscale for seam-aware dHash
      const dHashBuffer = await sharp(sourceDiskPath)
        .resize(65, 32, { fit: 'fill' }) // 65 width so 64 difference pairs with seam wrapping
        .grayscale()
        .raw()
        .toBuffer();

      const visualHash = this._computeSeamAwareDHash(dHashBuffer, 65, 32);

      // 3. Downscale to 256x128 sRGB for spatial altitude color histograms & edge analysis
      const { data: rgbBuffer, info } = await sharp(sourceDiskPath)
        .resize(256, 128, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const width = info.width;
      const height = info.height;

      // 4. Compute 3-Band Spatial Altitude HSV Histograms & Luminance
      const { spatialBands, colorHistogram, avgLuminance, avgSaturation, hueProfile } = this._computeSpatialColorHistograms(rgbBuffer, width, height);

      // 5. Compute Rotation-Aware Horizontal Quadrant Profiles (8 Slices for Yaw Invariance)
      const horizontalSlices = this._computeHorizontalSlices(rgbBuffer, width, height, 8);

      // 6. Compute Edge & Texture Energy
      const edgeEnergy = this._computeEdgeEnergy(rgbBuffer, width, height);

      return {
        algorithmVersion: this.algorithmVersion,
        visualHash,
        assetHash,
        width,
        height,
        colorHistogram,
        spatialBands,
        horizontalSlices,
        edgeEnergy,
        features: {
          avgLuminance,
          avgSaturation,
          hueProfile
        },
        analyzedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn(`[LocalFeatureProvider] Sharp extraction notice for ${sourceDiskPath}:`, err.message);
      return this._generateBufferFallbackFingerprint(fileBuffer, assetHash);
    }
  }

  /**
   * Computes difference hash (dHash) with 0°/360° equirectangular seam continuity.
   * Compares adjacent pixels across 32 rows, including wrapping x=64 to x=0.
   */
  _computeSeamAwareDHash(rawGrayscale, width, height) {
    let bits = '';
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < 64; x++) {
        const p1 = rawGrayscale[rowOffset + x];
        const p2 = rawGrayscale[rowOffset + ((x + 1) % width)];
        bits += (p2 > p1 ? '1' : '0');
      }
    }

    // Convert bit string (2048 bits) to compact 64-hex char string
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      const nibble = bits.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex.substring(0, 64);
  }

  /**
   * Computes 3-band spatial altitude HSV histograms (Ceiling, Horizon, Floor).
   */
  _computeSpatialColorHistograms(rawRgba, width, height) {
    const ceilingHisto = new Array(16).fill(0);
    const horizonHisto = new Array(16).fill(0);
    const floorHisto = new Array(16).fill(0);
    const globalHisto = new Array(16).fill(0);

    const ceilingEnd = Math.floor(height * 0.25);
    const floorStart = Math.floor(height * 0.75);

    let totalLum = 0;
    let totalSat = 0;
    const totalPixels = width * height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = rawRgba[idx] / 255;
        const g = rawRgba[idx + 1] / 255;
        const b = rawRgba[idx + 2] / 255;

        // Convert RGB to HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        if (delta !== 0) {
          if (max === r) h = ((g - b) / delta) % 6;
          else if (max === g) h = (b - r) / delta + 2;
          else h = (r - g) / delta + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
        }

        const s = max === 0 ? 0 : delta / max;
        const v = max;

        totalLum += v;
        totalSat += s;

        const hueBin = Math.min(15, Math.floor((h / 360) * 16));
        globalHisto[hueBin]++;

        if (y < ceilingEnd) {
          ceilingHisto[hueBin]++;
        } else if (y >= floorStart) {
          floorHisto[hueBin]++;
        } else {
          horizonHisto[hueBin]++;
        }
      }
    }

    // Normalize histograms
    const norm = (arr, count) => arr.map(val => (count > 0 ? parseFloat((val / count).toFixed(4)) : 0));

    const ceilingPixels = width * ceilingEnd;
    const floorPixels = width * (height - floorStart);
    const horizonPixels = totalPixels - ceilingPixels - floorPixels;

    return {
      spatialBands: {
        ceiling: norm(ceilingHisto, ceilingPixels),
        horizon: norm(horizonHisto, horizonPixels),
        floor: norm(floorHisto, floorPixels)
      },
      colorHistogram: norm(globalHisto, totalPixels),
      avgLuminance: parseFloat((totalLum / totalPixels).toFixed(3)),
      avgSaturation: parseFloat((totalSat / totalPixels).toFixed(3)),
      hueProfile: norm(globalHisto, totalPixels)
    };
  }

  /**
   * Computes horizontal vertical column slices for yaw rotational cross-correlation.
   */
  _computeHorizontalSlices(rawRgba, width, height, numSlices = 8) {
    const slices = [];
    const sliceWidth = Math.floor(width / numSlices);

    for (let s = 0; s < numSlices; s++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      const startX = s * sliceWidth;
      const endX = Math.min(width, (s + 1) * sliceWidth);
      const pixelCount = (endX - startX) * height;

      for (let y = 0; y < height; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          rSum += rawRgba[idx];
          gSum += rawRgba[idx + 1];
          bSum += rawRgba[idx + 2];
        }
      }

      slices.push({
        r: Math.round(rSum / pixelCount),
        g: Math.round(gSum / pixelCount),
        b: Math.round(bSum / pixelCount)
      });
    }

    return slices;
  }

  /**
   * Computes edge energy via Sobel gradient approximation.
   */
  _computeEdgeEnergy(rawRgba, width, height) {
    let edgeSum = 0;
    const stride = 4;

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * stride;
        const right = (y * width + (x + 1)) * stride;
        const down = ((y + 1) * width + x) * stride;

        const lum = rawRgba[idx] * 0.299 + rawRgba[idx + 1] * 0.587 + rawRgba[idx + 2] * 0.114;
        const lumRight = rawRgba[right] * 0.299 + rawRgba[right + 1] * 0.587 + rawRgba[right + 2] * 0.114;
        const lumDown = rawRgba[down] * 0.299 + rawRgba[down + 1] * 0.587 + rawRgba[down + 2] * 0.114;

        const dx = Math.abs(lumRight - lum);
        const dy = Math.abs(lumDown - lum);
        edgeSum += Math.sqrt(dx * dx + dy * dy);
      }
    }

    const sampleCount = (height / 2) * (width / 2);
    return parseFloat((edgeSum / sampleCount).toFixed(2));
  }

  /**
   * Pairwise similarity calculation with rotational cross-correlation.
   */
  computeSimilarity(fpA, fpB) {
    if (!fpA || !fpB) return { similarityScore: 0, dHashSimilarity: 0, colorSimilarity: 0, rotationalSimilarity: 0, bestHeadingOffsetDeg: 0 };

    // 1. dHash Hamming Distance Similarity
    const dHashSimilarity = this._compareDHash(fpA.visualHash, fpB.visualHash);

    // 2. Spatial Histogram Cosine Similarity
    const colorSimilarity = this._compareColorHistograms(fpA.colorHistogram, fpB.colorHistogram);

    // 3. Rotation-Aware Circular Yaw Correlation (8 Offsets)
    const { maxCorrelation, bestOffsetDeg } = this._computeRotationalCorrelation(fpA.horizontalSlices, fpB.horizontalSlices);

    // 4. Structural Edge Similarity
    const edgeDiff = Math.abs((fpA.edgeEnergy || 0) - (fpB.edgeEnergy || 0));
    const edgeSimilarity = Math.max(0, 1 - (edgeDiff / 50));

    // Weighted Combined Score:
    // If dHash is extremely high (>0.92) -> duplicate scene dominates
    let combinedScore = 0;
    if (dHashSimilarity > 0.90) {
      combinedScore = 0.60 * dHashSimilarity + 0.25 * colorSimilarity + 0.15 * maxCorrelation;
    } else {
      combinedScore = 0.35 * dHashSimilarity + 0.35 * colorSimilarity + 0.20 * maxCorrelation + 0.10 * edgeSimilarity;
    }

    combinedScore = Math.min(1.0, Math.max(0.0, parseFloat(combinedScore.toFixed(3))));

    return {
      similarityScore: combinedScore,
      dHashSimilarity: parseFloat(dHashSimilarity.toFixed(3)),
      colorSimilarity: parseFloat(colorSimilarity.toFixed(3)),
      rotationalSimilarity: parseFloat(maxCorrelation.toFixed(3)),
      bestHeadingOffsetDeg: bestOffsetDeg
    };
  }

  _compareDHash(hashA, hashB) {
    if (!hashA || !hashB || hashA.length !== hashB.length) return 0;
    let matchingBits = 0;
    const totalBits = hashA.length * 4;

    for (let i = 0; i < hashA.length; i++) {
      const vA = parseInt(hashA[i], 16);
      const vB = parseInt(hashB[i], 16);
      const xor = vA ^ vB;
      // Count matching bits (4 - Hamming distance of nibble)
      const diffBits = (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
      matchingBits += (4 - diffBits);
    }

    return matchingBits / totalBits;
  }

  _compareColorHistograms(histA, histB) {
    if (!histA || !histB || histA.length !== histB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < histA.length; i++) {
      dot += histA[i] * histB[i];
      normA += histA[i] * histA[i];
      normB += histB[i] * histB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  _computeRotationalCorrelation(slicesA, slicesB) {
    if (!Array.isArray(slicesA) || !Array.isArray(slicesB) || slicesA.length !== slicesB.length || slicesA.length === 0) {
      return { maxCorrelation: 0, bestOffsetDeg: 0 };
    }

    const n = slicesA.length;
    let maxCorrelation = -1;
    let bestOffsetIdx = 0;

    for (let offset = 0; offset < n; offset++) {
      let dot = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < n; i++) {
        const sA = slicesA[i];
        const sB = slicesB[(i + offset) % n];

        const valA = sA.r + sA.g * 2 + sA.b;
        const valB = sB.r + sB.g * 2 + sB.b;

        dot += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
      }

      const corr = (normA > 0 && normB > 0) ? (dot / (Math.sqrt(normA) * Math.sqrt(normB))) : 0;
      if (corr > maxCorrelation) {
        maxCorrelation = corr;
        bestOffsetIdx = offset;
      }
    }

    const degPerSlice = 360 / n;
    const bestOffsetDeg = Math.round(bestOffsetIdx * degPerSlice);

    return {
      maxCorrelation: Math.max(0, maxCorrelation),
      bestOffsetDeg
    };
  }

  _generateBufferFallbackFingerprint(buffer, assetHash) {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return {
      algorithmVersion: this.algorithmVersion,
      visualHash: hash.repeat(2).substring(0, 64),
      assetHash,
      width: 400,
      height: 200,
      colorHistogram: new Array(16).fill(0.0625),
      spatialBands: {
        ceiling: new Array(16).fill(0.0625),
        horizon: new Array(16).fill(0.0625),
        floor: new Array(16).fill(0.0625)
      },
      horizontalSlices: new Array(8).fill({ r: 128, g: 128, b: 128 }),
      edgeEnergy: 15.0,
      features: { avgLuminance: 0.5, avgSaturation: 0.3, hueProfile: new Array(16).fill(0.0625) },
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = LocalFeatureProvider;
