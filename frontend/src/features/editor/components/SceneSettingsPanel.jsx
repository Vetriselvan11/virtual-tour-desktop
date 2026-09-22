import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Slider, Button, Tooltip, Switch, message } from 'antd';
import Icon from '../../../components/common/Icon';

const { Option } = Select;

const TRANSITION_ANIMATIONS = [
  { value: 'fade', label: 'Smooth Fade', iconName: 'FaCircleCheck', desc: 'Standard crossfade to dark backdrop' },
  { value: 'zoom', label: 'Zoom In Focus', iconName: 'ZoomIn', desc: 'Seamless forward camera focal push' },
  { value: 'zoom-out', label: 'Zoom Pull Back', iconName: 'ZoomOut', desc: 'Cinematic wide pull-back zoom' },
  { value: 'portal', label: 'Portal Warp', iconName: 'Zap', desc: 'Hyperspace FOV acceleration' },
];

export function SceneSettingsPanel({
  scene,
  scenes = [],
  tour,
  onTourUpdate,
  viewerRef
}) {
  const [form] = Form.useForm();
  const [transitionEffect, setTransitionEffect] = useState('fade');
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [sceneFov, setSceneFov] = useState(80);

  useEffect(() => {
    if (scene) {
      const fovVal = scene.fov !== undefined ? parseFloat(scene.fov) : 80;
      form.setFieldsValue({
        name: scene.name || '',
        transitionEffect: scene.transitionEffect || 'fade',
        transitionDuration: scene.transitionDuration !== undefined ? scene.transitionDuration : 0.5,
        initialYaw: scene.initialYaw !== undefined ? scene.initialYaw : 0,
        initialPitch: scene.initialPitch !== undefined ? scene.initialPitch : 0,
        fov: fovVal
      });
      setTransitionEffect(scene.transitionEffect || 'fade');
      setTransitionDuration(scene.transitionDuration !== undefined ? scene.transitionDuration : 0.5);
      setSceneFov(fovVal);
    }
  }, [scene, form]);

  if (!scene || !tour) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-disabled)', fontSize: 12 }}>
        No scene selected
      </div>
    );
  }

  const isStartScene = tour.startScene === scene.id;

  const handleUpdateScene = (updates) => {
    const updatedScenes = scenes.map(s => s.id === scene.id ? { ...s, ...updates } : s);
    onTourUpdate({ ...tour, scenes: updatedScenes });
  };

  const handleCaptureInitialAngle = () => {
    if (!viewerRef?.current) {
      message.warning('Viewer controls not ready');
      return;
    }
    const yaw = viewerRef.current.getYaw ? viewerRef.current.getYaw() : (viewerRef.current.targetTheta !== undefined ? viewerRef.current.targetTheta : 0);
    const pitch = viewerRef.current.getPitch ? viewerRef.current.getPitch() : (viewerRef.current.targetPhi !== undefined ? Math.PI / 2 - viewerRef.current.targetPhi : 0);

    form.setFieldsValue({ initialYaw: yaw, initialPitch: pitch });
    handleUpdateScene({ initialYaw: yaw, initialPitch: pitch });
    const degYaw = ((yaw * 180) / Math.PI).toFixed(1);
    const degPitch = ((pitch * 180) / Math.PI).toFixed(1);
    message.success(`Starting angle saved! (Heading: ${degYaw}°, Tilt: ${degPitch}°)`);
  };

  const handlePreviewInitialAngle = () => {
    if (!viewerRef?.current) {
      message.warning('Viewer controls not ready');
      return;
    }
    const yaw = scene.initialYaw !== undefined ? parseFloat(scene.initialYaw) : 0;
    const pitch = scene.initialPitch !== undefined ? parseFloat(scene.initialPitch) : 0;
    const fov = scene.fov !== undefined ? parseFloat(scene.fov) : 80;

    if (viewerRef.current.setCameraOrientation) {
      viewerRef.current.setCameraOrientation(yaw, pitch, fov);
    } else {
      if (viewerRef.current.targetTheta !== undefined) viewerRef.current.targetTheta = yaw;
      if (viewerRef.current.targetPhi !== undefined) viewerRef.current.targetPhi = Math.PI / 2 - pitch;
    }
    message.info('Viewer aligned to saved room starting angle');
  };

  const labelStyle = { fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Current Scene Header Banner */}
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>
          ROOM CONFIGURATION
        </div>
        <Input
          size="small"
          value={form.getFieldValue('name')}
          onChange={e => {
            form.setFieldValue('name', e.target.value);
            handleUpdateScene({ name: e.target.value });
          }}
          placeholder="Room Name..."
          prefix={<Icon name="Pencil" size="xs" style={{ color: 'var(--text-muted)' }} />}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}
        />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {scene.id}</div>
      </div>

      {/* Start Scene Toggle Action */}
      <Button
        size="small"
        block
        icon={isStartScene ? <Icon name="Check" size="sm" /> : <Icon name="Crown" size="sm" />}
        onClick={() => {
          onTourUpdate({ ...tour, startScene: scene.id });
          message.success('Tour starting scene updated!');
        }}
        style={{
          background: isStartScene ? 'var(--green-dim)' : 'var(--bg-tertiary)',
          border: `1px solid ${isStartScene ? 'rgba(0,229,160,0.25)' : 'var(--border)'}`,
          color: isStartScene ? 'var(--green)' : 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: 11
        }}
      >
        {isStartScene ? 'This is the Tour Start Scene' : 'Set as Start Scene'}
      </Button>

      {/* Default Unzoomed Camera FOV Zoom Level */}
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="ZoomIn" size="xs" style={{ color: 'var(--accent)' }} /> 360 CAMERA FIELD OF VIEW (UNZOOMED)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>PERSPECTIVE ANGLE</span>
          <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{sceneFov}°</span>
        </div>
        <Slider
          min={60}
          max={105}
          step={1}
          value={sceneFov}
          onChange={v => {
            setSceneFov(v);
            form.setFieldValue('fov', v);
            handleUpdateScene({ fov: v });
            if (viewerRef?.current?.camera) {
              viewerRef.current.camera.fov = v;
              viewerRef.current.camera.updateProjectionMatrix();
            }
          }}
        />
      </div>

      {/* Scene Transition Animation Options */}
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="FaFilm" size="xs" style={{ color: 'var(--cyan)' }} /> SCENE TRANSITION ANIMATION
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {TRANSITION_ANIMATIONS.map(anim => {
            const isSelected = transitionEffect === anim.value;
            return (
              <div
                key={anim.value}
                onClick={() => {
                  setTransitionEffect(anim.value);
                  form.setFieldValue('transitionEffect', anim.value);
                  handleUpdateScene({ transitionEffect: anim.value });
                }}
                style={{
                  padding: '8px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--cyan-dim)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'all 0.15s'
                }}
              >
                <Icon name={anim.iconName} size="sm" style={{ color: isSelected ? 'var(--cyan)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: 10, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                  {anim.label}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
            <span>TRANSITION DURATION</span>
            <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{transitionDuration.toFixed(2)}s</span>
          </div>
          <Slider
            min={0.2}
            max={2.0}
            step={0.05}
            value={transitionDuration}
            onChange={v => {
              setTransitionDuration(v);
              form.setFieldValue('transitionDuration', v);
              handleUpdateScene({ transitionDuration: v });
            }}
          />
        </div>
      </div>

      {/* Starting Orientation Controls */}
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
      }}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="Compass" size="xs" style={{ color: 'var(--amber)' }} /> STARTING CAMERA ANGLE
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          Rotate the panorama to your preferred perspective and lock it as the default starting entry angle.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <Button
            size="small"
            block
            icon={<Icon name="Target" size="sm" />}
            onClick={handleCaptureInitialAngle}
            style={{
              background: 'var(--amber-dim)',
              border: '1px solid rgba(255,179,71,0.25)',
              color: 'var(--amber)',
              fontWeight: 600,
              fontSize: 11
            }}
          >
            Capture Current View as Start Angle
          </Button>
          <Button
            size="small"
            block
            icon={<Icon name="Eye" size="sm" />}
            onClick={handlePreviewInitialAngle}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 11
            }}
          >
            Go to Saved Start Angle
          </Button>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--text-muted)',
          padding: '4px 6px', background: 'rgba(0,0,0,0.25)',
          borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)'
        }}>
          <span>HEADING: <strong style={{ color: 'var(--amber)' }}>{((scene.initialYaw || 0) * 180 / Math.PI).toFixed(1)}°</strong></span>
          <span>TILT: <strong style={{ color: 'var(--amber)' }}>{((scene.initialPitch || 0) * 180 / Math.PI).toFixed(1)}°</strong></span>
        </div>
      </div>
    </div>
  );
}
