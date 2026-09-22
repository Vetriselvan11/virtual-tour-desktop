import React, { useState, useEffect, useRef } from 'react';
import { Modal, Progress, Button, Space, Tag, Alert, Spin } from 'antd';
import Icon from '../../../components/common/Icon';
import {
  analyzeTourScenes,
  getAnalysisJobStatus,
  getTourIntelligence
} from '../services/analysis.service';

export default function AnalysisProgressModal({
  open,
  onClose,
  tour,
  onAnalysisComplete
}) {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | completed | failed
  const [progress, setProgress] = useState(0);
  const [currentSceneName, setCurrentSceneName] = useState('');
  const [processedScenes, setProcessedScenes] = useState(0);
  const [totalScenes, setTotalScenes] = useState(0);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pollIntervalRef = useRef(null);
  const tourId = tour?.id || tour?._id;

  const startAnalysis = async () => {
    if (!tourId) return;
    setStatus('running');
    setProgress(0);
    setErrorMsg(null);
    setResultsSummary(null);

    try {
      const res = await analyzeTourScenes(tourId, { forceReanalyze: false });
      if (res?.jobId) {
        setJobId(res.jobId);
        setTotalScenes(res.totalScenes || (tour?.scenes?.length || 0));
      } else if (res?.analyzedScenes) {
        // Synchronous response completed immediately
        setStatus('completed');
        setProgress(100);
        try {
          const intel = await getTourIntelligence(tourId);
          setResultsSummary({
            analyzedCount: intel?.scenes?.length || res.analyzedScenes.length,
            suggestionsCount: intel?.pendingSuggestions?.length || (res.suggestions?.length || 0),
            duplicatesCount: intel?.duplicateWarnings?.length || (res.duplicatePairs?.length || 0)
          });
          if (onAnalysisComplete) onAnalysisComplete(intel || res);
        } catch (e) {
          setResultsSummary({
            analyzedCount: res.analyzedScenes.length,
            suggestionsCount: res.suggestions?.length || 0,
            duplicatesCount: res.duplicatePairs?.length || 0
          });
          if (onAnalysisComplete) onAnalysisComplete(res);
        }
      } else {
        // Fallback: fetch intelligence
        const intel = await getTourIntelligence(tourId);
        setStatus('completed');
        setProgress(100);
        setResultsSummary({
          analyzedCount: intel?.scenes?.length || (tour?.scenes?.length || 0),
          suggestionsCount: intel?.pendingSuggestions?.length || 0,
          duplicatesCount: intel?.duplicateWarnings?.length || 0
        });
        if (onAnalysisComplete) onAnalysisComplete(intel);
      }
    } catch (err) {
      setStatus('failed');
      setErrorMsg(err.message || 'Failed to initialize local scene analysis.');
    }
  };

  useEffect(() => {
    if (open) {
      startAnalysis();
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setStatus('idle');
      setProgress(0);
      setJobId(null);
      setErrorMsg(null);
    }
  }, [open, tourId]);

  useEffect(() => {
    if (status !== 'running' || !jobId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const job = await getAnalysisJobStatus(jobId);
        if (!job) return;

        setProcessedScenes(job.processedScenes || 0);
        setTotalScenes(job.totalScenes || 1);
        setCurrentSceneName(job.currentSceneId || job.currentScene || '');

        const pct = job.totalScenes > 0 
          ? Math.round((job.processedScenes / job.totalScenes) * 100) 
          : (job.progress || 0);
        setProgress(pct);

        if (job.status === 'completed' || job.status === 'complete') {
          clearInterval(pollIntervalRef.current);
          setStatus('completed');
          setProgress(100);

          // Fetch fresh intelligence to show summary
          try {
            const intel = await getTourIntelligence(tourId);
            setResultsSummary({
              analyzedCount: intel?.scenes?.length || job.processedScenes,
              suggestionsCount: intel?.pendingSuggestions?.length || 0,
              duplicatesCount: intel?.duplicateWarnings?.length || 0
            });
            if (onAnalysisComplete) onAnalysisComplete(intel);
          } catch (e) {
            console.warn('Failed to load completed analysis summary:', e);
          }
        } else if (job.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setStatus('failed');
          setErrorMsg(job.error || 'Analysis process encountered an error.');
        }
      } catch (err) {
        console.warn('Polling status error:', err);
      }
    }, 600);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [status, jobId, tourId, onAnalysisComplete]);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-main)', fontSize: 16 }}>
            Local AI Scene Analysis
          </span>
        </div>
      }
      open={open}
      onCancel={status === 'running' ? undefined : onClose}
      closable={status !== 'running'}
      footer={null}
      width={520}
      centered
      className="glass-modal"
      styles={{ body: { padding: '16px 20px 24px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {status === 'running' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Progress
              type="circle"
              percent={progress}
              size={120}
              strokeColor={{
                '0%': 'var(--accent)',
                '100%': 'var(--cyan)'
              }}
            />
            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
              Analyzing Scenes ({processedScenes} / {totalScenes})
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              100% On-Device • Sharp Vision Descriptors • Circular Yaw Invariance
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
            <Alert
              type="success"
              showIcon
              message="Scene Analysis Complete"
              description="Local computer vision has analyzed all room features and generated spatial intelligence."
              style={{ borderRadius: 8 }}
            />

            {resultsSummary && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                background: 'rgba(24, 26, 23, 0.6)', padding: '12px', borderRadius: 8,
                border: '1px solid var(--border-soft)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
                    {resultsSummary.analyzedCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Rooms Analyzed
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-bright)' }}>
                    {resultsSummary.suggestionsCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Auto-Link Suggestions
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: resultsSummary.duplicatesCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {resultsSummary.duplicatesCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Duplicate Warnings
                  </div>
                </div>
              </div>
            )}

            <Button
              type="primary"
              block
              onClick={onClose}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                border: 'none', height: 36, fontWeight: 600
              }}
            >
              Done & Review Suggestions
            </Button>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Alert
              type="error"
              showIcon
              message="Analysis Failed"
              description={errorMsg || 'An unknown error occurred during local scene processing.'}
              style={{ borderRadius: 8 }}
            />
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={onClose}>Close</Button>
              <Button type="primary" onClick={startAnalysis}>Retry Analysis</Button>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
}
