import React from 'react';
import { Button, Tooltip, Upload, Input } from 'antd';
import Icon from '../../common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';
import { ICON_OPTIONS, QUICK_PICK_ICONS, PRESET_COLORS, labelStyle } from './hotspotConstants';

export default function HotspotAppearanceSection({
  form,
  currentColor,
  setCurrentColor,
  iconMode,
  setIconMode,
  customUploading,
  customUrlInput,
  setCustomUrlInput,
  handleCustomUpload,
  applyCustomUrl,
  handleSelectQuickPick,
  clearCustomIcon,
  handleChange,
  matchesQuery
}) {
  return (
    <>
      {matchesQuery("COLOR", ["color", "presets", "picker"]) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>ACCENT COLOR</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => {
                  form.setFieldValue('color', c);
                  setCurrentColor(c);
                  handleChange({ color: c });
                }}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  cursor: 'pointer',
                  border: currentColor === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: currentColor === c ? `0 0 10px ${c}` : 'none',
                  transition: 'all 0.15s'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {matchesQuery("ICON", ["icon", "glyph", "glyph icon", "custom", "svg", "upload", "gif"]) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={labelStyle}>HOTSPOT ICON</div>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setIconMode('preset');
                  if (form.getFieldValue('icon') === 'custom' && !form.getFieldValue('customIcon')) {
                    form.setFieldValue('icon', 'arrow');
                    handleChange({ icon: 'arrow' });
                  }
                }}
                style={{
                  padding: '3px 8px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer', background: iconMode === 'preset' ? 'var(--accent)' : 'transparent',
                  color: iconMode === 'preset' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s'
                }}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => {
                  setIconMode('custom');
                  if (!form.getFieldValue('customIcon')) {
                    form.setFieldValue('icon', 'custom');
                  }
                }}
                style={{
                  padding: '3px 8px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer', background: iconMode === 'custom' ? 'var(--accent)' : 'transparent',
                  color: iconMode === 'custom' ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s'
                }}
              >
                <span>Custom / SVG</span>
                {form.getFieldValue('customIcon') && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                )}
              </button>
            </div>
          </div>

          {iconMode === 'preset' ? (
            /* Preset Glyphs Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {ICON_OPTIONS.map(i => {
                const isSelected = form.getFieldValue('icon') === i.value && !form.getFieldValue('customIcon');
                return (
                  <div
                    key={i.value}
                    onClick={() => {
                      form.setFieldValue('icon', i.value);
                      form.setFieldValue('customIcon', '');
                      setCustomUrlInput('');
                      handleChange({ icon: i.value, customIcon: '' });
                    }}
                    style={{
                      padding: '6px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      fontSize: 10, color: isSelected ? 'var(--accent-bright)' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Icon name={i.iconName} size="sm" />
                    <span style={{ fontSize: 9, fontWeight: isSelected ? 700 : 500 }}>{i.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Icon / SVG / GIF Mode */
            <div style={{
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
              padding: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10
            }}>
              {/* File Upload Dropzone */}
              <Upload
                accept=".png,.svg,.gif,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/gif,image/webp,image/jpeg"
                showUploadList={false}
                beforeUpload={handleCustomUpload}
                disabled={customUploading}
              >
                <Button
                  size="small"
                  loading={customUploading}
                  icon={<Icon name="Upload" size="sm" />}
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--accent)',
                    color: 'var(--accent-bright)',
                    height: 36,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  {customUploading ? 'Uploading Custom Icon...' : 'Upload SVG / PNG / GIF / WebP'}
                </Button>
              </Upload>

              {/* Direct URL Input */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                  OR PASTE ICON / SVG URL
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Input
                    size="small"
                    placeholder="https://.../icon.svg or /uploads/icons/..."
                    value={customUrlInput}
                    onChange={e => setCustomUrlInput(e.target.value)}
                    onPressEnter={() => applyCustomUrl(customUrlInput)}
                    style={{ fontSize: 11, background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                  />
                  <Button
                    size="small"
                    onClick={() => applyCustomUrl(customUrlInput)}
                    style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
                  >
                    Set
                  </Button>
                </div>
              </div>

              {/* Quick Picks Architectural Library */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                  QUICK-PICK VECTOR ICONS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  {QUICK_PICK_ICONS.map(qp => {
                    const isCur = form.getFieldValue('customIcon') === qp.svg;
                    return (
                      <Tooltip title={qp.label} key={qp.name}>
                        <div
                          onClick={() => handleSelectQuickPick(qp.svg)}
                          style={{
                            padding: '6px 4px', borderRadius: 'var(--radius-sm)',
                            background: isCur ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                            border: `1px solid ${isCur ? 'var(--accent)' : 'var(--border)'}`,
                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 3, transition: 'all 0.15s'
                          }}
                        >
                          <img
                            src={qp.svg}
                            alt={qp.name}
                            style={{ width: 16, height: 16, filter: isCur ? 'drop-shadow(0 0 4px var(--accent))' : 'none' }}
                          />
                          <span style={{ fontSize: 8.5, color: isCur ? 'var(--accent-bright)' : 'var(--text-muted)', fontWeight: isCur ? 700 : 500 }}>
                            {qp.name}
                          </span>
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Active Custom Icon Preview & Style Options */}
              {form.getFieldValue('customIcon') && (
                <div style={{
                  marginTop: 4, padding: 8, background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: form.getFieldValue('iconStyle') === 'frameless' ? 4 : '50%',
                        background: form.getFieldValue('iconStyle') === 'frameless' ? 'transparent' : currentColor,
                        border: '1px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 10px ${currentColor}66`,
                        overflow: 'hidden'
                      }}>
                        <img
                          src={getImageUrl(form.getFieldValue('customIcon'))}
                          alt="Custom Icon"
                          style={{ width: 22, height: 22, objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>Custom Icon Active</div>
                        <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>✓ Ready in 3D Scene</div>
                      </div>
                    </div>
                    <Button
                      size="small"
                      danger
                      onClick={clearCustomIcon}
                      style={{ fontSize: 10, height: 24, padding: '0 8px' }}
                    >
                      Clear
                    </Button>
                  </div>

                  {/* Icon Style Option: Badge vs Frameless */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Display Mode:</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { key: 'badge', label: 'Badge' },
                        { key: 'frameless', label: 'Frameless' }
                      ].map(st => {
                        const isSelected = (form.getFieldValue('iconStyle') || 'badge') === st.key;
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              form.setFieldValue('iconStyle', st.key);
                              handleChange({ iconStyle: st.key });
                            }}
                            style={{
                              padding: '2px 8px', fontSize: 9, fontWeight: 600,
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              background: isSelected ? 'var(--accent-dim)' : 'transparent',
                              color: isSelected ? 'var(--accent-bright)' : 'var(--text-muted)',
                              borderRadius: 'var(--radius-xs)', cursor: 'pointer'
                            }}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
