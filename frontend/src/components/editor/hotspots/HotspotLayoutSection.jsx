import React from 'react';
import { Form, Slider, Button, Tooltip } from 'antd';
import { labelStyle } from './hotspotConstants';

export default function HotspotLayoutSection({
  form,
  hotspot,
  matchesQuery,
  onApplySizeToAll,
  onApplyNameSizeToAll,
  syncAllHotspotSize,
  onToggleSyncSize
}) {
  const currentSize = form.getFieldValue('size') || hotspot?.size || 40;
  const currentNameSize = form.getFieldValue('nameSize') || hotspot?.nameSize || 13;

  return (
    <>
      {matchesQuery("HOTSPOT SIZE", ["size", "diameter", "scale"]) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={labelStyle}>HOTSPOT SIZE: {currentSize}px</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {onToggleSyncSize && (
                <Tooltip title="When enabled, changing size immediately updates ALL hotspots across all scenes">
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600,
                    color: syncAllHotspotSize ? 'var(--cyan)' : 'var(--text-muted)'
                  }}>
                    <input
                      type="checkbox"
                      checked={!!syncAllHotspotSize}
                      onChange={(e) => onToggleSyncSize(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: 'var(--cyan)' }}
                    />
                    <span>Sync all</span>
                  </label>
                </Tooltip>
              )}
              {onApplySizeToAll && (
                <button
                  type="button"
                  onClick={() => onApplySizeToAll(currentSize, false)}
                  title="Apply this size to all hotspots across all scenes"
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                    color: 'var(--cyan)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Apply to All
                </button>
              )}
            </div>
          </div>
          <Form.Item name="size" noStyle>
            <Slider min={10} max={1000} step={5} />
          </Form.Item>
        </div>
      )}

      {matchesQuery("NAME SIZE", ["name", "text", "size"]) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={labelStyle}>NAME SIZE: {currentNameSize}px</span>
            {onApplyNameSizeToAll && (
              <button
                type="button"
                onClick={() => onApplyNameSizeToAll(currentNameSize, false)}
                title="Apply this label size to all hotspots across all scenes"
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  color: 'var(--accent)',
                  borderRadius: 4,
                  padding: '2px 7px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Apply to All
              </button>
            )}
          </div>
          <Form.Item name="nameSize" noStyle>
            <Slider min={10} max={40} step={1} />
          </Form.Item>
        </div>
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
