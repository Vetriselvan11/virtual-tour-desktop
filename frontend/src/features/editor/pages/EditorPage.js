import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, message, Spin, Drawer, Modal } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../../../services/http/httpClient';
import ScenesSidebar from '../../../components/editor/ScenesSidebar';
import DarkVeil from '../../../components/common/DarkVeil';

// Core Imports
import { useHistoryManager } from '../../../core/editor/history/historyManager';
import { useKeyboardShortcuts } from '../../../core/editor/shortcuts/useKeyboardShortcuts';
import { scenePreloader } from '../../../core/editor/preloader/scenePreloader';
import { useGuidedTour } from '../../../core/editor/guided-tour/guidedTour';
import EditorTopbar from '../../../core/editor/interaction/EditorTopbar';
import SceneTimeline from '../../../core/editor/timeline/SceneTimeline';
import { audioEngine } from '../../../core/editor/audio/AudioEngine';
import { KeyframeController } from '../../../core/editor/keyframe/KeyframeController';

// Custom Hooks & Subcomponents
import { useEditorLayout } from '../hooks/useEditorLayout';
import { useTourManager } from '../hooks/useTourManager';
import { useHotspotManager } from '../hooks/useHotspotManager';
import { useMediaUploader } from '../hooks/useMediaUploader';
import { EditorModals } from '../components/EditorModals';
import TourSettingsModal from '../components/TourSettingsModal';
import EditorWorkspace from '../components/EditorWorkspace';
import EditorInspector from '../components/EditorInspector';
import PublishModal from '../../publish/components/PublishModal';
import SceneGraphModal from '../../analysis/components/SceneGraphModal';
import AnalysisProgressModal from '../../analysis/components/AnalysisProgressModal';

export default function EditorPage() {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);

  // Core State
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  
  const [snapSettings, setSnapSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('snap_settings');
      return saved ? JSON.parse(saved) : { gridSnap: false, magneticSnap: false, horizonSnap: false };
    } catch {
      return { gridSnap: false, magneticSnap: false, horizonSnap: false };
    }
  });

  const [manualDraftMode, setManualDraftMode] = useState(() => {
    return localStorage.getItem('manual_draft_mode') === 'true';
  });

  const viewportStateRef = useRef({});
  const [selectedHotspotPos, setSelectedHotspotPos] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, hotspot: null });
  const [isSceneConnectionModalOpen, setIsSceneConnectionModalOpen] = useState(false);
  const [showTourSettingsModal, setShowTourSettingsModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSceneGraphModal, setShowSceneGraphModal] = useState(false);
  const [showAnalysisProgressModal, setShowAnalysisProgressModal] = useState(false);

  // History Manager
  const {
    state: tour,
    pushState: setTourState,
    undo: triggerUndo,
    redo: triggerRedo,
    canUndo,
    canRedo,
    resetHistory
  } = useHistoryManager(null);

  const currentScene = tour?.scenes?.find(s => s.id === currentSceneId);
  const hotspots = currentScene?.hotspots || [];

  // Hooks
  const layout = useEditorLayout();
  const tourManager = useTourManager(tourId, tour, setTourState, resetHistory, setCurrentSceneId, setEditMode, setAutoRotate, () => hotspotManager.clearSelection(), manualDraftMode);
  const hotspotManager = useHotspotManager(tour, currentSceneId, setTourState, viewerRef);
  
  // Guided Tour
  const guidedTour = useGuidedTour({
    scenes: tour?.scenes || [],
    currentSceneId,
    onSceneChange: (id) => {
      setCurrentSceneId(id);
      hotspotManager.clearSelection();
    },
    onCameraRotate: (yawOffset) => {
      if (viewerRef.current) viewerRef.current.rotate(yawOffset, 0);
    }
  });

  const mediaUploader = useMediaUploader(
    tourId, tour, setTourState, setCurrentSceneId, 
    hotspotManager.clearSelection, tourManager.handleAddScene, 
    guidedTour.playTour, guidedTour.pauseTour, viewerRef
  );

  const audioEngineRef = useRef(audioEngine);
  const keyframeControllerRef = useRef(null);

  useEffect(() => {
    viewportStateRef.current = {
      currentSceneId,
      selectedHotspotId: hotspotManager.selectedHotspot?.id,
      editMode,
      autoRotate
    };
  }, [currentSceneId, hotspotManager.selectedHotspot, editMode, autoRotate]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.setQuality(layout.quality);
  }, [layout.quality]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.setCameraEase(layout.cameraEase);
  }, [layout.cameraEase]);

  useEffect(() => {
    if (!keyframeControllerRef.current) {
      keyframeControllerRef.current = new KeyframeController(null);
    }
  }, []);

  useEffect(() => {
    if (viewerRef.current && keyframeControllerRef.current) {
      keyframeControllerRef.current._viewer = viewerRef.current;
    }
  });

  const handleSceneAudioUpdate = useCallback((audioUpdates) => {
    if (!currentSceneId || !tour) return;
    const updated = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId ? { ...s, ...audioUpdates } : s
      ),
    };
    setTourState(updated);
  }, [currentSceneId, tour, setTourState]);

  useEffect(() => {
    if (tour && currentSceneId) {
      const curScene = tour.scenes?.find(s => s.id === currentSceneId);
      if (curScene) {
        scenePreloader.preloadAdjacent(curScene, tour.scenes, getImageUrl);
      }
    }
  }, [currentSceneId, tour]);

  useKeyboardShortcuts({
    onUndo: () => { if (canUndo) { triggerUndo(); message.info('Undo last action'); } },
    onRedo: () => { if (canRedo) { triggerRedo(); message.info('Redo next action'); } },
    onDelete: () => {
      if (hotspotManager.selectedHotspots.length > 1) {
        hotspotManager.handleBulkHotspotDelete();
      } else if (hotspotManager.selectedHotspot) {
        hotspotManager.handleHotspotDelete(hotspotManager.selectedHotspot.id);
        message.info('Hotspot deleted');
      }
    },
    onSave: () => tourManager.handleSave(),
    onToggleAutoRotate: () => setAutoRotate(r => !r),
    onToggleFullscreen: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen();
      }
    },
    onDeselect: hotspotManager.clearSelection,
    onCopy: () => {
      if (hotspotManager.selectedHotspot) {
        hotspotManager.setClipboardHotspot(hotspotManager.selectedHotspot);
        message.success('Hotspot style copied to clipboard!');
      }
    },
    onPaste: hotspotManager.handlePasteHotspot
  });

  const handleToggleManualDraftMode = (enabled) => {
    setManualDraftMode(enabled);
    localStorage.setItem('manual_draft_mode', enabled ? 'true' : 'false');
    if (!enabled) {
      message.info('Auto-save mode enabled');
      if (tour) {
        tourManager.triggerDebouncedSave(tour, viewportStateRef);
      }
    } else {
      message.info('Manual Draft mode enabled. Changes will not save automatically.');
      tourManager.setSyncStatus('saved');
    }
  };

  useEffect(() => {
    if (!tour || tourManager.loading) return;

    const vp = viewportStateRef.current;
    localStorage.setItem(`tour_edits_${tourId}`, JSON.stringify({
      tour,
      timestamp: Date.now(),
      currentSceneId: vp.currentSceneId,
      selectedHotspotId: vp.selectedHotspotId,
      editMode: vp.editMode,
      autoRotate: vp.autoRotate,
      saveFailed: !manualDraftMode && tourManager.syncStatus === 'failed'
    }));

    if (manualDraftMode) return;
    if (tour !== tourManager.lastSavedTourRef.current) {
      tourManager.triggerDebouncedSave(tour, viewportStateRef);
    }
  }, [tour, tourId, tourManager.loading, manualDraftMode, tourManager.syncStatus, tourManager.triggerDebouncedSave]); // eslint-disable-line

  useEffect(() => {
    tourManager.fetchTour(viewportStateRef);
  }, [tourId]); // eslint-disable-line

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    const handleOnline = () => {
      if (tourManager.syncStatus === 'failed' && tour) {
        message.info('Connection restored. Syncing changes...');
        tourManager.triggerDebouncedSave(tour, viewportStateRef);
      }
    };

    const handleBeforeUnload = (e) => {
      const isPending = tourManager.syncStatus === 'saving';
      const isFailed = tourManager.syncStatus === 'failed';

      if (manualDraftMode && tour && tour !== tourManager.lastSavedTourRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved draft changes. Are you sure you want to leave?';
        return e.returnValue;
      }
      if (!manualDraftMode) {
        if (isPending) {
          e.preventDefault();
          e.returnValue = 'Some changes are still saving. Are you sure you want to leave?';
          return e.returnValue;
        }
        if (isFailed) {
          e.preventDefault();
          e.returnValue = 'Save failed. If you leave now, you may lose your recent changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tourManager.syncStatus, tour, manualDraftMode, tourManager.triggerDebouncedSave]); // eslint-disable-line

  const handleContextMenuAction = (action, data) => {
    if (action === 'edit' && data) {
      hotspotManager.setSelectedHotspot(data);
    } else if (action === 'duplicate' && data) {
      hotspotManager.handleDuplicateHotspot(data);
    } else if (action === 'delete' && data) {
      hotspotManager.handleHotspotDelete(data.id);
    } else if (action === 'copy-style' && data) {
      hotspotManager.setClipboardHotspot(data);
      message.success('Hotspot style copied to clipboard!');
    } else if (action === 'paste-hotspot') {
      hotspotManager.handlePasteHotspot();
    } else if (action === 'add-hotspot') {
      if (viewerRef.current) {
        const coords = viewerRef.current.getYawPitchFromClick(contextMenu.x, contextMenu.y);
        if (coords) hotspotManager.handleAddHotspot(coords);
      }
    } else if (action === 'toggle-rotate') {
      setAutoRotate(r => !r);
    }
  };

  const handleVisualConnectionSelect = (targetSceneId) => {
    if (!hotspotManager.activeHotspotToConnect) return;
    const updated = {
      ...hotspotManager.activeHotspotToConnect,
      type: 'navigation',
      targetScene: targetSceneId
    };
    hotspotManager.handleHotspotUpdate(updated);
    message.success("Hotspot successfully connected!");
    setIsSceneConnectionModalOpen(false);
    hotspotManager.setActiveHotspotToConnect(null);
  };

  if (tourManager.loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Loading Studio Workspace...</div>
        </div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>Tour not found</div>
          <Button onClick={() => navigate('/dashboard')} style={{ marginTop: 16 }}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <input
        type="file"
        ref={mediaUploader.folderInputRef}
        multiple
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={mediaUploader.handleFolderUploadChange}
      />
      <input
        type="file"
        ref={mediaUploader.singleInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={mediaUploader.handleSingleUploadChange}
      />

      <EditorTopbar
        tour={tour}
        currentScene={currentScene}
        titleEditing={titleEditing}
        tempTitle={tempTitle}
        setTempTitle={setTempTitle}
        setTitleEditing={setTitleEditing}
        onTitleSave={() => {
          setTourState(t => ({ ...t, title: tempTitle || t.title }));
          setTitleEditing(false);
        }}
        onOpenTourSettings={() => setShowTourSettingsModal(true)}
        editMode={editMode}
        setEditMode={(mode) => { setEditMode(mode); if (mode) guidedTour.pauseTour(); else hotspotManager.clearSelection(); }}
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => { triggerUndo(); message.info('Undo'); }}
        onRedo={() => { triggerRedo(); message.info('Redo'); }}
        onSave={tourManager.handleSave}
        saving={tourManager.saving}
        syncStatus={tourManager.syncStatus}
        manualDraftMode={manualDraftMode}
        onToggleManualDraftMode={handleToggleManualDraftMode}
        onReload={() => {
          Modal.confirm({
            title: 'Discard unsaved changes?',
            content: 'This will reset your editor state to the last saved database state. This action cannot be undone.',
            okText: 'Discard & Reload',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: () => {
              localStorage.removeItem(`tour_edits_${tourId}`);
              tourManager.fetchTour(viewportStateRef);
            }
          });
        }}
        onExportZip={mediaUploader.handleExportTour}
        onExportVideo={mediaUploader.handleExportVideo}
        onToggleFloorplan={() => {
          layout.setShowFloorplanEditor(e => !e);
          layout.triggerResize();
        }}
        showFloorplanEditor={layout.showFloorplanEditor}
        onTriggerBulkUpload={() => {
          if (mediaUploader.folderInputRef.current) mediaUploader.folderInputRef.current.click();
        }}
        onTabSwitch={(tab) => {
          layout.setRightTab(tab);
          if (layout.rightSidebarCollapsed) {
            layout.setRightSidebarCollapsed(false);
            layout.triggerResize();
          }
        }}
        onOpenPublish={() => setShowPublishModal(true)}
        onOpenSceneGraph={() => setShowSceneGraphModal(true)}
        onTriggerAnalyze={() => setShowAnalysisProgressModal(true)}
        navigate={navigate}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {mediaUploader.isRecordingVideo && (
          <div style={{
            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255, 77, 109, 0.95)', backdropFilter: 'blur(8px)',
            padding: '12px 24px', borderRadius: '30px', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 8px 32px rgba(255, 77, 109, 0.3)', border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white', fontWeight: 600, animation: 'pulse 2s infinite'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
              <span>Recording Walkthrough...</span>
            </div>
            <Button 
              type="primary" 
              onClick={mediaUploader.stopVideoRecording}
              style={{ background: '#fff', color: '#ff4d6d', border: 'none', fontWeight: 'bold', borderRadius: 20 }}
            >
              Stop & Save
            </Button>
          </div>
        )}
        
        {layout.isMobile ? (
          <Drawer
            title="Rooms Manager"
            placement="left"
            onClose={() => layout.setLeftSidebarCollapsed(true)}
            open={!layout.leftSidebarCollapsed}
            styles={{ body: { padding: 0 } }}
            width={240}
          >
            <ScenesSidebar
              scenes={tour.scenes || []}
              currentSceneId={currentSceneId}
              tourId={tourId}
              tour={tour}
              onSelectScene={(id) => { setCurrentSceneId(id); hotspotManager.clearSelection(); layout.setLeftSidebarCollapsed(true); }}
              onAddScene={tourManager.handleAddScene}
              onDeleteScene={(id) => tourManager.handleDeleteScene(id, currentSceneId)}
              onTourUpdate={setTourState}
              onReorderScenes={tourManager.handleReorderScenes}
            />
          </Drawer>
        ) : (
          <div
            style={{
              width: layout.leftSidebarCollapsed ? 0 : layout.leftSidebarWidth,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: layout.isResizingSidebar ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRight: layout.leftSidebarCollapsed ? 'none' : '1px solid var(--border)',
              flexShrink: 0,
              zIndex: 9,
              position: 'relative'
            }}
          >
            {/* DarkVeil Background Animation - Left Side */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none', zIndex: 0 }}>
              <DarkVeil hueShift={345} speed={0.12} scanlineFrequency={0.5} warpAmount={0.35} />
            </div>
            <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
              <ScenesSidebar
                scenes={tour.scenes || []}
                currentSceneId={currentSceneId}
                tourId={tourId}
                tour={tour}
                onSelectScene={(id) => { setCurrentSceneId(id); hotspotManager.clearSelection(); }}
                onAddScene={tourManager.handleAddScene}
                onDeleteScene={(id) => tourManager.handleDeleteScene(id, currentSceneId)}
                onTourUpdate={setTourState}
                onReorderScenes={tourManager.handleReorderScenes}
              />
            </div>
          </div>
        )}

        {!layout.leftSidebarCollapsed && !layout.isMobile && (
          <div
            onMouseDown={() => layout.setIsResizingSidebar(true)}
            style={{
              width: '4px', cursor: 'col-resize',
              background: layout.isResizingSidebar ? 'var(--accent)' : 'transparent',
              transition: 'background 0.2s', zIndex: 10, alignSelf: 'stretch', flexShrink: 0, position: 'relative'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
            onMouseLeave={e => { if (!layout.isResizingSidebar) e.currentTarget.style.background = 'transparent'; }}
          />
        )}

        <div
          onClick={() => {
            layout.setLeftSidebarCollapsed(!layout.leftSidebarCollapsed);
            layout.triggerResize();
          }}
          style={{
            position: 'absolute',
            left: layout.isMobile ? 8 : (layout.leftSidebarCollapsed ? 8 : layout.leftSidebarWidth + 8),
            top: '50%', transform: 'translateY(-50%)',
            width: '18px', height: '48px',
            borderRadius: layout.leftSidebarCollapsed ? '0 var(--radius-sm) var(--radius-sm) 0' : 'var(--radius-sm) 0 0 var(--radius-sm)',
            background: 'rgba(17, 17, 24, 0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 1000,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            color: 'rgba(240, 238, 255, 0.7)', fontSize: '9px', boxShadow: 'var(--shadow-sm)'
          }}
        >
          {layout.leftSidebarCollapsed ? '▶' : '◀'}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <EditorWorkspace
            viewerRef={viewerRef}
            currentScene={currentScene}
            tour={tour}
            tourId={tourId}
            hotspots={hotspots}
            editMode={editMode}
            snapSettings={snapSettings}
            setSnapSettings={setSnapSettings}
            hotspotManager={hotspotManager}
            selectedHotspotPos={selectedHotspotPos}
            setSelectedHotspotPos={setSelectedHotspotPos}
            setAutoRotate={setAutoRotate}
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            handleContextMenuAction={handleContextMenuAction}
            setIsSceneConnectionModalOpen={setIsSceneConnectionModalOpen}
            setCurrentSceneId={setCurrentSceneId}
            guidedTour={guidedTour}
            layout={layout}
          />

          {layout.isMobile ? (
            <Drawer
              title="Rooms Timeline"
              placement="bottom"
              onClose={() => layout.setBottomTimelineCollapsed(true)}
              open={!layout.bottomTimelineCollapsed}
              styles={{ body: { padding: 0 } }}
              height={160}
            >
              <SceneTimeline
                scenes={tour.scenes || []}
                currentSceneId={currentSceneId}
                onSelectScene={(id) => { setCurrentSceneId(id); hotspotManager.clearSelection(); layout.setBottomTimelineCollapsed(true); }}
                onReorderScenes={tourManager.handleReorderScenes}
                onTriggerSingleUpload={() => {
                  if (mediaUploader.singleInputRef.current) mediaUploader.singleInputRef.current.click();
                }}
                onDeleteScene={(id) => tourManager.handleDeleteScene(id, currentSceneId)}
                tour={tour}
                onTourUpdate={setTourState}
                isPlaying={guidedTour.isPlaying}
                currentStep={guidedTour.currentStep}
              />
            </Drawer>
          ) : (
            <div
              style={{
                height: layout.bottomTimelineCollapsed ? 0 : '110px',
                overflow: 'hidden', transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'var(--bg-secondary)', flexShrink: 0, zIndex: 8
              }}
            >
              <SceneTimeline
                scenes={tour.scenes || []}
                currentSceneId={currentSceneId}
                onSelectScene={(id) => { setCurrentSceneId(id); hotspotManager.clearSelection(); }}
                onReorderScenes={tourManager.handleReorderScenes}
                onTriggerSingleUpload={() => {
                  if (mediaUploader.singleInputRef.current) mediaUploader.singleInputRef.current.click();
                }}
                onDeleteScene={(id) => tourManager.handleDeleteScene(id, currentSceneId)}
                tour={tour}
                onTourUpdate={setTourState}
                isPlaying={guidedTour.isPlaying}
                currentStep={guidedTour.currentStep}
              />
            </div>
          )}

          <div
            onClick={() => {
              layout.setBottomTimelineCollapsed(!layout.bottomTimelineCollapsed);
              layout.triggerResize();
            }}
            style={{
              position: 'absolute', bottom: layout.isMobile ? 8 : (layout.bottomTimelineCollapsed ? 8 : 118),
              left: '50%', transform: 'translateX(-50%)', width: '48px', height: '18px',
              borderRadius: layout.bottomTimelineCollapsed ? 'var(--radius-sm) var(--radius-sm) 0 0' : '0 0 var(--radius-sm) var(--radius-sm)',
              background: 'rgba(17, 17, 24, 0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 1000, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              color: 'rgba(240, 238, 255, 0.7)', fontSize: '9px', boxShadow: 'var(--shadow-sm)'
            }}
          >
            {layout.bottomTimelineCollapsed ? '▲' : '▼'}
          </div>

        </div>

        <EditorInspector
          layout={layout}
          tour={tour}
          setTourState={setTourState}
          currentScene={currentScene}
          currentSceneId={currentSceneId}
          hotspotManager={hotspotManager}
          viewerRef={viewerRef}
          handleSceneAudioUpdate={handleSceneAudioUpdate}
          audioEngineRef={audioEngineRef}
          keyframeControllerRef={keyframeControllerRef}
          setIsSceneConnectionModalOpen={setIsSceneConnectionModalOpen}
          onSceneChange={setCurrentSceneId}
          onOpenSceneGraph={() => setShowSceneGraphModal(true)}
          onTriggerAnalyze={() => setShowAnalysisProgressModal(true)}
        />
      </div>

      <EditorModals 
        tour={tour}
        currentSceneId={currentSceneId}
        isSceneConnectionModalOpen={isSceneConnectionModalOpen}
        setIsSceneConnectionModalOpen={setIsSceneConnectionModalOpen}
        handleVisualConnectionSelect={handleVisualConnectionSelect}
        setActiveHotspotToConnect={hotspotManager.setActiveHotspotToConnect}
        isUploadingFolder={mediaUploader.isUploadingFolder}
        folderUploadProgress={mediaUploader.folderUploadProgress}
        exporting={mediaUploader.exporting}
        exportProgress={mediaUploader.exportProgress}
      />

      <TourSettingsModal
        visible={showTourSettingsModal}
        onClose={() => setShowTourSettingsModal(false)}
        tour={tour}
        onTourUpdate={setTourState}
      />

      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        tour={tour}
        onPublishSuccess={(res) => {
          if (tourManager?.fetchTour) {
            tourManager.fetchTour(viewportStateRef);
          }
        }}
      />

      <SceneGraphModal
        open={showSceneGraphModal}
        onClose={() => setShowSceneGraphModal(false)}
        tour={tour}
        currentSceneId={currentSceneId}
        onSelectScene={(id) => {
          setCurrentSceneId(id);
          setShowSceneGraphModal(false);
        }}
        onTourUpdate={setTourState}
        onTriggerAnalyze={() => {
          setShowSceneGraphModal(false);
          setShowAnalysisProgressModal(true);
        }}
      />

      <AnalysisProgressModal
        open={showAnalysisProgressModal}
        onClose={() => setShowAnalysisProgressModal(false)}
        tour={tour}
        onAnalysisComplete={() => {
          if (tourManager?.fetchTour) {
            tourManager.fetchTour(viewportStateRef);
          }
        }}
      />
    </div>
  );
}
