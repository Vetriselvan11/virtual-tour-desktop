import { useState, useEffect } from 'react';
import { useResponsiveContext } from '../../../context/ResponsiveProvider';

export function useEditorLayout() {
  const { isMobile, isTablet } = useResponsiveContext();

  // Left Sidebar Resize
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('editor_sidebar_width')) || 240;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Viewport Settings
  const [quality, setQuality] = useState(() => localStorage.getItem('editor_quality') || 'medium');
  const [cameraEase, setCameraEase] = useState(() => parseFloat(localStorage.getItem('editor_camera_ease')) || 0.055);

  // Collapsible Workspace panels state
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [bottomTimelineCollapsed, setBottomTimelineCollapsed] = useState(window.innerWidth < 1024);

  // Right panel active tab
  const [rightTab, setRightTab] = useState('hotspot');

  // UI Overlays
  const [showFloorplanEditor, setShowFloorplanEditor] = useState(false);

  useEffect(() => {
    localStorage.setItem('editor_quality', quality);
  }, [quality]);

  useEffect(() => {
    localStorage.setItem('editor_camera_ease', String(cameraEase));
  }, [cameraEase]);

  const triggerResize = () => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(180, Math.min(380, e.clientX));
      setLeftSidebarWidth(newWidth);
      localStorage.setItem('editor_sidebar_width', String(newWidth));
      triggerResize();
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (isMobile || isTablet) {
      setLeftSidebarCollapsed(true);
      setRightSidebarCollapsed(true);
      setBottomTimelineCollapsed(true);
    } else {
      setLeftSidebarCollapsed(false);
      setRightSidebarCollapsed(false);
      setBottomTimelineCollapsed(false);
    }
  }, [isMobile, isTablet]);

  return {
    leftSidebarWidth,
    setLeftSidebarWidth,
    isResizingSidebar,
    setIsResizingSidebar,
    leftSidebarCollapsed,
    setLeftSidebarCollapsed,
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
    bottomTimelineCollapsed,
    setBottomTimelineCollapsed,
    rightTab,
    setRightTab,
    showFloorplanEditor,
    setShowFloorplanEditor,
    quality,
    setQuality,
    cameraEase,
    setCameraEase,
    triggerResize,
    isMobile,
    isTablet
  };
}
