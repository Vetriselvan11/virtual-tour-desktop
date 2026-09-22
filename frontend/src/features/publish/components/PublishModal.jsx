import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Tabs, Button, Input, Tag, Space, Alert,
  Progress, message, Popconfirm, Spin, Tooltip
} from 'antd';
import Icon from '../../../components/common/Icon';
import ActionLoader from '../../../components/common/ActionLoader';
import {
  validateTourForPublish,
  publishTour,
  getTourVersions,
  rollbackTourVersion,
  unpublishTour
} from '../services/publish.service';

const { TextArea } = Input;

export default function PublishModal({
  open,
  onClose,
  tour,
  onPublishSuccess
}) {
  const [activeTab, setActiveTab] = useState('publish');
  const [slug, setSlug] = useState('');
  const [changeLog, setChangeLog] = useState('');
  
  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Publishing process state
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStage, setPublishStage] = useState('');
  const [publishResult, setPublishResult] = useState(null);

  // Versions history state
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const tourId = tour?.id || tour?._id;

  // Initialize slug from tour title or existing slug
  useEffect(() => {
    if (tour) {
      const initialSlug = tour.publicSlug || (tour.title || 'my-tour')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'tour';
      setSlug(initialSlug);
    }
  }, [tour]);

  // Run pre-flight validation when modal opens
  const runValidation = useCallback(async () => {
    if (!tourId) return;
    setValidating(true);
    try {
      const res = await validateTourForPublish(tourId, { publicSlug: slug });
      setValidationResult(res);
    } catch (err) {
      setValidationResult({
        isValid: false,
        errors: [err.message || 'Validation service failed to connect.'],
        warnings: []
      });
    } finally {
      setValidating(false);
    }
  }, [tourId, slug]);

  const fetchVersions = useCallback(async () => {
    if (!tourId) return;
    setLoadingVersions(true);
    try {
      const data = await getTourVersions(tourId);
      setVersions(data || []);
    } catch (err) {
      console.warn('Could not load version history:', err);
    } finally {
      setLoadingVersions(false);
    }
  }, [tourId]);

  useEffect(() => {
    if (open) {
      setPublishResult(null);
      setPublishProgress(0);
      setPublishStage('');
      runValidation();
      fetchVersions();
    }
  }, [open, runValidation, fetchVersions]);

  const handleStartPublish = async () => {
    setPublishing(true);
    setPublishProgress(15);
    setPublishStage('Validating tour & referenced assets...');

    try {
      const timer = setInterval(() => {
        setPublishProgress((prev) => {
          if (prev < 80) return prev + 15;
          return prev;
        });
      }, 400);

      setPublishStage('Packaging 360° panoramas & multi-res tiles...');
      const result = await publishTour(tourId, {
        publicSlug: slug,
        changeLog: changeLog || 'Published update'
      });

      clearInterval(timer);
      setPublishProgress(100);
      setPublishStage('Published successfully!');
      setPublishResult(result);
      message.success(`Version ${result.versionNumber} is now LIVE!`);

      if (onPublishSuccess) {
        onPublishSuccess(result);
      }
      fetchVersions();
    } catch (err) {
      message.error(`Publishing failed: ${err.message}`);
      setPublishStage('Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (versionId, versionNumber) => {
    setRollingBack(true);
    try {
      const res = await rollbackTourVersion(tourId, versionId);
      message.success(res.message || `Rolled back to Version ${versionNumber}`);
      fetchVersions();
      if (onPublishSuccess) onPublishSuccess(res);
    } catch (err) {
      message.error(`Rollback failed: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      await unpublishTour(tourId);
      message.info('Tour is now unpublished. Public URL is disabled.');
      fetchVersions();
      if (onPublishSuccess) onPublishSuccess({ unpublished: true });
    } catch (err) {
      message.error(`Unpublish failed: ${err.message}`);
    } finally {
      setUnpublishing(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
  const liveUrl = `${origin}/tour/${slug}`;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const activeVersion = versions.find(v => v.active);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-main)', fontSize: 18 }}>
            Publish Tour & Version Management
          </span>
          {activeVersion && (
            <Tag color="green" style={{ borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
              v{activeVersion.versionNumber} LIVE
            </Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      className="glass-modal"
      styles={{ body: { padding: '16px 20px 24px' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'publish',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Icon name="Upload" size="xs" /> Publish Live Version
              </span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                {publishResult ? (
                  /* Publish Success Card */
                  <div style={{
                    background: 'rgba(104, 197, 143, 0.08)',
                    border: '1px solid rgba(104, 197, 143, 0.3)',
                    borderRadius: 12, padding: '24px 20px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 42, marginBottom: 8 }}>🎉</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                      Version {publishResult.versionNumber} is LIVE!
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                      Published {publishResult.totalAssets} assets ({formatBytes(publishResult.totalSize)}) to local immutable storage.
                    </div>

                    <div style={{
                      background: 'rgba(24, 26, 23, 0.8)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 8, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 20
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {origin}/tour/{publishResult.publicSlug}
                      </span>
                      <Space>
                        <Button
                          size="small"
                          icon={<Icon name="Copy" size="xs" />}
                          onClick={() => {
                            navigator.clipboard.writeText(`${origin}/tour/${publishResult.publicSlug}`);
                            message.success('Public URL copied to clipboard!');
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          icon={<Icon name="ExternalLink" size="xs" />}
                          onClick={() => window.open(`/tour/${publishResult.publicSlug}`, '_blank')}
                        >
                          Open Live
                        </Button>
                      </Space>
                    </div>

                    <Button onClick={() => setPublishResult(null)}>
                      Publish Another Update
                    </Button>
                  </div>
                ) : (
                  /* Pre-flight & Publish Form */
                  <div>
                    {/* Pre-Flight Validation Box */}
                    <div style={{
                      background: 'rgba(24, 26, 23, 0.4)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 8, padding: '12px 16px', marginBottom: 16
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="ShieldCheck" size="xs" style={{ color: 'var(--primary)' }} /> Pre-Flight Integrity Checks
                        </span>
                        {validating ? (
                          <Spin size="small" />
                        ) : (
                          <Button size="small" type="text" onClick={runValidation} icon={<Icon name="RefreshCw" size="xs" />}>
                            Re-check
                          </Button>
                        )}
                      </div>

                      {validating ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Validating scenes, panoramas, tile pyramids, and 3D assets...</div>
                      ) : validationResult?.isValid ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: 13 }}>
                          <Icon name="CheckCircle" size="xs" /> All checks passed. Ready for local publishing.
                        </div>
                      ) : (
                        <div>
                          {validationResult?.errors?.map((err, i) => (
                            <Alert key={i} type="error" message={err} showIcon style={{ marginBottom: 6, fontSize: 12 }} />
                          ))}
                        </div>
                      )}

                      {validationResult?.warnings?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          {validationResult.warnings.map((warn, i) => (
                            <Alert key={i} type="warning" message={warn} showIcon style={{ marginBottom: 4, fontSize: 12 }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Slug & Change Notes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                          PUBLIC URL SLUG
                        </div>
                        <Input
                          prefix={<span style={{ color: 'var(--text-soft)', fontSize: 12 }}>/tour/</span>}
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                          placeholder="my-virtual-tour"
                          style={{ fontFamily: 'var(--font-mono)' }}
                          onBlur={runValidation}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>
                          Live Preview: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{liveUrl}</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                          RELEASE NOTES / CHANGELOG (OPTIONAL)
                        </div>
                        <TextArea
                          rows={2}
                          value={changeLog}
                          onChange={(e) => setChangeLog(e.target.value)}
                          placeholder="e.g. Added 3D showcase model, updated hotspot narration, refined camera transitions."
                        />
                      </div>
                    </div>

                    {/* Progress Bar (Visible during publish) */}
                    {publishing && (
                      <ActionLoader text={publishStage || 'Publishing Tour...'} />
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <Button onClick={onClose} disabled={publishing}>
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        icon={<Icon name="Upload" size="xs" />}
                        onClick={handleStartPublish}
                        loading={publishing}
                        disabled={validating || (validationResult && !validationResult.isValid)}
                        style={{
                          background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                          border: 'none', fontWeight: 600
                        }}
                      >
                        Publish Version Now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'versions',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Icon name="History" size="xs" /> Version History ({versions.length})
              </span>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                {loadingVersions ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin size="default" />
                  </div>
                ) : versions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No published versions yet. Publish your first version using the "Publish Live Version" tab.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                    {versions.map((ver) => {
                      const isLive = ver.active && ver.status === 'published';
                      const formattedDate = ver.publishedAt
                        ? new Date(ver.publishedAt).toLocaleString()
                        : ver.createdAt
                        ? new Date(ver.createdAt).toLocaleString()
                        : 'Unknown date';

                      return (
                        <div
                          key={ver.versionId}
                          style={{
                            background: isLive ? 'rgba(104, 197, 143, 0.08)' : 'rgba(24, 26, 23, 0.4)',
                            border: `1px solid ${isLive ? 'rgba(104, 197, 143, 0.3)' : 'var(--border-soft)'}`,
                            borderRadius: 8, padding: '12px 16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                                Version {ver.versionNumber}
                              </span>
                              {isLive ? (
                                <Tag color="green" style={{ borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                                  ACTIVE LIVE
                                </Tag>
                              ) : (
                                <Tag style={{ borderRadius: 6, fontSize: 10, background: 'rgba(24, 26, 23, 0.6)', color: 'var(--text-soft)', margin: 0 }}>
                                  {ver.status ? ver.status.toUpperCase() : 'ARCHIVED'}
                                </Tag>
                              )}
                              <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                                {formattedDate}
                              </span>
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {ver.changeLog || 'Standard release version'} • {ver.totalAssets || 0} assets ({formatBytes(ver.totalSize)})
                            </div>
                          </div>

                          <Space>
                            <Button
                              size="small"
                              icon={<Icon name="Eye" size="xs" />}
                              onClick={() => window.open(`/view/${ver.tourId}/${ver.versionId}`, '_blank')}
                            >
                              View
                            </Button>
                            {!isLive && (
                              <Popconfirm
                                title="Rollback to this version?"
                                description={`This will immediately make Version ${ver.versionNumber} active on the public URL.`}
                                onConfirm={() => handleRollback(ver.versionId, ver.versionNumber)}
                                okText="Rollback"
                                cancelText="Cancel"
                              >
                                <Button
                                  size="small"
                                  type="primary"
                                  ghost
                                  icon={<Icon name="RotateCcw" size="xs" />}
                                  loading={rollingBack}
                                >
                                  Rollback
                                </Button>
                              </Popconfirm>
                            )}
                          </Space>
                        </div>
                      );
                    })}

                    {activeVersion && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'flex-end' }}>
                        <Popconfirm
                          title="Unpublish this tour?"
                          description="The public URL will be disabled. Version history files will remain preserved."
                          onConfirm={handleUnpublish}
                          okText="Unpublish"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <Button danger size="small" icon={<Icon name="EyeOff" size="xs" />} loading={unpublishing}>
                            Unpublish Tour
                          </Button>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }
        ]}
      />
    </Modal>
  );
}
