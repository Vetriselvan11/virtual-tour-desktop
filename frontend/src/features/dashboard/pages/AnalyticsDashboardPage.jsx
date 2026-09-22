import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Space, Table, Tag, Typography, Row, Col, Progress, Tooltip, message, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/common/Icon';
import { getTours } from '../services/tour.service';
import {
  getTourOverview,
  getSceneAnalytics,
  getHotspotAnalytics,
  getObjectAnalytics,
  getCinematicAnalytics,
  downloadAnalyticsCsv
} from '../services/analytics.service';

const { Title, Text } = Typography;

export default function AnalyticsDashboardPage() {
  const navigate = useNavigate();

  const [tours, setTours] = useState([]);
  const [selectedTourId, setSelectedTourId] = useState(null);
  const [dateFilter, setDateFilter] = useState('30'); // '1' | '7' | '30' | '90' | 'all'
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [objects, setObjects] = useState([]);
  const [cinematics, setCinematics] = useState([]);

  // 1. Fetch available tours on mount
  useEffect(() => {
    async function loadTours() {
      try {
        const list = await getTours();
        setTours(list || []);
        if (list && list.length > 0) {
          setSelectedTourId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load tours:', err);
      }
    }
    loadTours();
  }, []);

  // 2. Fetch analytics whenever tour or date filter changes
  useEffect(() => {
    if (!selectedTourId) return;

    async function fetchAnalytics() {
      setLoading(true);
      try {
        const params = dateFilter !== 'all' ? { days: dateFilter } : {};

        const [ovData, scData, hsData, objData, cinData] = await Promise.all([
          getTourOverview(selectedTourId, params),
          getSceneAnalytics(selectedTourId, params),
          getHotspotAnalytics(selectedTourId, params),
          getObjectAnalytics(selectedTourId, params),
          getCinematicAnalytics(selectedTourId, params)
        ]);

        setOverview(ovData || {});
        setScenes(scData || []);
        setHotspots(hsData || []);
        setObjects(objData || []);
        setCinematics(cinData || []);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        message.error('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [selectedTourId, dateFilter]);

  const handleExportCsv = async () => {
    if (!selectedTourId) return;
    try {
      const params = dateFilter !== 'all' ? { days: dateFilter } : {};
      await downloadAnalyticsCsv(selectedTourId, params);
      message.success('Analytics CSV report downloaded.');
    } catch (err) {
      console.error('CSV export failed:', err);
      message.error('Failed to export CSV report.');
    }
  };

  const selectedTour = tours.find(t => t.id === selectedTourId);

  // Table Columns
  const sceneColumns = [
    {
      title: 'Scene',
      dataIndex: 'sceneId',
      key: 'sceneId',
      render: (id) => {
        const sc = selectedTour?.scenes?.find(s => s.id === id);
        return <Text strong style={{ color: 'var(--text-main)' }}>{sc?.name || id}</Text>;
      }
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
      sorter: (a, b) => b.views - a.views,
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: 'Unique Visitors',
      dataIndex: 'uniqueSessionsCount',
      key: 'uniqueSessionsCount',
      render: (val) => <Text>{val}</Text>
    },
    {
      title: 'Avg Dwell Time',
      dataIndex: 'avgDwellSeconds',
      key: 'avgDwellSeconds',
      sorter: (a, b) => b.avgDwellSeconds - a.avgDwellSeconds,
      render: (sec) => <Text>{sec}s</Text>
    },
    {
      title: '360° Heatmap',
      key: 'heatmapAction',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<Icon name="Flame" size="xs" />}
          style={{
            background: 'linear-gradient(135deg, #b88a44, #e29d3b)',
            borderColor: '#b88a44',
            fontSize: '11px',
            fontWeight: 600
          }}
          onClick={() => navigate(`/dashboard/analytics/heatmap/${selectedTourId}/${record.sceneId}`)}
        >
          View Heatmap
        </Button>
      )
    }
  ];

  const hotspotColumns = [
    {
      title: 'Hotspot ID',
      dataIndex: 'hotspotId',
      key: 'hotspotId',
      render: (id) => <Text code>{id}</Text>
    },
    {
      title: 'Type',
      dataIndex: 'hotspotType',
      key: 'hotspotType',
      render: (type) => <Tag color="purple">{type || 'custom'}</Tag>
    },
    {
      title: 'Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      sorter: (a, b) => b.clicks - a.clicks,
      render: (val) => <Text strong style={{ color: 'var(--accent)' }}>{val}</Text>
    },
    {
      title: 'Impressions',
      dataIndex: 'impressions',
      key: 'impressions',
      render: (val) => <Text>{val}</Text>
    },
    {
      title: 'CTR',
      dataIndex: 'ctr',
      key: 'ctr',
      sorter: (a, b) => b.ctr - a.ctr,
      render: (ctr) => (
        <Space orientation="horizontal" size="small">
          <Progress percent={Math.min(100, ctr)} size="small" showInfo={false} strokeColor="var(--accent)" style={{ width: 60 }} />
          <Text>{ctr}%</Text>
        </Space>
      )
    },
    {
      title: 'Actions Executed',
      dataIndex: 'actionsExecuted',
      key: 'actionsExecuted',
      render: (val) => <Text>{val}</Text>
    }
  ];

  const objectColumns = [
    {
      title: '3D Object',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (name, record) => <Text strong style={{ color: 'var(--text-main)' }}>{name || record.objectId}</Text>
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
      render: (val) => <Text>{val}</Text>
    },
    {
      title: 'Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      render: (val) => <Tag color="cyan">{val}</Tag>
    },
    {
      title: 'Animations Played',
      dataIndex: 'animationPlays',
      key: 'animationPlays',
      render: (val) => <Tag color="gold">{val}</Tag>
    },
    {
      title: 'Total Interactions',
      dataIndex: 'totalInteractions',
      key: 'totalInteractions',
      sorter: (a, b) => b.totalInteractions - a.totalInteractions,
      render: (val) => <Text strong style={{ color: 'var(--accent)' }}>{val}</Text>
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Title level={2} style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon name="TrendingUp" size="md" color="var(--accent)" />
            Tour Analytics & Insights
          </Title>
          <Text style={{ color: 'var(--text-muted)' }}>
            Real-time engagement, drop-off funnels, hotspot CTR, and 360° gaze heatmaps.
          </Text>
        </div>

        <Space size="middle" wrap>
          <Select
            style={{ width: 220 }}
            placeholder="Select Tour"
            value={selectedTourId}
            onChange={setSelectedTourId}
            options={tours.map(t => ({ label: t.title || t.id, value: t.id }))}
          />

          <Select
            style={{ width: 140 }}
            value={dateFilter}
            onChange={setDateFilter}
            options={[
              { label: 'Today', value: '1' },
              { label: 'Past 7 Days', value: '7' },
              { label: 'Past 30 Days', value: '30' },
              { label: 'Past 90 Days', value: '90' },
              { label: 'All Time', value: 'all' }
            ]}
          />

          <Button
            icon={<Icon name="Download" size="sm" />}
            onClick={handleExportCsv}
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-main)'
            }}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Aggregating analytics data...</div>
        </div>
      ) : (
        <>
          {/* Overview Metric Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Sessions</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {overview?.totalSessions || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Unique Visitors</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#6c63ff', marginTop: '4px' }}>
                  {overview?.uniqueVisitors || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Total Scene Views</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
                  {overview?.totalSceneViews || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Hotspot Clicks</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#00d2d3', marginTop: '4px' }}>
                  {overview?.totalHotspotClicks || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Avg Session Dwell</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#ff9f43', marginTop: '4px' }}>
                  {overview?.avgSessionDurationSeconds || 0}s
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Card style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}>
                <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Tour Completion</Text>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2ed573', marginTop: '4px' }}>
                  {overview?.completionRate || 0}%
                </div>
              </Card>
            </Col>
          </Row>

          {/* Scene Analytics Table */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Icon name="Eye" size="sm" color="var(--accent)" />
                Scene Performance & 360° Heatmaps
              </div>
            }
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px', marginBottom: '24px' }}
          >
            <Table
              dataSource={scenes}
              columns={sceneColumns}
              rowKey="sceneId"
              pagination={{ pageSize: 6 }}
              style={{ background: 'transparent' }}
            />
          </Card>

          {/* Two-Column Grid: Hotspots & 3D Objects */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Icon name="Link2" size="sm" color="#6c63ff" />
                    Hotspot Engagement & CTR
                  </div>
                }
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}
              >
                <Table
                  dataSource={hotspots}
                  columns={hotspotColumns}
                  rowKey={(r) => `${r.sceneId}_${r.hotspotId}`}
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Icon name="Box" size="sm" color="#00d2d3" />
                    3D Interactive Object Interactions
                  </div>
                }
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '12px' }}
              >
                <Table
                  dataSource={objects}
                  columns={objectColumns}
                  rowKey="objectId"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
