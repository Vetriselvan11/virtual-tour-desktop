import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, Button, Tag, Space, Card, Spin, message, Popconfirm, Tooltip
} from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';
import {
  getTourIntelligence,
  acceptAiSuggestion,
  rejectAiSuggestion
} from '../services/analysis.service';

export default function SceneGraphModal({
  open,
  onClose,
  tour,
  currentSceneId,
  onSelectScene,
  onTourUpdate,
  onTriggerAnalyze
}) {
  const [loading, setLoading] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [processingSuggestionId, setProcessingSuggestionId] = useState(null);

  const tourId = tour?.id || tour?._id;
  const svgRef = useRef(null);

  const fetchGraphData = async () => {
    if (!tourId) return;
    setLoading(true);
    try {
      const data = await getTourIntelligence(tourId);
      setIntelligence(data);
    } catch (err) {
      console.warn('Failed to load scene graph intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedEdge(null);
      fetchGraphData();
    }
  }, [open, tourId]);

  // Compute 2D node layout (Circular / Radial force distribution)
  const scenes = useMemo(() => tour?.scenes || [], [tour]);
  const nodeLayout = useMemo(() => {
    const map = new Map();
    const count = scenes.length;
    if (count === 0) return map;

    const centerX = 360;
    const centerY = 240;
    const radius = Math.min(220, 80 + count * 20);

    scenes.forEach((sc, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      map.set(sc.id, { x, y, scene: sc });
    });

    return map;
  }, [scenes]);

  // Extract confirmed hotspot edges from tour config
  const confirmedEdges = useMemo(() => {
    const edges = [];
    scenes.forEach((sc) => {
      (sc.hotspots || []).forEach((hs) => {
        if ((hs.type === 'scene' || hs.targetScene) && hs.targetScene) {
          edges.push({
            id: `conf_${sc.id}_${hs.targetScene}`,
            source: sc.id,
            target: hs.targetScene,
            type: 'confirmed'
          });
        }
      });
    });
    return edges;
  }, [scenes]);

  // Extract AI suggestions from intelligence
  const aiSuggestions = useMemo(() => {
    return (intelligence?.pendingSuggestions || []).map((sug) => ({
      id: sug.suggestionId,
      source: sug.sourceSceneId,
      target: sug.targetSceneId,
      type: 'ai_suggested',
      suggestion: sug
    }));
  }, [intelligence]);

  const handleAcceptSuggestion = async (sug) => {
    setProcessingSuggestionId(sug.suggestionId);
    try {
      const res = await acceptAiSuggestion(tourId, sug.suggestionId, { createBidirectional: true });
      message.success(`Navigation created between scenes!`);
      
      if (onTourUpdate && res.hotspot) {
        const updatedScenes = scenes.map(sc => {
          if (sc.id === sug.sourceSceneId) {
            return { ...sc, hotspots: [...(sc.hotspots || []), res.hotspot] };
          }
          if (res.reciprocalHotspot && sc.id === sug.targetSceneId) {
            return { ...sc, hotspots: [...(sc.hotspots || []), res.reciprocalHotspot] };
          }
          return sc;
        });
        onTourUpdate({ ...tour, scenes: updatedScenes });
      }

      setSelectedEdge(null);
      fetchGraphData();
    } catch (err) {
      message.error(`Failed to accept: ${err.message}`);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const handleRejectSuggestion = async (sugId) => {
    setProcessingSuggestionId(sugId);
    try {
      await rejectAiSuggestion(tourId, sugId);
      message.info('Suggestion dismissed');
      setSelectedEdge(null);
      fetchGraphData();
    } catch (err) {
      message.error(`Failed to reject: ${err.message}`);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-main)', fontSize: 18 }}>
              Scene Relationship & Navigation Graph
            </span>
          </div>
          <Space size={8}>
            <Button
              size="small"
              icon={<Icon name="Sparkles" size="xs" />}
              type="primary"
              onClick={() => {
                if (onTriggerAnalyze) onTriggerAnalyze();
              }}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                border: 'none', fontWeight: 600
              }}
            >
              Re-Analyze Tour
            </Button>
          </Space>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
      className="glass-modal"
      styles={{ body: { padding: '16px 20px 24px' } }}
    >
      {/* Legend Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12,
        padding: '6px 12px', background: 'rgba(24, 26, 23, 0.5)', borderRadius: 6,
        fontSize: 11, color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, background: 'var(--cyan)', borderRadius: 2 }} />
          <span>Confirmed Link ({confirmedEdges.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, background: 'var(--accent)', borderBottom: '2px dashed var(--accent)', borderRadius: 2 }} />
          <span>AI Suggested ({aiSuggestions.length})</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-soft)' }}>
          Click node to view scene • Click dashed link to accept
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '120px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: 480, background: 'rgba(12, 14, 13, 0.95)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 720 480"
            style={{ width: '100%', height: '100%', cursor: 'grab' }}
          >
            {/* Confirmed Edges (Solid Lines) */}
            {confirmedEdges.map((edge) => {
              const src = nodeLayout.get(edge.source);
              const tgt = nodeLayout.get(edge.target);
              if (!src || !tgt) return null;

              return (
                <line
                  key={edge.id}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="var(--cyan)"
                  strokeWidth="2.5"
                  strokeOpacity="0.75"
                />
              );
            })}

            {/* AI Suggested Edges (Dashed Amber Lines) */}
            {aiSuggestions.map((edge) => {
              const src = nodeLayout.get(edge.source);
              const tgt = nodeLayout.get(edge.target);
              if (!src || !tgt) return null;

              const isSelected = selectedEdge?.id === edge.id;

              return (
                <g key={edge.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEdge(edge)}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={isSelected ? '#fff' : 'var(--accent)'}
                    strokeWidth={isSelected ? '4' : '2.5'}
                    strokeDasharray="6,4"
                    strokeOpacity={isSelected ? '1' : '0.85'}
                  />
                  {/* Midpoint Pill Tag */}
                  <circle
                    cx={(src.x + tgt.x) / 2}
                    cy={(src.y + tgt.y) / 2}
                    r="9"
                    fill="var(--bg-panel)"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                  <text
                    x={(src.x + tgt.x) / 2}
                    y={(src.y + tgt.y) / 2 + 3}
                    textAnchor="middle"
                    fill="var(--accent-bright)"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    ✨
                  </text>
                </g>
              );
            })}

            {/* Scene Nodes */}
            {Array.from(nodeLayout.entries()).map(([sceneId, node]) => {
              const isCurrent = sceneId === currentSceneId;
              const analysis = intelligence?.scenes?.find(s => s.sceneId === sceneId);
              const category = analysis?.category || 'Scene';

              return (
                <g
                  key={sceneId}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (onSelectScene) onSelectScene(sceneId);
                  }}
                >
                  {/* Outer glow ring for active scene */}
                  {isCurrent && (
                    <circle
                      r="26"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeDasharray="4,2"
                      opacity="0.9"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    r="20"
                    fill="var(--bg-card)"
                    stroke={isCurrent ? 'var(--accent)' : 'var(--border-medium)'}
                    strokeWidth="2"
                  />

                  {/* Scene Name Label */}
                  <text
                    y="32"
                    textAnchor="middle"
                    fill="var(--text-main)"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-display)"
                  >
                    {node.scene.name || sceneId}
                  </text>

                  {/* Category Pill */}
                  <text
                    y="44"
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="9"
                  >
                    {category}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Selected Suggestion Action Popup Overlay */}
          {selectedEdge && (
            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              background: 'rgba(24, 26, 23, 0.95)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(108, 99, 255, 0.4)', borderRadius: 8,
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>
                    AI Suggestion: {selectedEdge.suggestion?.sourceSceneName} ➔ {selectedEdge.suggestion?.targetSceneName}
                  </span>
                  <Tag color="gold" style={{ borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                    {Math.round((selectedEdge.suggestion?.confidence || 0) * 100)}% MATCH
                  </Tag>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(selectedEdge.suggestion?.reasons || []).join(' • ')}
                </div>
              </div>

              <Space>
                <Button
                  size="small"
                  type="primary"
                  icon={<Icon name="Check" size="xs" />}
                  loading={processingSuggestionId === selectedEdge.suggestion?.suggestionId}
                  onClick={() => handleAcceptSuggestion(selectedEdge.suggestion)}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                    border: 'none', fontWeight: 600
                  }}
                >
                  Accept & Link
                </Button>
                <Button
                  size="small"
                  onClick={() => handleRejectSuggestion(selectedEdge.suggestion?.suggestionId)}
                  disabled={processingSuggestionId === selectedEdge.suggestion?.suggestionId}
                >
                  Dismiss
                </Button>
                <Button size="small" type="text" onClick={() => setSelectedEdge(null)}>
                  Close
                </Button>
              </Space>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
