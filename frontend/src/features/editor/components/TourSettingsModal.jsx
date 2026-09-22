import React, { useState, useRef, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Divider } from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';
import { uploadImage } from '../services/upload.service';

export default function TourSettingsModal({
  visible,
  onClose,
  tour,
  onTourUpdate
}) {
  const [form] = Form.useForm();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [clientLogo, setClientLogo] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tour && visible) {
      form.setFieldsValue({
        title: tour.title || '',
        description: tour.description || '',
        clientUrl: tour.clientUrl || ''
      });
      setClientLogo(tour.clientLogo || '');
    }
  }, [tour, visible, form]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = /\.(jpe?g|png|webp|svg|gif)$/i;
    if (!allowed.test(file.name)) {
      message.error('Please upload a valid image file (PNG, JPG, SVG, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      message.error('Image size must be less than 10MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const res = await uploadImage(tour.id, file);
      setClientLogo(res.url);
      message.success('Client logo uploaded successfully!');
    } catch (err) {
      message.error('Failed to upload logo: ' + (err?.response?.data?.error || err.message));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setClientLogo('');
    message.info('Client logo removed');
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      const updated = {
        ...tour,
        title: values.title,
        description: values.description,
        clientUrl: values.clientUrl,
        clientLogo: clientLogo || ''
      };
      onTourUpdate(updated);
      message.success('Tour branding settings updated!');
      onClose();
    });
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          <Icon name="Settings" size="sm" style={{ color: 'var(--accent)' }} />
          <span>Tour Branding & Settings</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}>
          Save Changes
        </Button>
      ]}
      centered
      width={520}
      styles={{
        body: { padding: '20px 0' }
      }}
    >
      <Form form={form} layout="vertical">
        {/* Client Logo Section */}
        <div style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: 20
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '0.04em' }}>
            CLIENT LOGO & BRANDING
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>
            This logo will be prominently displayed in the top-left corner of the 360 viewer.
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 120,
              height: 64,
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border)',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 6
            }}>
              {clientLogo ? (
                <img
                  src={getImageUrl(clientLogo)}
                  alt="Client Logo"
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>No Logo</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                size="small"
                icon={<Icon name="Upload" size="xs" />}
                onClick={() => fileInputRef.current?.click()}
                loading={uploadingLogo}
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 12
                }}
              >
                {clientLogo ? 'Change Client Logo' : 'Upload Client Logo'}
              </Button>

              {clientLogo && (
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<Icon name="Trash2" size="xs" />}
                  onClick={handleRemoveLogo}
                  style={{ fontSize: 11, height: 24, padding: 0, textAlign: 'left' }}
                >
                  Remove Logo
                </Button>
              )}
            </div>
          </div>
        </div>

        <Form.Item
          name="clientUrl"
          label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Client Website URL (Optional)</span>}
        >
          <Input
            placeholder="e.g. https://www.clientbrand.com"
            prefix={<Icon name="Globe" size="xs" style={{ color: 'var(--text-muted)' }} />}
          />
        </Form.Item>

        <Divider style={{ borderColor: 'var(--border)', margin: '16px 0' }} />

        <Form.Item
          name="title"
          label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tour Title</span>}
          rules={[{ required: true, message: 'Tour title is required' }]}
        >
          <Input placeholder="Tour Title" />
        </Form.Item>

        <Form.Item
          name="description"
          label={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Description</span>}
        >
          <Input.TextArea rows={3} placeholder="Tour description..." style={{ resize: 'none' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
