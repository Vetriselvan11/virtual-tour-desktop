import React, { memo, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Space, Button, Tooltip, Modal, Badge, Popover, Select, Slider, InputNumber } from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';

const { Option } = Select;

// ─── Virtualization constants ────────────────────────────────────────────────
// Each timeline slot = 138px card + 32px (connector circle + margins) = 170px,
// but the first card has no connector so we offset the scroll calculation accordingly.
// For simplicity we treat all slots as equal width; the first slot is left-aligned.
const CARD_WIDTH      = 138; // scene card px
const CONNECTOR_WIDTH = 32;  // transition connector px (including margins)
const CARD_SLOT_WIDTH = CARD_WIDTH + CONNECTOR_WIDTH; // 170px per slot after the first
const TIMELINE_OVERSCAN = 3;  // extra cards each side of viewport

// ─── Memoized individual timeline card ───────────────────────────────────────
const TimelineCard = memo(function TimelineCard({
  scene,
  index,
  isActive,
  isDragged,
  isDragOver,
  isHovered,
  keyframesCount,
  editMode,
  onSelectScene,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  onSceneDurationChange,
  onDeleteScene
}) {
  const hsCount   = scene.hotspots?.length || 0;
  const hasAudio  = scene.ambientAudio || scene.narrationAudio;
  const sceneDur  = scene.duration !== undefined ? scene.duration : 8;
  const thumbUrl  = scene.thumbnail || scene.image;

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Delete scene?',
      content: `Are you sure you want to delete "${scene.name || 'this scene'}" and its hotspots?`,
      okText: 'Yes, delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        onDeleteScene(scene.id);
      }
    });
  }, [onDeleteScene, scene.id, scene.name]);

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onMouseEnter(scene.id)}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        width: `${CARD_WIDTH}px`,
        height: '78px',
        borderRadius: 'var(--radius-sm)',
        border: isActive
          ? '2px solid var(--accent)'
          : isDragOver
          ? '2px dashed var(--accent)'
          : '1px solid var(--border)',
        background: isActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
        boxShadow: isActive ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
        cursor: 'pointer',
        opacity: isDragged ? 0.4 : 1,
        transform: isDragOver ? 'scale(1.05)' : 'none',
        transition: 'border 0.2s, transform 0.2s, opacity 0.2s',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={() => onSelectScene(scene.id)}
    >
      {/* Thumbnail */}
      <div
        style={{
          flex: 1,
          background: thumbUrl ? `url(${getImageUrl(thumbUrl)}) center/cover` : '#000',
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {!thumbUrl && <Icon name="Image" size="xl" style={{ color: 'var(--text-muted)' }} />}

        {/* Badges */}
        <div style={{
          position: 'absolute', top: '5px', left: '5px', display: 'flex', gap: 3,
          opacity: isHovered ? 0 : 1, pointerEvents: isHovered ? 'none' : 'auto',
          transition: 'opacity 0.15s ease-in-out'
        }}>
          <Badge
            count={`${hsCount} hs`}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--cyan)',
              border: '1px solid rgba(0,212,255,0.2)', fontSize: '8px', height: '14px', lineHeight: '12px',
            }}
          />
          {hasAudio && (
            <span style={{ fontSize: 8, padding: '1px 3px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(108,99,255,0.2)', color: 'var(--purple)', borderRadius: 3 }}>
              <Icon name="Volume2" size="sm" />
            </span>
          )}
        </div>

        {/* Keyframe diamonds */}
        {keyframesCount > 0 && (
          <div style={{
            position: 'absolute', top: '5px', right: '5px', display: 'flex', gap: 2,
            opacity: isHovered ? 0 : 1, pointerEvents: isHovered ? 'none' : 'auto',
            transition: 'opacity 0.15s ease-in-out'
          }}>
            {Array.from({ length: Math.min(3, keyframesCount) }).map((_, kIdx) => (
              <div key={kIdx} style={{ width: 5, height: 5, background: 'var(--amber)', transform: 'rotate(45deg)', boxShadow: '0 0 4px var(--amber)' }} />
            ))}
          </div>
        )}

        {/* Drag handle */}
        <div className="drag-handle-indicator" style={{
          position: 'absolute', bottom: '5px', right: '5px',
          background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '2px 4px',
          cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border)',
          opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none',
          transition: 'opacity 0.15s ease-in-out'
        }}>
          <Icon name="Move" style={{ color: 'rgba(255,255,255,0.7)' }} size="sm" />
        </div>

        {/* Duration editor */}
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: '5px', left: '5px',
          background: 'rgba(0,0,0,0.65)', borderRadius: '4px', padding: '2px 4px',
          display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--border)',
          opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none',
          transition: 'opacity 0.15s ease-in-out'
        }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>⏱</span>
          <InputNumber
            size="small" min={1} max={60} controls={false} value={sceneDur}
            onChange={val => onSceneDurationChange(scene.id, val)}
            style={{ width: '24px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 9, height: 12, padding: 0 }}
          />
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>s</span>
        </div>

        {/* Delete button */}
        <div className="timeline-delete-btn" onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', top: '5px', right: '5px',
          opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none',
          transition: 'opacity 0.15s ease-in-out', zIndex: 20
        }}>
          <Button
            size="small" danger icon={<Icon name="Trash2" size="sm" />}
            onClick={handleDeleteClick}
            style={{ width: '18px', height: '18px', minWidth: '18px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,77,109,0.15)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: '3px', color: 'var(--red)' }}
          />
        </div>
      </div>

      {/* Bottom label */}
      <div style={{
        height: '22px', background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', padding: '0 8px', justifyContent: 'space-between', borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 600,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '90px',
        }}>
          {scene.name || 'Untitled Room'}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>#{index + 1}</div>
      </div>
    </div>
  );
});

// ─── Transition connector (only rendered for visible items) ───────────────────
const TransitionConnector = memo(function TransitionConnector({ scene, onTransitionChange }) {
  return (
    <Popover
      title={<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>TRANSITION TO {scene.name.toUpperCase()}</span>}
      content={
        <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>EFFECT STYLE</div>
            <Select
              size="small" value={scene.transitionEffect || 'fade'}
              onChange={val => onTransitionChange(scene.id, 'transitionEffect', val)}
              style={{ width: '100%' }}
              dropdownStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <Option value="fade">Cross-Fade</Option>
              <Option value="zoom">Warp Zoom</Option>
            </Select>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
              <span>DURATION</span>
              <span style={{ color: 'var(--cyan)' }}>{scene.transitionDuration !== undefined ? scene.transitionDuration : 0.5}s</span>
            </div>
            <Slider
              min={0.1} max={2.5} step={0.05}
              value={scene.transitionDuration !== undefined ? scene.transitionDuration : 0.5}
              onChange={val => onTransitionChange(scene.id, 'transitionDuration', val)}
            />
          </div>
        </div>
      }
      trigger="click" placement="top"
    >
      <Tooltip title="Configure Scene Transition">
        <div
          style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            color: scene.transitionEffect === 'zoom' ? 'var(--cyan)' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', margin: '0 4px', fontSize: 10, transition: 'all 0.2s', zIndex: 10
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 8px var(--accent-glow)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          ⧓
        </div>
      </Tooltip>
    </Popover>
  );
});

// ─── Main SceneTimeline ───────────────────────────────────────────────────────
export default function SceneTimeline({
  scenes = [],
  currentSceneId,
  onSelectScene,
  onReorderScenes,
  onTriggerSingleUpload,
  onDeleteScene,
  tour,
  onTourUpdate,
  isPlaying = false,
  currentStep = 0,
  editMode = true
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);

  // ─── Virtual scroll — zero-rerender-per-pixel ───────────────────────────
  // Same pattern as sidebar: only setWindowStart when the visible window actually shifts.
  // React re-renders happen at most once per CARD_SLOT_WIDTH (~170px) of horizontal scroll.
  const trackRef        = useRef(null);
  const scrollLeftRef   = useRef(0);
  const [windowStart, setWindowStart]     = useState(0);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let lastW = el.clientWidth || 1200;
    setContainerWidth(lastW);
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect?.width || 0);
      if (w > 0 && w !== lastW) { lastW = w; setContainerWidth(w); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleTrackScroll = useCallback((e) => {
    const sl = e.currentTarget.scrollLeft;
    scrollLeftRef.current = sl;
    const rawStart = sl > CARD_WIDTH ? Math.floor((sl - CARD_WIDTH) / CARD_SLOT_WIDTH) + 1 : 0;
    const newStart = Math.max(0, rawStart - TIMELINE_OVERSCAN);
    setWindowStart(prev => (prev !== newStart ? newStart : prev));
  }, []);

  // ─── Virtual window computation (uses windowStart, not scrollLeft state) ────
  const totalCount   = scenes.length;
  const totalWidth   = totalCount > 0 ? CARD_WIDTH + (totalCount - 1) * CARD_SLOT_WIDTH : 0;
  const startIdx     = windowStart;
  const visibleCount = Math.ceil(containerWidth / CARD_SLOT_WIDTH) + 1;
  const endIdx       = Math.min(totalCount, startIdx + visibleCount + TIMELINE_OVERSCAN * 2);

  // Left offset of startIdx card
  const leftOffset = startIdx === 0 ? 0 : CARD_WIDTH + (startIdx - 1) * CARD_SLOT_WIDTH;

  // ─── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
    const dragImg = new Image();
    dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    if (e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(dragImg, 0, 0);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  }, [draggedIndex]);

  const handleDragLeave  = useCallback(() => { setDragOverIndex(null); }, []);
  const handleDragEnd    = useCallback(() => { setDraggedIndex(null); setDragOverIndex(null); }, []);

  const handleDrop = useCallback((e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex || sourceIndex < 0 || sourceIndex >= scenes.length) return;
    const reordered = [...scenes];
    const [movedScene] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedScene);
    if (onReorderScenes) onReorderScenes(reordered);
  }, [scenes, onReorderScenes]);

  const handleSceneDurationChange = useCallback((sceneId, duration) => {
    const updated = scenes.map(s => s.id === sceneId ? { ...s, duration } : s);
    onTourUpdate({ ...tour, scenes: updated });
  }, [scenes, tour, onTourUpdate]);

  const handleTransitionChange = useCallback((sceneId, field, value) => {
    const updated = scenes.map(s => s.id === sceneId ? { ...s, [field]: value } : s);
    onTourUpdate({ ...tour, scenes: updated });
  }, [scenes, tour, onTourUpdate]);

  const handleMouseEnter = useCallback((id) => setHoveredCardId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredCardId(null), []);

  const keyframesMap = useMemo(() => {
    const map = new Map();
    (tour?.keyframes || []).forEach(k => {
      map.set(k.sceneId, (map.get(k.sceneId) || 0) + 1);
    });
    return map;
  }, [tour?.keyframes]);

  return (
    <div
      style={{
        height: '110px', flexShrink: 0,
        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px',
        zIndex: 5, overflowX: 'hidden', userSelect: 'none', position: 'relative'
      }}
    >
      {/* Sequencer playhead */}
      {isPlaying && scenes.length > 0 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: 110 + currentStep * CARD_SLOT_WIDTH + 65,
          width: '2px',
          background: 'linear-gradient(to bottom, var(--accent), var(--cyan))',
          boxShadow: '0 0 8px var(--accent-glow)', zIndex: 100,
          pointerEvents: 'none', transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ position: 'absolute', top: -4, left: -4, width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }} />
        </div>
      )}

      {/* Label */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        borderRight: '1px solid var(--border)', paddingRight: '16px', height: '70%', minWidth: '100px',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '11px', color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Sequencer
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'} total
        </span>
      </div>

      {/* ── Virtualized track ────────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        onScroll={handleTrackScroll}
        style={{
          display: 'flex', alignItems: 'center',
          flex: 1, overflowX: 'auto', height: '100%', padding: '4px 0',
        }}
        className="custom-timeline-scroll"
      >
        {/* Full-width virtual container so the scrollbar thumb is correctly sized */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', width: totalWidth + 160, flexShrink: 0 }}>
          {/* Left spacer for virtual offset */}
          {leftOffset > 0 && <div style={{ width: leftOffset, flexShrink: 0 }} />}

          {scenes.slice(startIdx, endIdx).map((scene, localI) => {
            const globalIndex = startIdx + localI;
            const isActive    = scene.id === currentSceneId;
            const isDragged   = draggedIndex === globalIndex;
            const isDragOver  = dragOverIndex === globalIndex;
            const isHovered   = editMode && hoveredCardId === scene.id;
            const keyframesCount = keyframesMap.get(scene.id) || 0;
            const renderConnector = editMode && globalIndex > 0;

            return (
              <React.Fragment key={scene.id}>
                {renderConnector && (
                  <TransitionConnector
                    scene={scene}
                    onTransitionChange={handleTransitionChange}
                  />
                )}
                <TimelineCard
                  scene={scene}
                  index={globalIndex}
                  isActive={isActive}
                  isDragged={isDragged}
                  isDragOver={isDragOver}
                  isHovered={isHovered}
                  keyframesCount={keyframesCount}
                  editMode={editMode}
                  onSelectScene={onSelectScene}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onSceneDurationChange={handleSceneDurationChange}
                  onDeleteScene={onDeleteScene}
                />
              </React.Fragment>
            );
          })}

          {/* Right spacer: keeps total div width correct beyond visible items */}
          {endIdx < totalCount && (
            <div style={{ width: (totalCount - endIdx) * CARD_SLOT_WIDTH, flexShrink: 0 }} />
          )}

          {/* Add Scene button — always at the end */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px' }} />
            <Tooltip title="Add Single Scene Image">
              <div
                onClick={onTriggerSingleUpload}
                style={{
                  width: '130px', height: '78px', borderRadius: 'var(--radius-sm)',
                  border: '2px dashed var(--border)', background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '6px',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <Icon name="Plus" size="lg" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Add Scene</span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
