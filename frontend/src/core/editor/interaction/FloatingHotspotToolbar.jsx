import React from 'react';
import { Select, Input, Button, Tooltip, Space, Slider, Checkbox, Switch } from 'antd';
import Icon from '../../../components/common/Icon';

const { Option } = Select;

const PRESET_COLORS = [
  '#6366f1', // Accent Purple
  '#06b6d4', // Cyber Cyan
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Link
  '#f43f5e'  // Ruby Red
];

const ICON_OPTIONS = [
  { value: 'arrow', label: 'Arrow', iconName: 'ArrowRight' },
  { value: 'arrow-up', label: 'Up', iconName: 'ArrowUp' },
  { value: 'arrow-down', label: 'Down', iconName: 'ArrowDown' },
  { value: 'info', label: 'Info', iconName: 'Info' },
  { value: 'link', label: 'Link', iconName: 'Link2' },
  { value: 'video', label: 'Video', iconName: 'Video' },
  { value: 'star', label: 'Star', iconName: 'Star' },
  { value: 'circle', label: 'Circle', iconName: 'Circle' },
  { value: 'stairs', label: 'Stairs', iconName: 'FaStairs' },
  { value: 'door', label: 'Door', iconName: 'FaDoorClosed' },
  { value: 'sound', label: 'Sound', iconName: 'Volume2' },
  { value: 'eye', label: 'Eye', iconName: 'Eye' },
];

const ANIMATION_OPTIONS = [
  { value: 'none', label: 'Static' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'glow', label: 'Glow' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'spin', label: 'Spin' }
];

export default function FloatingHotspotToolbar({
  hotspot,
  selectedHotspots = [], // Passed for multi-select bulk operations
  x,
  y,
  scenes,
  currentSceneId,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  onSelectSceneVisually,
  snapSettings,
  onSnapSettingsChange,
  onBulkUpdate,
  onBulkDelete
}) {
  const isMulti = selectedHotspots.length > 1;
  const activeHotspot = hotspot || selectedHotspots[0];

  if (!activeHotspot) return null;

  const handleColorSelect = (color) => {
    if (isMulti) {
      onBulkUpdate({ color });
    } else {
      onUpdate({ ...activeHotspot, color });
    }
  };

  const handleIconSelect = (icon) => {
    if (isMulti) {
      onBulkUpdate({ icon });
    } else {
      onUpdate({ ...activeHotspot, icon });
    }
  };

  const handleTooltipChange = (e) => {
    if (isMulti) {
      onBulkUpdate({ tooltip: e.target.value });
    } else {
      onUpdate({ ...activeHotspot, tooltip: e.target.value });
    }
  };

  const handleSceneLink = (targetScene) => {
    if (isMulti) {
      onBulkUpdate({ type: 'navigation', targetScene });
    } else {
      onUpdate({ ...activeHotspot, type: 'navigation', targetScene });
    }
  };

  const handleToggleLock = () => {
    if (isMulti) {
      const allLocked = selectedHotspots.every(h => h.locked);
      onBulkUpdate({ locked: !allLocked });
    } else {
      onUpdate({ ...activeHotspot, locked: !activeHotspot.locked });
    }
  };

  const handleToggleVisibility = () => {
    if (isMulti) {
      const allAlwaysVisible = selectedHotspots.every(h => h.alwaysVisible);
      onBulkUpdate({ alwaysVisible: !allAlwaysVisible });
    } else {
      onUpdate({ ...activeHotspot, alwaysVisible: !activeHotspot.alwaysVisible });
    }
  };

  const handleSizeChange = (size) => {
    if (isMulti) {
      onBulkUpdate({ size });
    } else {
      onUpdate({ ...activeHotspot, size });
    }
  };

  const handleAnimChange = (animation) => {
    if (isMulti) {
      onBulkUpdate({ animation });
    } else {
      onUpdate({ ...activeHotspot, animation });
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + 45, 
        transform: 'translateX(-50%)',
        zIndex: 2500,
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-lg), 0 0 32px var(--accent-glow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '340px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      {/* Row 1: Header / Multi-Select Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--accent-bright)', fontWeight: 700, letterSpacing: '0.06em' }}>
          {isMulti 
            ? `BULK OPERATIONS (${selectedHotspots.length} HOTSPOTS)` 
            : `HOTSPOT PROPERTIES (${activeHotspot.id})`}
        </span>
        <Button
          size="small"
          type="text"
          icon={<Icon name="X" size="sm" style={{ color: 'var(--text-muted)' }} />}
          onClick={onClose}
          style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </div>

      {/* Row 2: Lock, Always Visible, Color Presets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {/* Lock & Visibility switches */}
        <Space size={6}>
          <Tooltip title={activeHotspot.locked ? 'Unlock Position' : 'Lock Position'}>
            <Button
              size="small"
              onClick={handleToggleLock}
              icon={activeHotspot.locked ? <Icon name="Lock" size="sm" style={{ color: 'var(--red)' }} /> : <Icon name="Unlock" size="sm" style={{ color: 'var(--text-muted)' }} />}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
          </Tooltip>
          <Tooltip title={activeHotspot.alwaysVisible ? 'Hide Label Hover Default' : 'Label Always Visible'}>
            <Button
              size="small"
              onClick={handleToggleVisibility}
              icon={activeHotspot.alwaysVisible ? <Icon name="Eye" size="sm" style={{ color: 'var(--green)' }} /> : <Icon name="EyeOff" size="sm" style={{ color: 'var(--text-muted)' }} />}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
          </Tooltip>
        </Space>

        {/* Color Presets */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => handleColorSelect(c)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: c,
                cursor: 'pointer',
                border: activeHotspot.color === c ? '2px solid #fff' : '2px solid transparent',
                boxShadow: activeHotspot.color === c ? `0 0 8px ${c}` : 'none',
                transition: 'all 0.15s'
              }}
            />
          ))}
        </div>
      </div>

      {/* Row 3: Icons & Animation presets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>GLYPH ICON</div>
          <Select
            value={activeHotspot.icon || 'arrow'}
            onChange={handleIconSelect}
            size="small"
            style={{ width: '100%' }}
            dropdownStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
          >
            {ICON_OPTIONS.map(opt => (
              <Option key={opt.value} value={opt.value}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name={opt.iconName} size="xs" />
                  <span>{opt.label}</span>
                </div>
              </Option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>ANIMATION STYLE</div>
          <Select
            value={activeHotspot.animation || 'none'}
            onChange={handleAnimChange}
            size="small"
            style={{ width: '100%' }}
            dropdownStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
          >
            {ANIMATION_OPTIONS.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
        </div>
      </div>

      {/* Row 4: Sizing Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
          <span>HOTSPOT DIAMETER</span>
          <span style={{ color: 'var(--cyan)' }}>{activeHotspot.size || 40}px</span>
        </div>
        <Slider
          min={20}
          max={90}
          value={activeHotspot.size || 40}
          onChange={handleSizeChange}
          tooltip={{ formatter: val => `${val}px` }}
          style={{ margin: '4px 0 8px' }}
        />
      </div>

      {/* Row 5: Tooltip Inline Editor */}
      <div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>TOOLTIP TEXT</div>
        <Input
          value={activeHotspot.tooltip || ''}
          onChange={handleTooltipChange}
          placeholder={isMulti ? 'Change tooltip for all selected...' : 'Enter tooltip label...'}
          size="small"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '12px'
          }}
        />
      </div>

      {/* Row 6: Connected Scene Link */}
      <div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>DESTINATION SCENE LINK</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Select
            value={activeHotspot.targetScene || undefined}
            onChange={handleSceneLink}
            placeholder="Select target room..."
            size="small"
            style={{ flex: 1 }}
            dropdownStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
            allowClear
          >
            {scenes
              .filter((s) => s.id !== currentSceneId)
              .map((s) => (
                <Option key={s.id} value={s.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="ArrowRight" size="xs" style={{ color: 'var(--accent)' }} />
                    <span>{s.name || s.id}</span>
                  </div>
                </Option>
              ))}
          </Select>

          {!isMulti && onSelectSceneVisually && activeHotspot.type === 'navigation' && (
            <Tooltip title="Link scene visually">
              <Button
                size="small"
                icon={<Icon name="Target" size="sm" />}
                onClick={() => onSelectSceneVisually(activeHotspot)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)' }}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Snapping Controls */}
      {snapSettings && onSnapSettingsChange && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.04em', fontWeight: 600 }}>
            LAYOUT SNAPPING ENGINE
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Checkbox 
              checked={snapSettings.gridSnap} 
              onChange={e => onSnapSettingsChange({ ...snapSettings, gridSnap: e.target.checked })}
              style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
            >
              Grid (15°)
            </Checkbox>
            <Checkbox 
              checked={snapSettings.magneticSnap} 
              onChange={e => onSnapSettingsChange({ ...snapSettings, magneticSnap: e.target.checked })}
              style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
            >
              Magnetic
            </Checkbox>
            <Checkbox 
              checked={snapSettings.horizonSnap} 
              onChange={e => onSnapSettingsChange({ ...snapSettings, horizonSnap: e.target.checked })}
              style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
            >
              Horizon Lock
            </Checkbox>
          </div>
        </div>
      )}

      {/* Action Row: Duplicate / Delete */}
      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '8px', justifyContent: 'flex-end' }}>
        {!isMulti && (
          <Tooltip title="Duplicate Hotspot">
            <Button
              size="small"
              icon={<Icon name="Copy" size="sm" />}
              onClick={() => onDuplicate(activeHotspot)}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)' }}
            >
              Duplicate
            </Button>
          </Tooltip>
        )}
        <Button
          size="small"
          danger
          icon={<Icon name="Trash2" size="sm" />}
          onClick={() => {
            if (isMulti) {
              onBulkDelete();
            } else {
              onDelete(activeHotspot.id);
            }
          }}
          style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--red)', borderRadius: 'var(--radius-sm)' }}
        >
          Delete {isMulti ? `(${selectedHotspots.length})` : ''}
        </Button>
      </div>
    </div>
  );
}
