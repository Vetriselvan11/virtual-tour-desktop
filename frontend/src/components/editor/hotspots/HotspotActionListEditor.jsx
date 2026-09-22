import React, { useState } from 'react';
import { Button, Select, Input, InputNumber, Tooltip, Tag, message } from 'antd';
import Icon from '../../../components/common/Icon';
import MediaUrlPicker from '../../../components/common/MediaUrlPicker';
import { labelStyle } from './hotspotConstants';

const { Option } = Select;

const ACTION_TYPES = [
  { value: 'sceneNavigate', label: 'Scene Navigation', icon: 'Compass', color: '#6366f1', desc: 'Jump to another room or scene' },
  { value: 'cameraMove', label: 'Camera Movement', icon: 'Camera', color: '#ec4899', desc: 'Smoothly pan, tilt, or zoom camera' },
  { value: 'lookAt', label: '3D Look-At Target', icon: 'Crosshair', color: '#06b6d4', desc: 'Aim camera at 3D coordinate or hotspot' },
  { value: 'openInfo', label: 'Open Information', icon: 'Info', color: '#3b82f6', desc: 'Display title & description popup' },
  { value: 'openMedia', label: 'Open Media / Video', icon: 'Film', color: '#e11d48', desc: 'Show image gallery or video player' },
  { value: 'openUrl', label: 'External Website', icon: 'ExternalLink', color: '#10b981', desc: 'Open web link in a new tab' },
  { value: 'playAudio', label: 'Play Audio / Sound', icon: 'Volume2', color: '#f59e0b', desc: 'Trigger ambient sound or voiceover' },
  { value: 'pauseAudio', label: 'Pause Audio', icon: 'VolumeX', color: '#f59e0b', desc: 'Pause active audio' },
  { value: 'stopAudio', label: 'Stop Audio', icon: 'Square', color: '#f59e0b', desc: 'Stop audio playback' },
  { value: 'showHotspot', label: 'Show Another Hotspot', icon: 'Eye', color: '#8b5cf6', desc: 'Make target hotspot or group visible' },
  { value: 'hideHotspot', label: 'Hide Another Hotspot', icon: 'EyeOff', color: '#8b5cf6', desc: 'Hide target hotspot or group' },
  { value: 'toggleHotspot', label: 'Toggle Hotspot Visibility', icon: 'Shuffle', color: '#8b5cf6', desc: 'Toggle visibility state' },
  { value: 'startCinematic', label: 'Start Cinematic Tour', icon: 'PlayCircle', color: '#f43f5e', desc: 'Trigger cinematic timeline sequence' },
  { value: 'stopCinematic', label: 'Stop Cinematic Tour', icon: 'StopCircle', color: '#f43f5e', desc: 'Stop cinematic playback' },
  { value: 'customEvent', label: 'Custom App Event', icon: 'Zap', color: '#eab308', desc: 'Emit internal event to listeners' }
];

const TRIGGER_OPTIONS = [
  { value: 'click', label: 'On Click', color: 'blue' },
  { value: 'hover', label: 'On Hover', color: 'cyan' },
  { value: 'enterView', label: 'On Enter View', color: 'purple' },
  { value: 'timeline', label: 'Timeline Cue', color: 'gold' },
  { value: 'manual', label: 'Manual / Triggered', color: 'default' }
];

const EASING_OPTIONS = [
  { value: 'power2.inOut', label: 'Smooth (Default)' },
  { value: 'power3.inOut', label: 'Cinematic Dynamic' },
  { value: 'linear', label: 'Linear Speed' },
  { value: 'sine.inOut', label: 'Gentle Sine' },
  { value: 'back.inOut', label: 'Dynamic Overshoot' },
  { value: 'bounce.out', label: 'Elastic Bounce' }
];

export default function HotspotActionListEditor({
  hotspot,
  scenes = [],
  currentSceneId,
  currentScene,
  onChange,
  viewerRef,
  onTestAction
}) {
  const actions = Array.isArray(hotspot?.actions) ? hotspot.actions : [];

  const handleAddAction = (type = 'sceneNavigate') => {
    const newAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trigger: 'click',
      type,
      delay: 0,
      duration: 1.5,
      easing: 'power2.inOut'
    };

    if (type === 'sceneNavigate') {
      const otherScene = scenes.find(s => s.id !== currentSceneId);
      newAction.targetScene = otherScene ? otherScene.id : '';
    } else if (type === 'cameraMove') {
      if (viewerRef?.current) {
        newAction.yaw = viewerRef.current.getYaw ? viewerRef.current.getYaw() : (viewerRef.current.targetTheta || 0);
        newAction.pitch = viewerRef.current.getPitch ? viewerRef.current.getPitch() : (Math.PI / 2 - (viewerRef.current.targetPhi || Math.PI / 2));
        newAction.fov = viewerRef.current.camera?.fov || 80;
      }
    } else if (type === 'openInfo') {
      newAction.title = hotspot?.title || hotspot?.tooltip || 'Information';
      newAction.description = hotspot?.description || '';
    }

    const nextActions = [...actions, newAction];
    onChange({ actions: nextActions });
    message.success(`Added action: ${type}`);
  };

  const handleUpdateAction = (index, updates) => {
    const nextActions = actions.map((act, i) => (i === index ? { ...act, ...updates } : act));
    onChange({ actions: nextActions });
  };

  const handleDeleteAction = (index) => {
    const nextActions = actions.filter((_, i) => i !== index);
    onChange({ actions: nextActions });
  };

  const handleDuplicateAction = (index) => {
    const target = actions[index];
    if (!target) return;
    const duplicated = {
      ...JSON.parse(JSON.stringify(target)),
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    };
    const nextActions = [...actions];
    nextActions.splice(index + 1, 0, duplicated);
    onChange({ actions: nextActions });
    message.success('Action duplicated');
  };

  const handleMoveAction = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= actions.length) return;
    const nextActions = [...actions];
    const item = nextActions.splice(index, 1)[0];
    nextActions.splice(targetIdx, 0, item);
    onChange({ actions: nextActions });
  };

  const handleCaptureViewForAction = (index) => {
    if (!viewerRef?.current) {
      message.warning('Viewer not ready to capture camera angle.');
      return;
    }
    const viewer = viewerRef.current;
    const yaw = viewer.getYaw ? viewer.getYaw() : (viewer.targetTheta || 0);
    const pitch = viewer.getPitch ? viewer.getPitch() : (Math.PI / 2 - (viewer.targetPhi || Math.PI / 2));
    const fov = viewer.camera?.fov || viewer.fov || 80;

    handleUpdateAction(index, { yaw, pitch, fov });
    message.success('Captured camera angle from current view!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={labelStyle}>PROGRAMMABLE ACTIONS ({actions.length})</div>
        {onTestAction && actions.length > 0 && (
          <Button
            size="small"
            type="primary"
            icon={<Icon name="Play" size="xs" />}
            onClick={() => onTestAction(hotspot)}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-bright))',
              borderColor: 'transparent',
              fontSize: 10,
              fontWeight: 600,
              height: 24
            }}
          >
            Test Actions
          </Button>
        )}
      </div>

      {actions.length === 0 ? (
        <div style={{
          padding: '14px', textAlign: 'center', background: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            No programmable actions attached yet.
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="small" type="dashed" onClick={() => handleAddAction('sceneNavigate')} style={{ fontSize: 10 }}>
              + Scene Navigate
            </Button>
            <Button size="small" type="dashed" onClick={() => handleAddAction('cameraMove')} style={{ fontSize: 10 }}>
              + Camera Move
            </Button>
            <Button size="small" type="dashed" onClick={() => handleAddAction('openInfo')} style={{ fontSize: 10 }}>
              + Open Info
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((act, idx) => {
            const typeConfig = ACTION_TYPES.find(t => t.value === act.type) || ACTION_TYPES[0];
            const trigConfig = TRIGGER_OPTIONS.find(t => t.value === act.trigger) || TRIGGER_OPTIONS[0];

            return (
              <div
                key={act.id || idx}
                style={{
                  background: 'rgba(23, 8, 13, 0.85)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Header with Sequence #, Trigger, Type, and Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: typeConfig.color || 'var(--accent)',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {idx + 1}
                    </div>
                    <Tag color={trigConfig.color} style={{ fontSize: 9, padding: '0 4px', margin: 0 }}>
                      {trigConfig.label}
                    </Tag>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {typeConfig.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      size="small" type="text" icon={<Icon name="ChevronUp" size="xs" />}
                      disabled={idx === 0} onClick={() => handleMoveAction(idx, -1)}
                      style={{ padding: '0 2px', height: 18, color: 'var(--text-muted)' }}
                    />
                    <Button
                      size="small" type="text" icon={<Icon name="ChevronDown" size="xs" />}
                      disabled={idx === actions.length - 1} onClick={() => handleMoveAction(idx, 1)}
                      style={{ padding: '0 2px', height: 18, color: 'var(--text-muted)' }}
                    />
                    <Button
                      size="small" type="text" icon={<Icon name="Copy" size="xs" />}
                      onClick={() => handleDuplicateAction(idx)}
                      style={{ padding: '0 2px', height: 18, color: 'var(--text-muted)' }}
                    />
                    <Button
                      size="small" type="text" icon={<Icon name="Trash2" size="xs" />}
                      onClick={() => handleDeleteAction(idx)}
                      style={{ padding: '0 2px', height: 18, color: 'var(--red)' }}
                    />
                  </div>
                </div>

                {/* Trigger & Action Type Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TRIGGER</div>
                    <Select
                      size="small"
                      value={act.trigger || 'click'}
                      onChange={(trigger) => handleUpdateAction(idx, { trigger })}
                      style={{ width: '100%', fontSize: 11 }}
                    >
                      {TRIGGER_OPTIONS.map(t => (
                        <Option key={t.value} value={t.value}>{t.label}</Option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>ACTION TYPE</div>
                    <Select
                      size="small"
                      value={act.type || 'sceneNavigate'}
                      onChange={(type) => handleUpdateAction(idx, { type })}
                      style={{ width: '100%', fontSize: 11 }}
                    >
                      {ACTION_TYPES.map(t => (
                        <Option key={t.value} value={t.value}>{t.label}</Option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* ── Sub-forms based on Action Type ── */}
                {act.type === 'sceneNavigate' && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TARGET SCENE</div>
                    <Select
                      size="small"
                      placeholder="Select destination scene"
                      value={act.targetScene}
                      onChange={(targetScene) => handleUpdateAction(idx, { targetScene })}
                      style={{ width: '100%', fontSize: 11 }}
                    >
                      {scenes.filter(s => s.id !== currentSceneId).map(s => (
                        <Option key={s.id} value={s.id}>{s.name || s.id}</Option>
                      ))}
                    </Select>
                  </div>
                )}

                {act.type === 'cameraMove' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>YAW (°)</div>
                        <InputNumber
                          size="small"
                          value={act.yaw !== undefined ? parseFloat(((act.yaw * 180) / Math.PI).toFixed(1)) : 0}
                          onChange={(v) => handleUpdateAction(idx, { yaw: (v * Math.PI) / 180 })}
                          style={{ width: '100%', fontSize: 10 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PITCH (°)</div>
                        <InputNumber
                          size="small"
                          value={act.pitch !== undefined ? parseFloat(((act.pitch * 180) / Math.PI).toFixed(1)) : 0}
                          onChange={(v) => handleUpdateAction(idx, { pitch: (v * Math.PI) / 180 })}
                          style={{ width: '100%', fontSize: 10 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>FOV (°)</div>
                        <InputNumber
                          size="small"
                          value={act.fov || 80}
                          onChange={(fov) => handleUpdateAction(idx, { fov })}
                          style={{ width: '100%', fontSize: 10 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>DURATION (s)</div>
                        <InputNumber
                          size="small" min={0.1} max={15} step={0.5}
                          value={act.duration || 1.5}
                          onChange={(duration) => handleUpdateAction(idx, { duration })}
                          style={{ width: '100%', fontSize: 10 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>EASING</div>
                        <Select
                          size="small"
                          value={act.easing || 'power2.inOut'}
                          onChange={(easing) => handleUpdateAction(idx, { easing })}
                          style={{ width: '100%', fontSize: 10 }}
                        >
                          {EASING_OPTIONS.map(e => <Option key={e.value} value={e.value}>{e.label}</Option>)}
                        </Select>
                      </div>
                    </div>

                    <Button
                      size="small"
                      icon={<Icon name="Camera" size="xs" />}
                      onClick={() => handleCaptureViewForAction(idx)}
                      style={{ fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent-bright)', borderColor: 'var(--accent)' }}
                    >
                      Capture Current View
                    </Button>
                  </div>
                )}

                {act.type === 'lookAt' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                    {currentScene?.hotspots && currentScene.hotspots.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>AIM AT HOTSPOT</div>
                        <Select
                          size="small"
                          placeholder="Select hotspot to look at..."
                          style={{ width: '100%', fontSize: 11 }}
                          onChange={(hsId) => {
                            const hs = currentScene.hotspots.find(h => h.id === hsId);
                            if (hs) {
                              handleUpdateAction(idx, { yaw: hs.yaw, pitch: hs.pitch });
                            }
                          }}
                        >
                          {currentScene.hotspots.filter(h => h.id !== hotspot?.id).map((hs, i) => (
                            <Option key={hs.id || i} value={hs.id}>{hs.title || hs.tooltip || `Hotspot #${i + 1}`}</Option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {act.type === 'openInfo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    <Input
                      size="small"
                      placeholder="Info Title..."
                      value={act.title}
                      onChange={(e) => handleUpdateAction(idx, { title: e.target.value })}
                      style={{ fontSize: 11 }}
                    />
                    <Input.TextArea
                      rows={2}
                      placeholder="Info Description / Message..."
                      value={act.description}
                      onChange={(e) => handleUpdateAction(idx, { description: e.target.value })}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                )}

                {act.type === 'openMedia' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    <MediaUrlPicker
                      value={act.mediaUrl || act.url || ''}
                      onChange={(mediaUrl) => handleUpdateAction(idx, { mediaUrl })}
                      accept="image/*,video/*"
                      placeholder="https://... image or video URL"
                      uploadLabel="Upload Media"
                    />
                  </div>
                )}

                {act.type === 'openUrl' && (
                  <div style={{ marginBottom: 6 }}>
                    <Input
                      size="small"
                      placeholder="https://example.com"
                      value={act.url || act.linkUrl}
                      onChange={(e) => handleUpdateAction(idx, { url: e.target.value })}
                      prefix={<Icon name="ExternalLink" size="xs" style={{ color: 'var(--text-muted)' }} />}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                )}

                {act.type === 'playAudio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    <MediaUrlPicker
                      value={act.audioUrl || act.url || ''}
                      onChange={(audioUrl) => handleUpdateAction(idx, { audioUrl })}
                      accept="audio/*"
                      placeholder="Audio MP3 / WAV URL..."
                      uploadLabel="Upload Sound"
                    />
                  </div>
                )}

                {(act.type === 'showHotspot' || act.type === 'hideHotspot' || act.type === 'toggleHotspot') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>TARGET HOTSPOT</div>
                      <Select
                        size="small"
                        placeholder="Select target hotspot..."
                        value={act.targetHotspotId}
                        onChange={(targetHotspotId) => handleUpdateAction(idx, { targetHotspotId })}
                        allowClear
                        style={{ width: '100%', fontSize: 11 }}
                      >
                        {(currentScene?.hotspots || []).filter(h => h.id !== hotspot?.id).map((h, i) => (
                          <Option key={h.id || i} value={h.id}>{h.title || h.tooltip || `Hotspot #${i + 1}`}</Option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>OR TARGET GROUP NAME</div>
                      <Input
                        size="small"
                        placeholder="e.g. Room Lighting"
                        value={act.targetGroup}
                        onChange={(e) => handleUpdateAction(idx, { targetGroup: e.target.value })}
                        style={{ fontSize: 11 }}
                      />
                    </div>
                  </div>
                )}

                {act.type === 'customEvent' && (
                  <div style={{ marginBottom: 6 }}>
                    <Input
                      size="small"
                      placeholder="event-name (e.g. open-floorplan)"
                      value={act.eventName}
                      onChange={(e) => handleUpdateAction(idx, { eventName: e.target.value })}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                )}

                {/* Delay configuration */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>EXECUTION DELAY:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <InputNumber
                      size="small" min={0} max={30} step={0.5}
                      value={act.delay || 0}
                      onChange={(delay) => handleUpdateAction(idx, { delay: delay || 0 })}
                      style={{ width: 64, fontSize: 10 }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>sec</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Action Bar */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <Select
          size="small"
          placeholder="+ Add New Action..."
          style={{ flex: 1, fontSize: 11 }}
          onChange={(type) => handleAddAction(type)}
          value={null}
        >
          {ACTION_TYPES.map(t => (
            <Option key={t.value} value={t.value}>
              + {t.label}
            </Option>
          ))}
        </Select>
      </div>
    </div>
  );
}
