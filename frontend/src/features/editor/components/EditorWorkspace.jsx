import React, { useRef } from 'react';
import { Space, Button } from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';
import PanoramaViewer from '../../../components/viewer/PanoramaViewer';
import MiniMap from '../../../components/minimap/MiniMap';
import FloatingHotspotToolbar from '../../../core/editor/interaction/FloatingHotspotToolbar';
import ContextMenu from '../../../core/editor/interaction/ContextMenu';
import { ViewportStudioPanel } from './ViewportStudioPanel';

export default function EditorWorkspace({
  viewerRef,
  currentScene,
  tour,
  tourId,
  hotspots = [],
  editMode,
  snapSettings,
  setSnapSettings,
  hotspotManager,
  selectedHotspotPos,
  setSelectedHotspotPos,
  setAutoRotate,
  contextMenu,
  setContextMenu,
  handleContextMenuAction,
  setIsSceneConnectionModalOpen,
  setCurrentSceneId,
  guidedTour,
  layout
}) {
  const miniMapRef = useRef(null);
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {!currentScene ? (
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '2px dashed var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            color: 'var(--accent)'
          }}>
            <Icon name="Camera" size="xl" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>No Room Selected</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Import room panoramas using the toolbar "Bulk Import" to get started</div>
          </div>
        </div>
      ) : (
        <>
          <PanoramaViewer
            ref={viewerRef}
            sceneId={currentScene?.id}
            imageUrl={currentScene.image ? getImageUrl(currentScene.image) : null}
            scene={currentScene}
            hotspots={hotspots}
            objects3d={currentScene?.objects3d || currentScene?.objects || []}
            editMode={editMode}
            onHotspotClick={hotspotManager.handleHotspotClick}
            onAddHotspot={editMode ? hotspotManager.handleAddHotspot : undefined}
            selectedHotspot={hotspotManager.selectedHotspot}
            selectedHotspots={hotspotManager.selectedHotspots}
            snapSettings={snapSettings}
            onHotspotUpdate={hotspotManager.handleHotspotUpdate}
            onContextMenuTrigger={(x, y, hs) => setContextMenu({ visible: true, x, y, hotspot: hs })}
            onSelectedHotspotPosChange={setSelectedHotspotPos}
            onCameraYawChange={(yaw) => { miniMapRef.current?.setYaw(yaw); }}
            onAutoRotateChange={setAutoRotate}
          />

          {editMode ? (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
              padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              fontSize: 11, color: 'var(--text-secondary)',
              border: '1px solid var(--border)', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-sm)'
            }}>
              <Icon name="Target" size="sm" style={{ color: 'var(--cyan)' }} />
              <span>Right-click panorama to add • Drag to move • Hold <strong>Shift</strong> for precision • Hold <strong>Alt</strong> for grid snap</span>
            </div>
          ) : (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
              padding: '6px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', display: 'flex',
              alignItems: 'center', gap: '12px', boxShadow: 'var(--shadow-md)', zIndex: 1500
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                CINEMATIC WALK
              </span>
              <Space size={6}>
                <Button size="small" type="text" onClick={guidedTour.skipPrev} icon={<Icon name="SkipBack" size="sm" />} style={{ color: '#fff' }} />
                <Button
                  size="small" type="primary" shape="circle"
                  icon={guidedTour.isPlaying ? <Icon name="Pause" size="xs" /> : <Icon name="Play" size="xs" />}
                  onClick={guidedTour.isPlaying ? guidedTour.pauseTour : guidedTour.playTour}
                  style={{ background: guidedTour.isPlaying ? 'var(--red)' : 'var(--accent)', border: 'none', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
                <Button size="small" type="text" onClick={guidedTour.skipNext} icon={<Icon name="SkipForward" size="sm" />} style={{ color: '#fff' }} />
              </Space>
            </div>
          )}

          {(tour?.floorplan || tour?.floor2Plan || localStorage.getItem(`tour_floorplan_f2_${tourId}`)) && (
            <MiniMap
              ref={miniMapRef}
              tour={tour}
              currentSceneId={currentScene?.id}
              onSelectScene={(id) => { setCurrentSceneId(id); hotspotManager.clearSelection(); }}
              editMode={editMode}
            />
          )}

          {editMode && hotspotManager.selectedHotspot && selectedHotspotPos && (
            <FloatingHotspotToolbar
              hotspot={hotspotManager.selectedHotspot}
              selectedHotspots={hotspotManager.selectedHotspots}
              x={selectedHotspotPos.x}
              y={selectedHotspotPos.y}
              scenes={tour?.scenes || []}
              currentSceneId={currentScene?.id}
              onUpdate={hotspotManager.handleHotspotUpdate}
              onDelete={hotspotManager.handleHotspotDelete}
              onDuplicate={hotspotManager.handleDuplicateHotspot}
              onClose={hotspotManager.clearSelection}
              onSelectSceneVisually={(hs) => {
                hotspotManager.setActiveHotspotToConnect(hs);
                setIsSceneConnectionModalOpen(true);
              }}
              snapSettings={snapSettings}
              onSnapSettingsChange={setSnapSettings}
              onBulkUpdate={hotspotManager.handleBulkHotspotUpdate}
              onBulkDelete={hotspotManager.handleBulkHotspotDelete}
            />
          )}

          <ViewportStudioPanel
            layout={layout}
            currentSceneId={currentScene?.id}
            scenesCount={tour?.scenes?.length || 0}
          />

          <ContextMenu
            visible={contextMenu.visible}
            x={contextMenu.x}
            y={contextMenu.y}
            clickedHotspot={contextMenu.hotspot}
            hasClipboard={!!hotspotManager.clipboardHotspot}
            onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
            onAction={handleContextMenuAction}
          />
        </>
      )}
    </div>
  );
}
