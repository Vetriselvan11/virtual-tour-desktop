import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { sharedModelLoader } from '../objects3d/ModelLoaderService.js';
import { lookAtToYawPitch } from './CinematicTimelineEngine.js';

const _scratchVec3 = new THREE.Vector3();
const _scratchRaycaster = new THREE.Raycaster();

/**
 * Object3DManager
 * Production 3D Object Management, Transform Gizmos, Animation Mixers,
 * Raycast Interaction, and Action Execution Subsystem for 360TOOL.
 */
export default class Object3DManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {Object} renderLoop
   * @param {Object} [stateManager]
   * @param {Function} [getImageUrlCallback]
   * @param {Object} [viewerCore]
   */
  constructor(scene, camera, renderLoop, stateManager = null, getImageUrlCallback = null, viewerCore = null) {
    this.scene = scene;
    this.camera = camera;
    this.renderLoop = renderLoop;
    this.stateManager = stateManager;
    this.getImageUrl = getImageUrlCallback || ((url) => url);
    this.viewerCore = viewerCore;

    // Root Group for 3D Objects in WebGL Scene
    this.objectsGroup = new THREE.Group();
    this.objectsGroup.name = '3D_Objects_Root';
    this.scene.add(this.objectsGroup);

    // Dynamic scene lighting for PBR/Standard 3D materials
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.objectsGroup.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight1.position.set(5, 10, 7);
    this.objectsGroup.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight2.position.set(-5, -5, -5);
    this.objectsGroup.add(this.dirLight2);

    // Active object records: id -> { config, rootMesh, mixer, currentAction, clips, boundingBox }
    this.activeObjects = new Map();
    this.selectedObjectId = null;
    this.hoveredObject = null;
    this.editMode = false;

    // TransformControls Gizmo for Studio Editor
    this.transformControls = null;
    this._isGizmoDragging = false;

    // Callbacks
    this.onObjectClick = null;
    this.onObjectHover = null;
    this.onObjectTransformChange = null;

    // Animation Mixer Render Loop Hook
    this._registerRenderHook();
  }

  /**
   * Registers a continuous render loop hook for AnimationMixers.
   * @private
   */
  _registerRenderHook() {
    this.renderLoop.registerHook('object3d_anim_mixers', (time, delta) => {
      let isAnyPlaying = false;
      const rateDelta = Math.min(delta, 0.1);

      for (const entry of this.activeObjects.values()) {
        if (entry.mixer) {
          entry.mixer.update(rateDelta);
          isAnyPlaying = true;
        }
      }

      return isAnyPlaying;
    });
  }

  /**
   * Enables or disables Studio Editor TransformControls gizmos.
   */
  initTransformControls(rendererDomElement) {
    if (this.transformControls || !rendererDomElement) return;

    this.transformControls = new TransformControls(this.camera, rendererDomElement);
    this.transformControls.size = 0.85;
    this.transformControls.setSpace('world');
    this.scene.add(this.transformControls);

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this._isGizmoDragging = event.value;
      if (this.viewerCore) {
        this.viewerCore.isDraggingCamera = false;
        this.viewerCore.userInteracting = event.value;
      }
      this.renderLoop.setContinuousDemand('gizmo_drag', event.value);
    });

    this.transformControls.addEventListener('change', () => {
      if (!this.selectedObjectId) return;
      const entry = this.activeObjects.get(this.selectedObjectId);
      if (entry && entry.rootMesh && this.onObjectTransformChange) {
        const p = entry.rootMesh.position;
        const r = entry.rootMesh.rotation;
        const s = entry.rootMesh.scale;

        const updatedTransform = {
          position: { x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)), z: Number(p.z.toFixed(3)) },
          rotation: {
            x: Number(THREE.MathUtils.radToDeg(r.x).toFixed(1)),
            y: Number(THREE.MathUtils.radToDeg(r.y).toFixed(1)),
            z: Number(THREE.MathUtils.radToDeg(r.z).toFixed(1))
          },
          scale: { x: Number(s.x.toFixed(3)), y: Number(s.y.toFixed(3)), z: Number(s.z.toFixed(3)) }
        };

        entry.config.transform = updatedTransform;
        this.onObjectTransformChange(this.selectedObjectId, updatedTransform);
      }
      this.renderLoop.requestRender(2);
    });
  }

  setGizmoMode(mode = 'translate') {
    if (this.transformControls) {
      this.transformControls.setMode(mode);
      this.renderLoop.requestRender(2);
    }
  }

  /**
   * Rebuilds all 3D objects for a newly loaded scene.
   * @param {Array<Object>} objectsList
   * @param {string|null} selectedId
   */
  async rebuild(objectsList = [], selectedId = null) {
    this.clear();
    this.selectedObjectId = selectedId;

    if (!Array.isArray(objectsList) || objectsList.length === 0) {
      if (this.transformControls) this.transformControls.detach();
      this.renderLoop.requestRender(1);
      return;
    }

    const loadPromises = objectsList.map((objConf) => this._loadAndMountObject(objConf));
    await Promise.allSettled(loadPromises);

    this.selectObject(selectedId);
    this.renderLoop.requestRender(5);
  }

  /**
   * Loads and attaches a single 3D object to the scene graph.
   * @private
   */
  async _loadAndMountObject(objConf) {
    if (!objConf || !objConf.id) return;

    const rawUrl = objConf.asset?.url || objConf.modelUrl || objConf.url;
    if (!rawUrl) return;

    const resolvedUrl = this.getImageUrl(rawUrl);

    try {
      const { object: instanceMesh, animations, metadata } = await sharedModelLoader.instantiateModel(resolvedUrl);

      // Apply Transform
      const transform = objConf.transform || {};
      const pos = transform.position || { x: 0, y: 0, z: 2.5 };
      const rot = transform.rotation || { x: 0, y: 0, z: 0 };
      const scale = transform.scale !== undefined ? transform.scale : { x: 1, y: 1, z: 1 };

      instanceMesh.position.set(pos.x || 0, pos.y || 0, pos.z !== undefined ? pos.z : 2.5);
      instanceMesh.rotation.set(
        THREE.MathUtils.degToRad(rot.x || 0),
        THREE.MathUtils.degToRad(rot.y || 0),
        THREE.MathUtils.degToRad(rot.z || 0)
      );

      if (typeof scale === 'number') {
        instanceMesh.scale.set(scale, scale, scale);
      } else {
        instanceMesh.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
      }

      instanceMesh.userData = {
        objectId: objConf.id,
        objectConfig: objConf
      };

      // Ensure all child meshes reference the parent config for raycasting
      instanceMesh.traverse((child) => {
        child.userData.objectId = objConf.id;
        child.userData.objectConfig = objConf;
      });

      // Setup AnimationMixer
      let mixer = null;
      let currentAction = null;

      if (animations && animations.length > 0) {
        mixer = new THREE.AnimationMixer(instanceMesh);
        const animConf = objConf.animation || {};

        if (animConf.enabled !== false && animConf.autoplay !== false) {
          const clipName = animConf.activeClip || animations[0].name;
          const clip = THREE.AnimationClip.findByName(animations, clipName) || animations[0];
          if (clip) {
            currentAction = mixer.clipAction(clip);
            currentAction.setLoop(animConf.loop === 'once' ? THREE.LoopOnce : THREE.LoopRepeat);
            currentAction.clampWhenFinished = animConf.loop === 'once';
            currentAction.timeScale = animConf.timeScale !== undefined ? animConf.timeScale : 1.0;
            currentAction.play();
          }
        }
      }

      // Check initial visibility state
      const isVisible = this._evaluateVisibility(objConf);
      instanceMesh.visible = isVisible;

      this.objectsGroup.add(instanceMesh);

      this.activeObjects.set(objConf.id, {
        config: objConf,
        rootMesh: instanceMesh,
        mixer,
        currentAction,
        clips: animations || [],
        metadata
      });

      this.renderLoop.requestRender(2);
    } catch (err) {
      console.error(`[Object3DManager] Failed to mount 3D object "${objConf.id}":`, err);
    }
  }

  /**
   * Updates an existing object in-place without reloading asset from disk.
   */
  updateInPlace(objConf, selectedId = null) {
    if (!objConf || !objConf.id) return;
    this.selectedObjectId = selectedId;

    const entry = this.activeObjects.get(objConf.id);
    if (!entry || !entry.rootMesh) {
      // If not yet mounted, mount it
      this._loadAndMountObject(objConf);
      return;
    }

    entry.config = objConf;
    const instanceMesh = entry.rootMesh;

    // Apply updated Transform
    const transform = objConf.transform || {};
    const pos = transform.position || { x: 0, y: 0, z: 2.5 };
    const rot = transform.rotation || { x: 0, y: 0, z: 0 };
    const scale = transform.scale !== undefined ? transform.scale : { x: 1, y: 1, z: 1 };

    instanceMesh.position.set(pos.x || 0, pos.y || 0, pos.z !== undefined ? pos.z : 2.5);
    instanceMesh.rotation.set(
      THREE.MathUtils.degToRad(rot.x || 0),
      THREE.MathUtils.degToRad(rot.y || 0),
      THREE.MathUtils.degToRad(rot.z || 0)
    );

    if (typeof scale === 'number') {
      instanceMesh.scale.set(scale, scale, scale);
    } else {
      instanceMesh.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
    }

    // Apply Animation settings
    if (entry.mixer && entry.clips.length > 0) {
      const animConf = objConf.animation || {};
      if (animConf.enabled !== false) {
        const clipName = animConf.activeClip || entry.clips[0].name;
        const clip = THREE.AnimationClip.findByName(entry.clips, clipName) || entry.clips[0];
        if (clip) {
          if (entry.currentAction) entry.currentAction.stop();
          entry.currentAction = entry.mixer.clipAction(clip);
          entry.currentAction.setLoop(animConf.loop === 'once' ? THREE.LoopOnce : THREE.LoopRepeat);
          entry.currentAction.clampWhenFinished = animConf.loop === 'once';
          entry.currentAction.timeScale = animConf.timeScale !== undefined ? animConf.timeScale : 1.0;
          if (animConf.autoplay !== false) {
            entry.currentAction.play();
          }
        }
      } else if (entry.currentAction) {
        entry.currentAction.stop();
      }
    }

    // Evaluate Visibility
    instanceMesh.visible = this._evaluateVisibility(objConf);

    this.selectObject(selectedId);
    this.renderLoop.requestRender(3);
  }

  /**
   * Selects an object and attaches TransformControls gizmo.
   */
  selectObject(objectId) {
    this.selectedObjectId = objectId;
    const entry = objectId ? this.activeObjects.get(objectId) : null;

    if (this.transformControls) {
      if (entry && entry.rootMesh && this.editMode) {
        this.transformControls.attach(entry.rootMesh);
      } else {
        this.transformControls.detach();
      }
    }
    this.renderLoop.requestRender(2);
  }

  /**
   * Evaluates if object is currently visible based on state manager rules.
   * @private
   */
  _evaluateVisibility(objConf) {
    if (!objConf) return false;
    if (objConf.visible === false) return false;
    if (this.stateManager && typeof this.stateManager.isObjectVisible === 'function') {
      return this.stateManager.isObjectVisible(objConf);
    }
    return true;
  }

  /**
   * Handles pointer hover: checks intersection against 3D object meshes.
   * @returns {boolean} True if hovering over any 3D object
   */
  handleMouseMove(mouseVec, raycaster, rect) {
    if (this._isGizmoDragging) return false;

    const meshes = [];
    for (const entry of this.activeObjects.values()) {
      if (entry.rootMesh && entry.rootMesh.visible) {
        entry.rootMesh.traverse((child) => {
          if (child.isMesh) meshes.push(child);
        });
      }
    }

    if (meshes.length === 0) {
      if (this.hoveredObject) {
        this.hoveredObject = null;
        if (this.onObjectHover) this.onObjectHover(null, null);
      }
      return false;
    }

    raycaster.setFromCamera(mouseVec, this.camera);
    const hits = raycaster.intersectObjects(meshes, true);

    if (hits.length > 0) {
      const hitChild = hits[0].object;
      const objectId = hitChild.userData.objectId;
      const objConf = hitChild.userData.objectConfig;

      if (!this.hoveredObject || this.hoveredObject.id !== objectId) {
        this.hoveredObject = objConf;
        if (this.onObjectHover) {
          _scratchVec3.setFromMatrixPosition(hits[0].object.matrixWorld);
          _scratchVec3.project(this.camera);
          const screenPos = {
            x: ((_scratchVec3.x * 0.5) + 0.5) * (rect ? rect.width : window.innerWidth),
            y: ((-_scratchVec3.y * 0.5) + 0.5) * (rect ? rect.height : window.innerHeight)
          };
          this.onObjectHover(objConf, screenPos);
        }
      }
      return true;
    } else {
      if (this.hoveredObject) {
        this.hoveredObject = null;
        if (this.onObjectHover) this.onObjectHover(null, null);
      }
      return false;
    }
  }

  /**
   * Returns hit 3D object config for pointer click.
   */
  getHitObject(mouseVec, raycaster) {
    if (this._isGizmoDragging) return null;

    const meshes = [];
    for (const entry of this.activeObjects.values()) {
      if (entry.rootMesh && entry.rootMesh.visible) {
        entry.rootMesh.traverse((child) => {
          if (child.isMesh) meshes.push(child);
        });
      }
    }

    if (meshes.length === 0) return null;

    raycaster.setFromCamera(mouseVec, this.camera);
    const hits = raycaster.intersectObjects(meshes, true);

    if (hits.length > 0) {
      const hitChild = hits[0].object;
      const objectId = hitChild.userData.objectId;
      const entry = this.activeObjects.get(objectId);
      return entry ? entry.config : hitChild.userData.objectConfig;
    }

    return null;
  }

  /**
   * Plays a named animation clip on a target 3D object.
   */
  playAnimation(objectId, clipName, loopMode = 'repeat', speed = 1.0) {
    const entry = this.activeObjects.get(objectId);
    if (!entry || !entry.mixer || entry.clips.length === 0) return;

    const clip = clipName ? THREE.AnimationClip.findByName(entry.clips, clipName) : entry.clips[0];
    if (clip) {
      if (entry.currentAction) entry.currentAction.stop();
      entry.currentAction = entry.mixer.clipAction(clip);
      entry.currentAction.setLoop(loopMode === 'once' ? THREE.LoopOnce : THREE.LoopRepeat);
      entry.currentAction.clampWhenFinished = loopMode === 'once';
      entry.currentAction.timeScale = speed;
      entry.currentAction.reset().play();
      this.renderLoop.requestRender(10);
    }
  }

  /**
   * Pauses or stops animation on a target 3D object.
   */
  stopAnimation(objectId) {
    const entry = this.activeObjects.get(objectId);
    if (entry && entry.currentAction) {
      entry.currentAction.stop();
      this.renderLoop.requestRender(2);
    }
  }

  /**
   * Sets object visibility dynamically.
   */
  setVisibility(objectId, visible) {
    const entry = this.activeObjects.get(objectId);
    if (entry && entry.rootMesh) {
      entry.rootMesh.visible = Boolean(visible);
      if (this.selectedObjectId === objectId && !visible && this.transformControls) {
        this.transformControls.detach();
      }
      this.renderLoop.requestRender(2);
    }
  }

  /**
   * Removes and disposes all active 3D objects.
   */
  clear() {
    if (this.transformControls) {
      this.transformControls.detach();
    }

    for (const entry of this.activeObjects.values()) {
      if (entry.mixer) {
        entry.mixer.stopAllAction();
        entry.mixer.uncacheRoot(entry.rootMesh);
      }
      sharedModelLoader.disposeInstance(entry.rootMesh);
    }

    this.activeObjects.clear();
    this.hoveredObject = null;
    this.selectedObjectId = null;
  }

  /**
   * Full destructor on engine teardown.
   */
  destroy() {
    this.clear();
    if (this.transformControls) {
      this.transformControls.dispose();
      this.scene.remove(this.transformControls);
      this.transformControls = null;
    }
    this.scene.remove(this.objectsGroup);
  }
}
