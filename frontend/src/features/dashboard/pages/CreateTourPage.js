import React, { useState } from 'react';
import { Typography, Form, Input, Button, message, Space } from 'antd';
import Icon from '../../../components/common/Icon';
import ActionLoader from '../../../components/common/ActionLoader';
import { useNavigate } from 'react-router-dom';
import { createTour } from '../services/tour.service';

const { Title, Text } = Typography;

export default function CreateTourPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const tour = await createTour(values);
      message.success('Tour created! Opening editor...');
      setTimeout(() => navigate(`/editor/${tour.id}`), 600);
    } catch (err) {
      message.error('Failed to create tour');
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease', maxWidth: 600, position: 'relative' }}>
      {loading && <ActionLoader text="Creating virtual tour..." />}
      <Button
        icon={<Icon name="ArrowLeft" />}
        onClick={() => navigate('/dashboard/tours')}
        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', marginBottom: 28 }}
      >
        Back to Tours
      </Button>

      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0, fontSize: 28 }}>
          Create New Tour
        </Title>
        <Text style={{ color: 'var(--text-secondary)' }}>
          Set up your virtual tour — you'll add scenes and hotspots in the editor
        </Text>
      </div>

      <div style={{
        padding: 32,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}>
        {/* Visual header */}
        <div style={{
          textAlign: 'center', marginBottom: 32,
          padding: '24px',
          background: 'linear-gradient(135deg, var(--accent-dim), var(--cyan-dim))',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(108,99,255,0.15)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
            margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px var(--accent-glow)',
          }}>
            <Icon name="Globe" size="lg" style={{ color: '#fff' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-secondary)' }}>
            New Virtual Experience
          </div>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="title"
            label="Tour Title"
            rules={[{ required: true, message: 'Please enter a tour title' }]}
          >
            <Input
              placeholder="e.g. Hotel Grand — Virtual Walkthrough"
              size="large"
              style={{ fontSize: 15 }}
            />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea
              placeholder="A short description of your virtual tour..."
              rows={3}
              style={{ resize: 'none' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => navigate('/dashboard/tours')}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<Icon name="Plus" />}
                size="large"
              >
                Create & Open Editor
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 24 }}>
        {[
          { step: '01', label: 'Create Tour', desc: 'Set a title and description' },
          { step: '02', label: 'Add Scenes', desc: 'Upload 360° panoramas' },
          { step: '03', label: 'Add Hotspots', desc: 'Connect scenes together' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            opacity: i === 0 ? 1 : 0.6,
          }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>STEP {s.step}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
