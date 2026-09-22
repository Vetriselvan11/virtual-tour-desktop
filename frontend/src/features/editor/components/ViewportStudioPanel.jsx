import React, { useState, useEffect } from 'react';
import { Slider } from 'antd';
import { sharedTextureManager } from '../../../core/viewer/TextureManager';

export function ViewportStudioPanel({ layout, currentSceneId, scenesCount = 0 }) {
  const [showDiag, setShowDiag] = useState(false);
  const [diagStats, setDiagStats] = useState({ totalCached: 0, maxCache: 5, heapMb: null });

  useEffect(() => {
    if (!showDiag) return;
    const interval = setInterval(() => {
      const stats = sharedTextureManager.getStats();
      const heap = window.performance?.memory?.usedJSHeapSize
        ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))
        : null;
      setDiagStats({
        totalCached: stats.totalCached,
        maxCache: stats.maxCacheSize,
        heapMb: heap
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDiag]);

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
      padding: '8px 12px', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px',
      boxShadow: 'var(--shadow-md)', zIndex: 1000, width: '180px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          VIEWPORT STUDIO
        </span>
        <span
          onClick={() => setShowDiag(d => !d)}
          style={{
            fontSize: '8px', cursor: 'pointer',
            color: showDiag ? 'var(--cyan)' : 'var(--text-disabled)',
            fontWeight: 600
          }}
          title="Toggle Performance Diagnostics"
        >
          {showDiag ? '● DIAG ON' : '○ DIAG'}
        </span>
      </div>

      {showDiag && (
        <div style={{
          background: 'rgba(0,0,0,0.5)',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          fontSize: '8.5px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Scenes:</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{scenesCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Active Scene:</span>
            <span style={{ color: 'var(--cyan)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSceneId || 'none'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cached VRAM:</span>
            <span style={{ color: 'var(--green)' }}>{diagStats.totalCached} / {diagStats.maxCache}</span>
          </div>
          {diagStats.heapMb !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>JS Heap:</span>
              <span style={{ color: 'var(--amber)' }}>{diagStats.heapMb} MB</span>
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>RENDER QUALITY</span>
          <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{layout.quality.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['low', 'medium', 'high'].map(q => (
            <div
              key={q}
              onClick={() => layout.setQuality(q)}
              style={{
                flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${layout.quality === q ? 'var(--cyan)' : 'var(--border)'}`,
                background: layout.quality === q ? 'var(--cyan-dim)' : 'var(--bg-secondary)',
                color: layout.quality === q ? 'var(--cyan)' : 'var(--text-muted)',
                fontSize: 9, cursor: 'pointer', transition: 'all 0.15s',
                fontWeight: layout.quality === q ? 600 : 400
              }}
            >
              {q.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>CAMERA GLIDE</span>
          <span style={{ color: 'var(--accent)' }}>{Math.round(layout.cameraEase * 1000)}ms</span>
        </div>
        <Slider
          min={0.01} max={0.15} step={0.005}
          value={layout.cameraEase}
          onChange={layout.setCameraEase}
          tooltip={{ formatter: val => `${Math.round(val * 1000)}ms glide` }}
          style={{ margin: '4px 0' }}
        />
      </div>
    </div>
  );
}

