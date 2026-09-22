import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Button, Tooltip, message, Upload, Input } from 'antd';
import Icon from '../common/Icon';
import { v4 as uuidv4 } from 'uuid';
import { uploadImage } from '../../features/editor/services/upload.service';
import SceneListItem from './scenes/SceneListItem';
import FolderSection from './scenes/FolderSection';
import { getImageUrl } from '../../services/http/httpClient';

// ─── Virtualization constants ──────────────────────────────────────────────────
// Each scene card slot = thumbnail(76) + padding(16) + name(20) + ID(14) + margin(8) = 134px.
// Round up to 136px for a clean slot.
const SIDEBAR_ITEM_HEIGHT = 136; // px per scene card slot
const SIDEBAR_OVERSCAN    = 3;   // extra cards above/below viewport

const ScenesSidebar = memo(function ScenesSidebar({
  scenes = [],
  currentSceneId,
  tourId,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  onTourUpdate,
  tour,
  onReorderScenes
}) {
  const [search, setSearch]                     = useState('');
  const [filterType, setFilterType]             = useState('all');
  const [folders, setFolders]                   = useState({});
  const [expandedFolders, setExpandedFolders]   = useState({});
  const [contextMenu, setContextMenu]           = useState({ visible: false, x: 0, y: 0, sceneId: null });
  const [renamingSceneId, setRenamingSceneId]   = useState(null);
  const [renamingName, setRenamingName]         = useState('');

  // ─── Virtual scroll — zero-rerender-per-pixel approach ─────────────────────
  // KEY INSIGHT: only trigger a React re-render when the *window* of visible items
  // changes (i.e., a new card enters or leaves the viewport). This means React
  // re-renders happen at most once per SIDEBAR_ITEM_HEIGHT pixels of scrolling
  // (~136px) instead of once per pixel. Scroll is silky-smooth.
  const listRef         = useRef(null);
  const scrollTopRef    = useRef(0);
  const [windowStart, setWindowStart] = useState(0); // index of first rendered card
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure container height once; only update if it actually changes.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let lastH = el.clientHeight || 600;
    setContainerHeight(lastH);
    const ro = new ResizeObserver(entries => {
      const h = Math.round(entries[0]?.contentRect?.height || 0);
      if (h > 0 && h !== lastH) { lastH = h; setContainerHeight(h); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    const st  = e.currentTarget.scrollTop;
    scrollTopRef.current = st;
    // Only the start index matters for deciding what to render.
    const newStart = Math.max(0, Math.floor(st / SIDEBAR_ITEM_HEIGHT) - SIDEBAR_OVERSCAN);
    // setWindowStart only if the window actually shifts — avoids per-pixel re-renders.
    setWindowStart(prev => (prev !== newStart ? newStart : prev));
  }, []);

  // ─── Folder sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tour?.folders && typeof tour.folders === 'object') {
      setFolders(tour.folders);
      setExpandedFolders(prev => {
        const exp = { ...prev };
        Object.keys(tour.folders).forEach(f => {
          if (exp[f] === undefined) exp[f] = true;
        });
        return exp;
      });
      try { localStorage.removeItem(`tour_folders_${tourId}`); } catch {}
    } else if (tour && (tour.folders === undefined || tour.folders === null)) {
      const cached = localStorage.getItem(`tour_folders_${tourId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setFolders(parsed);
            const exp = {};
            Object.keys(parsed).forEach(f => { exp[f] = true; });
            setExpandedFolders(exp);
          }
        } catch (e) { console.error('Error loading virtual folders:', e); }
      }
    }
  }, [tour?.folders, tourId]);

  const saveFolders = useCallback((newFolders) => {
    setFolders(newFolders);
    if (onTourUpdate && tour) {
      onTourUpdate({ ...tour, folders: newFolders });
    }
    try { localStorage.removeItem(`tour_folders_${tourId}`); } catch {}
  }, [onTourUpdate, tour, tourId]);

  const handleUploadAndAddScene = useCallback(async (file) => {
    try {
      const result = await uploadImage(tourId, file);
      const newScene = {
        id: `scene_${uuidv4().slice(0, 8)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        image: result.url,
        preview: result.previewUrl || result.url,
        thumbnail: result.thumbnailUrl || result.url,
        hotspots: [],
      };
      onAddScene(newScene);
      message.success(`Scene "${newScene.name}" added`);
    } catch (err) {
      message.error('Upload failed: ' + (err.response?.data?.error || err.message));
    }
    return false;
  }, [tourId, onAddScene]);

  const handleCreateFolder = useCallback(() => {
    const folderName = prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;
    const name = folderName.trim();
    if (folders[name]) { message.error('Folder already exists'); return; }
    saveFolders({ ...(folders || {}), [name]: [] });
    setExpandedFolders(prev => ({ ...prev, [name]: true }));
    message.success(`Folder "${name}" created`);
  }, [folders, saveFolders]);

  const handleRemoveFolder = useCallback((folderName) => {
    const nf = { ...(folders || {}) };
    delete nf[folderName];
    saveFolders(nf);
    message.info(`Folder "${folderName}" deleted`);
  }, [folders, saveFolders]);

  const handleMoveSceneToFolder = useCallback((sceneId, folderName) => {
    const nf = { ...(folders || {}) };
    Object.keys(nf).forEach(f => {
      nf[f] = Array.isArray(nf[f]) ? nf[f].filter(id => id !== sceneId) : [];
    });
    if (folderName) {
      if (!Array.isArray(nf[folderName])) nf[folderName] = [];
      if (!nf[folderName].includes(sceneId)) nf[folderName].push(sceneId);
    }
    saveFolders(nf);
    message.success('Scene moved');
  }, [folders, saveFolders]);

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, index, sceneId) => {
    e.dataTransfer.setData('text/sidebar-scene-index', index);
    e.dataTransfer.setData('text/sidebar-scene-id', sceneId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const handleDropOnScene = useCallback((e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/sidebar-scene-index'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex || sourceIndex < 0 || sourceIndex >= scenes.length) return;
    const reordered = [...scenes];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    if (onReorderScenes) onReorderScenes(reordered);
  }, [scenes, onReorderScenes]);

  const handleDropOnFolder = useCallback((e, folderName) => {
    e.preventDefault();
    const sceneId = e.dataTransfer.getData('text/sidebar-scene-id');
    if (!sceneId) return;
    handleMoveSceneToFolder(sceneId, folderName);
  }, [handleMoveSceneToFolder]);

  // ─── Context Menu ─────────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e, sceneId) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, sceneId });
  }, []);

  useEffect(() => {
    const hide = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', hide);
    return () => window.removeEventListener('click', hide);
  }, []);

  // ─── Scene actions ────────────────────────────────────────────────────────────
  const handleDuplicateScene = useCallback((sceneId) => {
    const original = scenes.find(s => s.id === sceneId);
    if (!original) return;
    onAddScene({
      ...original,
      id: `scene_${uuidv4().slice(0, 8)}`,
      name: `${original.name} (Copy)`,
      hotspots: (original.hotspots || []).map(h => ({ ...h, id: `hs_${uuidv4().slice(0, 8)}` }))
    });
    message.success(`Duplicated "${original.name}"`);
  }, [scenes, onAddScene]);

  const handleCopyScene = useCallback((sceneId) => {
    const original = scenes.find(s => s.id === sceneId);
    if (!original) return;
    localStorage.setItem('copied_scene_clipboard', JSON.stringify(original));
    message.success(`Copied "${original.name}" to clipboard`);
  }, [scenes]);

  const handlePasteScene = useCallback(() => {
    const cached = localStorage.getItem('copied_scene_clipboard');
    if (!cached) { message.error('No scene copied to clipboard'); return; }
    try {
      const original = JSON.parse(cached);
      onAddScene({
        ...original,
        id: `scene_${uuidv4().slice(0, 8)}`,
        name: `${original.name} (Pasted)`,
        hotspots: (original.hotspots || []).map(h => ({ ...h, id: `hs_${uuidv4().slice(0, 8)}` }))
      });
      message.success('Pasted scene successfully');
    } catch { message.error('Failed to paste scene'); }
  }, [onAddScene]);

  const handleRenameInit = useCallback((sceneId, currentName) => {
    setRenamingSceneId(sceneId);
    setRenamingName(currentName || '');
  }, []);

  const handleRenameSave = useCallback((sceneId) => {
    if (!renamingName.trim()) { setRenamingSceneId(null); return; }
    const updated = scenes.map(s => s.id === sceneId ? { ...s, name: renamingName.trim() } : s);
    onTourUpdate({ ...tour, scenes: updated });
    setRenamingSceneId(null);
    message.success('Scene renamed');
  }, [renamingName, scenes, onTourUpdate, tour]);

  const handleMakeStart = useCallback((id) => {
    onTourUpdate({ ...tour, startScene: id });
  }, [onTourUpdate, tour]);

  // ─── Filtering & Folder separation (memoized) ─────────────────────────────────
  const filteredScenes = useMemo(() => {
    const query = search.toLowerCase();
    return scenes.filter(s => {
      const matchesSearch = !search || (s.name || '').toLowerCase().includes(query) || s.id.includes(query);
      if (!matchesSearch) return false;
      if (filterType === 'audio') return s.ambientAudio || s.narrationAudio || (s.hotspots || []).some(h => h.type === 'audio');
      if (filterType === 'hotspots') return (s.hotspots || []).length > 0;
      return true;
    });
  }, [scenes, search, filterType]);

  const folderSceneIds = useMemo(() =>
    Object.values(folders || {}).filter(Array.isArray).flat()
  , [folders]);

  const ungroupedScenes = useMemo(() =>
    filteredScenes.filter(s => !folderSceneIds.includes(s.id))
  , [filteredScenes, folderSceneIds]);

  // ─── Stable memoized scene metadata lookup ────────────────────────────────────
  // Pre-compute per-scene derived data into a stable Map so SceneListItem only
  // receives numbers/strings/booleans — never object refs.
  const sceneMeta = useMemo(() => {
    const map = new Map();
    scenes.forEach(s => {
      map.set(s.id, {
        title: s.name || 'Untitled Room',
        thumbnailUrl: (s.thumbnail || s.image) ? getImageUrl(s.thumbnail || s.image) : null,
        sceneDisplayId: s.id,
        hsCount: s.hotspots?.length || 0,
        hasAudio: !!(s.ambientAudio || s.narrationAudio || (s.hotspots || []).some(h => h.type === 'audio')),
      });
    });
    return map;
  }, [scenes]);

  const keyframesMap = useMemo(() => {
    const map = new Map();
    (tour?.keyframes || []).forEach(k => {
      map.set(k.sceneId, (map.get(k.sceneId) || 0) + 1);
    });
    return map;
  }, [tour?.keyframes]);

  const startSceneId = tour?.startScene;

  // ─── Virtual windowing ────────────────────────────────────────────────
  const totalUngrouped = ungroupedScenes.length;
  const totalHeight    = totalUngrouped * SIDEBAR_ITEM_HEIGHT;
  const visibleCount   = Math.ceil(containerHeight / SIDEBAR_ITEM_HEIGHT);
  // windowStart was already computed in handleScroll (no scrollTop state needed)
  const startIdx       = windowStart;
  const endIdx         = Math.min(totalUngrouped, startIdx + visibleCount + SIDEBAR_OVERSCAN * 2 + 1);
  const visibleScenes  = ungroupedScenes.slice(startIdx, endIdx);

  // ─── renderSceneItem — only passes primitive props to SceneListItem ───────────
  const renderSceneItem = useCallback((scene, listIndex) => {
    const meta = sceneMeta.get(scene.id) || {};
    return (
      <SceneListItem
        key={scene.id}
        sceneId={scene.id}
        index={listIndex}
        title={meta.title}
        thumbnailUrl={meta.thumbnailUrl}
        sceneDisplayId={meta.sceneDisplayId}
        isActive={scene.id === currentSceneId}
        isStart={scene.id === startSceneId}
        isRenaming={renamingSceneId === scene.id}
        renamingName={renamingName}
        hsCount={meta.hsCount}
        hasAudio={meta.hasAudio}
        keyframesCount={keyframesMap.get(scene.id) || 0}
        setRenamingName={setRenamingName}
        onRenameSave={handleRenameSave}
        onSelectScene={onSelectScene}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDropOnScene={handleDropOnScene}
        onContextMenu={handleContextMenu}
      />
    );
  }, [
    sceneMeta, currentSceneId, startSceneId, renamingSceneId, renamingName,
    keyframesMap, handleRenameSave, onSelectScene,
    handleDragStart, handleDragOver, handleDropOnScene, handleContextMenu
  ]);

  const hasCopiedScene = !!localStorage.getItem('copied_scene_clipboard');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: 'var(--bg-secondary)',
      userSelect: 'none'
    }}>
      {/* Search and Filters */}
      <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Input
          placeholder="Search rooms..."
          size="small"
          prefix={<Icon name="Search" size="sm" style={{ color: 'var(--text-muted)' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { value: 'all', label: 'All Rooms' },
            { value: 'audio', label: 'Audio' },
            { value: 'hotspots', label: 'Hotspots' }
          ].map(f => (
            <Button
              key={f.value}
              size="small"
              onClick={() => setFilterType(f.value)}
              style={{
                fontSize: 10, fontWeight: filterType === f.value ? 700 : 500,
                padding: '2px 10px', height: 22, borderRadius: 'var(--radius-full)',
                background: filterType === f.value ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: filterType === f.value ? '#ffffff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: '8px 10px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Upload beforeUpload={handleUploadAndAddScene} showUploadList={false} accept="image/*" style={{ flex: 1 }}>
          <Button
            icon={<Icon name="Plus" size="sm" />} size="small" block
            style={{
              background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
              color: 'var(--accent-bright)', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)'
            }}
          >
            Add Room
          </Button>
        </Upload>
        <Button
          icon={<Icon name="FolderOpen" size="sm" />} size="small" onClick={handleCreateFolder}
          style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, borderRadius: 'var(--radius-sm)'
          }}
        >
          Folder
        </Button>
        {hasCopiedScene && (
          <Tooltip title="Paste Copied Scene">
            <Button
              icon={<Icon name="ClipboardPaste" size="sm" />} size="small"
              onClick={handlePasteScene}
              style={{
                background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,0.3)',
                color: 'var(--green)', borderRadius: 'var(--radius-sm)'
              }}
            />
          </Tooltip>
        )}
      </div>

      {/* Scene count indicator */}
      <div style={{ padding: '4px 10px', flexShrink: 0, fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
        {scenes.length} {scenes.length === 1 ? 'ROOM' : 'ROOMS'} TOTAL
      </div>

      {/* ── Main scrolling viewport ─────────────────────────────────────────── */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}
      >
        {scenes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
            <Icon name="Image" size="lg" style={{ marginBottom: 8, display: 'block', color: 'var(--text-disabled)', margin: '0 auto' }} />
            No rooms added yet. Click "Add Room" or use "Bulk Import" to get started.
          </div>
        )}

        {/* Folder sections — rendered in full (folders typically have few scenes each) */}
        {Object.keys(folders).map(folderName => {
          const isExpanded = expandedFolders[folderName];
          const folderSceneIdsList = folders[folderName] || [];
          const matchedScenes = filteredScenes.filter(s => folderSceneIdsList.includes(s.id));
          return (
            <FolderSection
              key={folderName}
              folderName={folderName}
              isExpanded={isExpanded}
              matchedScenes={matchedScenes}
              onToggleExpand={() => setExpandedFolders(prev => ({ ...prev, [folderName]: !isExpanded }))}
              onRemoveFolder={handleRemoveFolder}
              onDragOver={handleDragOver}
              onDropOnFolder={handleDropOnFolder}
              renderSceneItem={renderSceneItem}
            />
          );
        })}

        {/* Ungrouped Scenes — VIRTUALIZED with absolute positioning */}
        {totalUngrouped > 0 && (
          <div style={{ marginTop: Object.keys(folders).length > 0 ? 12 : 0 }}>
            {Object.keys(folders).length > 0 && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 4px 6px', letterSpacing: '0.05em' }}>
                UNGROUPED ROOMS
              </div>
            )}
            {/*
              Virtual list container:
              - position:relative + exact totalHeight = correct scrollbar
              - each card is position:absolute at its exact pixel offset
              - NO spacer divs = NO layout shift during scroll
              - React only re-mounts cards that enter/leave the overscan window
            */}
            <div style={{ position: 'relative', height: totalHeight }}>
              {visibleScenes.map((scene, i) => {
                const globalIndex = startIdx + i;
                return (
                  <div
                    key={scene.id}
                    style={{
                      position: 'absolute',
                      top: globalIndex * SIDEBAR_ITEM_HEIGHT,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {renderSceneItem(scene, globalIndex)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            zIndex: 5000, background: 'var(--bg-panel)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)', width: 180, padding: '4px 0'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handleRenameInit(contextMenu.sceneId, scenes.find(s => s.id === contextMenu.sceneId)?.name)} style={contextMenuItemStyle}>
            <Icon name="Pencil" size="sm" style={{ marginRight: 8 }} /> Rename Room
          </div>
          <div className="context-menu-item" onClick={() => handleDuplicateScene(contextMenu.sceneId)} style={contextMenuItemStyle}>
            <Icon name="Copy" size="sm" style={{ marginRight: 8 }} /> Duplicate
          </div>
          <div className="context-menu-item" onClick={() => handleCopyScene(contextMenu.sceneId)} style={contextMenuItemStyle}>
            <Icon name="Copy" size="sm" style={{ marginRight: 8 }} /> Copy Config
          </div>
          <div className="context-menu-item" onClick={() => handleMakeStart(contextMenu.sceneId)} style={contextMenuItemStyle}>
            <Icon name="Check" size="sm" style={{ marginRight: 8, color: 'var(--green)' }} /> Make Start Scene
          </div>
          <div className="context-menu-item" onClick={() => handleMoveSceneToFolder(contextMenu.sceneId, null)} style={contextMenuItemStyle}>
            <Icon name="Folder" size="sm" style={{ marginRight: 8 }} /> Move to Root
          </div>
          {/* Show Move to Folder submenu items */}
          {Object.keys(folders).length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {Object.keys(folders).map(fname => (
                <div key={fname} className="context-menu-item" onClick={() => handleMoveSceneToFolder(contextMenu.sceneId, fname)} style={{ ...contextMenuItemStyle, paddingLeft: 20 }}>
                  <Icon name="FolderOpen" size="sm" style={{ marginRight: 8 }} /> → {fname}
                </div>
              ))}
            </>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <div className="context-menu-item" onClick={() => onDeleteScene(contextMenu.sceneId)} style={{ ...contextMenuItemStyle, color: 'var(--red)' }}>
            <Icon name="Trash2" size="sm" style={{ marginRight: 8 }} /> Delete Room
          </div>
        </div>
      )}

      <style>{`
        .scene-sidebar-card:hover {
          border-color: var(--border-hover) !important;
          transform: translateY(-1px);
        }
        .context-menu-item {
          padding: 8px 12px;
          font-size: 11.5px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
        }
        .context-menu-item:hover {
          background: var(--accent-dim);
          color: var(--accent-bright);
        }
      `}</style>
    </div>
  );
});

const contextMenuItemStyle = {
  padding: '6px 12px',
  fontSize: '11.5px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  color: 'var(--text-secondary)',
  transition: 'all 0.12s'
};

export default ScenesSidebar;
