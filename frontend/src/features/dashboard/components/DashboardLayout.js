import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../../../components/common/Icon';
import { useResponsiveContext } from '../../../context/ResponsiveProvider';
import brandLogo from '../../../assets/logo.png';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/dashboard/tours', icon: <Icon name="LayoutDashboard" size="sm" />, label: 'My Tours' },
  { key: '/dashboard/create', icon: <Icon name="Plus" size="sm" />, label: 'Create Tour' },
  { key: '/dashboard/analytics', icon: <Icon name="TrendingUp" size="sm" />, label: 'Analytics' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isTablet } = useResponsiveContext();
  const [collapsed, setCollapsed] = useState(isMobile || isTablet);

  // Auto-collapse when breakpoints change
  React.useEffect(() => {
    setCollapsed(isMobile || isTablet);
  }, [isMobile, isTablet]);

  const selectedKey = menuItems.find(i => location.pathname.startsWith(i.key))?.key
    || (location.pathname === '/dashboard' ? '/dashboard/tours' : '/dashboard/tours');

  return (
    <Layout className="app-bg" style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        collapsedWidth={isMobile ? 0 : 80}
        style={{
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border-soft)',
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          zIndex: 100,
          overflow: 'auto',
          boxShadow: isMobile && !collapsed ? '0 0 40px rgba(0,0,0,0.8)' : 'none',
        }}
        trigger={null}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 0' : '22px 18px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          marginBottom: 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <img 
            src={brandLogo} 
            alt="WoX BUILDER Logo" 
            style={{
              width: collapsed ? 36 : '100%',
              maxWidth: collapsed ? 36 : 210,
              height: collapsed ? 36 : 50,
              objectFit: 'contain',
              objectPosition: collapsed ? 'center' : 'left center',
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.6))',
              display: 'block',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }} 
            onClick={() => navigate('/')}
          />
        </div>

        <style>{`
          .ant-menu-dark .ant-menu-item-selected {
            background: linear-gradient(90deg, rgba(184, 138, 68, 0.18), rgba(122, 143, 106, 0.08)) !important;
            border: 1px solid rgba(184, 138, 68, 0.22) !important;
            border-left: none !important;
            color: var(--text-main) !important;
          }
          .ant-menu-dark .ant-menu-item:hover {
            background: rgba(244, 241, 234, 0.04) !important;
          }
        `}</style>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', border: 'none', padding: '4px 0' }}
        />
      </Sider>

      <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 240), transition: 'margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: 'transparent' }}>
        {/* Top header */}
        <Header style={{
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-soft)',
          padding: isMobile ? '0 16px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 99,
          height: 64,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, display: 'flex', alignItems: 'center' }}
          >
            {collapsed ? '→' : '←'}
          </div>
        </Header>

        <Content style={{ 
          padding: isMobile ? '20px 16px' : (isTablet ? '24px 24px' : '40px 48px'), 
          minHeight: 'calc(100vh - 64px)',
          transition: 'padding 0.3s ease',
          maxWidth: '1360px',
          margin: '0 auto',
          width: '100%',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
