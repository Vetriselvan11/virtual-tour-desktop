import React, { memo } from 'react';
import { Button, Badge } from 'antd';
import Icon from '../../common/Icon';

const FolderSection = memo(function FolderSection({
  folderName,
  isExpanded,
  matchedScenes = [],
  onToggleExpand,
  onRemoveFolder,
  onDragOver,
  onDropOnFolder,
  renderSceneItem
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDropOnFolder(e, folderName)}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-tertiary)',
        marginBottom: 8,
        overflow: 'hidden'
      }}
    >
      {/* Folder Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 10px',
          background: 'var(--bg-tertiary)',
          cursor: 'pointer'
        }}
        onClick={onToggleExpand}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
          {isExpanded ? <Icon name="FolderOpen" style={{ color: 'var(--cyan)' }} size="sm" /> : <Icon name="Folder" style={{ color: 'var(--text-muted)' }} size="sm" />}
          <span>{folderName}</span>
          <Badge count={matchedScenes.length} size="small" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: 'none', fontSize: 9 }} />
        </div>
        <Button
          size="small"
          danger
          type="text"
          icon={<Icon name="Trash2" style={{ width: 12, height: 12 }} />}
          onClick={(e) => { e.stopPropagation(); onRemoveFolder(folderName); }}
          style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </div>

      {/* Folder Content */}
      {isExpanded && (
        <div style={{ padding: '8px 6px 2px' }}>
          {matchedScenes.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-disabled)', padding: '6px 8px', textAlign: 'center' }}>
              Drag scenes here
            </div>
          ) : (
            matchedScenes.map((scene, idx) => renderSceneItem(scene, idx))
          )}
        </div>
      )}
    </div>
  );
});

export default FolderSection;
