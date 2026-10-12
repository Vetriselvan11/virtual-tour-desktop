import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../../../components/common/Icon';

/**
 * KrpanoClassicSkin - Compact 1:1 Krpano Tour Skin
 * 
 * Improvements:
 * - Marked VR button for WebXR / Virtual Reality Mode
 * - Compact decreased size (smaller thumbnails and sleek control bar)
 * - Horizontal left-right scrollable track with wheel & scroll buttons
 * - Robust image error fallback (prevents broken image icons)
 */
function getDashboardTheme(hexColor = '#1c4ca2') {
  let hex = (hexColor || '#1c4ca2').replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) hex = '1c4ca2';
  
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const r2 = Math.max(0, Math.floor(r * 0.65));
  const g2 = Math.max(0, Math.floor(g * 0.65));
  const b2 = Math.max(0, Math.floor(b * 0.65));

  const rDark = Math.max(0, Math.floor(r * 0.3));
  const gDark = Math.max(0, Math.floor(g * 0.3));
  const bDark = Math.max(0, Math.floor(b * 0.3));

  return {
    primaryHex: `#${hex}`,
    bg: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.94) 0%, rgba(${r2}, ${g2}, ${b2}, 0.97) 100%)`,
    barBg: `rgba(${rDark}, ${gDark}, ${bDark}, 0.62)`,
    scrollBtnBg: `rgba(${rDark}, ${gDark}, ${bDark}, 0.88)`,
    restoreBtnBg: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.95) 0%, rgba(${r2}, ${g2}, ${b2}, 0.98) 100%)`,
    glowColor: `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.65)`
  };
}

export default function KrpanoClassicSkin({
  tour,
  scenes = [],
  currentSceneId,
  onSelectScene,
  getImageUrl,
  viewerRef,
  autoRotate,
  setAutoRotate,
  isFullscreen,
  onToggleFullscreen,
  showUI = true,
  isMobile = false,
  isDashboardHidden,
  onToggleDashboardHidden
}) {
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [internalHidden, setInternalHidden] = useState(false);
  const isHidden = isDashboardHidden !== undefined ? isDashboardHidden : internalHidden;
  const setIsHidden = useCallback((val) => {
    setInternalHidden(val);
    if (onToggleDashboardHidden) onToggleDashboardHidden(val);
  }, [onToggleDashboardHidden]);

  // Dynamic window width measurement for fine-grained responsiveness on any screen size
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveIsMobile = isMobile || windowWidth < 640;
  const isSmallScreen = windowWidth < 460;
  const isUltraSmall = windowWidth < 380;

  // Overall Image Gallery Modal & Search Bar
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dashboard Theme Color (Dynamic from tour config in editor mode)
  const theme = getDashboardTheme(tour?.dashboardColor || '#1c4ca2');

  const scrollRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const scrollHoldIntervalRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Mouse Drag-To-Scroll (Horizontal Pan) State
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const velRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animFrameRef = useRef(null);

  const currentIndex = scenes.findIndex(s => s.id === currentSceneId);
  const currentScene = scenes[currentIndex] || scenes[0];

  const checkScrollBounds = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollBounds, { passive: true });
      window.addEventListener('resize', checkScrollBounds);
      return () => {
        el.removeEventListener('scroll', checkScrollBounds);
        window.removeEventListener('resize', checkScrollBounds);
      };
    }
  }, [scenes.length, thumbsOpen, checkScrollBounds]);

  // Convert vertical mouse wheel into horizontal scroll on thumbnail strip
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 0.9;
        checkScrollBounds();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [checkScrollBounds]);

  // Auto-scroll active card into center view
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      const container = scrollRef.current;
      const targetLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [currentSceneId, thumbsOpen]);

  // Mouse drag-to-scroll listeners
  const onMouseDownTrack = (e) => {
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    cancelAnimationFrame(animFrameRef.current);
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragScrollLeftRef.current = scrollRef.current.scrollLeft;
    lastMouseXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velRef.current = 0;
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e) => {
      if (!scrollRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      if (Math.abs(dx) > 4) {
        hasDraggedRef.current = true;
      }
      scrollRef.current.scrollLeft = dragScrollLeftRef.current - dx;

      const now = performance.now();
      const dt = now - lastTimeRef.current;
      if (dt > 8) {
        velRef.current = (lastMouseXRef.current - e.clientX) / dt;
        lastMouseXRef.current = e.clientX;
        lastTimeRef.current = now;
      }
      checkScrollBounds();
    };

    const onMouseUp = () => {
      setIsDragging(false);
      // Kinetic inertia glide on release
      if (Math.abs(velRef.current) > 0.12 && scrollRef.current) {
        let momentum = velRef.current * 160;
        const glide = () => {
          if (!scrollRef.current || Math.abs(momentum) < 0.4) return;
          scrollRef.current.scrollLeft += momentum * 0.12;
          momentum *= 0.88;
          checkScrollBounds();
          animFrameRef.current = requestAnimationFrame(glide);
        };
        animFrameRef.current = requestAnimationFrame(glide);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, checkScrollBounds]);

  // Press-and-hold continuous scroll for chevron buttons
  const startScrollHold = (offset) => {
    scrollByAmount(offset);
    clearInterval(scrollHoldIntervalRef.current);
    scrollHoldIntervalRef.current = setInterval(() => {
      scrollByAmount(offset * 0.65);
    }, 60);
  };

  const stopScrollHold = () => {
    clearInterval(scrollHoldIntervalRef.current);
  };

  // Close gallery modal on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showGalleryModal) {
        setShowGalleryModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showGalleryModal]);

  const scrollByAmount = (offset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScrollBounds, 250);
    }
  };

  const goToPrevScene = useCallback(() => {
    if (scenes.length <= 1) return;
    const prevIdx = (currentIndex - 1 + scenes.length) % scenes.length;
    onSelectScene(scenes[prevIdx].id);
  }, [currentIndex, scenes, onSelectScene]);

  const goToNextScene = useCallback(() => {
    if (scenes.length <= 1) return;
    const nextIdx = (currentIndex + 1) % scenes.length;
    onSelectScene(scenes[nextIdx].id);
  }, [currentIndex, scenes, onSelectScene]);

  // Press-and-hold camera rotation
  const startHoldAction = (actionFn) => {
    actionFn();
    clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = setInterval(() => {
      actionFn();
    }, 45);
  };

  const stopHoldAction = () => {
    clearInterval(holdIntervalRef.current);
  };

  const handleTriggerVR = () => {
    if (viewerRef?.current?.enterVR) {
      viewerRef.current.enterVR();
    } else if (viewerRef?.current?.toggleVR) {
      viewerRef.current.toggleVR();
    } else {
      console.log('WebXR / VR mode triggered');
    }
  };

  const getInitialThumbUrl = (sc) => {
    if (sc.thumbnail) return getImageUrl(sc.thumbnail);
    if (sc.preview) return getImageUrl(sc.preview);
    if (sc.image) return getImageUrl(sc.image);
    return null;
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: effectiveIsMobile ? '6px' : '12px',
          left: '50%',
          transform: isHidden
            ? 'translateX(-50%) translateY(calc(100% + 50px))'
            : 'translateX(-50%) translateY(0)',
          width: effectiveIsMobile ? 'calc(100vw - 10px)' : 'calc(100vw - 40px)',
          maxWidth: '860px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          opacity: showUI ? (isHidden ? 0 : 1) : 0,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
          pointerEvents: (showUI && !isHidden) ? 'auto' : 'none',
          userSelect: 'none'
        }}
      >
      {/* ── Italic Title Above Bar ── */}
      <div style={{
        color: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        fontSize: isSmallScreen ? '11px' : effectiveIsMobile ? '12px' : '14px',
        textShadow: '0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)',
        marginBottom: '3px',
        paddingLeft: '4px',
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%'
      }}>
        {currentScene?.name || currentScene?.title || tour?.title || 'Virtual Tour'}
      </div>

      {/* ── Main Compact Blue Krpano Frame ── */}
      <div style={{
        width: '100%',
        background: theme.bg,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1.2px solid rgba(255, 255, 255, 0.55)',
        borderRadius: effectiveIsMobile ? '6px' : '8px',
        boxShadow: `0 6px 26px rgba(0, 0, 0, 0.65), 0 0 16px ${theme.glowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ── Thumbnail Strip with Left/Right Scroll Buttons (Collapsible) ── */}
        {thumbsOpen && (
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            {/* Left Scroll Arrow Button */}
            <button
              onClick={() => scrollByAmount(-220)}
              onMouseDown={() => startScrollHold(-220)}
              onMouseUp={stopScrollHold}
              onMouseLeave={stopScrollHold}
              title="Scroll Left"
              style={{
                position: 'absolute',
                left: 2,
                zIndex: 10,
                width: isSmallScreen ? 18 : 20,
                height: effectiveIsMobile ? 46 : 56,
                background: theme.scrollBtnBg,
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 4,
                color: '#fff',
                cursor: canScrollLeft ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                opacity: canScrollLeft ? 1 : 0.35,
                pointerEvents: canScrollLeft ? 'auto' : 'none',
                transition: 'opacity 0.2s ease, background 0.2s ease'
              }}
            >
              <Icon name="ChevronLeft" size="xs" />
            </button>

            {/* Scrollable Thumbnails Track with Mouse Drag-To-Scroll */}
            <div
              ref={scrollRef}
              onMouseDown={onMouseDownTrack}
              style={{
                display: 'flex',
                gap: isSmallScreen ? '4px' : effectiveIsMobile ? '5px' : '7px',
                padding: isSmallScreen ? '5px 20px 4px 20px' : effectiveIsMobile ? '6px 24px 4px 24px' : '7px 26px 5px 26px',
                overflowX: 'auto',
                scrollBehavior: isDragging ? 'auto' : 'smooth',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                width: '100%',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none'
              }}
            >
              <style>{`
                .krpano-scroll-track::-webkit-scrollbar { display: none; }
              `}</style>

              {scenes.map((sc) => {
                const isSelected = sc.id === currentSceneId;
                const thumbUrl = getInitialThumbUrl(sc);
                const sceneName = sc.name || sc.id;

                return (
                  <div
                    key={sc.id}
                    data-active={isSelected}
                    onClick={() => {
                      if (hasDraggedRef.current) return;
                      onSelectScene(sc.id);
                    }}
                    style={{
                      position: 'relative',
                      width: isSmallScreen ? '68px' : effectiveIsMobile ? '76px' : '98px',
                      height: isSmallScreen ? '44px' : effectiveIsMobile ? '48px' : '60px',
                      flexShrink: 0,
                      borderRadius: '5px',
                      border: isSelected ? '2.8px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.35)',
                      boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.85)' : '0 1px 4px rgba(0,0,0,0.4)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      backgroundColor: '#0a1a35',
                      transition: 'transform 0.15s ease, border-color 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
                      }
                    }}
                  >
                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt={sceneName}
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          pointerEvents: 'none'
                        }}
                        onError={(e) => {
                          // Automatic fallback from thumbnail -> preview -> master image
                          if (sc.preview && e.currentTarget.src !== getImageUrl(sc.preview)) {
                            e.currentTarget.src = getImageUrl(sc.preview);
                          } else if (sc.image && e.currentTarget.src !== getImageUrl(sc.image)) {
                            e.currentTarget.src = getImageUrl(sc.image);
                          }
                        }}
                      />
                    )}

                    {/* Dark gradient for high-contrast white text */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.75) 100%)',
                      pointerEvents: 'none'
                    }} />

                    {/* Scene Name Overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '2px',
                      right: '2px',
                      textAlign: 'center',
                      color: '#ffffff',
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: isSmallScreen ? '8px' : effectiveIsMobile ? '8.5px' : '10px',
                      fontWeight: 'bold',
                      textShadow: '0 1px 2px #000, 0 1px 4px #000',
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none'
                    }}>
                      {sceneName}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Scroll Arrow Button */}
            <button
              onClick={() => scrollByAmount(220)}
              onMouseDown={() => startScrollHold(220)}
              onMouseUp={stopScrollHold}
              onMouseLeave={stopScrollHold}
              title="Scroll Right"
              style={{
                position: 'absolute',
                right: 2,
                zIndex: 10,
                width: isSmallScreen ? 18 : 20,
                height: effectiveIsMobile ? 46 : 56,
                background: theme.scrollBtnBg,
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 4,
                color: '#fff',
                cursor: canScrollRight ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                opacity: canScrollRight ? 1 : 0.35,
                pointerEvents: canScrollRight ? 'auto' : 'none',
                transition: 'opacity 0.2s ease, background 0.2s ease'
              }}
            >
              <Icon name="ChevronRight" size="xs" />
            </button>
          </div>
        )}

        {/* ── Compact Bottom Icon Control Bar ── */}
        <div style={{
          height: isSmallScreen ? '30px' : effectiveIsMobile ? '32px' : '36px',
          padding: isUltraSmall ? '0 2px' : effectiveIsMobile ? '0 6px' : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: thumbsOpen ? '1px solid rgba(255, 255, 255, 0.22)' : 'none',
          background: theme.barBg
        }}>
          {/* Left Group: [<<] [All Images / Gallery Search Modal Toggle] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isUltraSmall ? '2px' : effectiveIsMobile ? '5px' : '10px' }}>
            {/* Previous Scene Button [<<] */}
            <button
              onClick={goToPrevScene}
              title="Previous Scene"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "15" : "18"} height={isSmallScreen ? "15" : "18"} viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
              </svg>
            </button>

            {/* Overall Images Gallery & Search Bar Toggle Icon */}
            <button
              onClick={() => setShowGalleryModal(prev => !prev)}
              title="Show All Images & Search (Gallery)"
              style={{
                ...iconBtnStyle,
                color: showGalleryModal ? '#38bdf8' : '#ffffff'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = showGalleryModal ? '#38bdf8' : '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width={isSmallScreen ? "15" : "18"} height={isSmallScreen ? "15" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
          </div>

          {/* Center Group: [<] [>] [^] [v] [+] [-] [VR GOGGLES] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isUltraSmall ? '2px' : isSmallScreen ? '4px' : effectiveIsMobile ? '6px' : '11px' }}>
            {/* Pan Left [<] */}
            <button
              onMouseDown={() => startHoldAction(() => viewerRef?.current?.rotate(-0.045, 0))}
              onMouseUp={stopHoldAction}
              onMouseLeave={stopHoldAction}
              onTouchStart={() => startHoldAction(() => viewerRef?.current?.rotate(-0.045, 0))}
              onTouchEnd={stopHoldAction}
              title="Look Left"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "13" : "16"} height={isSmallScreen ? "13" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Pan Right [>] */}
            <button
              onMouseDown={() => startHoldAction(() => viewerRef?.current?.rotate(0.045, 0))}
              onMouseUp={stopHoldAction}
              onMouseLeave={stopHoldAction}
              onTouchStart={() => startHoldAction(() => viewerRef?.current?.rotate(0.045, 0))}
              onTouchEnd={stopHoldAction}
              title="Look Right"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "13" : "16"} height={isSmallScreen ? "13" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Tilt Up [^] */}
            <button
              onMouseDown={() => startHoldAction(() => viewerRef?.current?.rotate(0, -0.038))}
              onMouseUp={stopHoldAction}
              onMouseLeave={stopHoldAction}
              onTouchStart={() => startHoldAction(() => viewerRef?.current?.rotate(0, -0.038))}
              onTouchEnd={stopHoldAction}
              title="Look Up"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "13" : "16"} height={isSmallScreen ? "13" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>

            {/* Tilt Down [v] */}
            <button
              onMouseDown={() => startHoldAction(() => viewerRef?.current?.rotate(0, 0.038))}
              onMouseUp={stopHoldAction}
              onMouseLeave={stopHoldAction}
              onTouchStart={() => startHoldAction(() => viewerRef?.current?.rotate(0, 0.038))}
              onTouchEnd={stopHoldAction}
              title="Look Down"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "13" : "16"} height={isSmallScreen ? "13" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Zoom In [+] */}
            <button
              onClick={() => viewerRef?.current?.zoomIn()}
              title="Zoom In"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "14" : "18"} height={isSmallScreen ? "14" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Zoom Out [-] */}
            <button
              onClick={() => viewerRef?.current?.zoomOut()}
              title="Zoom Out"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "14" : "18"} height={isSmallScreen ? "14" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* ── MARKED VR ICON (WebXR / Virtual Reality Mode) ── */}
            <button
              onClick={handleTriggerVR}
              title="Enter VR Mode (Virtual Reality / Headset)"
              style={{
                ...iconBtnStyle,
                color: '#ffffff'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* VR Headset Goggles SVG Icon */}
              <svg width={isSmallScreen ? "17" : "22"} height={isSmallScreen ? "17" : "22"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-2-2-2 2H6a3 3 0 0 1-3-3V8z" />
                <circle cx="8" cy="11" r="2" />
                <circle cx="16" cy="11" r="2" />
              </svg>
            </button>
          </div>

          {/* Right Group: [Fullscreen] [Hide] [>>] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isUltraSmall ? '2px' : effectiveIsMobile ? '5px' : '10px' }}>
            {/* Fullscreen Toggle */}
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "14" : "16"} height={isSmallScreen ? "14" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>

            {/* Hide Full Dashboard Button */}
            <button
              onClick={() => setIsHidden(true)}
              title="Hide Full Dashboard"
              style={iconBtnStyle}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.color = '#38bdf8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.color = '#ffffff';
              }}
            >
              <svg width={isSmallScreen ? "16" : "20"} height={isSmallScreen ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="8 11 12 15 16 11"/>
                <line x1="12" y1="7" x2="12" y2="15"/>
              </svg>
            </button>

            {/* Next Scene Button [>>] */}
            <button
              onClick={goToNextScene}
              title="Next Scene"
              style={iconBtnStyle}
            >
              <svg width={isSmallScreen ? "15" : "18"} height={isSmallScreen ? "15" : "18"} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* ── Restore Full Dashboard Button (Appears when dashboard is hidden) ── */}
    {isHidden && (
      <button
        onClick={() => setIsHidden(false)}
        title="Show Full Dashboard"
        style={{
          position: 'fixed',
          bottom: effectiveIsMobile ? '8px' : '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          width: effectiveIsMobile ? '34px' : '38px',
          height: effectiveIsMobile ? '34px' : '38px',
          borderRadius: '50%',
          background: theme.restoreBtnBg,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1.4px solid rgba(255, 255, 255, 0.75)',
          boxShadow: `0 4px 18px rgba(0, 0, 0, 0.7), 0 0 16px ${theme.glowColor}, inset 0 1px 0 rgba(255,255,255,0.4)`,
          color: '#ffffff',
          cursor: 'pointer',
          display: showUI ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          padding: 0,
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateX(-50%) scale(1.15)';
          e.currentTarget.style.borderColor = '#ffffff';
          e.currentTarget.style.boxShadow = `0 0 18px ${theme.glowColor}, 0 6px 20px rgba(0,0,0,0.8)`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.75)';
          e.currentTarget.style.boxShadow = `0 4px 18px rgba(0, 0, 0, 0.7), 0 0 16px ${theme.glowColor}, inset 0 1px 0 rgba(255,255,255,0.4)`;
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="16 13 12 9 8 13" />
          <line x1="12" y1="9" x2="12" y2="17" />
        </svg>
      </button>
    )}

    {/* ── Overall Image Gallery Overlay with Search Bar (Opens on Image Icon Click) ── */}
    {showGalleryModal && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2500,
          background: 'rgba(5, 10, 22, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: effectiveIsMobile ? '10px' : '28px',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={() => {
          setShowGalleryModal(false);
          setSearchQuery('');
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '920px',
            maxHeight: effectiveIsMobile ? '92vh' : '86vh',
            background: 'linear-gradient(180deg, rgba(16, 28, 54, 0.98) 0%, rgba(9, 16, 32, 0.99) 100%)',
            border: '1.2px solid rgba(255, 255, 255, 0.25)',
            borderRadius: effectiveIsMobile ? '12px' : '16px',
            boxShadow: `0 24px 64px rgba(0, 0, 0, 0.85), 0 0 32px ${theme.glowColor}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#ffffff',
            userSelect: 'none'
          }}
        >
          {/* Header with Title, Search Bar & Close Button */}
          <div style={{
            padding: effectiveIsMobile ? '10px 12px' : '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            flexWrap: effectiveIsMobile ? 'wrap' : 'nowrap'
          }}>
            {/* Title & Scene Count Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
              <div style={{
                width: effectiveIsMobile ? 28 : 32,
                height: effectiveIsMobile ? 28 : 32,
                borderRadius: 8,
                background: theme.primaryHex,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
              }}>
                <svg width={effectiveIsMobile ? "15" : "18"} height={effectiveIsMobile ? "15" : "18"} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: effectiveIsMobile ? 13 : 16, letterSpacing: '0.01em' }}>
                  All Scenes & Panoramas
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.55)' }}>
                  {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} available
                </div>
              </div>
            </div>

            {/* Live Search Bar Input */}
            <div style={{
              position: 'relative',
              flex: effectiveIsMobile ? '1 1 100%' : '1 1 360px',
              maxWidth: effectiveIsMobile ? '100%' : '380px'
            }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search scene by title or number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus={!effectiveIsMobile}
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 36px',
                  borderRadius: '24px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1.2px solid rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s, background 0.2s',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#38bdf8';
                  e.target.style.background = 'rgba(255, 255, 255, 0.14)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.25)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Close Modal Button */}
            <button
              onClick={() => {
                setShowGalleryModal(false);
                setSearchQuery('');
              }}
              title="Close Gallery (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer',
                transition: 'background 0.2s, transform 0.2s',
                outline: 'none',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)';
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ✕
            </button>
          </div>

          {/* Grid of All Scenes */}
          <div style={{
            padding: effectiveIsMobile ? '10px' : '20px',
            overflowY: 'auto',
            maxHeight: effectiveIsMobile ? 'calc(92vh - 90px)' : 'calc(86vh - 84px)',
            display: 'grid',
            gridTemplateColumns: isSmallScreen ? 'repeat(2, 1fr)' : effectiveIsMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: isSmallScreen ? '8px' : effectiveIsMobile ? '10px' : '14px'
          }}>
            {scenes.filter(sc => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase().trim();
              const name = (sc.name || sc.title || '').toLowerCase();
              const id = String(sc.id || '').toLowerCase();
              return name.includes(q) || id.includes(q);
            }).length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px 10px',
                color: 'rgba(255, 255, 255, 0.5)'
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  No scenes found
                </div>
                <div style={{ fontSize: 12 }}>
                  No scenes match "{searchQuery}". Try a different keyword.
                </div>
              </div>
            ) : (
              scenes
                .filter(sc => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  const name = (sc.name || sc.title || '').toLowerCase();
                  const id = String(sc.id || '').toLowerCase();
                  return name.includes(q) || id.includes(q);
                })
                .map((sc, idx) => {
                  const isSelected = sc.id === currentSceneId;
                  const thumbUrl = getInitialThumbUrl(sc);
                  const sceneName = sc.name || sc.title || `Scene ${idx + 1}`;

                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        onSelectScene(sc.id);
                        setShowGalleryModal(false);
                        setSearchQuery('');
                      }}
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 10',
                        borderRadius: '8px',
                        border: isSelected ? '3px solid #ffffff' : '1.2px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: isSelected ? '0 0 16px rgba(255,255,255,0.85)' : '0 4px 12px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        backgroundColor: '#07152d',
                        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
                        e.currentTarget.style.borderColor = isSelected ? '#ffffff' : '#38bdf8';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.borderColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
                      }}
                    >
                      {thumbUrl && (
                        <img
                          src={thumbUrl}
                          alt={sceneName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => {
                            if (sc.preview && e.currentTarget.src !== getImageUrl(sc.preview)) {
                              e.currentTarget.src = getImageUrl(sc.preview);
                            } else if (sc.image && e.currentTarget.src !== getImageUrl(sc.image)) {
                              e.currentTarget.src = getImageUrl(sc.image);
                            }
                          }}
                        />
                      )}
                      {/* Gradient overlay */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)',
                        pointerEvents: 'none'
                      }} />

                      {/* Active tag */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          background: '#10b981',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                          textTransform: 'uppercase'
                        }}>
                          Active
                        </div>
                      )}

                      {/* Scene Title */}
                      <div style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 8,
                        right: 8,
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textShadow: '0 1px 3px #000, 0 1px 6px #000',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                      }}>
                        {sceneName}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}

const iconBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#ffffff',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  outline: 'none',
  transition: 'transform 0.15s ease, color 0.15s ease',
  opacity: 0.95,
  lineHeight: 1
};
