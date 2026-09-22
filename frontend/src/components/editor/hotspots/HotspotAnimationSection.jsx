import React from 'react';
import Icon from '../../common/Icon';
import { ANIM_OPTIONS, labelStyle } from './hotspotConstants';

export default function HotspotAnimationSection({
  form,
  animType,
  setAnimType,
  handleChange,
  matchesQuery
}) {
  return (
    <>
      {matchesQuery("ANIMATION", ["animation", "pulse", "glow", "spin", "bounce"]) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>ANIMATION PRESET</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {ANIM_OPTIONS.map(a => {
              const isSelected = animType === a.value;
              return (
                <div
                  key={a.value}
                  onClick={() => {
                    form.setFieldValue('animationType', a.value);
                    setAnimType(a.value);
                    handleChange({ animationType: a.value });
                  }}
                  style={{
                    padding: '6px 4px', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    fontSize: 10, color: isSelected ? 'var(--accent-bright)' : 'var(--text-muted)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon name={a.iconName} size="xs" />
                  <span style={{ fontSize: 9, fontWeight: isSelected ? 700 : 500 }}>{a.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
