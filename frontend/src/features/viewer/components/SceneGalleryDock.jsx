import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../../components/common/Icon';

/**
 * SceneGalleryDock - Professional Luxury-Grade Scene Dock & Explorer
 * Designed for 360 Virtual Tour Viewers
 */
function SceneGalleryDock({
  tour,
  scenes = [],
  currentSceneId,
  onSelectScene,
  getImageUrl,
  isMobile = false,
  showUI = true
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showExplorerModal, setShowExplorerModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredScene, setHoveredScene] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useRef(null);
  const activeCardRef = useRef(null);
  const searchInputRef = useRef(null);

  const folders = tour?.folders || {};
  const folderNames = Object.keys(folders);
  const hasFolders = folderNames.length > 0;

  // Filter scenes based on active folder tab and search query
  const filteredScenes = useMemo(() => {
    let list = scenes;

    if (hasFolders && selectedFolder !== 'ALL') {
      const folderSceneIds = folders[selectedFolder] || [];
      list = list.filter(s => folderSceneIds.includes(s.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [scenes, searchQuery, selectedFolder, hasFolders, folders]);

  const currentIndex = scenes.findIndex(s => s.id === currentSceneId);
  const currentScene = scenes[currentIndex] || scenes[0];

  // Check scroll bounds
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, filteredScenes.length]);

  // Convert mouse wheel to horizontal track scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        checkScroll();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [checkScroll]);

  // Smooth auto-scroll active thumbnail into center view
  useEffect(() => {
    if (activeCardRef.current && scrollRef.current && !collapsed) {
      const container = scrollRef.current;
      const card = activeCardRef.current;
      const cardLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const containerWidth = container.offsetWidth;

      container.scrollTo({
        left: cardLeft - containerWidth / 2 + cardWidth / 2,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 350);
    }
  }, [currentSceneId, collapsed, checkScroll]);

  // Hotkeys support (1-9 for quick scene jump, G for Grid Explorer, M for minimize)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      if (e.key >= '1' && e.key <= '9') {
        const targetIdx = parseInt(e.key, 10) - 1;
        if (scenes[targetIdx]) {
          e.preventDefault();
          onSelectScene(scenes[targetIdx].id);
        }
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowExplorerModal(prev => !prev);
      } else if (e.key === 'Escape' && showExplorerModal) {
        e.preventDefault();
        setShowExplorerModal(false);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenes, onSelectScene, showExplorerModal]);

  // Carousel smooth scroll navigation
  const handleScroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = isMobile ? 200 : 340;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
    setTimeout(checkScroll, 250);
  };

  // Quick next / previous scene
  const goToNextScene = (e) => {
    e.stopPropagation();
    if (scenes.length <= 1) return;
    const nextIdx = (currentIndex + 1) % scenes.length;
    onSelectScene(scenes[nextIdx].id);
  };

  const goToPrevScene = (e) => {
    e.stopPropagation();
    if (scenes.length <= 1) return;
    const prevIdx = (currentIndex - 1 + scenes.length) % scenes.length;
    onSelectScene(scenes[prevIdx].id);
  };

  if (!scenes || scenes.length <= 1) return null;

  return (
    <>
      {/* ─── 1. Collapsed Floating "Dynamic Island" Pill ────────────────────────── */}
      {collapsed ? (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 14 : 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            opacity: showUI ? 1 : 0,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: showUI ? 'auto' : 'none'
          }}
        >
          <div
            onClick={() => setCollapsed(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: isMobile ? '7px 12px' : '8px 16px',
              background: 'linear-gradient(135deg, rgba(20, 14, 30, 0.85) 0%, rgba(10, 6, 18, 0.9) 100%)',
              backdropFilter: 'blur(24px) saturate(200%)',
              WebkitBackdropFilter: 'blur(24px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 32,
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 20px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            {/* Live pulsing thumbnail icon */}
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                background: '#8b5cf6',
                border: '1.5px solid rgba(255, 255, 255, 0.5)',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.7)',
                flexShrink: 0
              }}
            >
              {(currentScene?.thumbnail || currentScene?.image) && (
                <img
                  src={getImageUrl(currentScene.thumbnail || currentScene.image)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    if (currentScene?.image) e.currentTarget.src = getImageUrl(currentScene.image);
                  }}
                />
              )}
            </div>

            <span style={{ maxWidth: isMobile ? 120 : 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentScene?.name || `Scene ${currentIndex + 1}`}
            </span>

            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.12)',
                color: 'rgba(240, 238, 255, 0.85)',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}
            >
              {currentIndex + 1}/{scenes.length}
            </span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: '#a78bfa',
                fontSize: 11,
                fontWeight: 700,
                paddingLeft: 4
              }}
            >
              <span>Explore</span>
              <Icon name="ChevronUp" size="xs" />
            </div>
          </div>
        </div>
      ) : (
        /* ─── 2. Expanded Floating Luxury Dock ───────────────────────────────── */
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 10 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            width: 'auto',
            maxWidth: isMobile ? 'calc(100vw - 16px)' : 'min(720px, calc(100vw - 260px))',
            minWidth: isMobile ? 'calc(100vw - 20px)' : 360,
            opacity: showUI ? 1 : 0,
            transition: 'opacity 0.45s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: showUI ? 'auto' : 'none'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(16, 10, 26, 0.84) 0%, rgba(8, 4, 14, 0.92) 100%)',
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              borderRadius: isMobile ? 16 : 18,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.75), 0 2px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              padding: isMobile ? '6px 8px 8px' : '8px 10px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top Specular Shimmer Line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: 1.5,
                background: 'linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.8), rgba(244, 63, 94, 0.6), transparent)',
                pointerEvents: 'none'
              }}
            />

            {/* ─── Dock Header Toolbar ───────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 4px',
                gap: 10
              }}
            >
              {/* Left: Active Scene Status & Room Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '3px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <Icon name="Compass" size="xs" style={{ color: '#a78bfa' }} />
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: 'rgba(240, 238, 255, 0.9)',
                      textTransform: 'uppercase',
                      fontFamily: "'DM Sans', sans-serif"
                    }}
                  >
                    Scene {currentIndex + 1} / {scenes.length}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#ffffff',
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '0.01em',
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)'
                  }}
                  title={currentScene?.name || currentScene?.id}
                >
                  {currentScene?.name || `Scene ${currentIndex + 1}`}
                </div>
              </div>

              {/* Right: Actions (Grid Explorer, Search, Prev, Next, Minimize) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {/* 🔲 Grid / Scene Explorer Button (Opens Full Visual Room Map) */}
                <button
                  onClick={() => setShowExplorerModal(true)}
                  title="Open Scene Explorer Map (Press G)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 9px',
                    borderRadius: 14,
                    background: 'rgba(139, 92, 246, 0.18)',
                    border: '1px solid rgba(167, 139, 250, 0.35)',
                    color: '#c4b5fd',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.35)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                    e.currentTarget.style.color = '#c4b5fd';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Icon name="Grid" size="xs" />
                  {!isMobile && <span>Grid</span>}
                </button>

                {/* Search Filter Toggle */}
                {scenes.length > 4 && (
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    {showSearch ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'rgba(0, 0, 0, 0.5)',
                          borderRadius: 16,
                          border: '1px solid rgba(167, 139, 250, 0.45)',
                          padding: '2px 8px',
                          gap: 4
                        }}
                      >
                        <Icon name="Search" size="xs" style={{ color: '#a78bfa' }} />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search rooms..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#fff',
                            fontSize: 11,
                            width: isMobile ? 80 : 110,
                            fontFamily: "'DM Sans', sans-serif"
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(240, 238, 255, 0.6)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Icon name="X" size="xs" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowSearch(true);
                          setTimeout(() => searchInputRef.current?.focus(), 50);
                        }}
                        title="Search scenes"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'rgba(240, 238, 255, 0.75)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                      >
                        <Icon name="Search" size="xs" />
                      </button>
                    )}
                  </div>
                )}

                {/* Step Previous Scene Button */}
                <button
                  onClick={goToPrevScene}
                  title="Previous scene (Left Arrow)"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'rgba(240, 238, 255, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'rgba(240, 238, 255, 0.75)';
                  }}
                >
                  <Icon name="ChevronLeft" size="xs" />
                </button>

                {/* Step Next Scene Button */}
                <button
                  onClick={goToNextScene}
                  title="Next scene (Right Arrow)"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'rgba(240, 238, 255, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'rgba(240, 238, 255, 0.75)';
                  }}
                >
                  <Icon name="ChevronRight" size="xs" />
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => setCollapsed(true)}
                  title="Minimize dock (Press M)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '4px 8px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'rgba(240, 238, 255, 0.7)',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'rgba(240, 238, 255, 0.7)';
                  }}
                >
                  <Icon name="ChevronDown" size="xs" />
                  {!isMobile && <span>Hide</span>}
                </button>
              </div>
            </div>

            {/* ─── Scrollable Thumbnail Track ────────────────────────────────── */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              {/* Left Floating Scroll Arrow */}
              {canScrollLeft && (
                <button
                  onClick={() => handleScroll('left')}
                  style={{
                    position: 'absolute',
                    left: -4,
                    zIndex: 10,
                    width: 28,
                    height: isMobile ? 46 : 56,
                    borderRadius: '8px 0 0 8px',
                    background: 'linear-gradient(90deg, rgba(12, 8, 20, 0.95), rgba(12, 8, 20, 0.7))',
                    border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '4px 0 16px rgba(0,0,0,0.6)',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(90deg, rgba(35, 24, 52, 0.98), rgba(25, 18, 38, 0.85))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(90deg, rgba(12, 8, 20, 0.95), rgba(12, 8, 20, 0.7))')}
                >
                  <Icon name="ChevronLeft" size="sm" />
                </button>
              )}

              {/* Thumbnails Container */}
              <div
                ref={scrollRef}
                style={{
                  display: 'flex',
                  gap: isMobile ? 6 : 8,
                  alignItems: 'center',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  padding: '3px 2px',
                  width: '100%',
                  scrollBehavior: 'smooth'
                }}
              >
                {filteredScenes.length === 0 ? (
                  <div
                    style={{
                      padding: '18px 24px',
                      color: 'rgba(240, 238, 255, 0.5)',
                      fontSize: 12,
                      textAlign: 'center',
                      width: '100%'
                    }}
                  >
                    No rooms found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredScenes.map((scene, index) => {
                    const isActive = scene.id === currentSceneId;
                    const sceneNumber = (index + 1).toString().padStart(2, '0');
                    const thumbImage = scene.thumbnail || scene.image;
                    const thumbUrl = thumbImage ? getImageUrl(thumbImage) : null;
                    const cardWidth = isMobile ? 74 : 90;
                    const cardHeight = isMobile ? 46 : 56;

                    return (
                      <div
                        key={scene.id}
                        ref={isActive ? activeCardRef : null}
                        onClick={() => onSelectScene(scene.id)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPopoverPos({ x: rect.left + rect.width / 2, y: rect.top });
                          setHoveredScene(scene);
                        }}
                        onMouseLeave={() => setHoveredScene(null)}
                        style={{
                          position: 'relative',
                          flexShrink: 0,
                          cursor: 'pointer',
                          width: cardWidth,
                          height: cardHeight,
                          borderRadius: 11,
                          overflow: 'hidden',
                          border: isActive
                            ? '2px solid #8b5cf6'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: isActive
                            ? '0 0 24px rgba(139, 92, 246, 0.65), 0 4px 18px rgba(0,0,0,0.6)'
                            : '0 3px 10px rgba(0, 0, 0, 0.4)',
                          transform: isActive
                            ? 'translateY(-2px) scale(1.02)'
                            : 'translateY(0) scale(1)',
                          transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          background: '#180e22'
                        }}
                      >
                        {/* High Performance Native Image with Automatic Fallback */}
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={scene.name || `Scene ${sceneNumber}`}
                            loading="lazy"
                            decoding="async"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                            onError={(e) => {
                              if (scene.image && e.currentTarget.src !== getImageUrl(scene.image)) {
                                e.currentTarget.src = getImageUrl(scene.image);
                              } else {
                                e.currentTarget.style.display = 'none';
                              }
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #241638, #0e0818)'
                            }}
                          >
                            <Icon name="Image" size="sm" style={{ color: 'rgba(240, 238, 255, 0.4)' }} />
                          </div>
                        )}

                        {/* Readable Gradient Overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: isActive
                              ? 'linear-gradient(180deg, rgba(139, 92, 246, 0.2) 0%, transparent 40%, rgba(10, 5, 20, 0.92) 100%)'
                              : 'linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, transparent 40%, rgba(0, 0, 0, 0.88) 100%)',
                            pointerEvents: 'none'
                          }}
                        />

                        {/* Top Left: Scene Number Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            background: isActive ? '#8b5cf6' : 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(6px)',
                            color: '#ffffff',
                            fontSize: 8.5,
                            fontWeight: 700,
                            padding: '1.5px 5.5px',
                            borderRadius: 6,
                            letterSpacing: '0.04em',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            boxShadow: isActive ? '0 0 10px rgba(139, 92, 246, 0.8)' : 'none'
                          }}
                        >
                          {sceneNumber}
                        </div>

                        {/* Top Right: Active Pulsing Live Badge */}
                        {isActive && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              background: 'rgba(16, 185, 129, 0.95)',
                              padding: '1.5px 5.5px',
                              borderRadius: 6,
                              boxShadow: '0 0 12px rgba(16, 185, 129, 0.75)'
                            }}
                          >
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: '#ffffff',
                                animation: 'livePulse 1.4s infinite ease-in-out'
                              }}
                            />
                            <span style={{ fontSize: 7.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                              LIVE
                            </span>
                          </div>
                        )}

                        {/* Bottom: Scene Name Caption */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 3,
                            left: 5,
                            right: 5,
                            fontSize: 9.5,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? '#ffffff' : 'rgba(240, 238, 255, 0.92)',
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textAlign: 'left',
                            textShadow: '0 1px 3px rgba(0,0,0,0.95)'
                          }}
                        >
                          {scene.name || `Scene ${index + 1}`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Floating Scroll Arrow */}
              {canScrollRight && (
                <button
                  onClick={() => handleScroll('right')}
                  style={{
                    position: 'absolute',
                    right: -4,
                    zIndex: 10,
                    width: 28,
                    height: isMobile ? 46 : 56,
                    borderRadius: '0 8px 8px 0',
                    background: 'linear-gradient(270deg, rgba(12, 8, 20, 0.95), rgba(12, 8, 20, 0.7))',
                    border: 'none',
                    borderLeft: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '-4px 0 16px rgba(0,0,0,0.6)',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(270deg, rgba(35, 24, 52, 0.98), rgba(25, 18, 38, 0.85))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(270deg, rgba(12, 8, 20, 0.95), rgba(12, 8, 20, 0.7))')}
                >
                  <Icon name="ChevronRight" size="sm" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. Rich Hover Preview Popover ───────────────────────────────────── */}
      {hoveredScene && hoveredScene.id !== currentSceneId && !collapsed && (
        <div
          style={{
            position: 'fixed',
            left: popoverPos.x,
            top: popoverPos.y - 12,
            transform: 'translate(-50%, -100%)',
            background: 'linear-gradient(135deg, rgba(20, 14, 30, 0.96) 0%, rgba(10, 6, 18, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 16px rgba(139, 92, 246, 0.25)',
            zIndex: 100,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 160,
            maxWidth: 220,
            animation: 'popoverIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {(hoveredScene.thumbnail || hoveredScene.image) && (
            <div
              style={{
                width: '100%',
                height: 90,
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#180e22'
              }}
            >
              <img
                src={getImageUrl(hoveredScene.thumbnail || hoveredScene.image)}
                alt={hoveredScene.name || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  if (hoveredScene.image) e.currentTarget.src = getImageUrl(hoveredScene.image);
                }}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ color: '#ffffff', fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
              {hoveredScene.name || 'Unnamed Scene'}
            </div>
            <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 600 }}>
              Click to navigate • #{scenes.findIndex(s => s.id === hoveredScene.id) + 1}
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. Fullscreen "Scene Explorer / Visual Room Map" Modal ─────────── */}
      {showExplorerModal && (
        <div
          onClick={() => setShowExplorerModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(6, 4, 12, 0.8)',
            backdropFilter: 'blur(32px) saturate(190%)',
            WebkitBackdropFilter: 'blur(32px) saturate(190%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 16 : 32,
            animation: 'fadeIn 0.22s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 960,
              maxHeight: '88vh',
              background: 'linear-gradient(180deg, rgba(22, 16, 36, 0.95) 0%, rgba(12, 8, 20, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: 24,
              boxShadow: '0 32px 96px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c4b5fd'
                  }}
                >
                  <Icon name="Grid" size="sm" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', fontFamily: "'Syne', sans-serif" }}>
                    Scene Explorer Map
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(240, 238, 255, 0.6)', marginTop: 2 }}>
                    {scenes.length} {scenes.length === 1 ? 'room' : 'rooms'} in this virtual tour
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowExplorerModal(false)}
                title="Close (Esc)"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              >
                <Icon name="X" size="sm" />
              </button>
            </div>

            {/* Folder Tabs / Filter Strip */}
            {hasFolders && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '12px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  overflowX: 'auto',
                  scrollbarWidth: 'none'
                }}
              >
                <button
                  onClick={() => setSelectedFolder('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 16,
                    background: selectedFolder === 'ALL' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid ' + (selectedFolder === 'ALL' ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All Rooms ({scenes.length})
                </button>
                {folderNames.map(fName => {
                  const count = (folders[fName] || []).length;
                  const isSelected = selectedFolder === fName;
                  return (
                    <button
                      key={fName}
                      onClick={() => setSelectedFolder(fName)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 16,
                        background: isSelected ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid ' + (isSelected ? '#a78bfa' : 'rgba(255, 255, 255, 0.1)'),
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {fName} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Modal Grid Body */}
            <div
              style={{
                padding: isMobile ? 16 : 24,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: isMobile ? 12 : 16,
                maxHeight: 'calc(88vh - 160px)'
              }}
            >
              {filteredScenes.map((scene, index) => {
                const isActive = scene.id === currentSceneId;
                const thumbImage = scene.thumbnail || scene.image;
                const thumbUrl = thumbImage ? getImageUrl(thumbImage) : null;
                const sceneNumber = (index + 1).toString().padStart(2, '0');

                return (
                  <div
                    key={scene.id}
                    onClick={() => {
                      onSelectScene(scene.id);
                      setShowExplorerModal(false);
                    }}
                    style={{
                      position: 'relative',
                      borderRadius: 14,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: isActive
                        ? '2px solid #8b5cf6'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(10, 6, 18, 0.6)',
                      boxShadow: isActive
                        ? '0 0 24px rgba(139, 92, 246, 0.6), 0 8px 24px rgba(0,0,0,0.6)'
                        : '0 4px 14px rgba(0,0,0,0.35)',
                      transition: 'all 0.22s ease',
                      transform: 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
                      e.currentTarget.style.borderColor = isActive ? '#8b5cf6' : 'rgba(167, 139, 250, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.borderColor = isActive ? '#8b5cf6' : 'rgba(255, 255, 255, 0.12)';
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: isMobile ? 85 : 115,
                        background: '#180e22',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {thumbUrl && (
                        <img
                          src={thumbUrl}
                          alt={scene.name || ''}
                          loading="lazy"
                          decoding="async"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block'
                          }}
                          onError={(e) => {
                            if (scene.image && e.currentTarget.src !== getImageUrl(scene.image)) {
                              e.currentTarget.src = getImageUrl(scene.image);
                            } else {
                              e.currentTarget.style.display = 'none';
                            }
                          }}
                        />
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(10, 5, 20, 0.9) 100%)'
                        }}
                      />

                      {/* Number Tag */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: isActive ? '#8b5cf6' : 'rgba(0, 0, 0, 0.7)',
                          backdropFilter: 'blur(6px)',
                          color: '#ffffff',
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 8,
                          border: '1px solid rgba(255, 255, 255, 0.18)'
                        }}
                      >
                        {sceneNumber}
                      </div>

                      {/* Active Tag */}
                      {isActive && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: '#10b981',
                            color: '#ffffff',
                            fontSize: 8.5,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 6,
                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)'
                          }}
                        >
                          ACTIVE
                        </div>
                      )}
                    </div>

                    {/* Scene Details Footer */}
                    <div style={{ padding: '8px 12px 10px' }}>
                      <div
                        style={{
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {scene.name || `Scene ${index + 1}`}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(240, 238, 255, 0.5)', marginTop: 2 }}>
                        {scene.hotspots?.length || 0} hotspots
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Dynamic Keyframe Styles */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.8); }
        }
        @keyframes popoverIn {
          from { opacity: 0; transform: translate(-50%, -90%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

export default React.memo(SceneGalleryDock);
