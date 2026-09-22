import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Space, Tooltip } from 'antd';
import Icon from '../common/Icon';
import { getImageUrl } from '../../services/http/httpClient';

/**
 * Premium krpano-style Floorplan Minimap overlay.
 * Synchronizes a triangular neon radar cone with the camera yaw heading in real-time.
 * Supports panning, zooming, floor switching, and pulsed active marker nodes.
 */
const MiniMap = forwardRef(function MiniMap(
  {
    tour,
    currentSceneId,
    cameraYaw = 0, // in radians
    onSelectScene,
    editMode = false
  },
  ref
) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activeFloor, setActiveFloor] = useState('1'); // '1' | '2'

  const radarConeRef = useRef(null);
  const lastYawRef = useRef(cameraYaw);

  useImperativeHandle(ref, () => ({
    setYaw: (yaw) => {
      lastYawRef.current = yaw;
      if (radarConeRef.current) {
        const deg = -(yaw * (180 / Math.PI));
        radarConeRef.current.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      }
    }
  }), []);

  if (!tour) return null;

  // Retrieve floor information (multi-floor support with persistent tour model)
  const floor1Plan = tour.floorplan || null;
  const floor1Pins = tour.floorplanPins || {};

  const floor2Plan = tour.floor2Plan || localStorage.getItem(`tour_floorplan_f2_${tour.id}`) || null;
  const floor2Pins = tour.floor2Pins || JSON.parse(localStorage.getItem(`tour_floorplan_pins_f2_${tour.id}`) || '{}');

  const currentPlan = activeFloor === '1' ? floor1Plan : floor2Plan;
  const currentPins = activeFloor === '1' ? floor1Pins : floor2Pins;

  // Sync active floor to where current scene is pinned if needed
  useEffect(() => {
    if (floor2Pins[currentSceneId]) {
      setActiveFloor('2');
    } else if (floor1Pins[currentSceneId]) {
      setActiveFloor('1');
    }
  }, [currentSceneId, floor1Pins, floor2Pins]);

  const rotationDeg = cameraYaw ? -(cameraYaw * (180 / Math.PI)) : 0;
  const currentPin = currentPins[currentSceneId];

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.map-pin-btn')) return; // ignore pin clicks
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.6, Math.min(4.0, z - e.deltaY * 0.0015)));
  };

  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="minimap-card"
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        width: '200px',
        height: '220px',
        background: 'rgba(10, 10, 15, 0.78)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md), 0 0 16px rgba(0, 212, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        transition: 'border 0.3s ease',
        userSelect: 'none'
      }}
    >
      {/* Title Header / Toolbar */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid var(--border)',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Icon name="Compass" size="sm" style={{ color: 'var(--cyan)' }} />
          <span>MAP STUDIO</span>
        </div>
        
        {/* Zoom Controls */}
        {currentPlan && (
          <Space size={6}>
            <Tooltip title="Reset View">
              <Icon name="RefreshCw" onClick={resetZoom} style={{ cursor: 'pointer', fontSize: 10 }} size="sm" />
            </Tooltip>
            <Icon name="ZoomIn" onClick={() => setZoom(z => Math.min(4, z + 0.2))} style={{ cursor: 'pointer', fontSize: 10 }} size="sm" />
            <Icon name="ZoomOut" onClick={() => setZoom(z => Math.max(0.6, z - 0.2))} style={{ cursor: 'pointer', fontSize: 10 }} size="sm" />
          </Space>
        )}
      </div>

      {/* Map Content Viewport */}
      <div 
        onMouseDown={currentPlan ? handleMouseDown : undefined}
        onMouseMove={currentPlan ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={currentPlan ? handleWheel : undefined}
        style={{ 
          flex: 1, 
          position: 'relative', 
          overflow: 'hidden', 
          cursor: isPanning ? 'grabbing' : (currentPlan ? 'grab' : 'default') 
        }}
      >
        {currentPlan ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              position: 'relative'
            }}
          >
            {/* Floorplan Image Background */}
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${getImageUrl(currentPlan)})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.8
              }}
            />

            {/* Pins and Radar cones Layer */}
            {Object.keys(currentPins).map((sceneId) => {
              const pin = currentPins[sceneId];
              if (!pin) return null;

              const isCurrent = sceneId === currentSceneId;
              const scene = tour.scenes?.find((s) => s.id === sceneId);
              if (!scene) return null;

              return (
                <div
                  key={sceneId}
                  style={{
                    position: 'absolute',
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isCurrent ? 20 : 10
                  }}
                >
                  {isCurrent && (
                    /* Heading Radar Cone rotated via CSS transform */
                    <div
                      ref={radarConeRef}
                      className="radar-cone"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: '80px',
                        height: '80px',
                        transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                        pointerEvents: 'none',
                        transition: 'transform 0.05s linear',
                        zIndex: -1
                      }}
                    >
                      <svg width="100%" height="100%" viewBox="0 0 100 100">
                        <defs>
                          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <path
                          d="M50,50 L30,10 A35,35 0 0,1 70,10 Z"
                          fill="url(#radarGlow)"
                          stroke="rgba(0, 212, 255, 0.4)"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Node Dot marker */}
                  <div
                    onClick={() => onSelectScene(sceneId)}
                    className="map-pin-btn"
                    style={{
                      width: isCurrent ? '11px' : '8px',
                      height: isCurrent ? '11px' : '8px',
                      borderRadius: '50%',
                      background: isCurrent ? 'var(--cyan)' : '#ffffff',
                      border: `1.5px solid ${isCurrent ? '#ffffff' : 'rgba(0,0,0,0.6)'}`,
                      cursor: 'pointer',
                      boxShadow: isCurrent ? '0 0 10px var(--cyan), 0 0 20px var(--cyan)' : 'none',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    title={scene.name || scene.id}
                  >
                    {isCurrent && (
                      <span
                        style={{
                          position: 'absolute',
                          width: '19px',
                          height: '19px',
                          borderRadius: '50%',
                          border: '2.5px solid var(--cyan)',
                          left: '-6px',
                          top: '-6px',
                          animation: 'pulse 1.6s infinite',
                          boxShadow: '0 0 8px var(--cyan)',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '11px',
              padding: '12px',
              textAlign: 'center'
            }}
          >
            <Icon name="Image" size="xl" style={{ marginBottom: '8px', color: 'var(--text-disabled)' }} />
            {editMode ? 'Upload a blueprint map in floorplan editor to configure layout' : 'No floorplan loaded'}
          </div>
        )}
      </div>

      {/* Bottom Floor Selector Tabs */}
      {floor2Plan && (
        <div style={{
          display: 'flex',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
          height: '24px'
        }}>
          <div 
            onClick={() => setActiveFloor('1')}
            style={{
              flex: 1,
              textAlign: 'center',
              lineHeight: '24px',
              fontSize: '10px',
              color: activeFloor === '1' ? 'var(--cyan)' : 'var(--text-muted)',
              background: activeFloor === '1' ? 'rgba(0,212,255,0.06)' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeFloor === '1' ? 700 : 400,
              borderRight: '1px solid var(--border)'
            }}
          >
            FLOOR 1
          </div>
          <div 
            onClick={() => setActiveFloor('2')}
            style={{
              flex: 1,
              textAlign: 'center',
              lineHeight: '24px',
              fontSize: '10px',
              color: activeFloor === '2' ? 'var(--cyan)' : 'var(--text-muted)',
              background: activeFloor === '2' ? 'rgba(0,212,255,0.06)' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeFloor === '2' ? 700 : 400
            }}
          >
            FLOOR 2
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default MiniMap;
