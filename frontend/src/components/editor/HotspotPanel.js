import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Collapse, message } from 'antd';
import Icon from '../common/Icon';
import { API_BASE } from '../../config/api';
import HotspotLayoutSection from './hotspots/HotspotLayoutSection';
import HotspotActionsSection from './hotspots/HotspotActionsSection';
import HotspotAudioSection from './hotspots/HotspotAudioSection';
import HotspotAppearanceSection from './hotspots/HotspotAppearanceSection';
import HotspotAnimationSection from './hotspots/HotspotAnimationSection';

import HotspotActionEngine from '../../core/hotspots/HotspotActionEngine';

const { Panel } = Collapse;

export default function HotspotPanel({
  hotspot,
  scenes = [],
  currentSceneId,
  currentScene,
  onUpdate,
  onDelete,
  onSelectSceneVisually,
  onSceneUpdate,
  viewerRef,
  onTestAction
}) {
  const [form] = Form.useForm();
  const [currentType, setCurrentType] = useState('navigation');
  const [currentColor, setCurrentColor] = useState('#6366f1');
  const [animType, setAnimType] = useState('pulse');
  const [iconMode, setIconMode] = useState('preset'); // 'preset' | 'custom'
  const [customUploading, setCustomUploading] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePanels, setActivePanels] = useState(['layout', 'actions', 'audio', 'styling', 'advanced']);

  useEffect(() => {
    if (hotspot) {
      const hasCustom = !!hotspot.customIcon || hotspot.icon === 'custom';
      setIconMode(hasCustom ? 'custom' : 'preset');
      setCustomUrlInput(hotspot.customIcon || '');

      form.setFieldsValue({
        tooltip: hotspot.tooltip || '',
        type: hotspot.type || 'navigation',
        targetScene: hotspot.targetScene || null,
        color: hotspot.color || '#6366f1',
        size: hotspot.size || 40,
        icon: hotspot.icon || 'arrow',
        customIcon: hotspot.customIcon || '',
        iconStyle: hotspot.iconStyle || 'badge',
        opacity: hotspot.opacity !== undefined ? hotspot.opacity : 1,
        linkUrl: hotspot.linkUrl || '',
        animationType: hotspot.animationType || 'pulse',
        showLabel: hotspot.showLabel !== false,
        alwaysVisible: hotspot.alwaysVisible || false,
        audioUrl: hotspot.audioUrl || '',
        audioLoop: hotspot.audioLoop !== false,
        onClickAction: hotspot.events?.onClick || 'navigate',
        onHoverAction: hotspot.events?.onHover || '',
        actionParam: hotspot.actionParam || '',
        easing: hotspot.easing || 'Power1.out',
        startTime: hotspot.startTime !== undefined ? hotspot.startTime : 0,
        endTime: hotspot.endTime !== undefined ? hotspot.endTime : 60,
        volume: hotspot.volume !== undefined ? hotspot.volume : 0.5,
      });
      setCurrentType(hotspot.type || 'navigation');
      setCurrentColor(hotspot.color || '#6366f1');
      setAnimType(hotspot.animationType || 'pulse');
    }
  }, [hotspot, form]);

  useEffect(() => {
    if (searchQuery) {
      setActivePanels(['layout', 'actions', 'audio', 'styling', 'advanced']);
    }
  }, [searchQuery]);

  const handleCustomUpload = async (file) => {
    setCustomUploading(true);

    // Read local data URL first for instant zero-latency visual update
    const reader = new FileReader();
    reader.onload = (e) => {
      const localDataUrl = e.target?.result;
      if (localDataUrl) {
        form.setFieldsValue({ customIcon: localDataUrl, icon: 'custom' });
        setCustomUrlInput(localDataUrl);
        handleChange({ customIcon: localDataUrl, icon: 'custom' });
      }
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('icon', file);
    try {
      let resp = await fetch(`${API_BASE}/api/tours/upload-icon`, { method: 'POST', body: formData });
      if (!resp.ok && resp.status === 404) {
        // Fallback to generic upload if server has not been restarted
        const fallbackForm = new FormData();
        fallbackForm.append('image', file);
        resp = await fetch(`${API_BASE}/api/upload/icons`, { method: 'POST', body: fallbackForm });
      }

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.url) {
          form.setFieldsValue({ customIcon: data.url, icon: 'custom' });
          setCustomUrlInput(data.url);
          handleChange({ customIcon: data.url, icon: 'custom' });
        }
      }
      message.success('Custom icon loaded & applied!');
    } catch (err) {
      console.warn('Server icon upload notice, used local data URL:', err.message);
      message.success('Custom icon applied locally!');
    } finally {
      setCustomUploading(false);
    }
    return false;
  };

  const applyCustomUrl = (url) => {
    const trimmed = (url || '').trim();
    setCustomUrlInput(trimmed);
    form.setFieldsValue({ customIcon: trimmed, icon: trimmed ? 'custom' : 'arrow' });
    handleChange({ customIcon: trimmed, icon: trimmed ? 'custom' : 'arrow' });
    if (trimmed) {
      message.success('Custom icon URL applied!');
    }
  };

  const handleSelectQuickPick = (svgData) => {
    setCustomUrlInput(svgData);
    form.setFieldsValue({ customIcon: svgData, icon: 'custom' });
    handleChange({ customIcon: svgData, icon: 'custom' });
    message.success('Icon applied!');
  };

  const clearCustomIcon = () => {
    setCustomUrlInput('');
    setIconMode('preset');
    form.setFieldsValue({ customIcon: '', icon: 'arrow' });
    handleChange({ customIcon: '', icon: 'arrow' });
  };

  const handleChange = (changed) => {
    if (!hotspot) return;
    const values = form.getFieldsValue();
    const merged = { ...hotspot, ...values, ...changed };
    if (changed.onClickAction !== undefined || changed.onHoverAction !== undefined) {
      merged.events = {
        onClick: merged.onClickAction || '',
        onHover: merged.onHoverAction || '',
      };
    }
    onUpdate(merged);
  };

  const handleTestAction = (hs) => {
    if (onTestAction) {
      onTestAction(hs);
      return;
    }
    const engine = new HotspotActionEngine({
      viewerCore: viewerRef?.current,
      onOpenInfo: (info) => message.info(`[Info Preview]: ${info.title} - ${info.description}`),
      onOpenMedia: (media) => message.info(`[Media Preview]: ${media.title} (${media.mediaUrl})`),
      onCustomEvent: (evt) => message.info(`[Custom Event]: ${evt}`)
    });
    engine.triggerHotspot(hs, 'click');
    message.success('Testing hotspot action chain...');
  };

  if (!hotspot) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{
          padding: 24, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
          border: '1px dashed var(--border)',
        }}>
          <Icon name="Link2" size="lg" style={{ color: 'var(--text-muted)', marginBottom: 10, display: 'block', margin: '0 auto' }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            Click on the panorama to add a hotspot, or select one to edit
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 8 }}>
            Supports: Navigation · Info · Audio · Video · Custom Actions
          </div>
        </div>
      </div>
    );
  }

  const matchesQuery = (fieldLabel, fieldKeywords = []) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return fieldLabel.toLowerCase().includes(q) || fieldKeywords.some(k => k.toLowerCase().includes(q));
  };

  const showLayout = matchesQuery("HOTSPOT SIZE", ["size", "diameter", "scale"]) ||
                     matchesQuery("OPACITY", ["opacity", "transparency", "alpha"]) ||
                     matchesQuery("SPHERICAL COORDINATES", ["yaw", "pitch", "position", "coordinates"]);

  const showActions = matchesQuery("HOTSPOT TYPE", ["type", "mode"]) ||
                      matchesQuery("TOOLTIP TEXT", ["tooltip", "label", "text"]) ||
                      (currentType === 'navigation' && matchesQuery("TARGET SCENE", ["target", "destination", "scene", "room"])) ||
                      (currentType === 'link' && matchesQuery("URL", ["url", "link"])) ||
                      (currentType === 'video' && matchesQuery("VIDEO SOURCE", ["video", "source", "mp4", "vimeo", "youtube"])) ||
                      (currentType === 'action' && matchesQuery("ACTION PARAMETER", ["parameter", "action", "param"])) ||
                      matchesQuery("ON CLICK", ["click", "event"]) ||
                      matchesQuery("ON HOVER", ["hover", "event"]);

  const showAudio = (currentType === 'audio' && matchesQuery("AUDIO SOURCE", ["audio", "sound", "source", "mp3"])) ||
                    (currentType === 'audio' && matchesQuery("HOTSPOT VOLUME", ["volume", "effect", "gain"])) ||
                    (currentScene && matchesQuery("SCENE AMBIENT VOLUME", ["ambient", "volume", "music", "background"])) ||
                    (currentScene && matchesQuery("SCENE NARRATION VOLUME", ["narration", "voiceover", "volume"]));

  const showStyling = matchesQuery("COLOR", ["color", "presets", "picker"]) ||
                      matchesQuery("ICON", ["icon", "glyph", "glyph icon"]) ||
                      matchesQuery("ANIMATION", ["animation", "pulse", "glow", "spin", "bounce"]) ||
                      matchesQuery("LABEL VISIBILITY", ["show label", "always show"]);

  return (
    <div style={{ padding: '0 0 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 2 }}>EDITING HOTSPOT</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-bright)' }}>
            {hotspot.id}
          </div>
        </div>
        <Button
          danger size="small"
          icon={<Icon name="Trash2" size="sm" />}
          onClick={() => onDelete(hotspot.id)}
          style={{ background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--red)', borderRadius: 'var(--radius-sm)' }}
        >
          Delete
        </Button>
      </div>

      {/* Settings Search Bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <Input
          placeholder="Search settings..."
          allowClear
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          size="small"
          prefix={<Icon name="Search" size="xs" style={{ color: 'var(--text-muted)' }} />}
          style={{
            background: 'var(--bg-tertiary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            borderRadius: 'var(--radius-sm)'
          }}
        />
      </div>

      {/* Main Content Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        <Form form={form} layout="vertical" onValuesChange={(changed) => {
          if (changed.type !== undefined) setCurrentType(changed.type);
          if (changed.color !== undefined) setCurrentColor(changed.color);
          if (changed.animationType !== undefined) setAnimType(changed.animationType);
          handleChange(changed);
        }}>
          
          <Collapse
            activeKey={activePanels}
            onChange={setActivePanels}
            ghost
            expandIconPosition="right"
            style={{ border: 'none' }}
          >
            {/* Panel 1: Layout */}
            {showLayout && (
              <Panel header={
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="FaRulerCombined" size="sm" style={{ color: 'var(--cyan)' }} /> LAYOUT & COORDINATES
                </span>
              } key="layout" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                <HotspotLayoutSection
                  form={form}
                  hotspot={hotspot}
                  matchesQuery={matchesQuery}
                />
              </Panel>
            )}

            {/* Panel 2: Actions & Navigation */}
            {showActions && (
              <Panel header={
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Link2" size="sm" style={{ color: 'var(--accent)' }} /> ACTIONS & NAVIGATION
                </span>
              } key="actions" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                <HotspotActionsSection
                  form={form}
                  currentType={currentType}
                  setCurrentType={setCurrentType}
                  scenes={scenes}
                  currentSceneId={currentSceneId}
                  currentScene={currentScene}
                  hotspot={hotspot}
                  onSelectSceneVisually={onSelectSceneVisually}
                  handleChange={handleChange}
                  matchesQuery={matchesQuery}
                  viewerRef={viewerRef}
                  onTestAction={handleTestAction}
                />
              </Panel>
            )}

            {/* Panel 3: Audio Mixer */}
            {showAudio && (
              <Panel header={
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Volume2" size="sm" style={{ color: 'var(--accent-bright)' }} /> AUDIO MIXER & SETTINGS
                </span>
              } key="audio" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                <HotspotAudioSection
                  form={form}
                  currentType={currentType}
                  handleChange={handleChange}
                  matchesQuery={matchesQuery}
                />
              </Panel>
            )}

            {/* Panel 4: Visual Styling */}
            {showStyling && (
              <Panel header={
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="FaPalette" size="sm" style={{ color: 'var(--amber)' }} /> VISUAL STYLING
                </span>
              } key="styling" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                <HotspotAppearanceSection
                  form={form}
                  currentColor={currentColor}
                  setCurrentColor={setCurrentColor}
                  iconMode={iconMode}
                  setIconMode={setIconMode}
                  customUploading={customUploading}
                  customUrlInput={customUrlInput}
                  setCustomUrlInput={setCustomUrlInput}
                  handleCustomUpload={handleCustomUpload}
                  applyCustomUrl={applyCustomUrl}
                  handleSelectQuickPick={handleSelectQuickPick}
                  clearCustomIcon={clearCustomIcon}
                  handleChange={handleChange}
                  matchesQuery={matchesQuery}
                />
                <HotspotAnimationSection
                  form={form}
                  animType={animType}
                  setAnimType={setAnimType}
                  handleChange={handleChange}
                  matchesQuery={matchesQuery}
                />
              </Panel>
            )}
          </Collapse>
        </Form>
      </div>
    </div>
  );
}
