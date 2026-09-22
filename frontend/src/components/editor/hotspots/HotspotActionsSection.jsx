import React, { useState } from 'react';
import { Form, Input, Select, Button, Tooltip, Switch, Radio } from 'antd';
import Icon from '../../common/Icon';
import MediaUrlPicker from '../../common/MediaUrlPicker';
import { TYPE_OPTIONS, EVENT_PRESETS, labelStyle } from './hotspotConstants';
import HotspotActionListEditor from './HotspotActionListEditor';

const { Option } = Select;

export default function HotspotActionsSection({
  form,
  currentType,
  setCurrentType,
  scenes = [],
  currentSceneId,
  currentScene,
  hotspot,
  onSelectSceneVisually,
  handleChange,
  matchesQuery,
  viewerRef,
  onTestAction
}) {
  const [actionMode, setActionMode] = useState(hotspot?.actions?.length > 0 ? 'advanced' : 'basic');

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={labelStyle}>ACTION MODE</span>
        <Radio.Group
          size="small"
          value={actionMode}
          onChange={(e) => setActionMode(e.target.value)}
          buttonStyle="solid"
        >
          <Radio.Button value="basic" style={{ fontSize: 10 }}>Basic</Radio.Button>
          <Radio.Button value="advanced" style={{ fontSize: 10 }}>Action Chain</Radio.Button>
        </Radio.Group>
      </div>

      {actionMode === 'advanced' ? (
        <div style={{ marginBottom: 14 }}>
          <HotspotActionListEditor
            hotspot={hotspot}
            scenes={scenes}
            currentSceneId={currentSceneId}
            currentScene={currentScene}
            onChange={handleChange}
            viewerRef={viewerRef}
            onTestAction={onTestAction}
          />
        </div>
      ) : (
        <>
          {matchesQuery("HOTSPOT TYPE", ["type", "mode"]) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>HOTSPOT TYPE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                {TYPE_OPTIONS.map(t => (
                  <div
                    key={t.value}
                    onClick={() => {
                      form.setFieldValue('type', t.value);
                      setCurrentType(t.value);
                      handleChange({ type: t.value });
                    }}
                    style={{
                      padding: '6px 4px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${currentType === t.value ? t.color : 'var(--border)'}`,
                      background: currentType === t.value ? `${t.color}1a` : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      fontSize: 10, color: currentType === t.value ? t.color : 'var(--text-muted)',
                      fontWeight: currentType === t.value ? 700 : 500,
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.icon}
                    <span style={{ fontSize: 9 }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchesQuery("TOOLTIP TEXT", ["tooltip", "label", "text"]) && (
            <Form.Item name="tooltip" label={<span style={labelStyle}>TOOLTIP TEXT</span>} style={{ marginBottom: 10 }}>
              <Input placeholder="Label shown on hover..." style={{ fontSize: 12 }} />
            </Form.Item>
          )}

          {currentType === 'navigation' && matchesQuery("TARGET SCENE", ["target", "destination", "scene", "room"]) && (
            <Form.Item label={<span style={labelStyle}>TARGET SCENE</span>} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Form.Item name="targetScene" noStyle>
                  <Select placeholder="Select destination scene" allowClear style={{ flex: 1 }}>
                    {scenes.filter(s => s.id !== currentSceneId).map(s => (
                      <Option key={s.id} value={s.id}>{s.name || s.id}</Option>
                    ))}
                  </Select>
                </Form.Item>
                {onSelectSceneVisually && (
                  <Tooltip title="Link scene visually">
                    <Button
                      icon={<Icon name="Link2" size="sm" />}
                      onClick={() => onSelectSceneVisually(hotspot)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                    />
                  </Tooltip>
                )}
              </div>
            </Form.Item>
          )}

          {currentType === 'link' && matchesQuery("URL", ["url", "link"]) && (
            <Form.Item name="linkUrl" label={<span style={labelStyle}>URL</span>} style={{ marginBottom: 10 }}>
              <Input placeholder="https://..." prefix={<Icon name="Globe" style={{ color: 'var(--text-muted)' }} size="sm" />} />
            </Form.Item>
          )}

          {currentType === 'video' && matchesQuery("VIDEO SOURCE", ["video", "source", "mp4", "vimeo", "youtube"]) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...labelStyle, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="Video" style={{ color: 'var(--red)' }} size="sm" /> VIDEO SOURCE
              </div>
              <MediaUrlPicker
                value={form.getFieldValue('linkUrl') || ''}
                onChange={v => { form.setFieldValue('linkUrl', v); handleChange({ linkUrl: v }); }}
                accept="video/*,audio/*"
                placeholder="https://youtube.com/... or /uploads/video.mp4"
                accentColor="var(--red)"
                uploadLabel="Upload Video"
              />
            </div>
          )}

          {currentType === 'action' && matchesQuery("ACTION PARAMETER", ["parameter", "action", "param"]) && (
            <Form.Item name="actionParam" label={<span style={labelStyle}>ACTION PARAMETER</span>} style={{ marginBottom: 10 }}>
              <Input placeholder="e.g. show-info-panel or custom-event-name" />
            </Form.Item>
          )}

          {matchesQuery("ON CLICK", ["click", "event"]) && (
            <Form.Item name="onClickAction" label={<span style={labelStyle}>ON CLICK BEHAVIOR</span>} style={{ marginBottom: 8 }}>
              <Select size="small" style={{ fontSize: 11 }}>
                <Option value="">— None —</Option>
                {EVENT_PRESETS.map(e => <Option key={e.value} value={e.value}>{e.label}</Option>)}
              </Select>
            </Form.Item>
          )}
        </>
      )}

      {/* Group Identifier */}
      <Form.Item label={<span style={labelStyle}>HOTSPOT GROUP (OPTIONAL)</span>} style={{ marginBottom: 8 }}>
        <Input
          placeholder="e.g. Living Room Features"
          value={hotspot?.group || ''}
          onChange={e => handleChange({ group: e.target.value })}
          style={{ fontSize: 12 }}
        />
      </Form.Item>
    </>
  );
}
