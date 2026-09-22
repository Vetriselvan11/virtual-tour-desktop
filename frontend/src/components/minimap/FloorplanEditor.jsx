import React, { useState, useEffect } from 'react';
import { Upload, Button, Select, Space, message, Tag, Radio } from 'antd';
import Icon from '../common/Icon';
import { getImageUrl } from '../../services/http/httpClient';
import { uploadImage } from '../../features/editor/services/upload.service';

const { Option } = Select;

/**
 * Floorplan Layout Editor and Alignment Studio.
 * Allows authors to upload floorplans and link scenes to responsive percentage coordinates.
 * Supports up to 2 separate floor layouts (Floor 1 & Floor 2).
 */
export default function FloorplanEditor({ tour, onUpdate, onClose }) {
  const [activeFloor, setActiveFloor] = useState('1'); // '1' | '2'
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Load floors (Floor 1 and Floor 2 are saved in Tour persistent configuration)
  const floor1Plan = tour?.floorplan || null;
  const floor1Pins = tour?.floorplanPins || {};
  const floor2Plan = tour?.floor2Plan || null;
  const floor2Pins = tour?.floor2Pins || {};
  const scenes = tour?.scenes || [];

  const currentPlan = activeFloor === '1' ? floor1Plan : floor2Plan;
  const currentPins = activeFloor === '1' ? floor1Pins : floor2Pins;
  
  // Handle floorplan image file uploading
  const handleFloorplanUpload = async (file) => {
    setUploading(true);
    try {
      const res = await uploadImage(tour.id, file);
      if (activeFloor === '1') {
        onUpdate({
          ...tour,
          floorplan: res.url
        });
      } else {
        onUpdate({
          ...tour,
          floor2Plan: res.url
        });
        // Clear any legacy localStorage key to avoid conflicting state
        localStorage.removeItem(`tour_floorplan_f2_${tour.id}`);
      }
      message.success(`Floor ${activeFloor} blueprint uploaded!`);
    } catch (err) {
      message.error('Failed to upload blueprint: ' + err.message);
    } finally {
      setUploading(false);
    }
    return false; // prevent default browser upload
  };

  // Capture click position on image to align selected scene marker
  const handleMapClick = (e) => {
    if (!selectedSceneId) {
      message.warning('Please select a scene from the dropdown first before placing a marker!');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeFloor === '1') {
      const updatedF1Pins = {
        ...floor1Pins,
        [selectedSceneId]: { x, y }
      };
      
      // If we pin on Floor 1, make sure it's removed from Floor 2 to avoid duplicates
      const updatedF2Pins = { ...floor2Pins };
      delete updatedF2Pins[selectedSceneId];

      onUpdate({
        ...tour,
        floorplanPins: updatedF1Pins,
        floor2Pins: updatedF2Pins
      });
      localStorage.removeItem(`tour_floorplan_pins_f2_${tour.id}`);
    } else {
      const updatedF2Pins = {
        ...floor2Pins,
        [selectedSceneId]: { x, y }
      };

      // Remove from Floor 1
      const updatedF1Pins = { ...floor1Pins };
      delete updatedF1Pins[selectedSceneId];

      onUpdate({
        ...tour,
        floorplanPins: updatedF1Pins,
        floor2Pins: updatedF2Pins
      });
      localStorage.removeItem(`tour_floorplan_pins_f2_${tour.id}`);
    }

    message.success(`Marker aligned for scene: ${scenes.find(s => s.id === selectedSceneId)?.name || selectedSceneId}`);
  };

  const handleClearPin = (sceneId) => {
    if (activeFloor === '1') {
      const updatedPins = { ...floor1Pins };
      delete updatedPins[sceneId];
      onUpdate({
        ...tour,
        floorplanPins: updatedPins
      });
    } else {
      const updatedF2Pins = { ...floor2Pins };
      delete updatedF2Pins[sceneId];
      onUpdate({
        ...tour,
        floor2Pins: updatedF2Pins
      });
      localStorage.removeItem(`tour_floorplan_pins_f2_${tour.id}`);
    }
  };

  const handleRemoveFloorplan = () => {
    if (activeFloor === '1') {
      onUpdate({
        ...tour,
        floorplan: null,
        floorplanPins: {}
      });
    } else {
      onUpdate({
        ...tour,
        floor2Plan: null,
        floor2Pins: {}
      });
      localStorage.removeItem(`tour_floorplan_f2_${tour.id}`);
      localStorage.removeItem(`tour_floorplan_pins_f2_${tour.id}`);
    }
    message.info(`Floor ${activeFloor} layout cleared`);
  };

  return (
    <div style={{ padding: '16px', background: 'var(--bg-secondary)', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Icon name="Compass" size="sm" style={{ color: 'var(--cyan)' }} />
          FLOORPLAN STUDIO
        </span>
        <Button size="small" type="text" onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</Button>
      </div>

      {/* Floor Select switcher */}
      <div style={{ marginBottom: '14px', textAlign: 'center' }}>
        <Radio.Group value={activeFloor} onChange={e => setActiveFloor(e.target.value)} size="small" buttonStyle="solid">
          <Radio.Button value="1">FLOOR 1</Radio.Button>
          <Radio.Button value="2">FLOOR 2</Radio.Button>
        </Radio.Group>
      </div>

      {/* Upload Blueprint Section */}
      {!currentPlan ? (
        <div style={{ padding: '24px 16px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', textAlign: 'center', marginBottom: '16px' }}>
          <Icon name="Image" style={{ color: 'var(--text-disabled)', marginBottom: '10px', display: 'block', margin: '0 auto' }} size="xl" />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Upload a PNG/JPG schematic map for Floor {activeFloor}
          </div>
          <Upload beforeUpload={handleFloorplanUpload} showUploadList={false} accept="image/*">
            <Button icon={<Icon name="Upload" size="sm" />} loading={uploading} type="primary" size="small">
              Upload Floor {activeFloor}
            </Button>
          </Upload>
        </div>
      ) : (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>ACTIVE BLUEPRINT</span>
            <Button size="small" danger onClick={handleRemoveFloorplan} icon={<Icon name="Trash2" size="sm" />} style={{ fontSize: '10px', height: '22px', padding: '0 8px' }}>
              Remove
            </Button>
          </div>

          {/* Selector Dropdown */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>1. SELECT ROOM TARGET</div>
            <Select
              placeholder="Select target..."
              value={selectedSceneId}
              onChange={setSelectedSceneId}
              style={{ width: '100%' }}
              dropdownStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {scenes.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name || s.id} {floor1Pins[s.id] ? '(Linked F1 ✓)' : (floor2Pins[s.id] ? '(Linked F2 ✓)' : '')}
                </Option>
              ))}
            </Select>
          </div>

          {/* Interactive Alignment Blueprint */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>2. CLICK BLUEPRINT TO PLACE PIN</div>
            <div
              onClick={handleMapClick}
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                cursor: selectedSceneId ? 'crosshair' : 'not-allowed',
                aspectRatio: '4/3'
              }}
            >
              {/* Map background */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${getImageUrl(currentPlan)})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />

              {/* Pins layer */}
              {Object.keys(currentPins).map((sceneId) => {
                const pin = currentPins[sceneId];
                if (!pin) return null;
                const isSelected = sceneId === selectedSceneId;
                const sceneName = scenes.find(s => s.id === sceneId)?.name || sceneId;

                return (
                  <div
                    key={sceneId}
                    style={{
                      position: 'absolute',
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--cyan)' : 'var(--accent)',
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                        position: 'relative'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: '14px',
                          top: '-4px',
                          fontSize: '8px',
                          background: 'rgba(0,0,0,0.85)',
                          color: '#fff',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {sceneName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Linked Markers List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
          FLOOR {activeFloor} PINNED TARGETS ({Object.keys(currentPins).length})
        </div>
        {Object.keys(currentPins).length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
            No room markers pinned on Floor {activeFloor}
          </div>
        ) : (
          Object.keys(currentPins).map((sceneId) => {
            const sceneName = scenes.find(s => s.id === sceneId)?.name || sceneId;
            return (
              <div
                key={sceneId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '6px',
                  border: '1px solid var(--border)'
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {sceneName}
                </span>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<Icon name="Trash2" size="sm" />}
                  onClick={() => handleClearPin(sceneId)}
                  style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
