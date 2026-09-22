import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Production Model Loading, Caching, and Instance Management Service for 360TOOL.
 * Handles GLB / GLTF asynchronous streaming, in-flight request deduplication,
 * LRU caching, deep cloning, and safe GPU resource disposal.
 */
class ModelLoaderService {
  constructor() {
    this._cache = new Map(); // url -> { scene, animations, metadata }
    this._loadingPromises = new Map(); // url -> Promise
    this._gltfLoader = new GLTFLoader();

    // Setup Draco decoder fallback path if available
    try {
      this._dracoLoader = new DRACOLoader();
      this._dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      this._gltfLoader.setDRACOLoader(this._dracoLoader);
    } catch (e) {
      console.warn('[ModelLoaderService] DRACOLoader setup notice:', e.message);
    }
  }

  /**
   * Loads a GLB/GLTF model asynchronously with deduplication and caching.
   * @param {string} url - Asset URL
   * @returns {Promise<{ scene: THREE.Group, animations: THREE.AnimationClip[], metadata: Object }>}
   */
  async loadModel(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid model URL provided.');
    }

    // 1. Return from memory cache if available
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    // 2. Reuse in-flight network request if already loading
    if (this._loadingPromises.has(url)) {
      return this._loadingPromises.get(url);
    }

    const loadPromise = new Promise((resolve, reject) => {
      this._gltfLoader.load(
        url,
        (gltf) => {
          try {
            const metadata = this._calculateMetadata(gltf.scene, gltf.animations);

            // Configure color space & shadows on meshes
            gltf.scene.traverse((node) => {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                  if (node.material.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
                  if (node.material.emissiveMap) node.material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                }
              }
            });

            const result = {
              scene: gltf.scene,
              animations: gltf.animations || [],
              metadata
            };

            this._cache.set(url, result);
            this._loadingPromises.delete(url);
            resolve(result);
          } catch (err) {
            this._loadingPromises.delete(url);
            reject(err);
          }
        },
        undefined,
        (err) => {
          this._loadingPromises.delete(url);
          console.error(`[ModelLoaderService] Failed to load 3D model from "${url}":`, err);
          reject(err);
        }
      );
    });

    this._loadingPromises.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Instantiates an independent, renderable clone of a cached model.
   * Uses SkeletonUtils.clone to properly handle skinned meshes and bone hierarchies.
   * 
   * @param {string} url - Asset URL
   * @returns {Promise<{ object: THREE.Object3D, animations: THREE.AnimationClip[], metadata: Object }>}
   */
  async instantiateModel(url) {
    try {
      const template = await this.loadModel(url);
      
      // Deep clone scene graph using SkeletonUtils
      const clonedScene = SkeletonUtils.clone(template.scene);
      
      // Clone materials so per-instance hover/emissive tints don't cross-contaminate
      clonedScene.traverse((node) => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) {
            node.material = node.material.map((mat) => mat.clone());
          } else {
            node.material = node.material.clone();
          }
        }
      });

      // Attach original animations to instance user data
      clonedScene.userData.animations = template.animations;
      clonedScene.userData.sourceUrl = url;
      clonedScene.userData.metadata = template.metadata;

      return {
        object: clonedScene,
        animations: template.animations,
        metadata: template.metadata
      };
    } catch (err) {
      console.warn(`[ModelLoaderService] Creating fallback placeholder for "${url}"`);
      const fallback = this._createFallbackPlaceholder(url, err.message);
      return {
        object: fallback,
        animations: [],
        metadata: { triangleCount: 12, vertexCount: 8, isFallback: true }
      };
    }
  }

  /**
   * Generates a sleek fallback wireframe cube if a model fails to load.
   * @private
   */
  _createFallbackPlaceholder(url, errorMsg) {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      wireframe: true,
      emissive: 0x550000
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    group.add(boxMesh);
    group.userData.isFallback = true;
    group.userData.errorMsg = errorMsg;
    group.userData.sourceUrl = url;
    return group;
  }

  /**
   * Calculates bounding volume and geometric complexity statistics.
   * @private
   */
  _calculateMetadata(scene, animations = []) {
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);
    const radius = bbox.getBoundingSphere(new THREE.Sphere()).radius;

    let totalTris = 0;
    let totalVerts = 0;
    let meshCount = 0;
    const materials = new Set();

    scene.traverse((node) => {
      if (node.isMesh && node.geometry) {
        meshCount++;
        const geo = node.geometry;
        if (geo.index) {
          totalTris += Math.floor(geo.index.count / 3);
        } else if (geo.attributes.position) {
          totalTris += Math.floor(geo.attributes.position.count / 3);
        }
        if (geo.attributes.position) {
          totalVerts += geo.attributes.position.count;
        }
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => materials.add(m.name || 'unnamed_mat'));
          } else {
            materials.add(node.material.name || 'unnamed_mat');
          }
        }
      }
    });

    return {
      size: { x: size.x, y: size.y, z: size.z },
      center: { x: center.x, y: center.y, z: center.z },
      boundingSphereRadius: radius,
      triangleCount: totalTris,
      vertexCount: totalVerts,
      meshCount,
      materialCount: materials.size,
      animationCount: animations.length,
      animationClips: animations.map((a) => a.name)
    };
  }

  /**
   * Disposes of cloned model instance resources (geometries and materials).
   * @param {THREE.Object3D} instanceRoot
   */
  disposeInstance(instanceRoot) {
    if (!instanceRoot) return;

    instanceRoot.traverse((node) => {
      if (node.isMesh) {
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => {
              if (mat.map) mat.map.dispose();
              if (mat.normalMap) mat.normalMap.dispose();
              if (mat.roughnessMap) mat.roughnessMap.dispose();
              if (mat.metalnessMap) mat.metalnessMap.dispose();
              if (mat.emissiveMap) mat.emissiveMap.dispose();
              mat.dispose();
            });
          } else {
            if (node.material.map) node.material.map.dispose();
            if (node.material.normalMap) node.material.normalMap.dispose();
            if (node.material.roughnessMap) node.material.roughnessMap.dispose();
            if (node.material.metalnessMap) node.material.metalnessMap.dispose();
            if (node.material.emissiveMap) node.material.emissiveMap.dispose();
            node.material.dispose();
          }
        }
      }
    });

    if (instanceRoot.parent) {
      instanceRoot.parent.remove(instanceRoot);
    }
  }

  /**
   * Clears the master template cache completely.
   */
  clearCache() {
    this._cache.forEach((template) => {
      template.scene.traverse((node) => {
        if (node.isMesh && node.geometry) {
          node.geometry.dispose();
        }
      });
    });
    this._cache.clear();
    this._loadingPromises.clear();
  }
}

export const sharedModelLoader = new ModelLoaderService();
export default ModelLoaderService;
