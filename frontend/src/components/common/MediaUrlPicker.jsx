import React, { useState } from 'react';
import { Input, Upload, Button, message } from 'antd';
import Icon from './Icon';
import { API_BASE } from '../../config/api';

export default function MediaUrlPicker({ value, onChange, accept, placeholder, accentColor, uploadLabel }) {
  const [mode, setMode] = useState(value?.startsWith('http') || !value ? 'url' : 'upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploading, setUploading] = useState(false);

  const applyUrl = (url) => {
    const trimmed = (url || '').trim();
    setUrlInput(trimmed);
    onChange(trimmed);
  };

  const handleUpload = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('audio', file);
    try {
      const resp = await fetch(`${API_BASE}/api/tours/upload-audio`, { method: 'POST', body: formData });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await resp.text();
        throw new Error('Server returned HTML. Restart the backend server and try again.\n' + txt.slice(0, 80));
      }
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      applyUrl(data.url);
    } catch (err) {
      message.error({ content: err.message, duration: 8 });
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[
          { key: 'url', icon: <Icon name="Link2" size="sm" />, label: 'Paste URL' },
          { key: 'upload', icon: <Icon name="Upload" size="sm" />, label: 'Upload File' },
        ].map(opt => (
          <div
            key={opt.key}
            onClick={() => setMode(opt.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '4px 6px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${mode === opt.key ? accentColor : 'var(--border)'}`,
              background: mode === opt.key ? `${accentColor}18` : 'var(--bg-secondary)',
              color: mode === opt.key ? accentColor : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 10, transition: 'all 0.15s',
            }}
          >
            {opt.icon} {opt.label}
          </div>
        ))}
      </div>

      {mode === 'url' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            size="small"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onBlur={() => applyUrl(urlInput)}
            onPressEnter={() => applyUrl(urlInput)}
            placeholder={placeholder}
            prefix={<Icon name="Link2" style={{ color: 'var(--text-muted)' }} size="sm" />}
            style={{ fontSize: 11, flex: 1 }}
          />
          <Button
            size="small"
            icon={<Icon name="Check" size="sm" />}
            onClick={() => applyUrl(urlInput)}
            style={{ background: accentColor, borderColor: accentColor, color: '#fff', flexShrink: 0 }}
          />
        </div>
      ) : (
        <Upload
          accept={accept}
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <Button
            size="small"
            icon={<Icon name="Upload" size="sm" />}
            loading={uploading}
            style={{
              width: '100%',
              background: 'var(--bg-secondary)',
              border: `1px dashed ${accentColor}55`,
              color: 'var(--text-secondary)',
            }}
          >
            {uploading ? 'Uploading...' : uploadLabel}
          </Button>
        </Upload>
      )}

      {value && (
        <div style={{
          marginTop: 6, padding: '5px 8px',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${accentColor}33`,
          fontSize: 10, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={value}>
          ✓ {value.length > 50 ? '...' + value.slice(-46) : value}
        </div>
      )}
    </div>
  );
}
