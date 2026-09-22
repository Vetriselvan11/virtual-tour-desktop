import React from 'react';
import { Modal } from 'antd';
import SceneConnectionModal from '../../../core/editor/interaction/SceneConnectionModal';
import Icon from '../../../components/common/Icon';

export function EditorModals({
  tour,
  currentSceneId,
  isSceneConnectionModalOpen,
  setIsSceneConnectionModalOpen,
  handleVisualConnectionSelect,
  setActiveHotspotToConnect,
  isUploadingFolder,
  folderUploadProgress,
  exporting,
  exportProgress
}) {
  return (
    <>
      <SceneConnectionModal
        visible={isSceneConnectionModalOpen}
        scenes={tour?.scenes || []}
        currentSceneId={currentSceneId}
        onSelect={handleVisualConnectionSelect}
        onClose={() => {
          setIsSceneConnectionModalOpen(false);
          setActiveHotspotToConnect(null);
        }}
      />

      <Modal
        title={<span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Importing Tour Folder Panoramas</span>}
        open={isUploadingFolder}
        footer={null}
        closable={false}
        centered
        styles={{ body: { padding: '24px 16px', textAlign: 'center' } }}
      >
        <div style={{ margin: '10px 0 20px' }}>
          <div style={{ marginBottom: 16, animation: 'pulse 1.5s infinite', color: 'var(--accent)', display: 'flex', justifyContent: 'center' }}>
            <Icon name="FaFolderOpen" size={48} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Uploading panorama images and generating rooms...
          </div>
          <div style={{
            width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', marginBottom: 12
          }}>
            <div style={{
              width: `${folderUploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--green))', transition: 'width 0.15s ease', boxShadow: '0 0 8px var(--accent-glow)'
            }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
            {folderUploadProgress}% Completed
          </div>
        </div>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Exporting Standalone Tour</span>}
        open={exporting}
        footer={null}
        closable={false}
        centered
        styles={{ body: { padding: '24px 16px', textAlign: 'center' } }}
      >
        <div style={{ margin: '10px 0 20px' }}>
          <div style={{ marginBottom: 16, animation: 'pulse 1.5s infinite', color: 'var(--cyan)', display: 'flex', justifyContent: 'center' }}>
            <Icon name="FaBoxOpen" size={48} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {exportProgress < 100 ? 'Packaging assets and offline player...' : 'Compiling zip archive...'}
          </div>
          <div style={{
            width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', marginBottom: 12
          }}>
            <div style={{
              width: `${exportProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--cyan))', transition: 'width 0.15s ease', boxShadow: '0 0 8px var(--accent-glow)'
            }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>
            {exportProgress}% Completed
          </div>
        </div>
      </Modal>
    </>
  );
}
