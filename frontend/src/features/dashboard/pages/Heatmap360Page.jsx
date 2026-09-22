import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Select, Slider, Switch, Space, Tag, Typography, Card, Spin, message } from 'antd';
import * as THREE from 'three';
import Icon from '../../../components/common/Icon';
import PanoramaViewer from '../../../components/viewer/PanoramaViewer';
import { getTour } from '../services/tour.service';
import { getSceneHeatmap } from '../services/analytics.service';

const { Title, Text } = Typography;

/**
 * Generates an equirectangular heatmap canvas texture from spherical bins.
 * Correctly wraps yaw around 0° / 360° boundary.
 */
function createHeatmapTexture(bins = [], metric = 'views', maxVal = 1, width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  if (!Array.isArray(bins) || bins.length === 0 || maxVal <= 0) {
    return new THREE.CanvasTexture(canvas);
  }

  // Draw radial intensity splats onto black background
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = 'black';
  tempCtx.fillRect(0, 0, width, height);

  bins.forEach((b) => {
    let val = 0;
    if (metric === 'dwell') val = b.dwellTime;
    else if (metric === 'unique') val = b.uniqueViewers;
    else val = b.viewCount;

    const normalizedIntensity = Math.min(1.0, val / maxVal);
    if (normalizedIntensity <= 0.01) return;

    // Convert spherical yaw (0..360) and pitch (-90..+90) to equirectangular pixel coordinates (X, Y)
    // Equirectangular: X = (yaw / 360) * width, Y = ((90 - pitch) / 180) * height
    const x = ((b.yawCenter % 360) / 360) * width;
    const y = ((90 - b.pitchCenter) / 180) * height;
    const radius = Math.max(16, (width / 36) * 1.6);

    const drawSplat = (cx, cy) => {
      const grad = tempCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${normalizedIntensity})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${normalizedIntensity * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      tempCtx.fillStyle = grad;
      tempCtx.beginPath();
      tempCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      tempCtx.fill();
    };

    // Draw main splat
    drawSplat(x, y);

    // Yaw Seam Wrapping: If splat crosses left or right border, draw mirrored splat
    if (x - radius < 0) {
      drawSplat(x + width, y);
    }
    if (x + radius > width) {
      drawSplat(x - width, y);
    }
  });

  // Colorize grayscale intensity map into thermal color palette
  const imgData = tempCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Custom Thermal Color Gradient (Transparent -> Blue -> Cyan -> Green -> Yellow -> Red)
  const getThermalColor = (intensity) => {
    // intensity is 0..255
    const t = intensity / 255;
    if (t < 0.05) return [0, 0, 0, 0];

    let r = 0, g = 0, b = 0, a = Math.min(0.88, t * 1.2);
    if (t < 0.25) {
      // 0..0.25: Blue to Cyan
      const localT = t / 0.25;
      r = 0;
      g = Math.round(localT * 255);
      b = 255;
    } else if (t < 0.5) {
      // 0.25..0.5: Cyan to Green
      const localT = (t - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round((1 - localT) * 255);
    } else if (t < 0.75) {
      // 0.5..0.75: Green to Yellow
      const localT = (t - 0.5) / 0.25;
      r = Math.round(localT * 255);
      g = 255;
      b = 0;
    } else {
      // 0.75..1.0: Yellow to Red
      const localT = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round((1 - localT) * 255);
      b = 0;
    }

    return [r, g, b, Math.round(a * 255)];
  };

  const outputImg = ctx.createImageData(width, height);
  const outData = outputImg.data;

  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i]; // red channel contains grayscale value
    if (intensity > 5) {
      const [r, g, b, a] = getThermalColor(intensity);
      outData[i] = r;
      outData[i + 1] = g;
      outData[i + 2] = b;
      outData[i + 3] = a;
    } else {
      outData[i + 3] = 0; // transparent
    }
  }

  ctx.putImageData(outputImg, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 360° Gaze & View Heatmap Studio Viewer.
 */
export default function Heatmap360Page() {
  const { tourId, sceneId } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);

  const [tour, setTour] = useState(null);
  const [currentSceneId, setCurrentSceneId] = useState(sceneId);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Heatmap Controls
  const [metric, setMetric] = useState('views'); // 'views' | 'dwell' | 'unique'
  const [binSize, setBinSize] = useState(10);
  const [opacity, setOpacity] = useState(0.75);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Overlay Three.js Mesh Ref
  const heatmapMeshRef = useRef(null);

  // 1. Load Tour Config
  useEffect(() => {
    async function loadTourData() {
      try {
        const data = await getTour(tourId);
        if (data) {
          setTour(data);
          if (!currentSceneId && data.scenes?.length > 0) {
            setCurrentSceneId(data.scenes[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load tour:', err);
        message.error('Failed to load tour data.');
      }
    }
    loadTourData();
  }, [tourId]);

  // 2. Load Heatmap Data for current scene
  useEffect(() => {
    if (!tourId || !currentSceneId) return;

    async function loadHeatmap() {
      setLoading(true);
      try {
        const data = await getSceneHeatmap(tourId, currentSceneId, { binSize });
        setHeatmapData(data);
      } catch (err) {
        console.error('Failed to load heatmap data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHeatmap();
  }, [tourId, currentSceneId, binSize]);

  // 3. Attach / Update Spherical Heatmap Layer in Three.js Scene
  useEffect(() => {
    const viewerCore = viewerRef.current;
    if (!viewerCore || !viewerCore.scene) return;

    // Clean up previous overlay mesh if exists
    if (heatmapMeshRef.current) {
      viewerCore.scene.remove(heatmapMeshRef.current);
      if (heatmapMeshRef.current.material.map) heatmapMeshRef.current.material.map.dispose();
      heatmapMeshRef.current.material.dispose();
      heatmapMeshRef.current.geometry.dispose();
      heatmapMeshRef.current = null;
    }

    if (!showHeatmap || !heatmapData || !heatmapData.bins || heatmapData.bins.length === 0) {
      viewerCore.renderLoop?.requestRender(2);
      return;
    }

    let maxVal = heatmapData.maxViews;
    if (metric === 'dwell') maxVal = heatmapData.maxDwell;
    else if (metric === 'unique') maxVal = heatmapData.maxUnique;

    const texture = createHeatmapTexture(heatmapData.bins, metric, maxVal);

    // Inner sphere layer (radius 4.9m, slightly inside 5.0m panorama sphere)
    const geom = new THREE.SphereGeometry(4.88, 64, 64);
    geom.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: opacity,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geom, mat);
    viewerCore.scene.add(mesh);
    heatmapMeshRef.current = mesh;

    viewerCore.renderLoop?.requestRender(5);

    return () => {
      if (heatmapMeshRef.current && viewerCore.scene) {
        viewerCore.scene.remove(heatmapMeshRef.current);
        if (heatmapMeshRef.current.material.map) heatmapMeshRef.current.material.map.dispose();
        heatmapMeshRef.current.material.dispose();
        heatmapMeshRef.current.geometry.dispose();
        heatmapMeshRef.current = null;
      }
    };
  }, [showHeatmap, heatmapData, metric, opacity, viewerRef.current]);

  const currentScene = tour?.scenes?.find(s => s.id === currentSceneId);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0a0a0f' }}>
      {/* 360 Panorama Viewer */}
      {currentScene && (
        <PanoramaViewer
          ref={viewerRef}
          sceneId={currentScene.id}
          imageUrl={currentScene.image}
          scene={currentScene}
          editMode={false}
          autoRotate={false}
        />
      )}

      {/* Floating Header & Navigation Controls */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 24,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Button
          icon={<Icon name="ArrowLeft" size="sm" />}
          onClick={() => navigate('/dashboard/analytics')}
          style={{
            background: 'rgba(20, 22, 21, 0.85)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            color: 'var(--text-main)',
            borderRadius: '8px'
          }}
        >
          Back to Analytics
        </Button>

        <div style={{
          background: 'rgba(20, 22, 21, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '6px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Icon name="Flame" size="sm" color="var(--accent)" />
          <Text strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>
            360° Gaze Heatmap Studio
          </Text>
        </div>
      </div>

      {/* Floating Heatmap Inspector Controls Card */}
      <Card
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          width: 320,
          background: 'rgba(20, 22, 21, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          zIndex: 100,
          color: 'var(--text-main)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-main)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Heatmap Settings</span>
            <Switch
              checked={showHeatmap}
              onChange={setShowHeatmap}
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
          </div>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Scene Selector */}
          <div>
            <Text style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SCENE</Text>
            <Select
              style={{ width: '100%', marginTop: '4px' }}
              value={currentSceneId}
              onChange={setCurrentSceneId}
              options={tour?.scenes?.map(s => ({ label: s.name || s.id, value: s.id })) || []}
            />
          </div>

          {/* Metric Selector */}
          <div>
            <Text style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HEATMAP METRIC</Text>
            <Select
              style={{ width: '100%', marginTop: '4px' }}
              value={metric}
              onChange={setMetric}
              options={[
                { label: 'View Density (Samples)', value: 'views' },
                { label: 'Dwell Time (Seconds)', value: 'dwell' },
                { label: 'Unique Visitors', value: 'unique' }
              ]}
            />
          </div>

          {/* Opacity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OPACITY</Text>
              <Text style={{ fontSize: '11px', color: 'var(--accent)' }}>{Math.round(opacity * 100)}%</Text>
            </div>
            <Slider
              min={0.1}
              max={1.0}
              step={0.05}
              value={opacity}
              onChange={setOpacity}
              disabled={!showHeatmap}
            />
          </div>

          {/* Bin Resolution */}
          <div>
            <Text style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GRID RESOLUTION</Text>
            <Select
              style={{ width: '100%', marginTop: '4px' }}
              value={binSize}
              onChange={setBinSize}
              options={[
                { label: 'High (5° Bins)', value: 5 },
                { label: 'Medium (10° Bins)', value: 10 },
                { label: 'Low (15° Bins)', value: 15 }
              ]}
            />
          </div>

          {/* Thermal Legend */}
          <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Low Density</span>
              <span>High Density</span>
            </div>
            <div style={{
              height: '10px',
              borderRadius: '5px',
              background: 'linear-gradient(90deg, #00d2d3 0%, #2ed573 35%, #ffa502 70%, #ff4757 100%)'
            }} />
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {heatmapData ? `${heatmapData.totalSamples || 0} gaze samples tracked` : 'No gaze samples'}
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
}
