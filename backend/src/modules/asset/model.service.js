const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('../../config/directories.config');
const { isPathSafe } = require('../../shared/utils/assetPath.util');
const { AppError, ValidationError } = require('../../shared/errors/AppError');

/**
 * Production 3D Model Asset Processing & Metadata Service for 360TOOL.
 */
class ModelService {
  /**
   * Extracts model metadata (geometry, animations, materials) from GLB/GLTF file.
   * @param {string} filePath - Absolute path on disk
   * @returns {Object} Metadata description
   */
  extractMetadata(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new AppError('Model file does not exist on disk', 404);
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const result = {
      filename: path.basename(filePath),
      format: ext.replace('.', ''),
      fileSize: stats.size,
      triangleCount: 0,
      vertexCount: 0,
      meshCount: 0,
      materialCount: 0,
      animationCount: 0,
      animationClips: [],
      materials: [],
      isValid: true
    };

    try {
      if (ext === '.glb') {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length < 12) {
          throw new ValidationError('Corrupted GLB: file smaller than binary header');
        }

        const magic = buffer.readUInt32LE(0);
        // 0x46546C67 is 'glTF'
        if (magic !== 0x46546C67) {
          throw new ValidationError('Invalid GLB file: missing glTF magic header');
        }

        const version = buffer.readUInt32LE(4);
        const totalLength = buffer.readUInt32LE(8);

        // Read Chunk 0 (JSON Chunk)
        if (buffer.length >= 20) {
          const chunkLength = buffer.readUInt32LE(12);
          const chunkType = buffer.readUInt32LE(16);

          // 0x4E4F534A is 'JSON'
          if (chunkType === 0x4E4F534A && buffer.length >= 20 + chunkLength) {
            const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
            const gltfJson = JSON.parse(jsonStr);
            this._populateGltfMetadata(result, gltfJson);
          }
        }
      } else if (ext === '.gltf') {
        const content = fs.readFileSync(filePath, 'utf8');
        const gltfJson = JSON.parse(content);
        this._populateGltfMetadata(result, gltfJson);
      }
    } catch (err) {
      console.warn('[ModelService] Notice during metadata extraction:', err.message);
      result.isValid = false;
      result.parseWarning = err.message;
    }

    return result;
  }

  /**
   * Helper to parse glTF JSON document structure for mesh and animation counts.
   * @private
   */
  _populateGltfMetadata(result, gltf) {
    if (!gltf || typeof gltf !== 'object') return;

    // Animations
    if (Array.isArray(gltf.animations)) {
      result.animationCount = gltf.animations.length;
      result.animationClips = gltf.animations.map((a, i) => a.name || `Animation_${i + 1}`);
    }

    // Materials
    if (Array.isArray(gltf.materials)) {
      result.materialCount = gltf.materials.length;
      result.materials = gltf.materials.map((m, i) => m.name || `Material_${i + 1}`);
    }

    // Meshes and Primitive estimates
    if (Array.isArray(gltf.meshes)) {
      result.meshCount = gltf.meshes.length;
      let totalTris = 0;
      let totalVerts = 0;

      for (const mesh of gltf.meshes) {
        if (Array.isArray(mesh.primitives)) {
          for (const prim of mesh.primitives) {
            if (prim.indices !== undefined && Array.isArray(gltf.accessors)) {
              const acc = gltf.accessors[prim.indices];
              if (acc && acc.count) totalTris += Math.floor(acc.count / 3);
            }
            if (prim.attributes && prim.attributes.POSITION !== undefined && Array.isArray(gltf.accessors)) {
              const posAcc = gltf.accessors[prim.attributes.POSITION];
              if (posAcc && posAcc.count) totalVerts += posAcc.count;
            }
          }
        }
      }

      result.triangleCount = totalTris;
      result.vertexCount = totalVerts;
    }
  }

  /**
   * Safely deletes a model asset from disk.
   */
  deleteModelFile(tourId, filename) {
    if (!tourId || !filename) return false;
    if (tourId.includes('..') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new ValidationError('Security violation: Invalid model filename or tour ID');
    }

    const filePath = path.join(UPLOADS_DIR, tourId, 'models', filename);
    if (!isPathSafe(UPLOADS_DIR, filePath)) {
      throw new ValidationError('Security violation: Invalid delete path');
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

module.exports = new ModelService();
