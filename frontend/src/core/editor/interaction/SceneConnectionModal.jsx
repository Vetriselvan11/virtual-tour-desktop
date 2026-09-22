import React from 'react';
import { Modal, Row, Col, Card, Typography, Empty, Badge } from 'antd';
import Icon from '../../../components/common/Icon';
import { getImageUrl } from '../../../services/http/httpClient';

const { Text } = Typography;

/**
 * Visual Scene Selector and Linker modal.
 * Displays card mockups of scenes, letting creators click to hook navigation targets.
 */
export default function SceneConnectionModal({
  visible,
  scenes = [],
  currentSceneId,
  onSelect,
  onClose
}) {
  // Filter out the active scene to prevent linking a scene to itself
  const linkableScenes = scenes.filter((s) => s.id !== currentSceneId);

  return (
    <Modal
      title={
        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="Link2" style={{ color: 'var(--accent)' }} size="sm" />
          CONNECT DESTINATION SCENE
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      styles={{ body: { padding: '16px 8px', maxHeight: '480px', overflowY: 'auto' } }}
    >
      {linkableScenes.length === 0 ? (
        <Empty
          description={
            <Text style={{ color: 'var(--text-muted)' }}>
              No other scenes found in this tour. Upload more 360° images first.
            </Text>
          }
          style={{ padding: '40px 0' }}
        />
      ) : (
        <Row gutter={[12, 12]}>
          {linkableScenes.map((scene) => {
            const hsCount = scene.hotspots?.length || 0;
            return (
              <Col xs={12} sm={8} md={6} key={scene.id}>
                <Card
                  hoverable
                  onClick={() => {
                    onSelect(scene.id);
                    onClose();
                  }}
                  styles={{ body: { padding: '10px' } }}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Thumbnail Card View */}
                  <div
                    style={{
                      height: '80px',
                      borderRadius: 'var(--radius-sm)',
                      background: (scene.thumbnail || scene.image)
                        ? `url(${getImageUrl(scene.thumbnail || scene.image)}) center/cover`
                        : '#000',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}
                  >
                    {!(scene.thumbnail || scene.image) && <Icon name="Image" size="xl" style={{ color: 'var(--text-muted)' }} />}
                    <div style={{ position: 'absolute', bottom: '6px', right: '6px' }}>
                      <Badge count={`${hsCount} hs`} style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(108,99,255,0.2)' }} />
                    </div>
                  </div>

                  {/* Title Info */}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <Text style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {scene.name || scene.id}
                    </Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Modal>
  );
}
