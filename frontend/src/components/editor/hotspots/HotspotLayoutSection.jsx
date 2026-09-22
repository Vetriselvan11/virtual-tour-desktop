import React from 'react';
import { Form, Slider } from 'antd';
import { labelStyle } from './hotspotConstants';

export default function HotspotLayoutSection({
  form,
  hotspot,
  matchesQuery
}) {
  return (
    <>
      {matchesQuery("HOTSPOT SIZE", ["size", "diameter", "scale"]) && (
        <Form.Item
          name="size"
          label={<span style={labelStyle}>HOTSPOT SIZE: {form.getFieldValue('size') || 40}px</span>}
          style={{ marginBottom: 10 }}
        >
          <Slider min={20} max={80} step={5} />
        </Form.Item>
      )}

      {matchesQuery("OPACITY", ["opacity", "transparency", "alpha"]) && (
        <Form.Item
          name="opacity"
          label={<span style={labelStyle}>OPACITY: {Math.round((form.getFieldValue('opacity') ?? 1) * 100)}%</span>}
          style={{ marginBottom: 10 }}
        >
          <Slider min={0.1} max={1} step={0.05} />
        </Form.Item>
      )}

      {matchesQuery("SPHERICAL COORDINATES", ["yaw", "pitch", "position", "coordinates"]) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {[
            { label: 'YAW', value: hotspot.yaw?.toFixed(3) },
            { label: 'PITCH', value: hotspot.pitch?.toFixed(3) },
          ].map(f => (
            <div key={f.label} style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{f.label}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
