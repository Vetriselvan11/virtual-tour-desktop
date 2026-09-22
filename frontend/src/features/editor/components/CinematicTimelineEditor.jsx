import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Tooltip, Select, Input, InputNumber, Tag, Slider, message, Dropdown } from 'antd';
import Icon from '../../../components/common/Icon';
import { CinematicTimelineEngine, lookAtToYawPitch } from '../../../core/viewer/CinematicTimelineEngine';

const { Option } = Select;

const EASE_PRESETS = [
  { value: 'power2.inOut', label: 'Smooth (Default)', desc: 'Natural acceleration and deceleration' },
  { value: 'power3.inOut', label: 'Cinematic Dynamic', desc: 'Dramatic slow-in and slow-out curve' },
  { value: 'linear', label: 'Linear Speed', desc: 'Constant angular velocity' },
  { value: 'sine.inOut', label: 'Gentle Sine', desc: 'Soft and subtle camera motion' },
  { value: 'back.inOut', label: 'Dynamic Overshoot', desc: 'Cinematic slight overshoot at target' },
  { value: 'bounce.out', label: 'Elastic Bounce', desc: 'Playful settling bounce at endpoint' }
];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  const minStr = String(mins).padStart(2, '0');
  const secStr = String(secs).padStart(4, '0');
  return `${minStr}:${secStr}`;
}

export default function CinematicTimelineEditor({
  tour,
  setTourState,
  viewerRef,
  currentSceneId,
  currentScene,
  onSceneChange
}) {
  const [keyframes, setKeyframes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeKeyframeIndex, setActiveKeyframeIndex] = useState(0);
  const [loopMode, setLoopMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  // Look-at Target modal/collapse state
  const [showLookAtHelper, setShowLookAtHelper] = useState(false);
  const [lookAtX, setLookAtX] = useState(0);
  const [lookAtY, setLookAtY] = useState(0);
  const [lookAtZ, setLookAtZ] = useState(1);

  // Event trigger creator state
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [newEvent, setNewEvent] = useState({ type: 'subtitle', text: '', duration: 3 });

  const timelineEngineRef = useRef(null);
  const rulerTrackRef = useRef(null);

  // 1. Initialize CinematicTimelineEngine
  useEffect(() => {
    const engine = new CinematicTimelineEngine({
      viewerCore: viewerRef?.current,
      onSceneChange: (sceneId) => {
        if (onSceneChange) onSceneChange(sceneId);
      },
      onTimeUpdate: (time, duration) => {
        setCurrentTime(time);
        setTotalDuration(duration);
      },
      onKeyframeChange: (index) => {
        setActiveKeyframeIndex(index);
      },
      onStateChange: (playing, paused) => {
        setIsPlaying(playing);
        setIsPaused(paused);
      },
      onEventTrigger: (event) => {
        if (event.type === 'subtitle' && event.text) {
          message.info(`[Subtitle Cue]: ${event.text}`);
        }
      }
    });

    timelineEngineRef.current = engine;

    // Load initial keyframes from tour state
    const tourData = tour?.cinematicTour || tour?.keyframes || tour?.guidedTour || [];
    engine.load(tourData);
    setKeyframes(engine.keyframes);
    setTotalDuration(engine.totalDuration);
    if (engine.keyframes.length > 0 && !selectedId) {
      setSelectedId(engine.keyframes[0].id);
    }

    return () => {
      engine.destroy();
    };
  }, []);

  // Keep engine viewer reference updated
  useEffect(() => {
    if (timelineEngineRef.current && viewerRef?.current) {
      timelineEngineRef.current.viewer = viewerRef.current;
    }
  });

  // Sync tour data updates into engine if tour object changes from outside
  useEffect(() => {
    if (!timelineEngineRef.current || isPlaying) return;
    const existingKfs = tour?.cinematicTour?.keyframes || tour?.keyframes || tour?.guidedTour?.keyframes;
    if (existingKfs && JSON.stringify(existingKfs) !== JSON.stringify(timelineEngineRef.current.keyframes)) {
      timelineEngineRef.current.load(existingKfs);
      setKeyframes([...timelineEngineRef.current.keyframes]);
      setTotalDuration(timelineEngineRef.current.totalDuration);
    }
  }, [tour?.cinematicTour, tour?.keyframes, tour?.guidedTour, isPlaying]);

  // Persist keyframes to tour state
  const persistKeyframes = useCallback((newKfs) => {
    setKeyframes(newKfs);
    if (timelineEngineRef.current) {
      timelineEngineRef.current.keyframes = newKfs;
      timelineEngineRef.current._recalculateSegments();
      setTotalDuration(timelineEngineRef.current.totalDuration);
    }

    if (setTourState && tour) {
      const updatedTour = {
        ...tour,
        cinematicTour: {
          enabled: newKfs.length > 0,
          loop: loopMode,
          totalDuration: timelineEngineRef.current?.totalDuration || 0,
          keyframes: newKfs
        },
        keyframes: newKfs
      };
      setTourState(updatedTour);
    }
  }, [tour, setTourState, loopMode]);

  const selectedKf = useMemo(() => {
    return keyframes.find((k) => k.id === selectedId) || null;
  }, [keyframes, selectedId]);

  // ─── Camera Capture Actions ──────────────────────────────────────────────────

  const handleCaptureView = useCallback(() => {
    if (!viewerRef?.current) {
      message.warning('Viewer is not ready to capture camera orientation.');
      return;
    }

    const viewer = viewerRef.current;
    // Yaw in radians:
    const yaw = viewer.getYaw ? viewer.getYaw() : (viewer.targetTheta || 0);
    // Pitch in radians:
    const pitch = viewer.getPitch ? viewer.getPitch() : (Math.PI / 2 - (viewer.targetPhi || Math.PI / 2));
    const fov = viewer.camera?.fov || viewer.fov || 80;
    const sceneId = currentSceneId || currentScene?.id || tour?.scenes?.[0]?.id || '';

    const newKeyframe = {
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sceneId,
      label: `Shot ${keyframes.length + 1} (${tour?.scenes?.find(s => s.id === sceneId)?.name || 'Scene'})`,
      yaw,
      pitch,
      fov,
      duration: 3.0,
      hold: 0,
      easing: 'power2.inOut',
      events: []
    };

    const nextKfs = [...keyframes, newKeyframe];
    persistKeyframes(nextKfs);
    setSelectedId(newKeyframe.id);
    message.success(`Captured Shot ${keyframes.length + 1} from current view!`);
  }, [viewerRef, currentSceneId, currentScene, tour, keyframes, persistKeyframes]);

  const handleUpdateFromCurrentView = useCallback(() => {
    if (!viewerRef?.current || !selectedKf) return;

    const viewer = viewerRef.current;
    const yaw = viewer.getYaw ? viewer.getYaw() : (viewer.targetTheta || 0);
    const pitch = viewer.getPitch ? viewer.getPitch() : (Math.PI / 2 - (viewer.targetPhi || Math.PI / 2));
    const fov = viewer.camera?.fov || viewer.fov || 80;
    const sceneId = currentSceneId || selectedKf.sceneId;

    const nextKfs = keyframes.map(k => {
      if (k.id === selectedKf.id) {
        return {
          ...k,
          sceneId,
          yaw,
          pitch,
          fov
        };
      }
      return k;
    });

    persistKeyframes(nextKfs);
    message.success(`Updated "${selectedKf.label}" with current camera angle.`);
  }, [viewerRef, selectedKf, currentSceneId, keyframes, persistKeyframes]);

  const handleJumpToKeyframe = useCallback((kf) => {
    if (!kf) return;
    setSelectedId(kf.id);

    // Switch scene if different
    if (kf.sceneId && kf.sceneId !== currentSceneId && onSceneChange) {
      onSceneChange(kf.sceneId);
    }

    // Direct camera to keyframe coordinates
    if (viewerRef?.current && viewerRef.current.setCameraOrientation) {
      viewerRef.current.setCameraOrientation(kf.yaw, kf.pitch, kf.fov);
    }
  }, [currentSceneId, onSceneChange, viewerRef]);

  const handleDeleteKeyframe = useCallback((id) => {
    const nextKfs = keyframes.filter(k => k.id !== id);
    persistKeyframes(nextKfs);
    if (selectedId === id) {
      setSelectedId(nextKfs[0]?.id || null);
    }
    message.info('Keyframe removed');
  }, [keyframes, selectedId, persistKeyframes]);

  const handleMoveKeyframe = useCallback((index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= keyframes.length) return;

    const next = [...keyframes];
    const item = next.splice(index, 1)[0];
    next.splice(targetIdx, 0, item);
    persistKeyframes(next);
  }, [keyframes, persistKeyframes]);

  const handleUpdateKeyframeField = useCallback((field, value) => {
    if (!selectedId) return;
    const nextKfs = keyframes.map(k => {
      if (k.id === selectedId) {
        return { ...k, [field]: value };
      }
      return k;
    });
    persistKeyframes(nextKfs);
  }, [selectedId, keyframes, persistKeyframes]);

  // ─── Transport Playback Actions ──────────────────────────────────────────────

  const handleTogglePlay = useCallback(() => {
    if (!timelineEngineRef.current) return;
    const engine = timelineEngineRef.current;

    if (isPlaying) {
      if (isPaused) {
        engine.resume();
      } else {
        engine.pause();
      }
    } else {
      if (keyframes.length === 0) {
        message.warning('Capture at least 1 keyframe shot to begin timeline playback.');
        return;
      }
      engine.play({ loop: loopMode, startTime: currentTime >= totalDuration ? 0 : currentTime });
    }
  }, [isPlaying, isPaused, keyframes.length, loopMode, currentTime, totalDuration]);

  const handleStop = useCallback(() => {
    if (!timelineEngineRef.current) return;
    timelineEngineRef.current.stop();
    setCurrentTime(0);
  }, []);

  const handleRestart = useCallback(() => {
    if (!timelineEngineRef.current) return;
    timelineEngineRef.current.restart();
  }, []);

  const handleSeek = useCallback((timeSec) => {
    if (!timelineEngineRef.current) return;
    timelineEngineRef.current.seek(timeSec);
  }, []);

  // ─── Scrubber & Ruler Dragging ──────────────────────────────────────────────

  const handleRulerMouseDown = (e) => {
    if (!rulerTrackRef.current || totalDuration <= 0) return;
    setIsDraggingRuler(true);

    const updateSeekFromPointer = (clientX) => {
      const rect = rulerTrackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = pct * totalDuration;
      handleSeek(targetTime);
    };

    updateSeekFromPointer(e.clientX);

    const onMouseMove = (moveEvent) => {
      updateSeekFromPointer(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingRuler(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ─── 3D Look-At Target Calculator ──────────────────────────────────────────

  const applyLookAtCoordinates = useCallback(() => {
    const { yaw, pitch } = lookAtToYawPitch(lookAtX, lookAtY, lookAtZ);
    handleUpdateKeyframeField('yaw', yaw);
    handleUpdateKeyframeField('pitch', pitch);

    if (viewerRef?.current?.setCameraOrientation) {
      viewerRef.current.setCameraOrientation(yaw, pitch, selectedKf?.fov || 80);
    }
    setShowLookAtHelper(false);
    message.success('Target Look-At orientation applied!');
  }, [lookAtX, lookAtY, lookAtZ, handleUpdateKeyframeField, viewerRef, selectedKf]);

  const applyHotspotLookAt = useCallback((hs) => {
    if (!hs) return;
    handleUpdateKeyframeField('yaw', hs.yaw);
    handleUpdateKeyframeField('pitch', hs.pitch);

    if (viewerRef?.current?.setCameraOrientation) {
      viewerRef.current.setCameraOrientation(hs.yaw, hs.pitch, selectedKf?.fov || 80);
    }
    setShowLookAtHelper(false);
    message.success(`Aimed camera directly at hotspot "${hs.title || hs.tooltip || 'Hotspot'}"!`);
  }, [handleUpdateKeyframeField, viewerRef, selectedKf]);

  // ─── Event Trigger Actions ──────────────────────────────────────────────────

  const handleAddEvent = useCallback(() => {
    if (!selectedKf) return;
    const events = selectedKf.events ? [...selectedKf.events] : [];
    events.push({ ...newEvent, id: `evt_${Date.now()}` });
    handleUpdateKeyframeField('events', events);
    setShowEventEditor(false);
    setNewEvent({ type: 'subtitle', text: '', duration: 3 });
    message.success('Timeline event trigger added!');
  }, [selectedKf, newEvent, handleUpdateKeyframeField]);

  const handleRemoveEvent = useCallback((eventIdx) => {
    if (!selectedKf || !selectedKf.events) return;
    const events = selectedKf.events.filter((_, idx) => idx !== eventIdx);
    handleUpdateKeyframeField('events', events);
  }, [selectedKf, handleUpdateKeyframeField]);

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const cardStyle = {
    background: 'rgba(23, 8, 13, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: 10,
    boxShadow: 'var(--shadow-sm)'
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: 6
  };

  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text-primary)' }}>

      {/* ── Section 1: Header & Sequence Stats ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 'var(--radius-xs)',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-bright))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px var(--accent-glow)'
            }}>
              <Icon name="Camera" size="xs" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                CINEMATIC TIMELINE
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {keyframes.length} Shot{keyframes.length !== 1 ? 's' : ''} • {formatTime(totalDuration)} Total
              </div>
            </div>
          </div>

          <Button
            size="small"
            type="primary"
            icon={<Icon name="Camera" size="xs" />}
            onClick={handleCaptureView}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-bright))',
              borderColor: 'transparent',
              boxShadow: '0 0 12px var(--accent-glow)',
              fontWeight: 600,
              fontSize: 11,
              height: 28
            }}
          >
            Capture View
          </Button>
        </div>

        {/* ── Section 2: Visual Scrubber & Time Ruler ── */}
        <div style={{ position: 'relative', marginTop: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
            <span>{formatTime(currentTime)}</span>
            <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>
              {isPlaying ? (isPaused ? 'PAUSED' : 'PLAYING') : 'STOPPED'}
            </span>
            <span>{formatTime(totalDuration)}</span>
          </div>

          {/* Draggable Track Ruler */}
          <div
            ref={rulerTrackRef}
            onMouseDown={handleRulerMouseDown}
            style={{
              position: 'relative',
              height: 38,
              background: 'rgba(10, 3, 6, 0.9)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              cursor: isDraggingRuler ? 'grabbing' : 'pointer',
              overflow: 'hidden'
            }}
          >
            {/* Tick Grid Marks */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(244,63,94,0.15) 0px, rgba(244,63,94,0.15) 1px, transparent 1px, transparent 20px)',
              pointerEvents: 'none'
            }} />

            {/* Playhead Progress Fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, rgba(159,18,57,0.3), rgba(244,63,94,0.45))',
              borderRight: '2px solid var(--accent-bright)',
              pointerEvents: 'none'
            }} />

            {/* Keyframe Badges on Ruler */}
            {keyframes.map((kf, idx) => {
              const seg = timelineEngineRef.current?._timeSegments?.[idx];
              const pct = seg && totalDuration > 0 ? (seg.startTime / totalDuration) * 100 : (idx / Math.max(1, keyframes.length - 1)) * 100;
              const isSelected = kf.id === selectedId;
              const isCurrent = idx === activeKeyframeIndex;

              return (
                <Tooltip key={kf.id} title={`${kf.label || `Shot ${idx + 1}`} (${kf.duration}s)`} placement="top">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToKeyframe(kf);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: isSelected ? 18 : 12,
                      height: isSelected ? 18 : 12,
                      borderRadius: 3,
                      rotate: '45deg',
                      background: isSelected ? 'var(--accent-bright)' : (isCurrent ? 'var(--cyan)' : 'var(--accent)'),
                      border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.6)',
                      boxShadow: isSelected ? '0 0 10px var(--accent-glow)' : 'none',
                      zIndex: isSelected ? 20 : 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: Transport Controls Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="Restart sequence from 0:00">
              <Button
                size="small"
                icon={<Icon name="RotateCcw" size="xs" />}
                onClick={handleRestart}
                disabled={keyframes.length === 0}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              />
            </Tooltip>

            <Tooltip title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Play Sequence'}>
              <Button
                size="small"
                type="primary"
                icon={isPlaying && !isPaused ? <Icon name="Pause" size="xs" /> : <Icon name="Play" size="xs" />}
                onClick={handleTogglePlay}
                disabled={keyframes.length === 0}
                style={{
                  background: isPlaying && !isPaused ? 'var(--amber)' : 'linear-gradient(135deg, var(--accent), var(--accent-bright))',
                  border: 'none',
                  boxShadow: isPlaying ? '0 0 10px var(--accent-glow)' : 'none',
                  color: '#fff',
                  width: 32,
                  height: 28
                }}
              />
            </Tooltip>

            <Tooltip title="Stop and reset">
              <Button
                size="small"
                icon={<Icon name="Square" size="xs" />}
                onClick={handleStop}
                disabled={!isPlaying && currentTime === 0}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          </div>

          {/* Loop & Speed controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip title={loopMode ? 'Looping enabled' : 'Looping disabled'}>
              <Button
                size="small"
                icon={<Icon name="Repeat" size="xs" />}
                onClick={() => {
                  const nextLoop = !loopMode;
                  setLoopMode(nextLoop);
                  if (timelineEngineRef.current) timelineEngineRef.current.loop = nextLoop;
                }}
                style={{
                  background: loopMode ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  borderColor: loopMode ? 'var(--accent)' : 'var(--border)',
                  color: loopMode ? 'var(--accent-bright)' : 'var(--text-muted)'
                }}
              />
            </Tooltip>

            <Select
              size="small"
              value={playbackSpeed}
              onChange={(val) => setPlaybackSpeed(val)}
              style={{ width: 68, fontSize: 11 }}
            >
              <Option value={0.5}>0.5x</Option>
              <Option value={1.0}>1.0x</Option>
              <Option value={1.5}>1.5x</Option>
              <Option value={2.0}>2.0x</Option>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Section 4: Keyframe Shots List ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={labelStyle}>SHOTS SEQUENCE</div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {keyframes.length} Shot{keyframes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {keyframes.length === 0 ? (
          <div style={{
            padding: '20px 10px', textAlign: 'center', background: 'rgba(0,0,0,0.2)',
            borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              No camera shots captured yet.
            </div>
            <Button
              size="small"
              type="dashed"
              icon={<Icon name="Camera" size="xs" />}
              onClick={handleCaptureView}
              style={{ color: 'var(--accent-bright)', borderColor: 'var(--accent)' }}
            >
              Capture Current View
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
            {keyframes.map((kf, index) => {
              const isSelected = kf.id === selectedId;
              const sceneObj = tour?.scenes?.find(s => s.id === kf.sceneId);

              return (
                <div
                  key={kf.id}
                  onClick={() => {
                    handleJumpToKeyframe(kf);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 10px var(--accent-glow)' : 'none'
                  }}
                >
                  {/* Sequence Number Indicator */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: isSelected ? 'var(--accent-bright)' : 'rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {index + 1}
                  </div>

                  {/* Shot details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {kf.label || `Shot ${index + 1}`}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tag color="magenta" style={{ fontSize: 9, padding: '0 4px', margin: 0 }}>
                        {sceneObj?.name || 'Scene'}
                      </Tag>
                      <span>⏱ {kf.duration}s</span>
                      {kf.hold > 0 && <span>• ⏸ {kf.hold}s hold</span>}
                    </div>
                  </div>

                  {/* Move Up/Down/Delete Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      type="text"
                      icon={<Icon name="ChevronUp" size="xs" />}
                      disabled={index === 0}
                      onClick={() => handleMoveKeyframe(index, -1)}
                      style={{ padding: '0 4px', color: 'var(--text-muted)', height: 20 }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<Icon name="ChevronDown" size="xs" />}
                      disabled={index === keyframes.length - 1}
                      onClick={() => handleMoveKeyframe(index, 1)}
                      style={{ padding: '0 4px', color: 'var(--text-muted)', height: 20 }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<Icon name="Trash2" size="xs" />}
                      onClick={() => handleDeleteKeyframe(kf.id)}
                      style={{ padding: '0 4px', color: 'var(--red)', height: 20 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Selected Shot Properties Inspector ── */}
      {selectedKf && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={labelStyle}>SHOT PROPERTIES</div>
            <Tag color="magenta">#{keyframes.findIndex(k => k.id === selectedKf.id) + 1}</Tag>
          </div>

          {/* Shot Title */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>LABEL</div>
            <Input
              size="small"
              value={selectedKf.label}
              onChange={(e) => handleUpdateKeyframeField('label', e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>

          {/* Scene Selector */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TARGET SCENE</div>
            <Select
              size="small"
              value={selectedKf.sceneId}
              onChange={(sceneId) => {
                handleUpdateKeyframeField('sceneId', sceneId);
                if (onSceneChange) onSceneChange(sceneId);
              }}
              style={{ width: '100%', fontSize: 12 }}
            >
              {(tour?.scenes || []).map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name || `Scene ${s.id}`}
                </Option>
              ))}
            </Select>
          </div>

          {/* Duration & Hold Steppers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TRANSITION (S)</div>
              <InputNumber
                size="small"
                min={0.5}
                max={30}
                step={0.5}
                value={selectedKf.duration}
                onChange={(val) => handleUpdateKeyframeField('duration', val || 3.0)}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>HOLD TIME (S)</div>
              <InputNumber
                size="small"
                min={0}
                max={15}
                step={0.5}
                value={selectedKf.hold || 0}
                onChange={(val) => handleUpdateKeyframeField('hold', val || 0)}
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
          </div>

          {/* Easing Preset */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>EASING CURVE</div>
            <Select
              size="small"
              value={selectedKf.easing || 'power2.inOut'}
              onChange={(val) => handleUpdateKeyframeField('easing', val)}
              style={{ width: '100%', fontSize: 12 }}
            >
              {EASE_PRESETS.map((p) => (
                <Option key={p.value} value={p.value}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{p.label}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </div>

          {/* Angles & FOV Display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>YAW</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {((selectedKf.yaw * 180) / Math.PI).toFixed(1)}°
              </div>
            </div>

            <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PITCH</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {((selectedKf.pitch * 180) / Math.PI).toFixed(1)}°
              </div>
            </div>

            <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>FOV</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {selectedKf.fov?.toFixed(0) || 80}°
              </div>
            </div>
          </div>

          {/* Update from view button */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Button
              size="small"
              icon={<Icon name="Camera" size="xs" />}
              onClick={handleUpdateFromCurrentView}
              style={{
                flex: 1,
                background: 'var(--accent-dim)',
                borderColor: 'var(--accent)',
                color: 'var(--accent-bright)',
                fontSize: 11
              }}
            >
              Update from View
            </Button>

            <Button
              size="small"
              icon={<Icon name="Compass" size="xs" />}
              onClick={() => setShowLookAtHelper(!showLookAtHelper)}
              style={{
                background: showLookAtHelper ? 'var(--accent)' : 'var(--bg-tertiary)',
                borderColor: 'var(--border)',
                color: showLookAtHelper ? '#fff' : 'var(--text-secondary)',
                fontSize: 11
              }}
            >
              Aim Target
            </Button>
          </div>

          {/* 3D Look-At Target Calculator Dropdown */}
          {showLookAtHelper && (
            <div style={{
              padding: '10px',
              background: 'rgba(10, 3, 6, 0.95)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-hover)',
              marginBottom: 10
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-bright)', marginBottom: 6 }}>
                3D LOOK-AT TARGET CALCULATOR
              </div>

              {/* Aim at existing hotspot option */}
              {currentScene?.hotspots && currentScene.hotspots.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>AIM AT HOTSPOT</div>
                  <Select
                    size="small"
                    placeholder="Select hotspot to aim at..."
                    style={{ width: '100%', fontSize: 11 }}
                    onChange={(hsId) => {
                      const hs = currentScene.hotspots.find(h => h.id === hsId);
                      if (hs) applyHotspotLookAt(hs);
                    }}
                  >
                    {currentScene.hotspots.map((hs, i) => (
                      <Option key={hs.id || i} value={hs.id}>
                        {hs.title || hs.tooltip || `Hotspot #${i + 1}`}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}

              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>OR ENTER 3D (X, Y, Z)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                <InputNumber size="small" placeholder="X" value={lookAtX} onChange={setLookAtX} style={{ fontSize: 11 }} />
                <InputNumber size="small" placeholder="Y" value={lookAtY} onChange={setLookAtY} style={{ fontSize: 11 }} />
                <InputNumber size="small" placeholder="Z" value={lookAtZ} onChange={setLookAtZ} style={{ fontSize: 11 }} />
              </div>

              <Button size="small" type="primary" onClick={applyLookAtCoordinates} style={{ width: '100%', fontSize: 11 }}>
                Calculate & Apply
              </Button>
            </div>
          )}

          {/* ── Event Triggers Section ── */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={labelStyle}>TIMELINE EVENT TRIGGERS</div>
              <Button
                size="small"
                type="text"
                icon={<Icon name="Plus" size="xs" />}
                onClick={() => setShowEventEditor(!showEventEditor)}
                style={{ color: 'var(--accent-bright)', padding: '0 4px', height: 20 }}
              >
                Add Trigger
              </Button>
            </div>

            {selectedKf.events && selectedKf.events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedKf.events.map((evt, eIdx) => (
                  <div
                    key={evt.id || eIdx}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border)', fontSize: 10
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag color="cyan" style={{ fontSize: 9, margin: 0 }}>{evt.type}</Tag>
                      <span style={{ color: 'var(--text-secondary)' }}>{evt.text || evt.payload || 'Trigger'}</span>
                    </div>
                    <Button
                      size="small"
                      type="text"
                      icon={<Icon name="X" size="xs" />}
                      onClick={() => handleRemoveEvent(eIdx)}
                      style={{ color: 'var(--red)', padding: 0, height: 16 }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                No events attached to this shot.
              </div>
            )}

            {/* Event creator popup */}
            {showEventEditor && (
              <div style={{
                marginTop: 8, padding: 8, background: 'rgba(10, 3, 6, 0.95)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-hover)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 6 }}>
                  <Select
                    size="small"
                    value={newEvent.type}
                    onChange={(type) => setNewEvent({ ...newEvent, type })}
                    style={{ fontSize: 11 }}
                  >
                    <Option value="subtitle">Subtitle Cue</Option>
                    <Option value="audio_cue">Audio Sound Cue</Option>
                    <Option value="hotspot_focus">Hotspot Pulse</Option>
                  </Select>

                  <Input
                    size="small"
                    placeholder="Subtitle text or cue message..."
                    value={newEvent.text}
                    onChange={(e) => setNewEvent({ ...newEvent, text: e.target.value })}
                    style={{ fontSize: 11 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="small" type="primary" onClick={handleAddEvent} style={{ flex: 1, fontSize: 10 }}>
                    Save Trigger
                  </Button>
                  <Button size="small" onClick={() => setShowEventEditor(false)} style={{ fontSize: 10 }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
