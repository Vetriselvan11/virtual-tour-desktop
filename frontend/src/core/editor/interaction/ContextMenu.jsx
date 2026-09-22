import React, { useEffect, useRef } from 'react';
import Icon from '../../../components/common/Icon';

/**
 * Premium glassmorphic Right-Click Context Menu overlay.
 * Custom contextual options based on whether right-clicking a hotspot or background.
 */
export default function ContextMenu({
  visible,
  x,
  y,
  clickedHotspot,
  onClose,
  onAction,
  hasClipboard
}) {
  const menuRef = useRef(null);

  // Close context menu if clicking anywhere else
  useEffect(() => {
    if (!visible) return;

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('touchstart', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const itemStyle = {
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-secondary)',
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'all 0.12s ease-out',
    borderRadius: '4px',
    userSelect: 'none'
  };

  const itemHoverStyle = (e, hoverColor = 'var(--accent)') => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
    e.currentTarget.style.color = '#fff';
    e.currentTarget.style.transform = 'translateX(2px)';
  };

  const itemLeaveStyle = (e) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = 'var(--text-secondary)';
    e.currentTarget.style.transform = 'translateX(0)';
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 3000,
        background: 'rgba(13, 13, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-md)',
        padding: '6px',
        width: '180px',
        boxShadow: 'var(--shadow-lg), 0 0 24px rgba(108, 99, 255, 0.12)',
        animation: 'fadeIn 0.12s ease-out'
      }}
    >
      {clickedHotspot ? (
        <>
          <div style={{ padding: '4px 10px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
            HOTSPOT: {clickedHotspot.id}
          </div>
          <div
            style={itemStyle}
            onMouseEnter={itemHoverStyle}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('edit', clickedHotspot);
              onClose();
            }}
          >
            <Icon name="Pencil" size="sm" style={{ color: 'var(--cyan)' }} />
            Edit Properties
          </div>
          <div
            style={itemStyle}
            onMouseEnter={itemHoverStyle}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('duplicate', clickedHotspot);
              onClose();
            }}
          >
            <Icon name="Copy" size="sm" style={{ color: 'var(--accent)' }} />
            Duplicate Hotspot
          </div>
          <div
            style={itemStyle}
            onMouseEnter={itemHoverStyle}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('copy-style', clickedHotspot);
              onClose();
            }}
          >
            <Icon name="PaintBucket" size="sm" style={{ color: 'var(--amber)' }} />
            Copy Style
          </div>
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />
          <div
            style={{ ...itemStyle, color: 'var(--red)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 77, 109, 0.1)';
              e.currentTarget.style.color = 'var(--red)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('delete', clickedHotspot);
              onClose();
            }}
          >
            <Icon name="Trash2" size="sm" />
            Delete Hotspot
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '4px 10px', fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
            CANVAS ACTIONS
          </div>
          <div
            style={itemStyle}
            onMouseEnter={itemHoverStyle}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('add-hotspot');
              onClose();
            }}
          >
            <Icon name="PlusCircle" size="sm" style={{ color: 'var(--accent)' }} />
            Add Hotspot Here
          </div>
          <div
            style={{
              ...itemStyle,
              opacity: hasClipboard ? 1 : 0.4,
              cursor: hasClipboard ? 'pointer' : 'not-allowed'
            }}
            onMouseEnter={hasClipboard ? itemHoverStyle : undefined}
            onMouseLeave={hasClipboard ? itemLeaveStyle : undefined}
            onClick={() => {
              if (hasClipboard) {
                onAction('paste-hotspot');
                onClose();
              }
            }}
          >
            <Icon name="ClipboardPaste" size="sm" style={{ color: 'var(--cyan)' }} />
            Paste Hotspot
          </div>
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />
          <div
            style={itemStyle}
            onMouseEnter={itemHoverStyle}
            onMouseLeave={itemLeaveStyle}
            onClick={() => {
              onAction('toggle-rotate');
              onClose();
            }}
          >
            <Icon name="Compass" size="sm" style={{ color: 'var(--green)' }} />
            Toggle Auto Rotate
          </div>
        </>
      )}
    </div>
  );
}
