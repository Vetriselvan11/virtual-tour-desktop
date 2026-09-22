import React from 'react';
import { Button, Tooltip, Space, Input, Tag, Switch, Dropdown } from 'antd';
import Icon from '../../../components/common/Icon';
import brandLogo from '../../../assets/logo.png';

/**
 * Ultra-Premium Studio Topbar for WoX BUILDER.
 * Unified header workspace controls, modes swapping, and bulk folder uploading triggers.
 */
export default function EditorTopbar({
  tour,
  currentScene,
  titleEditing,
  tempTitle,
  setTempTitle,
  setTitleEditing,
  onTitleSave,
  onOpenTourSettings,
  editMode,
  setEditMode,
  autoRotate,
  setAutoRotate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  saving,
  syncStatus,
  manualDraftMode,
  onToggleManualDraftMode,
  onReload,
  onExportZip,
  onExportVideo,
  onToggleFloorplan,
  showFloorplanEditor,
  onTriggerBulkUpload,
  onTabSwitch,
  onOpenPublish,
  onOpenSceneGraph,
  onTriggerAnalyze,
  navigate
}) {
  return (
    <div style={{
      height: 52, flexShrink: 0,
      background: 'var(--bg-panel)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 14,
      zIndex: 10,
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Left Area - Navigation & Title */}
      <Space size={10}>
        <Button
          size="small"
          icon={<Icon name="ArrowLeft" size="sm" />}
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)'
          }}
        />
        <img 
          src={brandLogo} 
          alt="WoX BUILDER Logo" 
          style={{ height: 26, width: 'auto', maxWidth: 130, objectFit: 'contain', display: 'block' }} 
        />
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        
        {titleEditing ? (
          <Input
            autoFocus
            value={tempTitle}
            onChange={e => setTempTitle(e.target.value)}
            onBlur={onTitleSave}
            onPressEnter={onTitleSave}
            style={{ width: 220, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700 }}
          />
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
            onClick={() => { setTempTitle(tour.title); setTitleEditing(true); }}
          >
            <span>{tour.title}</span>
            <Icon name="Pencil" size="xs" style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {onOpenTourSettings && (
          <Tooltip title="Tour Branding & Client Logo Settings">
            <Button
              size="small"
              icon={<Icon name="Settings" size="xs" />}
              onClick={onOpenTourSettings}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--accent-bright)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 26,
                padding: '0 8px',
                fontSize: 11,
                gap: 4
              }}
            >
              <span>Branding</span>
            </Button>
          </Tooltip>
        )}
      </Space>

      {/* Center Area - Mode Toggle Capsule & Current Scene Tag */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{
          display: 'flex', gap: 3,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-full)',
          padding: 3,
        }}>
          <div
            onClick={() => setEditMode(true)}
            style={{
              padding: '4px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: 11,
              background: editMode ? 'var(--accent)' : 'transparent',
              color: editMode ? '#ffffff' : 'var(--text-muted)',
              fontWeight: editMode ? 700 : 500,
              boxShadow: editMode ? '0 2px 8px var(--accent-glow)' : 'none',
              transition: 'all 0.18s ease',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Icon name="Pencil" size="xs" />
            <span>Edit Mode</span>
          </div>
          <div
            onClick={() => setEditMode(false)}
            style={{
              padding: '4px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: 11,
              background: !editMode ? 'var(--accent)' : 'transparent',
              color: !editMode ? '#ffffff' : 'var(--text-muted)',
              fontWeight: !editMode ? 700 : 500,
              boxShadow: !editMode ? '0 2px 8px var(--accent-glow)' : 'none',
              transition: 'all 0.18s ease',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Icon name="Eye" size="xs" />
            <span>Preview</span>
          </div>
        </div>

        {currentScene && (
          <Tag style={{
            background: 'var(--cyan-dim)', border: '1px solid rgba(6,182,212,0.25)',
            color: 'var(--cyan)', margin: 0, fontSize: 11, fontWeight: 600,
            borderRadius: 'var(--radius-full)', padding: '2px 10px'
          }}>
            Scene: {currentScene.name || currentScene.id}
          </Tag>
        )}
      </div>

      {/* Right Area - Workspace Utilities */}
      <Space size={8}>
        {/* Bulk Upload trigger */}
        <Tooltip title="Bulk Import Panoramas (Upload Folder)">
          <Button
            icon={<Icon name="FolderOpen" size="sm" />}
            onClick={onTriggerBulkUpload}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--green)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>

        {/* Audio Panel shortcut */}
        {onTabSwitch && (
          <Tooltip title="Narration & Ambient Audio Mixer">
            <Button
              icon={<Icon name="Volume2" size="sm" />}
              onClick={() => onTabSwitch('audio')}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--accent-bright)',
                height: 32, width: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            />
          </Tooltip>
        )}

        {/* Timeline Panel shortcut */}
        {onTabSwitch && (
          <Tooltip title="Cinematic Keyframe Sequencer">
            <Button
              icon={<Icon name="Video" size="sm" />}
              onClick={() => onTabSwitch('timeline')}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--amber)',
                height: 32, width: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            />
          </Tooltip>
        )}

        {/* AI Intelligence shortcut */}
        {onTabSwitch && (
          <Tooltip title="AI Intelligence & Room Recognition">
            <Button
              icon={<Icon name="Sparkles" size="sm" />}
              onClick={() => onTabSwitch('ai')}
              style={{
                background: 'rgba(108, 99, 255, 0.12)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                color: 'var(--accent-bright)',
                height: 32, width: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            />
          </Tooltip>
        )}

        {/* Scene Graph Modal shortcut */}
        {onOpenSceneGraph && (
          <Tooltip title="Scene Relationship & Navigation Graph">
            <Button
              icon={<Icon name="Network" size="sm" />}
              onClick={onOpenSceneGraph}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--cyan)',
                height: 32, width: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            />
          </Tooltip>
        )}

        {/* Floorplan toggler */}
        <Tooltip title="Floorplan Blueprint Editor">
          <Button
            icon={<Icon name="Target" size="sm" />}
            onClick={onToggleFloorplan}
            style={{
              background: showFloorplanEditor ? 'var(--cyan-dim)' : 'var(--bg-tertiary)',
              border: `1px solid ${showFloorplanEditor ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
              color: showFloorplanEditor ? 'var(--cyan)' : 'var(--text-secondary)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>

        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

        {/* Undo/Redo actions */}
        <Tooltip title="Undo">
          <Button
            icon={<Icon name="Undo2" size="sm" />}
            disabled={!canUndo}
            onClick={onUndo}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: canUndo ? 'var(--text-secondary)' : 'var(--text-disabled)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            icon={<Icon name="Redo2" size="sm" />}
            disabled={!canRedo}
            onClick={onRedo}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: canRedo ? 'var(--text-secondary)' : 'var(--text-disabled)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>

        {/* Auto-rotation toggle */}
        <Tooltip title={autoRotate ? 'Stop Auto-rotation' : 'Start Auto-rotation'}>
          <Button
            icon={autoRotate ? <Icon name="Pause" size="sm" /> : <Icon name="Play" size="sm" />}
            onClick={() => setAutoRotate(a => !a)}
            style={{
              background: autoRotate ? 'var(--green-dim)' : 'var(--bg-tertiary)',
              border: `1px solid ${autoRotate ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              color: autoRotate ? 'var(--green)' : 'var(--text-muted)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>
        
        {/* Discard & Reload */}
        <Tooltip title="Discard unsaved changes & reload">
          <Button
            icon={<Icon name="RefreshCw" size="sm" />}
            onClick={onReload}
            style={{
              background: 'var(--red-dim)',
              border: '1px solid rgba(244,63,94,0.25)',
              color: 'var(--red)',
              height: 32, width: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          />
        </Tooltip>

        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

        {/* Open Viewer & Export Build */}
        <Button
          icon={<Icon name="ExternalLink" size="sm" />}
          onClick={() => {
            const targetId = tour?.id || tour?._id;
            if (targetId) {
              window.open(`/viewer/${targetId}`, '_blank');
            } else {
              message.warning('Tour data is still loading, please wait a moment.');
            }
          }}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            height: 32,
            borderRadius: 'var(--radius-sm)',
            fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          Open Viewer
        </Button>

        <Dropdown
          menu={{
            items: [
              {
                key: 'zip',
                label: 'Package Offline ZIP',
                icon: <Icon name="FaBoxOpen" size="sm" />,
                onClick: onExportZip
              },
              {
                key: 'video',
                label: 'Record Video (.webm)',
                icon: <Icon name="Video" size="sm" />,
                onClick: onExportVideo
              }
            ]
          }}
          placement="bottomRight"
        >
          <Button
            icon={<Icon name="Download" size="sm" />}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            Export
          </Button>
        </Dropdown>

        {/* Publish Live Button */}
        {onOpenPublish && (
          <Button
            icon={<Icon name="Upload" size="sm" />}
            onClick={onOpenPublish}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px var(--accent-glow)'
            }}
          >
            <span>Publish</span>
            {tour?.published && tour?.latestVersionNumber ? (
              <span style={{
                marginLeft: 4, background: 'rgba(255,255,255,0.2)', padding: '1px 5px',
                borderRadius: 4, fontSize: 10
              }}>
                v{tour.latestVersionNumber}
              </span>
            ) : null}
          </Button>
        )}

        {/* Unified Save Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-full)',
          height: 32,
          padding: '0 12px',
          fontSize: 11
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Draft Mode</span>
            <Switch
              size="small"
              checked={manualDraftMode}
              onChange={onToggleManualDraftMode}
            />
          </div>
          
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          {manualDraftMode ? (
            <Button
              type="text"
              size="small"
              icon={<Icon name="Save" size="sm" style={{ color: 'var(--accent)' }} />}
              loading={saving}
              onClick={onSave}
              style={{
                padding: '0 4px',
                height: 22,
                fontSize: 11,
                color: 'var(--accent-bright)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Save
            </Button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncStatus === 'saving' && (
                <>
                  <Icon name="RefreshCw" size="xs" style={{ color: 'var(--amber)', animation: 'spin 1.5s linear infinite' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Saving...</span>
                </>
              )}
              {syncStatus === 'saved' && (
                <>
                  <Icon name="Check" size="xs" style={{ color: 'var(--green)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Saved</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <Icon name="AlertTriangle" size="xs" style={{ color: 'var(--red)' }} />
                  <span style={{ color: 'var(--red)', fontWeight: 600 }}>Failed</span>
                </>
              )}
            </div>
          )}
        </div>
      </Space>
    </div>
  );
}
