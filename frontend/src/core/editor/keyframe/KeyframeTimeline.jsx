import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Tooltip, Slider, Select, Input, InputNumber, message } from 'antd';
import Icon from '../../../components/common/Icon';

const { Option } = Select;

const EASE_PRESETS = [
  { value: 'power2.inOut', label: 'Smooth', iconName: 'FaBolt' },
  { value: 'power3.inOut', label: 'Cinematic', iconName: 'FaClapperboard' },
  { value: 'linear', label: 'Linear', iconName: 'FaArrowRight' },
  { value: 'back.inOut', label: 'Overshoot', iconName: 'FaUndo' },
  { value: 'elastic.out(1, 0.5)', label: 'Elastic', iconName: 'FaWaveSquare' },
  { value: 'bounce.out', label: 'Bounce', iconName: 'FaSquare' },
];

function KeyframeMarker({ keyframe, index, isActive, isDragging, onClick, onDragStart, totalKeyframes }) {
  const pct = totalKeyframes <= 1 ? 50 : (index / (totalKeyframes - 1)) * 100;

  return (
    <Tooltip title={`${keyframe.label} (${keyframe.duration}s)`} placement="top">
      <div
        onClick={() => onClick(keyframe)}
        onMouseDown={(e) => onDragStart(e, index)}
        className="timeline-keyframe"
        style={{
          left: `${pct}%`,
          background: isActive ? 'var(--accent-bright)' : 'var(--accent)',
          boxShadow: isActive ? `0 0 12px var(--accent-glow)` : 'none',
          border: isActive ? '2px solid #fff' : '2px solid rgba(255,255,255,0.5)',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: isActive ? 10 : 5,
          transition: isDragging ? 'none' : 'all 0.15s',
        }}
      />
    </Tooltip>
  );
}

/**
 * KeyframeTimeline
 * Full cinematic keyframe editor panel.
 *
 * Props:
 *   controller: KeyframeController instance
 *   viewerRef: ref to ViewerCore instance
 */
export default function KeyframeTimeline({ controller, viewerRef }) {
  const [keyframes, setKeyframes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [loopMode, setLoopMode] = useState('none'); // 'none' | 'loop' | 'pingpong'

  const trackRef = useRef(null);

  useEffect(() => {
    if (!controller) return;
    controller.onKeyframesChange = (kfs) => setKeyframes(kfs);
    controller.onPlaybackFrame = (idx) => setPlaybackIndex(idx);
    controller.onPlaybackEnd = () => setIsPlaying(false);
    return () => {
      if (controller) {
        controller.onKeyframesChange = null;
        controller.onPlaybackFrame = null;
        controller.onPlaybackEnd = null;
      }
    };
  }, [controller]);

  const selectedKf = keyframes.find(k => k.id === selectedId);

  const handleAddKeyframe = useCallback(() => {
    if (!controller) return;
    const kf = controller.addKeyframe();
    if (kf) {
      setSelectedId(kf.id);
      message.success('Keyframe captured!');
    }
  }, [controller]);

  const handleDelete = useCallback((id) => {
    if (!controller) return;
    controller.removeKeyframe(id);
    if (selectedId === id) setSelectedId(null);
  }, [controller, selectedId]);

  const handleJump = useCallback((id) => {
    if (!controller) return;
    controller.jumpToKeyframe(id);
    setSelectedId(id);
  }, [controller]);

  const handlePlay = useCallback(() => {
    if (!controller) return;
    if (isPlaying) {
      controller.stop();
      setIsPlaying(false);
    } else {
      if (keyframes.length < 2) { message.warning('Add at least 2 keyframes to play.'); return; }
      controller.play({
        loop: loopMode === 'loop',
        pingPong: loopMode === 'pingpong',
        startIndex: 0,
      });
      setIsPlaying(true);
    }
  }, [controller, isPlaying, keyframes.length, loopMode]);

  const handleUpdate = useCallback((field, value) => {
    if (!controller || !selectedId) return;
    controller.updateKeyframe(selectedId, { [field]: value });
  }, [controller, selectedId]);

  const labelStyle = { fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 4 };
  const cardStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: 10,
  };

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Transport Controls ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="FaClapperboard" size="xs" style={{ color: 'var(--amber)' }} /> CAMERA KEYFRAMES
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Timeline track */}
        <div
          ref={trackRef}
          className="timeline-track"
          style={{ height: 36, marginBottom: 12, cursor: 'pointer', position: 'relative' }}
          onClick={(e) => {
            // Click on empty area = add keyframe
            if (e.target === trackRef.current) handleAddKeyframe();
          }}
        >
          {/* Progress fill for playback */}
          {keyframes.length > 1 && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(playbackIndex / (keyframes.length - 1)) * 100}%`,
              background: 'linear-gradient(90deg, rgba(108,99,255,0.25), rgba(108,99,255,0.1))',
              transition: 'width 0.3s ease',
            }} />
          )}

          {keyframes.map((kf, i) => (
            <KeyframeMarker
              key={kf.id}
              keyframe={kf}
              index={i}
              isActive={kf.id === selectedId || i === playbackIndex}
              isDragging={false}
              totalKeyframes={keyframes.length}
              onClick={() => handleJump(kf.id)}
              onDragStart={() => {}}
            />
          ))}

          {keyframes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              Click + to capture keyframe positions
            </div>
          )}
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            icon={<Icon name="Camera" size="sm" />}
            onClick={handleAddKeyframe}
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(108,99,255,0.3)', color: 'var(--accent)' }}
          >
            Capture
          </Button>

          <div style={{ flex: 1 }} />

          <Button
            size="small"
            icon={<Icon name="SkipBack" size="sm" />}
            disabled={!keyframes.length}
            onClick={() => { if (keyframes.length) handleJump(keyframes[0].id); }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          />

          <Button
            size="small"
            icon={isPlaying ? <Icon name="Pause" size="sm" /> : <Icon name="Play" size="sm" />}
            onClick={handlePlay}
            disabled={keyframes.length < 2}
            style={{
              background: isPlaying ? 'var(--green-dim)' : 'var(--accent-dim)',
              border: `1px solid ${isPlaying ? 'rgba(0,229,160,0.2)' : 'rgba(108,99,255,0.3)'}`,
              color: isPlaying ? 'var(--green)' : 'var(--accent)',
              width: 32,
            }}
          />

          <Button
            size="small"
            icon={<Icon name="SkipForward" size="sm" />}
            disabled={!keyframes.length}
            onClick={() => { if (keyframes.length) handleJump(keyframes[keyframes.length - 1].id); }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          />

          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

          {/* Loop mode */}
          {[
            { value: 'none', iconName: 'FaArrowRight', tip: 'Play once' },
            { value: 'loop', iconName: 'FaRepeat', tip: 'Loop' },
            { value: 'pingpong', iconName: 'FaUpDown', tip: 'Ping-pong' },
          ].map(opt => (
            <Tooltip key={opt.value} title={opt.tip}>
              <div
                onClick={() => setLoopMode(opt.value)}
                style={{
                  padding: '4px 7px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11,
                  border: `1px solid ${loopMode === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: loopMode === opt.value ? 'var(--accent-dim)' : 'transparent',
                  color: loopMode === opt.value ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Icon name={opt.iconName} size="xs" />
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* ── Keyframe List ── */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle }}>KEYFRAME LIST</div>
        {keyframes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-disabled)', textAlign: 'center', padding: '12px 0' }}>
            No keyframes yet. Click <strong style={{ color: 'var(--accent)' }}>Capture</strong> to add one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {keyframes.map((kf, i) => (
              <div
                key={kf.id}
                onClick={() => { handleJump(kf.id); setSelectedId(kf.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: selectedId === kf.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: `1px solid ${selectedId === kf.id ? 'rgba(108,99,255,0.3)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 3, rotate: '45deg',
                  background: selectedId === kf.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: `2px solid ${selectedId === kf.id ? 'var(--accent)' : 'var(--border)'}`,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{kf.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {kf.duration}s
                </div>
                <Button
                  size="small"
                  icon={<Icon name="Trash2" size="sm" />}
                  onClick={(e) => { e.stopPropagation(); handleDelete(kf.id); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: '0 4px' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Selected Keyframe Properties ── */}
      {selectedKf && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle }}>KEYFRAME PROPERTIES</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ ...labelStyle }}>LABEL</div>
            <Input
              size="small"
              value={selectedKf.label}
              onChange={e => handleUpdate('label', e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ ...labelStyle }}>DURATION (s)</div>
              <InputNumber
                size="small"
                min={0.1} max={30} step={0.1}
                value={selectedKf.duration}
                onChange={v => handleUpdate('duration', v)}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
            <div>
              <div style={{ ...labelStyle }}>HOLD (ms)</div>
              <InputNumber
                size="small"
                min={0} max={10000} step={100}
                value={selectedKf.hold}
                onChange={v => handleUpdate('hold', v)}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ ...labelStyle }}>EASING</div>
            <Select
              size="small"
              value={selectedKf.ease}
              onChange={v => handleUpdate('ease', v)}
              style={{ width: '100%', fontSize: 12 }}
            >
              {EASE_PRESETS.map(e => (
                <Option key={e.value} value={e.value}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name={e.iconName} size="xs" />
                    <span>{e.label}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: 'YAW', value: selectedKf.yaw?.toFixed(3) },
              { label: 'PITCH', value: selectedKf.pitch?.toFixed(3) },
              { label: 'FOV', value: `${selectedKf.fov?.toFixed(0)}°` },
            ].map(f => (
              <div key={f.label} style={{ padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{f.label}</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.value}</div>
              </div>
            ))}
          </div>

          <Button
            size="small"
            icon={<Icon name="Camera" size="sm" />}
            onClick={() => {
              if (!controller) return;
              controller.updateKeyframe(selectedKf.id, {
                yaw: viewerRef?.current?.targetTheta ?? selectedKf.yaw,
                pitch: viewerRef?.current?.targetPhi ?? selectedKf.pitch,
                fov: viewerRef?.current?.camera?.fov ?? selectedKf.fov,
              });
              message.success('Keyframe updated from current view!');
            }}
            style={{ width: '100%', marginTop: 10, background: 'var(--accent-dim)', border: '1px solid rgba(108,99,255,0.3)', color: 'var(--accent)' }}
          >
            Update from Current View
          </Button>
        </div>
      )}
    </div>
  );
}
