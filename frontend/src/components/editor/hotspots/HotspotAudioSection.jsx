import React from 'react';
import { Form, Slider } from 'antd';
import Icon from '../../common/Icon';
import MediaUrlPicker from '../../common/MediaUrlPicker';
import { labelStyle } from './hotspotConstants';

export default function HotspotAudioSection({
  form,
  currentType,
  handleChange,
  matchesQuery
}) {
  return (
    <>
      {currentType === 'audio' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="Volume2" style={{ color: 'var(--accent-bright)' }} size="sm" /> AUDIO SOURCE
          </div>
          <MediaUrlPicker
            value={form.getFieldValue('audioUrl') || ''}
            onChange={v => { form.setFieldValue('audioUrl', v); handleChange({ audioUrl: v }); }}
            accept="audio/*"
            placeholder="/uploads/audio.mp3"
            accentColor="var(--accent-bright)"
            uploadLabel="Upload Audio"
          />
        </div>
      )}

      {currentType === 'audio' && (
        <Form.Item
          name="volume"
          label={<span style={labelStyle}>HOTSPOT VOLUME: {Math.round((form.getFieldValue('volume') ?? 0.5) * 100)}%</span>}
          style={{ marginBottom: 10 }}
        >
          <Slider min={0} max={1} step={0.05} />
        </Form.Item>
      )}
    </>
  );
}
