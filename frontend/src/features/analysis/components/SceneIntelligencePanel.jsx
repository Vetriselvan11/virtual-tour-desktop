import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Tag, Alert, Spin, message, Space, Progress, Card, Popconfirm
} from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';
import {
  getTourIntelligence,
  acceptAiSuggestion,
  rejectAiSuggestion
} from '../services/analysis.service';

export default function SceneIntelligencePanel({
  tour,
  currentScene,
  currentSceneId,
  onTourUpdate,
  onOpenSceneGraph,
  onTriggerAnalyze
}) {
  const [loading, setLoading] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [processingSuggestionId, setProcessingSuggestionId] = useState(null);

  const tourId = tour?.id || tour?._id;

  const fetchIntelligence = useCallback(async () => {
    if (!tourId) return;
    setLoading(true);
    try {
      const data = await getTourIntelligence(tourId);
      setIntelligence(data);
    } catch (err) {
      console.warn('Could not fetch scene intelligence:', err.message);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence, currentSceneId]);

  const sceneAnalysis = intelligence?.scenes?.find(s => s.sceneId === currentSceneId);
  const sceneSuggestions = (intelligence?.pendingSuggestions || []).filter(
    s => s.sourceSceneId === currentSceneId
  );

  const handleAccept = async (suggestion) => {
    setProcessingSuggestionId(suggestion.suggestionId);
    try {
      const res = await acceptAiSuggestion(tourId, suggestion.suggestionId, {
        createBidirectional: true
      });
      message.success(`Hotspot created to "${suggestion.targetSceneName || suggestion.targetSceneId}"!`);
      
      // Update parent tour state
      if (onTourUpdate && res.hotspot) {
        const updatedScenes = (tour.scenes || []).map(sc => {
          if (sc.id === suggestion.sourceSceneId) {
            return {
              ...sc,
              hotspots: [...(sc.hotspots || []), res.hotspot]
            };
          }
          if (res.reciprocalHotspot && sc.id === suggestion.targetSceneId) {
            return {
              ...sc,
              hotspots: [...(sc.hotspots || []), res.reciprocalHotspot]
            };
          }
          return sc;
        });
        onTourUpdate({ ...tour, scenes: updatedScenes });
      }

      fetchIntelligence();
    } catch (err) {
      message.error(`Failed to create hotspot: ${err.message}`);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const handleReject = async (suggestionId) => {
    setProcessingSuggestionId(suggestionId);
    try {
      await rejectAiSuggestion(tourId, suggestionId);
      message.info('Suggestion dismissed');
      fetchIntelligence();
    } catch (err) {
      message.error(`Failed to reject suggestion: ${err.message}`);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const isAnalyzed = sceneAnalysis?.analyzed;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
            Scene Intelligence
          </span>
        </div>
        <Space size={6}>
          <Button
            size="small"
            icon={<Icon name="Network" size="xs" />}
            onClick={onOpenSceneGraph}
            style={{
              background: 'rgba(108, 99, 255, 0.12)',
              border: '1px solid rgba(108, 99, 255, 0.3)',
              color: 'var(--accent-bright)',
              fontSize: 11, fontWeight: 600
            }}
          >
            Scene Graph
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<Icon name="Sparkles" size="xs" />}
            onClick={onTriggerAnalyze}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              border: 'none', fontSize: 11, fontWeight: 600
            }}
          >
            Analyze
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Spin size="small" />
        </div>
      ) : !isAnalyzed ? (
        /* Not Analyzed Prompt */
        <div style={{
          background: 'rgba(24, 26, 23, 0.4)',
          border: '1px dashed var(--border-soft)',
          borderRadius: 8, padding: '20px 14px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.6 }}>🔍</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
            Scene Not Yet Analyzed
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
            Run local computer vision to classify room context, detect duplicates, and generate intelligent navigation links.
          </div>
          <Button
            type="primary"
            size="small"
            icon={<Icon name="Sparkles" size="xs" />}
            onClick={onTriggerAnalyze}
          >
            Analyze Tour Scenes
          </Button>
        </div>
      ) : (
        /* Analyzed Scene Details */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Room Category Card */}
          <div style={{
            background: 'rgba(24, 26, 23, 0.5)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8, padding: '12px 14px'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 600 }}>
              DETECTED ROOM CONTEXT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                {sceneAnalysis.category || 'Unknown'}
              </span>
              <Tag color="cyan" style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                {Math.round((sceneAnalysis.categoryConfidence || 0) * 100)}% CONFIDENCE
              </Tag>
            </div>
            {sceneAnalysis.categoryReasoning && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {sceneAnalysis.categoryReasoning}
              </div>
            )}
          </div>

          {/* Navigation Suggestions for Current Scene */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>SUGGESTED NAVIGATIONS ({sceneSuggestions.length})</span>
            </div>

            {sceneSuggestions.length === 0 ? (
              <div style={{
                background: 'rgba(24, 26, 23, 0.3)',
                border: '1px solid var(--border-soft)',
                borderRadius: 8, padding: '14px', textAlign: 'center',
                fontSize: 12, color: 'var(--text-muted)'
              }}>
                <Icon name="CheckCheck" size="sm" style={{ color: 'var(--success)', marginBottom: 4, display: 'block', margin: '0 auto 6px' }} />
                No unlinked connections detected for this scene. All key neighbors are linked or below threshold.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sceneSuggestions.map((sug) => {
                  const isProcessing = processingSuggestionId === sug.suggestionId;
                  const confidencePct = Math.round(sug.confidence * 100);

                  return (
                    <div
                      key={sug.suggestionId}
                      style={{
                        background: 'rgba(24, 26, 23, 0.6)',
                        border: '1px solid rgba(184, 138, 68, 0.3)',
                        borderRadius: 8, padding: '12px',
                        display: 'flex', flexDirection: 'column', gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="ArrowRight" size="xs" style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                            {sug.targetSceneName || sug.targetSceneId}
                          </span>
                        </div>
                        <Tag color={confidencePct >= 80 ? 'gold' : 'blue'} style={{ borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                          {confidencePct}% Match
                        </Tag>
                      </div>

                      {/* Reasons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(sug.reasons || []).map((r, i) => (
                          <Tag key={i} style={{ background: 'rgba(24, 26, 23, 0.8)', border: '1px solid var(--border-soft)', color: 'var(--text-soft)', fontSize: 10, margin: 0 }}>
                            {r}
                          </Tag>
                        ))}
                      </div>

                      {/* Accept / Reject Buttons */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<Icon name="Plus" size="xs" />}
                          onClick={() => handleAccept(sug)}
                          loading={isProcessing}
                          style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                            border: 'none', fontSize: 11, fontWeight: 600
                          }}
                        >
                          Accept Hotspot
                        </Button>
                        <Button
                          size="small"
                          icon={<Icon name="X" size="xs" />}
                          onClick={() => handleReject(sug.suggestionId)}
                          disabled={isProcessing}
                          style={{ fontSize: 11 }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
