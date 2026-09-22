import React from 'react';
import { Modal } from 'antd';
import SceneConnectionModal from '../../../core/editor/interaction/SceneConnectionModal';
import Icon from '../../../components/common/Icon';
import ActionLoader from '../../../components/common/ActionLoader';

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
        styles={{ body: { padding: '24px 16px', textAlign: 'center', height: '250px', position: 'relative' } }}
      >
        <div style={{ margin: '10px 0 20px' }}>
          <ActionLoader text={`Uploading panorama images... ${folderUploadProgress}%`} />
        </div>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Exporting Standalone Tour</span>}
        open={exporting}
        footer={null}
        closable={false}
        centered
        styles={{ body: { padding: '24px 16px', textAlign: 'center', height: '250px', position: 'relative' } }}
      >
        <div style={{ margin: '10px 0 20px' }}>
          <ActionLoader text={`Packaging offline player... ${exportProgress}%`} />
        </div>
      </Modal>
    </>
  );
}
