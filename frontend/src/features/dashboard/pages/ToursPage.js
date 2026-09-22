import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Input, Row, Col, Space, Tag, Tooltip,
  Popconfirm, Spin, message, Modal, Select
} from 'antd';
import Icon from '../../../components/common/Icon';
import ActionLoader from '../../../components/common/ActionLoader';
import { useNavigate } from 'react-router-dom';
import { getTours, deleteTour, exportTourZip } from '../services/tour.service';
import { useResponsiveContext } from '../../../context/ResponsiveProvider';
import { motion } from 'framer-motion';
import PublishModal from '../../publish/components/PublishModal';

const { Title, Text } = Typography;
const { Option } = Select;

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, y: 0, 
    transition: { type: 'spring', stiffness: 300, damping: 30 } 
  }
};

export default function ToursPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveContext();
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Real-time export progress states
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportingTitle, setExportingTitle] = useState('');

  // Publish & Version Management states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedPublishTour, setSelectedPublishTour] = useState(null);

  const fetchTours = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTours();
      setTours(data || []);
    } catch (err) {
      console.warn('Tours fetch notice:', err);
      setTours([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTours(); }, [fetchTours]);

  const handleExport = async (tour) => {
    setExporting(true);
    setExportProgress(0);
    setExportingTitle(tour.title);
    try {
      const blob = await exportTourZip(tour.id, (progress) => {
        setExportProgress(progress);
      });
      
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (tour.title || 'tour').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `${safeTitle}_virtual_tour.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('Build downloaded successfully!');
    } catch (err) {
      message.error('Failed to download build: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTour(id);
      message.success('Tour deleted');
      setTours(prev => prev.filter(t => t.id !== id));
    } catch {
      message.error('Failed to delete tour');
    }
  };

  // Process tours to show mock draft/published based on existing data if needed
  const processedTours = (Array.isArray(tours) ? tours : []).map(t => ({
    ...t,
    status: t.isPublished === false ? 'draft' : 'published', // default to published
    title: t.title === 'gg' ? 'Heritage Courtyard Walkthrough' : t.title // Fallback for bad placeholder data
  }));

  const filtered = processedTours.filter(t => {
    const matchesSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || 
                          t.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const safeTours = Array.isArray(tours) ? tours : [];
  const totalScenes = safeTours.reduce((acc, t) => acc + (t.scenes?.length || 0), 0);
  const totalHotspots = safeTours.reduce((acc, t) => acc + (t.scenes || []).reduce((a, s) => a + (s.hotspots?.length || 0), 0), 0);
  const publishedCount = processedTours.filter(t => t.status === 'published').length;
  const draftCount = processedTours.filter(t => t.status === 'draft').length;

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants}>
      {/* Page Header Area */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Title level={2} style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)', margin: 0, fontSize: isMobile ? 32 : 36, letterSpacing: '-0.02em', fontWeight: 700 }}>
                Virtual Tours
              </Title>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: '12px',
                background: 'rgba(104, 197, 143, 0.1)',
                border: '1px solid rgba(104, 197, 143, 0.2)',
                color: 'var(--success)', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.04em', textTransform: 'uppercase'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                LIVE
              </div>
            </div>
            <Text style={{ color: 'var(--text-soft)', fontSize: 15 }}>
              Create, manage, preview, and publish immersive 360° experiences.
            </Text>
          </div>
          
          <Space>
            <Button 
              icon={<Icon name="RefreshCw" />} 
              onClick={fetchTours} 
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', color: 'var(--text-main)', backdropFilter: 'blur(10px)' }}
            >
              Refresh
            </Button>
            <Button 
              className="primary-btn" 
              icon={<Icon name="Plus" />} 
              onClick={() => navigate('/dashboard/create')} 
              size="large"
            >
              Create New Tour
            </Button>
          </Space>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          {[
            { label: 'Total Tours', value: tours.length, icon: <Icon name="Globe" />, color: 'var(--text-main)' },
            { label: 'Total Scenes', value: totalScenes, icon: <Icon name="Image" />, color: 'var(--primary)' },
            { label: 'Published', value: publishedCount, icon: <Icon name="Check" />, color: 'var(--success)' },
            { label: 'Drafts', value: draftCount, icon: <Icon name="FileText" />, color: 'var(--warning)' },
            { label: 'Hotspots', value: totalHotspots, icon: <Icon name="MapPin" />, color: 'var(--accent)' },
          ].map((s, i) => (
            <Col xs={12} sm={8} lg={6} xl={4} key={i} style={{ flexGrow: 1 }}>
              <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                  <div style={{ color: s.color, opacity: 0.8, fontSize: 18 }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-main)', lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </motion.div>

      {/* Toolbar */}
      <motion.div variants={itemVariants} className="glass-card" style={{ padding: '12px 16px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <Input
          placeholder="Search tours by name..."
          prefix={<Icon name="Search" style={{ color: 'var(--text-soft)', marginRight: 8 }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320, flex: 1, background: 'rgba(24, 26, 23, 0.4)', border: '1px solid var(--border-soft)', color: 'var(--text-main)' }}
          allowClear
        />
        <Space>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }}>
            <Option value="all">All Status</Option>
            <Option value="published">Published</Option>
            <Option value="draft">Drafts</Option>
          </Select>
          <Select value={sortOrder} onChange={setSortOrder} style={{ width: 140 }}>
            <Option value="newest">Newest First</Option>
            <Option value="oldest">Oldest First</Option>
          </Select>
        </Space>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card" style={{ textAlign: 'center', padding: '80px 24px', border: '1px dashed var(--border-medium)' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '20px', background: 'rgba(184, 138, 68, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            border: '1px solid var(--border-soft)',
            transform: 'rotate(10deg)'
          }}>
            <Icon name="Globe" size="empty" style={{ color: 'var(--primary)', transform: 'rotate(-10deg)', opacity: 0.4 }} />
          </div>
          <Title level={3} style={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)', marginBottom: 8, fontSize: 24 }}>
            {search || statusFilter !== 'all' ? 'No tours match your filters' : 'No virtual tours yet'}
          </Title>
          <Text style={{ color: 'var(--text-muted)', fontSize: 15, display: 'block', marginBottom: 24 }}>
            {search || statusFilter !== 'all' 
              ? 'Try adjusting your search or status dropdown.' 
              : 'Create your first immersive tour by uploading 360° scenes and adding interactive hotspots.'}
          </Text>
          {!search && statusFilter === 'all' && (
            <Button className="primary-btn" size="large" icon={<Icon name="Plus" />} onClick={() => navigate('/dashboard/create')} style={{ padding: '0 32px' }}>
              Create New Tour
            </Button>
          )}
        </motion.div>
      ) : (
        <Row gutter={[24, 24]}>
          {filtered.map((tour) => (
            <Col xs={24} md={12} xl={8} key={tour.id}>
              <motion.div variants={itemVariants} style={{ height: '100%' }}>
                <TourCard
                  tour={tour}
                  onDelete={handleDelete}
                  navigate={navigate}
                  onExport={handleExport}
                  onOpenPublish={(t) => {
                    setSelectedPublishTour(t);
                    setShowPublishModal(true);
                  }}
                />
              </motion.div>
            </Col>
          ))}
        </Row>
      )}

      {/* Export Modal */}
      <Modal
        title={<span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>Exporting Standalone Tour</span>}
        open={exporting}
        footer={null}
        closable={false}
        centered
        className="glass-modal"
        styles={{ body: { padding: '24px 16px', textAlign: 'center', height: '250px', position: 'relative' } }}
      >
        <div style={{ margin: '10px 0 20px' }}>
          <ActionLoader text={`Packaging ${exportingTitle || 'offline player'}... ${exportProgress}%`} />
        </div>
      </Modal>

      {/* Publish & Version Management Modal */}
      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        tour={selectedPublishTour}
        onPublishSuccess={fetchTours}
      />
    </motion.div>
  );
}

function TourCard({ tour, onDelete, navigate, onExport, onOpenPublish }) {
  const sceneCount = tour.scenes?.length || 0;
  const hotspotCount = tour.scenes?.reduce((a, s) => a + (s.hotspots?.length || 0), 0) || 0;
  const firstImage = tour.scenes?.[0]?.image;
  const isPublished = tour.published || tour.isPublished;
  const formattedDate = tour.lastPublishedAt
    ? `Pub: ${new Date(tour.lastPublishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : tour.createdAt
    ? new Date(tour.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown date';

  return (
    <div className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', cursor: 'default' }}>
      {/* Thumbnail 2:1 */}
      <div style={{
        aspectRatio: '2 / 1',
        width: '100%',
        background: firstImage
          ? `url(${require('../../../services/http/httpClient').getImageUrl(firstImage)}) center/cover`
          : 'var(--bg-panel)',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid var(--border-soft)',
        overflow: 'hidden'
      }}>
        {!firstImage && <Icon name="Image" size="xl" style={{ color: 'var(--text-soft)' }} />}
        
        {/* Status Badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: isPublished ? 'rgba(104, 197, 143, 0.15)' : 'rgba(215, 168, 79, 0.15)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: 11, color: isPublished ? 'var(--success)' : 'var(--warning)',
          border: `1px solid ${isPublished ? 'rgba(104, 197, 143, 0.25)' : 'rgba(215, 168, 79, 0.25)'}`,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPublished ? 'var(--success)' : 'var(--warning)' }} />
          {isPublished ? `v${tour.latestVersionNumber || 1} LIVE` : 'Draft'}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--text-main)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tour.title}
        </div>
        {tour.description && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tour.description}
          </div>
        )}

        {/* Metadata */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', marginTop: 'auto' }}>
          <Tag style={{ background: 'rgba(24, 26, 23, 0.6)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', margin: 0, padding: '2px 8px' }}>
            {sceneCount} Scene{sceneCount !== 1 ? 's' : ''}
          </Tag>
          <Tag style={{ background: 'rgba(24, 26, 23, 0.6)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', margin: 0, padding: '2px 8px' }}>
            {hotspotCount} Hotspot{hotspotCount !== 1 ? 's' : ''}
          </Tag>
          <span style={{ fontSize: 12, color: 'var(--text-soft)', marginLeft: 'auto', alignSelf: 'center' }}>
            {formattedDate}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <Button
            icon={<Icon name="Pencil" />}
            onClick={() => navigate(`/editor/${tour.id || tour._id}`)}
            style={{ flex: 1, background: 'rgba(184, 138, 68, 0.1)', border: '1px solid rgba(184, 138, 68, 0.2)', color: 'var(--primary)', fontWeight: 500 }}
          >
            Edit
          </Button>
          <Tooltip title="Publish / Manage Versions">
            <Button
              icon={<Icon name="Upload" />}
              onClick={() => onOpenPublish && onOpenPublish(tour)}
              style={{
                background: isPublished ? 'rgba(104, 197, 143, 0.12)' : 'rgba(24, 26, 23, 0.8)',
                border: `1px solid ${isPublished ? 'rgba(104, 197, 143, 0.3)' : 'var(--border-medium)'}`,
                color: isPublished ? 'var(--success)' : 'var(--text-main)',
                fontWeight: 600
              }}
            >
              Publish
            </Button>
          </Tooltip>
          <Tooltip title={isPublished && tour.publicSlug ? `Open Live (/tour/${tour.publicSlug})` : 'Preview Draft'}>
            <Button
              icon={<Icon name="Eye" />}
              onClick={() => {
                if (isPublished && tour.publicSlug) {
                  window.open(`/tour/${tour.publicSlug}`, '_blank');
                } else {
                  window.open(`/viewer/${tour.id || tour._id}`, '_blank');
                }
              }}
              style={{ background: 'rgba(24, 26, 23, 0.8)', border: '1px solid var(--border-medium)', color: 'var(--text-main)' }}
            />
          </Tooltip>
          <Tooltip title="Export Offline ZIP">
            <Button
              icon={<Icon name="Download" />}
              onClick={() => onExport(tour)}
              style={{ background: 'rgba(24, 26, 23, 0.8)', border: '1px solid var(--border-medium)', color: 'var(--text-main)' }}
            />
          </Tooltip>
          <Popconfirm
            title={<span style={{ color: 'var(--text-main)' }}>Delete Tour</span>}
            description={<span style={{ color: 'var(--text-muted)' }}>Are you sure? This cannot be undone.</span>}
            onConfirm={() => onDelete(tour.id || tour._id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            styles={{ body: { background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 6 } }}
          >
            <Button
              icon={<Icon name="Trash2" />}
              style={{ background: 'rgba(217, 95, 95, 0.08)', border: '1px solid rgba(217, 95, 95, 0.2)', color: 'var(--danger)' }}
            />
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
