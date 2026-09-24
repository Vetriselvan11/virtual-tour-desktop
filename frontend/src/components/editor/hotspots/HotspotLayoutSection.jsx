import React from 'react';
import { Form, Slider, Select } from 'antd';
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
          <Slider min={10} max={1000} step={5} />
        </Form.Item>
      )}

      {matchesQuery("NAME SIZE", ["name", "text", "size"]) && (
        <Form.Item
          name="nameSize"
          label={<span style={labelStyle}>NAME SIZE: {form.getFieldValue('nameSize') || 13}px</span>}
          style={{ marginBottom: 10 }}
        >
          <Slider min={10} max={40} step={1} />
        </Form.Item>
      )}

      {matchesQuery("NAME OFFSET", ["name", "offset", "position", "align", "x", "y"]) && (
        <>
          <Form.Item
            name="nameOffsetX"
            label={<span style={labelStyle}>NAME OFFSET X: {form.getFieldValue('nameOffsetX') || 0}px</span>}
            style={{ marginBottom: 4 }}
          >
            <Slider min={-100} max={100} step={1} />
          </Form.Item>
          <Form.Item
            name="nameOffsetY"
            label={<span style={labelStyle}>NAME OFFSET Y: {form.getFieldValue('nameOffsetY') || 0}px</span>}
            style={{ marginBottom: 10 }}
          >
            <Slider min={-100} max={100} step={1} />
          </Form.Item>
        </>
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
