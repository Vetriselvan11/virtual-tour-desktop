import React, { useState, useRef, useCallback } from 'react';
import { Button, Slider, Tooltip, Upload, Input, message } from 'antd';
import Icon from '../../../components/common/Icon';

// ── Waveform bars animation ────────────────────────────────────────────────
function WaveformBars({ isPlaying, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 22, flexShrink: 0 }}>
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className={isPlaying ? 'audio-bar' : ''}
          style={{
            width: 3,
            height: isPlaying ? undefined : 4,
            background: isPlaying ? color : 'var(--text-muted)',
            borderRadius: 2,
            animationDelay: isPlaying ? `${i * 0.08}s` : '0s',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  );
}

// ── Audio source picker: Upload file OR paste URL ──────────────────────────
function AudioSourcePicker({ field, label, color, accentDim, borderColor, onSet, uploading, setUploading }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'url'
  const [urlInput, setUrlInput] = useState('');

  const handleUpload = useCallback(async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('audio', file);
    try {
      const resp = await fetch('/api/tours/upload-audio', { method: 'POST', body: formData });
      // Guard: parse only if JSON content-type
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await resp.text();
        throw new Error(`Server returned HTML instead of JSON. Make sure the backend is running and restarted.\n\n${txt.slice(0, 120)}`);
      }
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      onSet(data.url);
      message.success(`${label} uploaded!`);
    } catch (err) {
      message.error({ content: err.message, duration: 6 });
    } finally {
      setUploading(false);
    }
    return false; // Prevent default ant Upload behavior
  }, [label, onSet, setUploading]);

  const handlePasteUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { message.warning('Please enter a URL'); return; }
    // Basic validation
    if (!trimmed.startsWith('http') && !trimmed.startsWith('/')) {
      message.warning('Enter a valid URL (http://... or /uploads/...)');
      return;
    }
    onSet(trimmed);
    setUrlInput('');
    message.success(`${label} URL set!`);
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[
          { key: 'upload', icon: <Icon name="Upload" size="sm" />, label: 'Upload File' },
          { key: 'url', icon: <Icon name="Link2" size="sm" />, label: 'Paste URL' },
        ].map(opt => (
          <div
            key={opt.key}
            onClick={() => setMode(opt.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, padding: '5px 8px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${mode === opt.key ? color : 'var(--border)'}`,
              background: mode === opt.key ? accentDim : 'var(--bg-secondary)',
              color: mode === opt.key ? color : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 11, transition: 'all 0.15s',
            }}
          >
            {opt.icon} {opt.label}
          </div>
        ))}
      </div>

      {mode === 'upload' ? (
        <Upload
          accept="audio/*,video/*"
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
              border: `1px dashed ${color}55`,
              color: 'var(--text-secondary)',
            }}
          >
            {uploading ? 'Uploading...' : `Upload ${label}`}
          </Button>
        </Upload>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            size="small"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onPressEnter={handlePasteUrl}
            placeholder={`https://... or /uploads/audio/file.mp3`}
            prefix={<Icon name="Link2" size="sm" style={{ color: 'var(--text-muted)' }} />}
            style={{ fontSize: 11, flex: 1 }}
          />
          <Button
            size="small"
            type="primary"
            icon={<Icon name="Check" size="sm" />}
            onClick={handlePasteUrl}
            style={{ background: color, borderColor: color, flexShrink: 0 }}
          />
        </div>
      )}
    </div>
  );
}

// ── Audio track row: shows currently set audio ─────────────────────────────
function AudioTrackRow({ url, isPlaying, onTogglePlay, onDelete, color, accentDim, borderColor }) {
  const shortName = url ? (url.length > 40 ? '...' + url.slice(-36) : url) : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${borderColor}`, padding: '6px 10px',
    }}>
      <WaveformBars isPlaying={isPlaying} color={color} />
      <div style={{
        flex: 1, fontSize: 11, color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={url}>
        {shortName}
      </div>
      <Button
        size="small"
        icon={isPlaying ? <Icon name="Pause" size="sm" /> : <Icon name="Play" size="sm" />}
        onClick={onTogglePlay}
        style={{ background: accentDim, border: `1px solid ${borderColor}`, color, flexShrink: 0 }}
      />
      <Button
        size="small"
        icon={<Icon name="Trash2" size="sm" />}
        onClick={onDelete}
        style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,109,0.2)', color: 'var(--red)', flexShrink: 0 }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// AudioPanel — Main Component
// Props:
//   scene:          current scene object
//   onSceneUpdate:  (updates) => void
//   audioEngineRef: React ref to audioEngine instance
// ══════════════════════════════════════════════════════════════════════════
export default function AudioPanel({ scene, onSceneUpdate, audioEngineRef }) {
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(scene?.ambientVolume ?? 0.5);
  const [narrationVolume, setNarrationVolume] = useState(scene?.narrationVolume ?? 0.9);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [ambientUploading, setAmbientUploading] = useState(false);
  const [narrationUploading, setNarrationUploading] = useState(false);

  const previewAudio = useRef(null);
  const stopPreview = () => {
    if (previewAudio.current) {
      previewAudio.current.pause();
      previewAudio.current.src = '';
    }
    setIsAmbientPlaying(false);
    setIsNarrationPlaying(false);
  };

  const playUrl = (url, loop, onEnd) => {
    stopPreview();
    if (!url) return;
    const a = new Audio();
    a.src = url;
    a.loop = loop;
    a.volume = isMuted ? 0 : masterVolume;
    a.onended = onEnd || null;
    a.play().catch(err => message.error('Cannot play audio: ' + err.message));
    previewAudio.current = a;
  };

  const handlePreviewAmbient = () => {
    if (!scene?.ambientAudio) return;
    if (isAmbientPlaying) { stopPreview(); return; }
    playUrl(scene.ambientAudio, true);
    setIsAmbientPlaying(true);
  };

  const handlePreviewNarration = () => {
    if (!scene?.narrationAudio) return;
    if (isNarrationPlaying) { stopPreview(); return; }
    playUrl(scene.narrationAudio, false, () => setIsNarrationPlaying(false));
    setIsNarrationPlaying(true);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (previewAudio.current) previewAudio.current.muted = next;
  };

  const labelStyle = {
    fontSize: 11, color: 'var(--text-secondary)',
    letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600,
  };
  const cardStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: 10,
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Master Volume ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="Volume2" size="sm" /> MASTER VOLUME
          </div>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute all'}>
            <Button
              size="small"
              icon={isMuted ? <Icon name="VolumeX" size="sm" /> : <Icon name="Volume2" size="sm" />}
              onClick={toggleMute}
              style={{
                background: isMuted ? 'var(--red-dim)' : 'transparent',
                border: `1px solid ${isMuted ? 'rgba(255,77,109,0.2)' : 'var(--border)'}`,
                color: isMuted ? 'var(--red)' : 'var(--text-secondary)',
              }}
            />
          </Tooltip>
        </div>
        <Slider
          min={0} max={1} step={0.01}
          value={masterVolume}
          onChange={v => {
            setMasterVolume(v);
            if (previewAudio.current) previewAudio.current.volume = v;
          }}
        />
      </div>

      {/* ── Ambient Audio ── */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="FaMusic" size="xs" style={{ color: 'var(--cyan)' }} /> AMBIENT AUDIO
        </div>

        {scene?.ambientAudio ? (
          <AudioTrackRow
            url={scene.ambientAudio}
            isPlaying={isAmbientPlaying}
            onTogglePlay={handlePreviewAmbient}
            onDelete={() => { stopPreview(); onSceneUpdate({ ambientAudio: null }); }}
            color="var(--cyan)"
            accentDim="var(--cyan-dim)"
            borderColor="rgba(0,212,255,0.2)"
          />
        ) : (
          <AudioSourcePicker
            field="ambientAudio"
            label="Ambient Audio"
            color="var(--cyan)"
            accentDim="var(--cyan-dim)"
            borderColor="rgba(0,212,255,0.3)"
            onSet={url => onSceneUpdate({ ambientAudio: url })}
            uploading={ambientUploading}
            setUploading={setAmbientUploading}
          />
        )}

        <div style={{ ...labelStyle, marginTop: 10 }}>VOLUME: {Math.round(ambientVolume * 100)}%</div>
        <Slider
          min={0} max={1} step={0.05}
          value={ambientVolume}
          onChange={v => {
            setAmbientVolume(v);
            onSceneUpdate({ ambientVolume: v });
            if (previewAudio.current && isAmbientPlaying) previewAudio.current.volume = v;
          }}
        />

        <div style={{ ...labelStyle, marginTop: 8 }}>LOOP</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ value: true, label: 'Loop', iconName: 'FaRepeat' }, { value: false, label: 'Once', iconName: 'FaPlay' }].map(opt => (
            <div
              key={String(opt.value)}
              onClick={() => onSceneUpdate({ ambientLoop: opt.value })}
              style={{
                flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${(scene?.ambientLoop ?? true) === opt.value ? 'var(--cyan)' : 'var(--border)'}`,
                background: (scene?.ambientLoop ?? true) === opt.value ? 'var(--cyan-dim)' : 'var(--bg-secondary)',
                color: (scene?.ambientLoop ?? true) === opt.value ? 'var(--cyan)' : 'var(--text-muted)',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
              }}
            >
              <Icon name={opt.iconName} size="xs" />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Narration Track ── */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="FaMicrophone" size="xs" style={{ color: 'var(--purple)' }} /> NARRATION
        </div>

        {scene?.narrationAudio ? (
          <AudioTrackRow
            url={scene.narrationAudio}
            isPlaying={isNarrationPlaying}
            onTogglePlay={handlePreviewNarration}
            onDelete={() => { stopPreview(); onSceneUpdate({ narrationAudio: null }); }}
            color="var(--purple)"
            accentDim="var(--purple-dim)"
            borderColor="rgba(192,132,252,0.2)"
          />
        ) : (
          <AudioSourcePicker
            field="narrationAudio"
            label="Narration Audio"
            color="var(--purple)"
            accentDim="var(--purple-dim)"
            borderColor="rgba(192,132,252,0.3)"
            onSet={url => onSceneUpdate({ narrationAudio: url })}
            uploading={narrationUploading}
            setUploading={setNarrationUploading}
          />
        )}

        <div style={{ ...labelStyle, marginTop: 10 }}>VOLUME: {Math.round(narrationVolume * 100)}%</div>
        <Slider
          min={0} max={1} step={0.05}
          value={narrationVolume}
          onChange={v => {
            setNarrationVolume(v);
            onSceneUpdate({ narrationVolume: v });
          }}
        />
      </div>

      {/* ── Subtitles info ── */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="FaCommentText" size="xs" style={{ color: 'var(--amber)' }} /> SUBTITLES
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Subtitle cues sync to narration audio timestamps.
          Use the <strong style={{ color: 'var(--amber)' }}>Timeline</strong> tab to add cue markers.
        </div>
        {(scene?.subtitleCues || []).length === 0 ? (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-disabled)' }}>No subtitle cues configured.</div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(scene?.subtitleCues || []).map((cue, i) => (
              <div key={i} style={{
                padding: '6px 10px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 11,
              }}>
                <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginRight: 8 }}>
                  {cue.start.toFixed(1)}s — {cue.end.toFixed(1)}s
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{cue.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
