import * as THREE from 'three';

/**
 * TilePatchGeometry.js — 360TOOL Multi-Resolution Engine
 * Generates curved spherical patch geometries for equirectangular 360° tiles.
 * 
 * Each patch matches the exact angular bounds of a tile at (row, col) within
 * a pyramid level with (rows, cols) subdivision.
 */
export class TilePatchGeometry extends THREE.SphereGeometry {
  /**
   * @param {number} col - Column index (0 to cols - 1)
   * @param {number} row - Row index (0 to rows - 1)
   * @param {number} cols - Total columns at this level
   * @param {number} rows - Total rows at this level
   * @param {number} [radius=4.985] - Radius (placed slightly inside radius 5.0 base sphere)
   * @param {number} [segments=12] - Grid subdivision per tile for smooth spherical curvature
   */
  constructor(col, row, cols, rows, radius = 4.985, segments = 12) {
    const phiStart = (col / cols) * Math.PI * 2;
    const phiLength = (1 / cols) * Math.PI * 2;
    const thetaStart = (row / rows) * Math.PI;
    const thetaLength = (1 / rows) * Math.PI;

    // In Three.js SphereGeometry:
    // (radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)
    super(radius, segments, segments, phiStart, phiLength, thetaStart, thetaLength);

    // Invert geometry so inner surface faces camera at origin (0,0,0)
    this.scale(-1, 1, 1);

    // Compute bounding sphere and box for fast frustum culling
    this.computeBoundingSphere();
    this.computeBoundingBox();

    // Store metadata
    this.userData = { col, row, cols, rows, phiStart, phiLength, thetaStart, thetaLength };
  }
}

/**
 * Geometry cache / pool to prevent reallocating geometries when moving across tiles.
 */
class GeometryPool {
  constructor() {
    /** @type {Map<string, THREE.SphereGeometry>} */
    this.cache = new Map();
  }

  /**
   * Get or create a cached TilePatchGeometry.
   */
  getGeometry(col, row, cols, rows) {
    const key = `${cols}_${rows}_${col}_${row}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const geom = new TilePatchGeometry(col, row, cols, rows);
    this.cache.set(key, geom);
    return geom;
  }

  /**
   * Clears and disposes all geometries.
   */
  dispose() {
    this.cache.forEach((geom) => {
      try {
        geom.dispose();
      } catch {}
    });
    this.cache.clear();
  }
}

export const sharedGeometryPool = new GeometryPool();
export default TilePatchGeometry;
