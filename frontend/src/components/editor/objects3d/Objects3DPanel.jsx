import React, { useState, useRef } from 'react';
import { Button, Input, Slider, Select, Switch, Space, Tag, Modal, Tooltip, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../common/Icon';
import HotspotActionListEditor from '../hotspots/HotspotActionListEditor';
import httpClient from '../../../services/http/httpClient';

/**
 * Production 3D Objects Studio Inspector Panel for 360TOOL.
 */
export default function Objects3DPanel({
  currentScene,
  tour,
  tourId: propTourId,
  onSceneUpdate,
  viewerRef,
  currentSceneId
}) {
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [gizmoMode, setGizmoMode] = useState('translate');
  const [activeTab, setActiveTab] = useState('transform'); // 'transform' | 'animation' | 'actions'
  const fileInputRef = useRef(null);

  const objectsList = currentScene?.objects3d || currentScene?.objects || [];
  const selectedObject = objectsList.find((o) => o.id === selectedObjectId) || null;

  // ─── Object Creation & Upload ──────────────────────────────────────────────

  const handleUploadModel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tourId = propTourId || tour?.id || tour?._id || 'temp';
    const formData = new FormData();
    formData.append('model', file);

    setIsUploading(true);
    try {
      const res = await httpClient.post(`/api/upload-model/${tourId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.asset) {
        const asset = res.data.asset;
        const newObjId = `obj_${Date.now()}`;

        // Calculate default position in front of active camera
        let initPos = { x: 0, y: -0.5, z: 2.5 };
        if (viewerRef?.current) {
          const yaw = viewerRef.current.getYaw() || 0;
          const pitch = viewerRef.current.getPitch() || 0;
          const r = 2.5;
          initPos = {
            x: Number((r * Math.cos(pitch) * Math.sin(yaw)).toFixed(3)),
            y: Number((r * Math.sin(pitch)).toFixed(3)),
            z: Number((r * Math.cos(pitch) * Math.cos(yaw)).toFixed(3))
          };
        }

        const newObject = {
          id: newObjId,
          name: file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, ' '),
          asset: {
            url: asset.url,
            filename: asset.filename,
            format: asset.format,
            fileSize: asset.fileSize,
            metadata: asset.metadata
          },
          transform: {
            position: initPos,
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          visible: true,
          interaction: {
            enabled: true,
            hover: true,
            click: true,
            tooltip: file.name.replace(/\.[^/.]+$/, ''),
            hoverScale: 1.05,
            hoverHighlight: true
          },
          animation: {
            enabled: (asset.metadata?.animationCount || 0) > 0,
            autoplay: true,
            activeClip: asset.metadata?.animationClips?.[0] || '',
            loop: 'repeat',
            timeScale: 1.0,
            availableClips: asset.metadata?.animationClips || []
          },
          actions: []
        };

        const updatedObjects = [...objectsList, newObject];
        saveObjects(updatedObjects);
        setSelectedObjectId(newObjId);
        if (viewerRef?.current) {
          viewerRef.current.updateObjects3D(updatedObjects, newObjId);
          viewerRef.current.selectObject(newObjId);
        }
        message.success(`3D Model "${file.name}" placed in scene.`);
      }
    } catch (err) {
      console.error('Failed to upload 3D model:', err);
      message.error(err.response?.data?.message || 'Failed to upload 3D model.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePlaceInViewport = () => {
    if (!selectedObject || !viewerRef?.current) return;
    const yaw = viewerRef.current.getYaw() || 0;
    const pitch = viewerRef.current.getPitch() || 0;
    const r = 2.5;

    const newPos = {
      x: Number((r * Math.cos(pitch) * Math.sin(yaw)).toFixed(3)),
      y: Number((r * Math.sin(pitch)).toFixed(3)),
      z: Number((r * Math.cos(pitch) * Math.cos(yaw)).toFixed(3))
    };

    updateObjectProperty(selectedObject.id, 'transform.position', newPos);
    message.success('Object centered in current view.');
  };

  const saveObjects = (newList) => {
    if (onSceneUpdate && currentScene) {
      onSceneUpdate({
        ...currentScene,
        objects3d: newList
      });
    }
  };

  const updateObjectProperty = (objId, path, value) => {
    const updatedList = objectsList.map((obj) => {
      if (obj.id !== objId) return obj;
      const clone = JSON.parse(JSON.stringify(obj));
      const parts = path.split('.');
      let target = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
      return clone;
    });

    saveObjects(updatedList);
    const updatedObj = updatedList.find((o) => o.id === objId);
    if (viewerRef?.current?.object3dManager && updatedObj) {
      viewerRef.current.object3dManager.updateInPlace(updatedObj, objId);
    }
  };

  const handleDeleteObject = (objId) => {
    Modal.confirm({
      title: 'Delete 3D Object',
      content: 'Are you sure you want to remove this 3D model from the scene?',
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const updated = objectsList.filter((o) => o.id !== objId);
        saveObjects(updated);
        if (selectedObjectId === objId) {
          setSelectedObjectId(null);
        }
        if (viewerRef?.current) {
          viewerRef.current.updateObjects3D(updated, null);
        }
        message.success('3D object removed.');
      }
    });
  };

  const handleDuplicateObject = (obj) => {
    const newId = `obj_${Date.now()}`;
    const clone = JSON.parse(JSON.stringify(obj));
    clone.id = newId;
    clone.name = `${obj.name} (Copy)`;
    clone.transform.position.x += 0.4;
    clone.transform.position.z += 0.2;

    const updated = [...objectsList, clone];
    saveObjects(updated);
    setSelectedObjectId(newId);
    if (viewerRef?.current) {
      viewerRef.current.updateObjects3D(updated, newId);
      viewerRef.current.selectObject(newId);
    }
    message.success('3D object duplicated.');
  };

  const handleSetGizmo = (mode) => {
    setGizmoMode(mode);
    if (viewerRef?.current) {
      viewerRef.current.setGizmoMode(mode);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      {/* Hidden File Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadModel}
        accept=".glb,.gltf,.bin"
        style={{ display: 'none' }}
      />

      {/* Top Header & Add Model Actions */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
            <Icon name="Box" size="sm" />
            <span>3D Interactive Objects</span>
            <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
              {objectsList.length}
            </Tag>
          </div>
        </div>

        <Space orientation="horizontal" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<Icon name="Plus" size="sm" />}
            loading={isUploading}
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, borderRadius: 6 }}
          >
            Add 3D Model
          </Button>
          {selectedObject && (
            <Tooltip title="Place object in current camera view">
              <Button
                icon={<Icon name="Target" size="sm" />}
                onClick={handlePlaceInViewport}
                style={{ borderRadius: 6 }}
              >
                Place Here
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Object List & Details Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {objectsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📦</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No 3D objects in this scene</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Upload GLB/GLTF models to place interactive 3D elements inside your 360° environment.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Object Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {objectsList.map((obj) => {
                const isSel = obj.id === selectedObjectId;
                return (
                  <div
                    key={obj.id}
                    onClick={() => {
                      setSelectedObjectId(obj.id);
                      if (viewerRef?.current) {
                        viewerRef.current.selectObject(obj.id);
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSel ? 'var(--accent-dim)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, background: 'var(--bg-tertiary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Icon name="Box" size="sm" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {obj.name || 'Unnamed Object'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                          <Tag style={{ fontSize: 9, padding: '0 3px', lineHeight: '14px', margin: 0 }}>
                            {obj.asset?.format?.toUpperCase() || 'GLB'}
                          </Tag>
                          {obj.animation?.enabled && (
                            <Tag color="purple" style={{ fontSize: 9, padding: '0 3px', lineHeight: '14px', margin: 0 }}>
                              Anim
                            </Tag>
                          )}
                          {obj.actions?.length > 0 && (
                            <Tag color="blue" style={{ fontSize: 9, padding: '0 3px', lineHeight: '14px', margin: 0 }}>
                              {obj.actions.length} act
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<Icon name={obj.visible !== false ? 'Eye' : 'EyeOff'} size="xs" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateObjectProperty(obj.id, 'visible', obj.visible === false);
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<Icon name="Copy" size="xs" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateObject(obj);
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Icon name="Trash2" size="xs" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteObject(obj.id);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inspector Details for Selected Object */}
            {selectedObject && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {/* Sub-Tabs: Transform / Animation / Actions */}
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 6, padding: 2, marginBottom: 12 }}>
                  {[
                    { key: 'transform', label: 'Transform', icon: 'Move' },
                    { key: 'animation', label: 'Animation', icon: 'Film' },
                    { key: 'actions', label: 'Actions', icon: 'Zap' }
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        border: 'none',
                        borderRadius: 4,
                        background: activeTab === t.key ? 'var(--accent)' : 'transparent',
                        color: activeTab === t.key ? '#fff' : 'var(--text-muted)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.15s'
                      }}
                    >
                      <Icon name={t.icon} size="xs" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* TAB 1: Transform & Gizmos */}
                {activeTab === 'transform' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Gizmo Mode Selector */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                        Interactive Gizmo Mode
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { mode: 'translate', label: 'Move (W)' },
                          { mode: 'rotate', label: 'Rotate (E)' },
                          { mode: 'scale', label: 'Scale (R)' }
                        ].map((g) => (
                          <Button
                            key={g.mode}
                            size="small"
                            type={gizmoMode === g.mode ? 'primary' : 'default'}
                            onClick={() => handleSetGizmo(g.mode)}
                            style={{ flex: 1, fontSize: 11 }}
                          >
                            {g.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Name & Group */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                        Name
                      </div>
                      <Input
                        size="small"
                        value={selectedObject.name || ''}
                        onChange={(e) => updateObjectProperty(selectedObject.id, 'name', e.target.value)}
                        placeholder="Object Name"
                      />
                    </div>

                    {/* Position (X, Y, Z) */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Position (Meters)</span>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 10 }}
                          onClick={() => updateObjectProperty(selectedObject.id, 'transform.position', { x: 0, y: -0.5, z: 2.5 })}
                        >
                          Reset
                        </Button>
                      </div>
                      {['x', 'y', 'z'].map((axis) => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ width: 14, fontSize: 10, fontWeight: 700, color: axis === 'x' ? '#ff4d4f' : axis === 'y' ? '#52c41a' : '#1890ff' }}>
                            {axis.toUpperCase()}
                          </span>
                          <Slider
                            min={-10}
                            max={10}
                            step={0.05}
                            value={selectedObject.transform?.position?.[axis] || 0}
                            onChange={(val) => updateObjectProperty(selectedObject.id, `transform.position.${axis}`, val)}
                            style={{ flex: 1, margin: '4px 0' }}
                          />
                          <Input
                            size="small"
                            type="number"
                            step="0.1"
                            value={selectedObject.transform?.position?.[axis] || 0}
                            onChange={(e) => updateObjectProperty(selectedObject.id, `transform.position.${axis}`, parseFloat(e.target.value) || 0)}
                            style={{ width: 56, fontSize: 11 }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Rotation (X, Y, Z) */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Rotation (Degrees)</span>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 10 }}
                          onClick={() => updateObjectProperty(selectedObject.id, 'transform.rotation', { x: 0, y: 0, z: 0 })}
                        >
                          Reset
                        </Button>
                      </div>
                      {['x', 'y', 'z'].map((axis) => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ width: 14, fontSize: 10, fontWeight: 700, color: axis === 'x' ? '#ff4d4f' : axis === 'y' ? '#52c41a' : '#1890ff' }}>
                            {axis.toUpperCase()}
                          </span>
                          <Slider
                            min={-180}
                            max={180}
                            step={1}
                            value={selectedObject.transform?.rotation?.[axis] || 0}
                            onChange={(val) => updateObjectProperty(selectedObject.id, `transform.rotation.${axis}`, val)}
                            style={{ flex: 1, margin: '4px 0' }}
                          />
                          <Input
                            size="small"
                            type="number"
                            value={selectedObject.transform?.rotation?.[axis] || 0}
                            onChange={(e) => updateObjectProperty(selectedObject.id, `transform.rotation.${axis}`, parseFloat(e.target.value) || 0)}
                            style={{ width: 56, fontSize: 11 }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Scale */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Scale Multiplier</span>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 10 }}
                          onClick={() => updateObjectProperty(selectedObject.id, 'transform.scale', { x: 1, y: 1, z: 1 })}
                        >
                          Reset
                        </Button>
                      </div>
                      {['x', 'y', 'z'].map((axis) => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ width: 14, fontSize: 10, fontWeight: 700, color: axis === 'x' ? '#ff4d4f' : axis === 'y' ? '#52c41a' : '#1890ff' }}>
                            {axis.toUpperCase()}
                          </span>
                          <Slider
                            min={0.05}
                            max={5}
                            step={0.05}
                            value={typeof selectedObject.transform?.scale === 'number' ? selectedObject.transform.scale : (selectedObject.transform?.scale?.[axis] || 1)}
                            onChange={(val) => updateObjectProperty(selectedObject.id, `transform.scale.${axis}`, val)}
                            style={{ flex: 1, margin: '4px 0' }}
                          />
                          <Input
                            size="small"
                            type="number"
                            step="0.05"
                            value={typeof selectedObject.transform?.scale === 'number' ? selectedObject.transform.scale : (selectedObject.transform?.scale?.[axis] || 1)}
                            onChange={(e) => updateObjectProperty(selectedObject.id, `transform.scale.${axis}`, parseFloat(e.target.value) || 1)}
                            style={{ width: 56, fontSize: 11 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 2: Animation */}
                {activeTab === 'animation' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Enable Animation</span>
                      <Switch
                        size="small"
                        checked={selectedObject.animation?.enabled !== false}
                        onChange={(val) => updateObjectProperty(selectedObject.id, 'animation.enabled', val)}
                      />
                    </div>

                    {selectedObject.animation?.availableClips?.length > 0 ? (
                      <>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                            Active Animation Clip
                          </div>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={selectedObject.animation?.activeClip || selectedObject.animation.availableClips[0]}
                            onChange={(val) => updateObjectProperty(selectedObject.id, 'animation.activeClip', val)}
                            options={selectedObject.animation.availableClips.map((c) => ({ label: c, value: c }))}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Autoplay on Scene Load</span>
                          <Switch
                            size="small"
                            checked={selectedObject.animation?.autoplay !== false}
                            onChange={(val) => updateObjectProperty(selectedObject.id, 'animation.autoplay', val)}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                            Loop Mode
                          </div>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={selectedObject.animation?.loop || 'repeat'}
                            onChange={(val) => updateObjectProperty(selectedObject.id, 'animation.loop', val)}
                            options={[
                              { label: 'Repeat Forever', value: 'repeat' },
                              { label: 'Play Once & Hold', value: 'once' }
                            ]}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                            Playback Speed ({selectedObject.animation?.timeScale || 1.0}x)
                          </div>
                          <Slider
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            value={selectedObject.animation?.timeScale || 1.0}
                            onChange={(val) => updateObjectProperty(selectedObject.id, 'animation.timeScale', val)}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-muted)', fontSize: 11 }}>
                        This 3D model does not contain embedded animation tracks.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Actions & Interactions */}
                {activeTab === 'actions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                        Hover Tooltip Text
                      </div>
                      <Input
                        size="small"
                        value={selectedObject.interaction?.tooltip || ''}
                        onChange={(e) => updateObjectProperty(selectedObject.id, 'interaction.tooltip', e.target.value)}
                        placeholder="Click to interact with 3D model"
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Hover Scale Effect</span>
                      <Switch
                        size="small"
                        checked={selectedObject.interaction?.hoverHighlight !== false}
                        onChange={(val) => updateObjectProperty(selectedObject.id, 'interaction.hoverHighlight', val)}
                      />
                    </div>

                    {/* Action Chain List Editor */}
                    <div style={{ marginTop: 8 }}>
                      <HotspotActionListEditor
                        hotspot={selectedObject}
                        scenes={tour?.scenes || []}
                        currentSceneId={currentSceneId}
                        viewerRef={viewerRef}
                        onChange={(updatedActions) => updateObjectProperty(selectedObject.id, 'actions', updatedActions)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
