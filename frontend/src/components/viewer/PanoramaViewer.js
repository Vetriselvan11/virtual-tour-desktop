import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import ViewerCore from '../../core/viewer/ViewerCore';
import { getImageUrl } from '../../services/http/httpClient';

import DeviceCapabilities from '../../core/viewer/DeviceCapabilities';

/**
 * React Bridge Wrapper for Persistent WebGL Tour Engine.
 * Keeps Three.js instance alive persistently, synchronizing props in-place.
 */
const PanoramaViewer = forwardRef(function PanoramaViewer(
  {
    sceneId,
    imageUrl,
    scene,
    hotspots = [],
    onHotspotClick,
    onAddHotspot,
    editMode = false,
    autoRotate = false,
    enableTinyPlanetIntro = false,
    onReady,
    onTinyPlanetStart,
    onTinyPlanetEnd,
    onTinyPlanetProgress,
    selectedHotspot,
    selectedHotspots = [], // Multi-select support
    snapSettings, // Layout snapping engine
    onHotspotUpdate,
    onContextMenuTrigger,
    onSelectedHotspotPosChange,
    onCameraYawChange,
    onAutoRotateChange,
    onHotspotEnterView,
    objects3d = [],
    selectedObjectId = null,
    onObjectClick,
    onObjectHover,
    onObjectTransformChange
  },
  ref
) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const tooltipRef = useRef(null);
  const introPlayedForInitialRef = useRef(false);

  // Tooltip HUD Overlay States (React side - only tracks hover active/inactive)
  const [hoveredHotspot, setHoveredHotspot] = useState(null);
  const [hoveredObject, setHoveredObject] = useState(null);
  const [xrSupported, setXrSupported] = useState(false);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);

  const selectedHotspotIds = selectedHotspots.length > 0 
    ? selectedHotspots.map(h => h.id) 
    : (selectedHotspot ? [selectedHotspot.id] : []);
  const selectionKey = selectedHotspotIds.join(',');

  // 1. Singleton Engine Mount: Initialize Three.js ONLY once!
  useEffect(() => {
    if (!mountRef.current) return;

    // Create the persistent core engine
    const engine = new ViewerCore(mountRef.current, (url) => {
      // Resolve relative API paths to absolute URLs using the centralized API service
      return getImageUrl(url);
    });

    engineRef.current = engine;
    if (autoRotate) {
      engine.setAutoRotate(true);
    }

    const checkCapabilities = async () => {
      await DeviceCapabilities.checkCapabilities();
      setXrSupported(DeviceCapabilities.supportsWebXR && DeviceCapabilities.supportsImmersiveVR);
      setGyroSupported(DeviceCapabilities.supportsDeviceOrientation);
    };
    checkCapabilities();

    if (onReady) onReady();

    // Clean up ONLY when the React component is fully unmounted
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // Empty dependencies ensure WebGL renderer is never recreated!

  // 1b. Auto-Rotation Prop Sync
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // 2. Texture Swapper: Swap textures dynamically in-place with scene transition parameters
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !imageUrl) return;

    // Construct a scene config bridge to load texture smoothly with custom animations
    const sceneConf = scene || { id: sceneId || imageUrl, image: imageUrl, objects3d: objects3d };
    engine.sceneManager.loadScene(sceneConf, hotspots, selectedHotspotIds, () => {
      // If tiny planet intro is enabled and not yet played for the initial scene
      if (enableTinyPlanetIntro && !introPlayedForInitialRef.current && !editMode) {
        introPlayedForInitialRef.current = true;
        if (onTinyPlanetStart) onTinyPlanetStart();
        engine.playTinyPlanetIntro({
          targetYaw: sceneConf.initialYaw !== undefined ? parseFloat(sceneConf.initialYaw) : undefined,
          targetPitch: sceneConf.initialPitch !== undefined ? parseFloat(sceneConf.initialPitch) : undefined,
          targetFov: sceneConf.fov !== undefined ? parseFloat(sceneConf.fov) : undefined,
          onProgress: onTinyPlanetProgress,
          onComplete: () => {
            if (onTinyPlanetEnd) onTinyPlanetEnd();
          }
        });
      }
    });
  }, [sceneId, imageUrl, scene?.transitionEffect, scene?.transitionDuration, enableTinyPlanetIntro, editMode]); // Fires swaps when scene or image changes!

  // 3. Hotspots Synchronizer: Redraw hotspots in-place in WebGL scene
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Guard against premature hotspot drawing during scene switch transitions or intro
    if ((!engine.sceneManager.isTransitioning || engine.sceneManager.currentSceneId === sceneId) && !engine.isTinyPlanetPlaying()) {
      engine.hotspotManager.rebuild(hotspots, selectedHotspotIds);
    }
  }, [hotspots, selectionKey, sceneId]); // Refreshes sprites on list/selection change!

  // 3b. 3D Objects Synchronizer: Redraw 3D objects in WebGL scene
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.object3dManager) return;

    const list = objects3d.length > 0 ? objects3d : (scene?.objects3d || scene?.objects || []);
    if (!engine.sceneManager.isTransitioning || engine.sceneManager.currentSceneId === sceneId) {
      engine.object3dManager.rebuild(list, selectedObjectId);
    }
  }, [objects3d, selectedObjectId, sceneId, scene?.objects3d]);

  // 4. Snap Settings & Selection Sync to Engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.snapSettings = snapSettings;
  }, [snapSettings]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.selectedHotspotIds = selectedHotspotIds;
  }, [selectionKey]);

  // 5. Callback Bridge Synchronization
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Direct callback overrides: extremely fast, zero re-rendering overhead
    engine.hotspotManager.setCallbacks({
      onClick: (hs, e) => {
        if (onHotspotClick) onHotspotClick(hs, e);
      },
      onHover: (hs, screenspacePos) => {
        setHoveredHotspot(hs);
        if (screenspacePos && tooltipRef.current) {
          tooltipRef.current.style.left = `${screenspacePos.x}px`;
          tooltipRef.current.style.top = `${screenspacePos.y - 45}px`;
        }
      },
      onDragUpdate: onHotspotUpdate,
      onEnterView: onHotspotEnterView
    });

    if (engine.object3dManager) {
      engine.object3dManager.onObjectClick = (obj, e) => {
        if (onObjectClick) onObjectClick(obj, e);
      };
      engine.object3dManager.onObjectHover = (obj, screenspacePos) => {
        setHoveredObject(obj);
        if (onObjectHover) onObjectHover(obj, screenspacePos);
      };
      engine.object3dManager.onObjectTransformChange = onObjectTransformChange;
      engine.object3dManager.editMode = editMode;
    }

    engine.setEditMode(editMode);
    engine.onBackgroundClick = editMode ? onAddHotspot : null;
    engine.onContextMenuTrigger = onContextMenuTrigger;
    engine.onCameraYawChange = onCameraYawChange;
    engine.onSelectedHotspotPosChange = onSelectedHotspotPosChange;
    engine.onAutoRotateChange = onAutoRotateChange;
  }, [
    onHotspotClick,
    onAddHotspot,
    onHotspotUpdate,
    onContextMenuTrigger,
    onCameraYawChange,
    editMode,
    onSelectedHotspotPosChange,
    onAutoRotateChange,
    onHotspotEnterView,
    onObjectClick,
    onObjectHover,
    onObjectTransformChange
  ]);

  // Expose Imperative API hooks identically to match existing pages
  useImperativeHandle(ref, () => ({
    get targetTheta() {
      return engineRef.current?.targetTheta ?? engineRef.current?.spherical?.theta ?? 0;
    },
    get targetPhi() {
      return engineRef.current?.targetPhi ?? engineRef.current?.spherical?.phi ?? Math.PI / 2;
    },
    get spherical() {
      return engineRef.current?.spherical ?? { phi: Math.PI / 2, theta: 0 };
    },
    get camera() {
      return engineRef.current?.camera ?? null;
    },
    get fov() {
      return engineRef.current?.fov ?? 95;
    },
    get engine() {
      return engineRef.current ?? null;
    },
    get object3dManager() {
      return engineRef.current?.object3dManager ?? null;
    },
    getYaw: () => {
      return engineRef.current ? engineRef.current.getYaw() : 0;
    },
    getPitch: () => {
      return engineRef.current ? engineRef.current.getPitch() : 0;
    },
    setCameraOrientation: (yaw, pitch, fov) => {
      engineRef.current?.setCameraOrientation(yaw, pitch, fov);
    },
    setAutoRotate: (val) => {
      engineRef.current?.setAutoRotate(val);
    },
    updateHotspots: (list) => {
      engineRef.current?.hotspotManager.rebuild(list, selectedHotspotIds);
    },
    updateObjects3D: (list, selId) => {
      engineRef.current?.object3dManager?.rebuild(list, selId !== undefined ? selId : selectedObjectId);
    },
    setGizmoMode: (mode) => {
      engineRef.current?.object3dManager?.setGizmoMode(mode);
    },
    selectObject: (id) => {
      engineRef.current?.object3dManager?.selectObject(id);
    },
    zoomIn: () => {
      engineRef.current?.zoomIn();
    },
    zoomOut: () => {
      engineRef.current?.zoomOut();
    },
    rotate: (yawOffset, pitchOffset) => {
      engineRef.current?.rotate(yawOffset, pitchOffset);
    },
    getCanvas: () => {
      return engineRef.current?.renderer?.domElement || null;
    },
    getYawPitchFromClick: (clientX, clientY) => {
      return engineRef.current?.getYawPitchFromClick(clientX, clientY) || null;
    },
    setQuality: (mode) => {
      engineRef.current?.setQuality(mode);
    },
    setCameraEase: (ease) => {
      engineRef.current?.setCameraEase(ease);
    },
    playTinyPlanetIntro: (options) => {
      engineRef.current?.playTinyPlanetIntro(options);
    },
    skipTinyPlanetIntro: () => {
      engineRef.current?.skipTinyPlanetIntro();
    },
    isTinyPlanetPlaying: () => {
      return engineRef.current?.isTinyPlanetPlaying() || false;
    },
    getTileStats: () => {
      return engineRef.current?.getTileStats() || null;
    },
    enterVR: () => engineRef.current?.webXRManager?.enterVR(),
    exitVR: () => engineRef.current?.webXRManager?.exitVR(),
    toggleVR: () => engineRef.current?.webXRManager?.toggleVR(),
    isVREnabled: () => engineRef.current?.webXRManager?.enabled || false,
    checkVRSupported: async () => engineRef.current?.webXRManager?.checkSupported() || false,
    getWebXRManager: () => engineRef.current?.webXRManager || null,
    isGyroEnabled: () => engineRef.current?.inputManager?.gyroEnabled || false,
    requestGyroPermission: () => engineRef.current?.inputManager?.requestGyroPermission(),
    enableGyro: () => {
      engineRef.current?.inputManager?.enableGyro();
      setGyroEnabled(true);
    },
    disableGyro: () => {
      engineRef.current?.inputManager?.disableGyro();
      setGyroEnabled(false);
    },
    calibrateGyro: () => engineRef.current?.inputManager?.calibrateGyro()
  }), [selectionKey]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#0a0a0f',
      }}
    >
      {/* Permanent DOM canvas container */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: hoveredHotspot ? 'pointer' : (editMode ? 'crosshair' : 'grab'),
          userSelect: 'none',
        }}
      />

      {/* Premium Glassmorphic Tooltip HUD Overlay */}
      {hoveredHotspot && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translate(-50%, -50%)',
            background: 'rgba(17, 17, 24, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#f0eeff',
            fontSize: '12px',
            fontWeight: 500,
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(108, 99, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            animation: 'fadeIn 0.15s ease-out',
            zIndex: 1000,
          }}
        >
          {hoveredHotspot.type === 'navigation' && <span style={{ color: '#6c63ff', fontWeight: 'bold' }}>➔</span>}
          {hoveredHotspot.type === 'info' && <span style={{ color: '#00d4ff', fontWeight: 'bold' }}>ℹ</span>}
          {hoveredHotspot.type === 'link' && <span style={{ color: '#ffb347', fontWeight: 'bold' }}>🔗</span>}
          {hoveredHotspot.type === 'video' && <span style={{ color: '#ff4d6d', fontWeight: 'bold' }}>▶</span>}
          <span>{hoveredHotspot.tooltip || 'View Scene'}</span>
        </div>
      )}

    </div>
  );
});

export default PanoramaViewer;
