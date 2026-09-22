import React, { memo } from 'react';
import { Input } from 'antd';
import Icon from '../../common/Icon';

/**
 * SceneListItem — virtualized sidebar card.
 *
 * PERFORMANCE CONTRACT:
 * - Accepts ONLY stable primitive props.
 * - Does NOT contain Ant Design Dropdown (100 Dropdown instances → scroll lag).
 * - Three-dot button triggers onContextMenu (shared floating menu in ScenesSidebar).
 * - React.memo is effective here because no function props change on scene selection.
 */
const SceneListItem = memo(function SceneListItem({
  // Stable primitive identifiers
  sceneId,
  index,
  title,
  thumbnailUrl,
  sceneDisplayId,

  // Stable boolean state
  isActive,
  isStart,
  isRenaming,
  renamingName,

  // Stable counts (numbers — stable memo)
  hsCount,
  hasAudio,
  keyframesCount,

  // Callbacks (bound to sceneId above in parent, stable refs)
  setRenamingName,
  onRenameSave,
  onSelectScene,
  onDragStart,
  onDragOver,
  onDropOnScene,
  onContextMenu,
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index, sceneId)}
      onDragOver={onDragOver}
      onDrop={(e) => onDropOnScene(e, index)}
      onContextMenu={(e) => onContextMenu(e, sceneId)}
      style={{ transition: 'transform 0.15s' }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
          background: isActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
          boxShadow: isActive ? '0 0 16px var(--accent-glow)' : 'none',
          marginBottom: 8,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={() => onSelectScene(sceneId)}
        className="scene-sidebar-card"
      >
        {/* Active Accent Left Border Indicator */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
            background: 'var(--accent)', zIndex: 10
          }} />
        )}

        {/* Card Thumbnail */}
        <div style={{
          height: 76,
          background: thumbnailUrl
            ? `url(${thumbnailUrl}) center/cover`
            : 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {!thumbnailUrl && <Icon name="Image" size="lg" style={{ color: 'var(--text-muted)' }} />}

          {/* Start Scene Crown Badge */}
          {isStart && (
            <div style={{
              position: 'absolute', top: 6, left: 6,
              fontSize: 9, background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.3)',
              color: 'var(--green)', padding: '2px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(8px)'
            }}>
              <Icon name="Crown" size="xs" /> START
            </div>
          )}

          {/* Badges */}
          <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 4 }}>
            {hsCount > 0 && (
              <div style={{ fontSize: 9, background: 'rgba(10,12,18,0.75)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', color: 'var(--cyan)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <Icon name="Link2" size="xs" /> {hsCount}
              </div>
            )}
            {hasAudio && (
              <div style={{ fontSize: 9, background: 'rgba(10,12,18,0.75)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', color: 'var(--accent-bright)', padding: '2px 5px', borderRadius: 4 }}>
                <Icon name="Volume2" size="xs" />
              </div>
            )}
            {keyframesCount > 0 && (
              <div style={{ fontSize: 9, background: 'rgba(10,12,18,0.75)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <Icon name="Camera" size="xs" /> {keyframesCount}
              </div>
            )}
          </div>
        </div>

        {/* Info Details */}
        <div style={{ padding: '8px 10px' }}>
          {isRenaming ? (
            <Input
              autoFocus
              size="small"
              value={renamingName}
              onChange={e => setRenamingName(e.target.value)}
              onBlur={() => onRenameSave(sceneId)}
              onPressEnter={() => onRenameSave(sceneId)}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600 }}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                fontSize: 12, fontWeight: isActive ? 700 : 600,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '130px'
              }}>
                {title || 'Untitled Room'}
              </div>
              {/* Three-dot triggers the shared floating context menu — no Dropdown per card */}
              <div
                onClick={(e) => { e.stopPropagation(); onContextMenu(e, sceneId); }}
                style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
              >
                <Icon name="MoreHorizontal" size="sm" />
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            ID: {sceneDisplayId}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SceneListItem;
