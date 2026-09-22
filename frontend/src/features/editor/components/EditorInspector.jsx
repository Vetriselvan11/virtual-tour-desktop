import React from 'react';
import { Drawer } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/common/Icon';
import DarkVeil from '../../../components/common/DarkVeil';
import FloorplanEditor from '../../../components/minimap/FloorplanEditor';
import HotspotPanel from '../../../components/editor/HotspotPanel';
import Objects3DPanel from '../../../components/editor/objects3d/Objects3DPanel';
import { SceneSettingsPanel } from './SceneSettingsPanel';
import AudioPanel from '../../../core/editor/audio/AudioPanel';
import CinematicTimelineEditor from './CinematicTimelineEditor';
import SceneIntelligencePanel from '../../analysis/components/SceneIntelligencePanel';

export default function EditorInspector({
  layout,
  tour,
  setTourState,
  currentScene,
  currentSceneId,
  hotspotManager,
  viewerRef,
  handleSceneAudioUpdate,
  audioEngineRef,
  keyframeControllerRef,
  setIsSceneConnectionModalOpen,
  onSceneChange,
  onOpenSceneGraph,
  onTriggerAnalyze
}) {
  const inspectorTabs = [
    { key: 'hotspot', icon: <Icon name="Link2" size="sm" />, label: 'Hotspot' },
    { key: 'objects3d', icon: <Icon name="Box" size="sm" />, label: '3D Objects' },
    { key: 'scene', icon: <Icon name="LayoutDashboard" size="sm" />, label: 'Scene' },
    { key: 'ai', icon: <Icon name="Sparkles" size="sm" />, label: 'AI Insights' },
    { key: 'audio', icon: <Icon name="Volume2" size="sm" />, label: 'Audio' },
    { key: 'timeline', icon: <Icon name="Camera" size="sm" />, label: 'Timeline' },
  ];

  const renderTabContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {inspectorTabs.map(tab => (
          <div
            key={tab.key}
            onClick={() => layout.setRightTab(tab.key)}
            style={{
              flex: 1, padding: '8px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              cursor: 'pointer', borderBottom: `2px solid ${layout.rightTab === tab.key ? 'var(--accent)' : 'transparent'}`,
              background: layout.rightTab === tab.key ? 'var(--accent-dim)' : 'transparent',
              color: layout.rightTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 9, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={layout.rightTab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            {layout.rightTab === 'hotspot' && (
              <HotspotPanel
                hotspot={hotspotManager.selectedHotspot}
                scenes={tour?.scenes || []}
                currentSceneId={currentSceneId}
                currentScene={currentScene}
                onUpdate={hotspotManager.handleHotspotUpdate}
                onDelete={hotspotManager.handleHotspotDelete}
                onSelectSceneVisually={(hs) => {
                  hotspotManager.setActiveHotspotToConnect(hs);
                  setIsSceneConnectionModalOpen(true);
                }}
                onSceneUpdate={handleSceneAudioUpdate}
                viewerRef={viewerRef}
              />
            )}

            {layout.rightTab === 'objects3d' && (
              <Objects3DPanel
                currentScene={currentScene}
                tour={tour}
                tourId={tour?.id || tour?._id}
                onSceneUpdate={handleSceneAudioUpdate}
                viewerRef={viewerRef}
                currentSceneId={currentSceneId}
              />
            )}

            {layout.rightTab === 'scene' && (
              <SceneSettingsPanel
                scene={currentScene}
                scenes={tour?.scenes || []}
                tour={tour}
                onTourUpdate={setTourState}
                viewerRef={viewerRef}
              />
            )}

            {layout.rightTab === 'ai' && (
              <SceneIntelligencePanel
                tour={tour}
                currentScene={currentScene}
                currentSceneId={currentSceneId}
                onTourUpdate={setTourState}
                onOpenSceneGraph={onOpenSceneGraph}
                onTriggerAnalyze={onTriggerAnalyze}
              />
            )}

            {layout.rightTab === 'audio' && (
              <AudioPanel
                scene={currentScene}
                onSceneUpdate={handleSceneAudioUpdate}
                audioEngineRef={audioEngineRef}
              />
            )}

            {layout.rightTab === 'timeline' && (
              <CinematicTimelineEditor
                tour={tour}
                setTourState={setTourState}
                viewerRef={viewerRef}
                currentSceneId={currentSceneId}
                currentScene={currentScene}
                onSceneChange={onSceneChange}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  if (layout.isMobile) {
    return (
      <Drawer
        title={layout.showFloorplanEditor ? "Floorplan Editor" : "Inspector"}
        placement="right"
        onClose={() => layout.setRightSidebarCollapsed(true)}
        open={!layout.rightSidebarCollapsed}
        styles={{ body: { padding: 0 } }}
        width={320}
      >
        {layout.showFloorplanEditor ? (
          <FloorplanEditor
            tour={tour}
            onUpdate={setTourState}
            onClose={() => {
              layout.setShowFloorplanEditor(false);
              layout.setRightSidebarCollapsed(true);
            }}
          />
        ) : (
          renderTabContent()
        )}
      </Drawer>
    );
  }

  return (
    <>
      <div
        style={{
          width: layout.rightSidebarCollapsed ? 0 : 300, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', borderLeft: layout.rightSidebarCollapsed ? 'none' : '1px solid var(--border)',
          flexShrink: 0, zIndex: 9, background: 'var(--bg-secondary)', position: 'relative'
        }}
      >
        {/* DarkVeil Background Animation - Right Side */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none', zIndex: 0 }}>
          <DarkVeil hueShift={345} speed={0.12} scanlineFrequency={0.5} warpAmount={0.35} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {layout.showFloorplanEditor ? (
            <FloorplanEditor
              tour={tour}
              onUpdate={setTourState}
              onClose={() => { layout.setShowFloorplanEditor(false); layout.triggerResize(); }}
            />
          ) : (
            renderTabContent()
          )}
        </div>
      </div>

      <div
        onClick={() => {
          layout.setRightSidebarCollapsed(!layout.rightSidebarCollapsed);
          layout.triggerResize();
        }}
        style={{
          position: 'absolute', right: layout.isMobile ? 8 : (layout.rightSidebarCollapsed ? 8 : 308),
          top: '50%', transform: 'translateY(-50%)', width: '18px', height: '48px',
          borderRadius: layout.rightSidebarCollapsed ? 'var(--radius-sm) 0 0 var(--radius-sm)' : '0 var(--radius-sm) var(--radius-sm) 0',
          background: 'rgba(17, 17, 24, 0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 1000, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          color: 'rgba(240, 238, 255, 0.7)', fontSize: '9px', boxShadow: 'var(--shadow-sm)'
        }}
      >
        {layout.rightSidebarCollapsed ? '◀' : '▶'}
      </div>
    </>
  );
}
