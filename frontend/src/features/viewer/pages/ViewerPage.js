import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Spin, message } from 'antd';
import { getImageUrl } from '../../../services/http/httpClient';
import { getTour } from '../../../features/dashboard/services/tour.service';
import { getPublicTourManifest } from '../../../features/publish/services/publish.service';
import { useParams, useLocation } from 'react-router-dom';
import { ViewerInfoModal } from '../components/ViewerInfoModal';
import { ViewerBtn, ViewerControlPanel, dirBtnStyle, zoomBtnStyle, smallControlBtnStyle } from '../components/ViewerControls';
import SceneGalleryDock from '../components/SceneGalleryDock';
import PanoramaViewer from '../../../components/viewer/PanoramaViewer';
import MiniMap from '../../../components/minimap/MiniMap';
import { useGuidedTour } from '../../../core/editor/guided-tour/guidedTour';
import { scenePreloader } from '../../../core/editor/preloader/scenePreloader';
import { useResponsiveContext } from '../../../context/ResponsiveProvider';
import { audioEngine } from '../../../core/editor/audio/AudioEngine';
import { narrationEngine } from '../../../core/editor/audio/NarrationEngine';
import Icon from '../../../components/common/Icon';
import { CinematicTimelineEngine } from '../../../core/viewer/CinematicTimelineEngine';
import HotspotActionEngine from '../../../core/hotspots/HotspotActionEngine';
import HotspotStateManager from '../../../core/hotspots/HotspotStateManager';
import { sharedAnalyticsManager } from '../../../core/analytics/AnalyticsManager';
import GazeSampler from '../../../core/analytics/GazeSampler';
import { resolvePublicAsset } from '../../../core/viewer/StandalonePathResolver';

export default function ViewerPage() {
  const { tourId, slug, versionId } = useParams();
  const location = useLocation();
  const viewerRef = useRef(null);
  const { isMobile } = useResponsiveContext();

  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTinyPlanetIntroPlaying, setIsTinyPlanetIntroPlaying] = useState(false);

  // Direct imperative ref for floorplan minimap radar (zero React re-renders during rotation)
  const miniMapRef = useRef(null);

  // Selected hotspot modal states for information & video hotspots
  const [activeInfoHotspot, setActiveInfoHotspot] = useState(null);
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Cinematic Timeline Playback State
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelineDuration, setTimelineDuration] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelinePaused, setTimelinePaused] = useState(false);
  const timelineEngineRef = useRef(null);

  // Hotspot Action & State Engines
  const hotspotStateManagerRef = useRef(new HotspotStateManager());
  const hotspotActionEngineRef = useRef(null);
  const gazeSamplerRef = useRef(null);

  const uiTimerRef = useRef(null);

  const currentScene = tour?.scenes?.find(s => s.id === currentSceneId);
  const hasCinematicContent = Boolean(
    (tour?.cinematicTour?.keyframes && tour.cinematicTour.keyframes.length > 0) ||
    (tour?.keyframes && tour.keyframes.length > 0) ||
    (tour?.guidedTour?.keyframes && tour.guidedTour.keyframes.length > 0) ||
    timelineDuration > 0
  );

  useEffect(() => {
    loadTour();
  }, [tourId, slug, versionId, location.pathname]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.setAutoRotate(autoRotate);
    }
  }, [autoRotate]);

  // Connect and initialize CinematicTimelineEngine
  useEffect(() => {
    const engine = new CinematicTimelineEngine({
      viewerCore: viewerRef.current,
      onSceneChange: (sceneId) => {
        if (sceneId) {
          setCurrentSceneId(sceneId);
          if (viewerRef.current?.sceneManager) {
            viewerRef.current.sceneManager.switchScene(sceneId);
          }
        }
      },
      onTimeUpdate: (time, duration) => {
        const now = Date.now();
        if (!timelineEngineRef.current?._lastUiUpdate || now - timelineEngineRef.current._lastUiUpdate > 250) {
          if (timelineEngineRef.current) timelineEngineRef.current._lastUiUpdate = now;
          setTimelineTime(time);
          setTimelineDuration(duration);
        }
      },
      onStateChange: (playing, paused) => {
        setTimelinePlaying(playing);
        setTimelinePaused(paused);
      },
      onEventTrigger: (event) => {
        if (event.type === 'subtitle' && event.text) {
          setActiveSubtitle({ text: event.text });
          setTimeout(() => {
            setActiveSubtitle(null);
          }, (event.duration || 3.5) * 1000);
        }
      }
    });

    timelineEngineRef.current = engine;

    if (tour) {
      const keyframeData = tour.cinematicTour?.keyframes || tour.keyframes || tour.guidedTour?.keyframes;
      if (keyframeData && keyframeData.length > 0) {
        engine.load(tour);
      } else if (tour.scenes && tour.scenes.length > 0) {
        const autoKfs = tour.scenes.map((sc, i) => ({
          id: `auto_kf_${sc.id}_${i}`,
          sceneId: sc.id,
          label: sc.name || `Scene ${i + 1}`,
          yaw: sc.initialYaw !== undefined ? parseFloat(sc.initialYaw) : 0,
          pitch: sc.initialPitch !== undefined ? parseFloat(sc.initialPitch) : 0,
          fov: sc.fov !== undefined ? parseFloat(sc.fov) : 80,
          duration: sc.duration !== undefined ? parseFloat(sc.duration) : 6.0,
          hold: 1.0,
          easing: 'power2.inOut'
        }));
        engine.load(autoKfs);
      }
    }

    return () => {
      engine.destroy();
    };
  }, [tour]);

  // Keep engine viewer reference synchronized
  useEffect(() => {
    if (timelineEngineRef.current && viewerRef.current) {
      timelineEngineRef.current.viewer = viewerRef.current;
    }
  });

  const handleToggleCinematicTour = () => {
    if (!timelineEngineRef.current) return;
    const engine = timelineEngineRef.current;

    if (timelinePlaying) {
      if (timelinePaused) {
        engine.resume();
      } else {
        engine.pause();
      }
    } else {
      engine.play({ loop: true, startTime: timelineTime >= timelineDuration ? 0 : timelineTime });
    }
  };

  const handleSkipNext = () => {
    if (!timelineEngineRef.current) return;
    const engine = timelineEngineRef.current;
    const nextIdx = (engine.currentKeyframeIndex + 1) % Math.max(1, engine.keyframes.length);
    const seg = engine._timeSegments?.[nextIdx];
    if (seg) engine.seek(seg.startTime);
  };

  const handleSkipPrev = () => {
    if (!timelineEngineRef.current) return;
    const engine = timelineEngineRef.current;
    const prevIdx = (engine.currentKeyframeIndex - 1 + engine.keyframes.length) % Math.max(1, engine.keyframes.length);
    const seg = engine._timeSegments?.[prevIdx];
    if (seg) engine.seek(seg.startTime);
  };

  // Preload adjacent panoramas in the background
  useEffect(() => {
    if (tour && currentSceneId) {
      const curScene = tour.scenes?.find(s => s.id === currentSceneId);
      if (curScene) {
        scenePreloader.preloadAdjacent(curScene, tour.scenes, getImageUrl);
      }
    }
  }, [currentSceneId, tour]);

  // Analytics Scene Enter & Gaze Sampler Scene Sync
  useEffect(() => {
    if (currentSceneId) {
      sharedAnalyticsManager.trackSceneEnter(currentSceneId);
      if (gazeSamplerRef.current) {
        gazeSamplerRef.current.setScene(currentSceneId);
      }
    }
  }, [currentSceneId]);

  // Initialize Gaze Sampler on viewer mount
  useEffect(() => {
    if (viewerRef.current && !gazeSamplerRef.current) {
      const sampler = new GazeSampler({
        viewerCore: viewerRef.current,
        analyticsManager: sharedAnalyticsManager,
        sampleIntervalMs: 500
      });
      if (currentSceneId) sampler.setScene(currentSceneId);
      sampler.start();
      gazeSamplerRef.current = sampler;
    }

    return () => {
      if (gazeSamplerRef.current) {
        gazeSamplerRef.current.destroy();
        gazeSamplerRef.current = null;
      }
    };
  }, [viewerRef.current]);

  // Audio and Narration Sync
  useEffect(() => {
    narrationEngine.onSubtitleChange = (cue) => {
      setActiveSubtitle(cue);
    };

    if (currentScene) {
      if (currentScene.ambientAudio) {
        audioEngine.playAmbient(getImageUrl(currentScene.ambientAudio), { volume: currentScene.ambientVolume || 0.5 });
      } else {
        audioEngine.stopAmbient();
      }

      if (currentScene.narrationAudio) {
        narrationEngine.startForScene({
          ...currentScene,
          narrationAudio: getImageUrl(currentScene.narrationAudio)
        });
      } else {
        narrationEngine.stop();
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [currentScene]);

  // Guided Walk Cinematic Auto Playback Hook
  const {
    isPlaying: tourWalking,
    playTour: startWalk,
    pauseTour: stopWalk,
    skipNext,
    skipPrev
  } = useGuidedTour({
    scenes: tour?.scenes || [],
    currentSceneId,
    onSceneChange: (id) => {
      goToScene(id);
    },
    onCameraRotate: (yawOffset) => {
      if (viewerRef.current) viewerRef.current.rotate(yawOffset, 0);
    }
  });

  const resetUITimer = () => {
    setShowUI(true);
    clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current) {
        setShowUI(false);
      }
    }, 4500);
  };

  const isPlayingRef = useRef(tourWalking);
  useEffect(() => {
    isPlayingRef.current = tourWalking;
  }, [tourWalking]);

  const handleReplayIntro = () => {
    if (viewerRef.current) {
      setIsTinyPlanetIntroPlaying(true);
      viewerRef.current.playTinyPlanetIntro({
        targetYaw: currentScene?.initialYaw !== undefined ? parseFloat(currentScene.initialYaw) : undefined,
        targetPitch: currentScene?.initialPitch !== undefined ? parseFloat(currentScene.initialPitch) : undefined,
        targetFov: currentScene?.fov !== undefined ? parseFloat(currentScene.fov) : undefined,
        onComplete: () => {
          setIsTinyPlanetIntroPlaying(false);
          resetUITimer();
        }
      });
    }
  };

  const loadTour = async () => {
    try {
      setLoading(true);

      if (window.__TOUR_CONFIG__) {
        setTour(window.__TOUR_CONFIG__);
        const scenes = window.__TOUR_CONFIG__.scenes || [];
        const start = window.__TOUR_CONFIG__.startScene || scenes[0]?.id || null;
        setCurrentSceneId(start);
        setLoading(false);
        return;
      }

      const isPublicRoute = slug || location.pathname.startsWith('/tour/') || location.pathname.startsWith('/view/');
      
      let data = null;
      let effectiveVersionId = versionId || null;

      if (isPublicRoute) {
        const targetSlugOrId = slug || tourId;
        const manifest = await getPublicTourManifest(targetSlugOrId, versionId);
        if (manifest && manifest.tour) {
          data = {
            ...manifest.tour,
            scenes: manifest.scenes || [],
            cinematicTour: manifest.cinematicTour || {},
            keyframes: manifest.cinematicTour?.keyframes || manifest.tour?.keyframes || [],
            analytics: manifest.analytics || {},
            publishing: manifest.publishing || {}
          };
          effectiveVersionId = manifest.publishing?.versionId || versionId;
        }
      } else {
        data = await getTour(tourId);
      }

      if (data) {
        setTour(data);
        const scenes = data.scenes || [];
        const start = data.startScene || scenes[0]?.id || null;
        setCurrentSceneId(start);
        
        const effectiveTourId = data.id || tourId || slug;
        sharedAnalyticsManager.trackSessionStart(effectiveTourId, {
          title: data.title,
          versionId: effectiveVersionId
        });
        sharedAnalyticsManager.trackTourStart(effectiveTourId);
      } else {
        setTour(null);
      }
    } catch (err) {
      console.error('Failed to load tour:', err);
      message.error(err.response?.data?.error || err.message || 'Failed to load tour');
    } finally {
      setLoading(false);
    }
  };

  const goToScene = (sceneId) => {
    if (sceneId === currentSceneId) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentSceneId(sceneId);
      setTimeout(() => setTransitioning(false), 350);
    }, 350);
  };

  // Initialize and synchronize HotspotActionEngine
  useEffect(() => {
    const actionEngine = new HotspotActionEngine({
      viewerCore: viewerRef.current,
      onSceneChange: (sceneId) => {
        goToScene(sceneId);
      },
      audioEngine: audioEngine,
      timelineEngine: timelineEngineRef.current,
      stateManager: hotspotStateManagerRef.current,
      onOpenInfo: (info) => {
        setActiveInfoHotspot(info.hotspot || info);
      },
      onOpenMedia: (media) => {
        setActiveInfoHotspot(media.hotspot || media);
      },
      onCustomEvent: (eventName) => {
        if (eventName === 'open-floorplan') {
          // Custom interactive event
        }
      }
    });

    hotspotActionEngineRef.current = actionEngine;

    return () => {
      actionEngine.destroy();
    };
  }, []);

  // Update action engine context when dependencies shift
  useEffect(() => {
    if (hotspotActionEngineRef.current) {
      hotspotActionEngineRef.current.setContext({
        viewerCore: viewerRef.current,
        timelineEngine: timelineEngineRef.current,
        onSceneChange: (sceneId) => goToScene(sceneId)
      });
    }
  });

  const handleHotspotClick = useCallback((hotspot) => {
    if (hotspotActionEngineRef.current) {
      hotspotActionEngineRef.current.triggerHotspot(hotspot, 'click');
    }
  }, []);

  const handleObjectClick = useCallback((object3d) => {
    if (hotspotActionEngineRef.current) {
      hotspotActionEngineRef.current.triggerObject(object3d, 'click');
    }
  }, []);

  const handleHotspotEnterView = useCallback((hotspot) => {
    if (hotspotActionEngineRef.current) {
      hotspotActionEngineRef.current.triggerHotspot(hotspot, 'enterView');
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (tour?.scenes?.length > 1) {
          const idx = tour.scenes.findIndex(s => s.id === currentSceneId);
          const nextIdx = (idx + 1) % tour.scenes.length;
          goToScene(tour.scenes[nextIdx].id);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (tour?.scenes?.length > 1) {
          const idx = tour.scenes.findIndex(s => s.id === currentSceneId);
          const prevIdx = (idx - 1 + tour.scenes.length) % tour.scenes.length;
          goToScene(tour.scenes[prevIdx].id);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tour, currentSceneId]);

  const handleUserInteraction = () => {
    if (isTinyPlanetIntroPlaying) return;
    audioEngine.init();
    if (!hasInteracted) setHasInteracted(true);
    resetUITimer();
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f',
        flexDirection: 'column', gap: 20,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          border: '3px solid rgba(108,99,255,0.2)',
          borderTopColor: '#6c63ff',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ color: 'rgba(240,238,255,0.5)', fontFamily: "'Syne', sans-serif", letterSpacing: '0.12em', fontSize: 13, fontWeight: 700 }}>
          LOADING TOUR ENGINE...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!tour) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
        Tour not found
      </div>
    );
  }

  const effectiveShowUI = showUI && !isTinyPlanetIntroPlaying;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#050508',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        fontFamily: "'DM Sans', sans-serif",
        touchAction: 'none',
      }}
      onMouseMove={handleUserInteraction}
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
      onTouchMove={handleUserInteraction}
    >
      {/* 3D Panorama Layer */}
      <div style={{
        width: '100%', height: '100%',
        transition: 'opacity 0.35s ease',
      }}>
        {currentScene && (
          <PanoramaViewer
            ref={viewerRef}
            sceneId={currentScene.id}
            imageUrl={currentScene.image ? getImageUrl(currentScene.image) : null}
            scene={currentScene}
            hotspots={currentScene.hotspots || []}
            objects3d={currentScene.objects3d || currentScene.objects || []}
            onHotspotClick={handleHotspotClick}
            onHotspotEnterView={handleHotspotEnterView}
            onObjectClick={handleObjectClick}
            onCameraYawChange={(yaw) => {
              miniMapRef.current?.setYaw(yaw);
            }}
            onAutoRotateChange={setAutoRotate}
            autoRotate={autoRotate}
            enableTinyPlanetIntro={true}
            onTinyPlanetStart={() => setIsTinyPlanetIntroPlaying(true)}
            onTinyPlanetEnd={() => {
              setIsTinyPlanetIntroPlaying(false);
              resetUITimer();
            }}
            editMode={false}
          />
        )}
      </div>

      {/* Top Header UI */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: isMobile ? '12px 14px' : '24px 32px',
        background: 'linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, rgba(10,10,15,0.5) 60%, transparent 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: effectiveShowUI ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: effectiveShowUI ? 'auto' : 'none',
        zIndex: 10,
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {tour.clientLogo ? (
            <div
              onClick={() => tour.clientUrl && window.open(tour.clientUrl, '_blank')}
              style={{
                cursor: tour.clientUrl ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center'
              }}
              title={tour.clientUrl ? `Visit ${tour.clientUrl}` : undefined}
            >
              <img 
                src={getImageUrl(tour.clientLogo)} 
                alt="Client Logo" 
                style={{
                  height: isMobile ? 28 : 38,
                  width: 'auto',
                  maxWidth: isMobile ? 90 : 160,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
                  borderRadius: '4px'
                }}
              />
            </div>
          ) : (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}>
              <Icon name="Building" size="sm" style={{ color: 'rgba(240, 238, 255, 0.75)' }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: isMobile ? '1 1 auto' : 'none', overflow: 'hidden' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: isMobile ? 13 : 20, color: '#f0eeff', letterSpacing: '0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tour.title}
            </div>
            {currentScene && !isMobile && (
              <div style={{ fontSize: 12, color: 'rgba(240,238,255,0.55)', marginTop: 4, fontFamily: "'DM Sans', sans-serif", textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                {currentScene.name || currentScene.id}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexShrink: 0 }}>
          <a
            href="https://woxbuilder.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
              opacity: 0.8,
              transition: 'opacity 0.2s ease',
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))'
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
          >
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.7)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)'
            }}>
              Powered by
            </span>
            <img
              src={resolvePublicAsset('logo.png')}
              alt="WoX BUILDER"
              style={{ height: isMobile ? '14px' : '20px', width: 'auto', display: 'block', objectFit: 'contain' }}
            />
          </a>

          <ViewerBtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Icon name={isFullscreen ? "FaCompress" : "FaExpand"} size="sm" />
          </ViewerBtn>
        </div>
      </div>

      {/* Cinematic Walk Controls (Top Center Overlay) */}
      {hasCinematicContent && (
        <div style={{
          position: 'absolute', top: isMobile ? 56 : 24, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 'calc(100vw - 28px)',
          background: 'rgba(10, 10, 15, 0.82)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '6px 14px', borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '10px',
          opacity: effectiveShowUI ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: effectiveShowUI ? 'auto' : 'none',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: timelinePlaying && !timelinePaused ? '#10b981' : '#be123c',
              boxShadow: timelinePlaying && !timelinePaused ? '0 0 8px #10b981' : 'none',
              animation: timelinePlaying && !timelinePaused ? 'livePulse 1.5s infinite ease-in-out' : 'none'
            }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(240, 238, 255, 0.75)', letterSpacing: '0.06em' }}>
              CINEMATIC WALK
            </span>
          </div>

          {timelineDuration > 0 && (
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                if (timelineEngineRef.current) timelineEngineRef.current.seek(pct * timelineDuration);
              }}
              style={{
                width: 80, height: 6, background: 'rgba(255,255,255,0.12)',
                borderRadius: 3, cursor: 'pointer', position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${(timelineTime / timelineDuration) * 100}%`,
                background: 'linear-gradient(90deg, #be123c, #f43f5e)',
                borderRadius: 3
              }} />
            </div>
          )}

          {timelineDuration > 0 && (
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(240, 238, 255, 0.6)' }}>
              {Math.floor(timelineTime / 60)}:{String(Math.floor(timelineTime % 60)).padStart(2, '0')} / {Math.floor(timelineDuration / 60)}:{String(Math.floor(timelineDuration % 60)).padStart(2, '0')}
            </span>
          )}

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={handleSkipPrev} style={smallControlBtnStyle} title="Previous shot">
              <Icon name="SkipBack" size="xs" />
            </button>
            <button
              onClick={handleToggleCinematicTour}
              style={{
                ...smallControlBtnStyle,
                background: timelinePlaying && !timelinePaused ? '#fbbf24' : 'linear-gradient(135deg, #9f1239, #f43f5e)',
                color: '#fff',
                border: 'none',
                width: '24px',
                height: '24px',
                boxShadow: '0 0 10px rgba(244,63,94,0.4)'
              }}
              title={timelinePlaying ? (timelinePaused ? 'Resume sequence' : 'Pause sequence') : 'Play cinematic sequence'}
            >
              <Icon name={timelinePlaying && !timelinePaused ? "Pause" : "Play"} size="xs" />
            </button>
            <button onClick={handleSkipNext} style={smallControlBtnStyle} title="Next shot">
              <Icon name="SkipForward" size="xs" />
            </button>
          </div>
        </div>
      )}

      {/* Redesigned Luxury Scene Gallery Dock */}
      <SceneGalleryDock
        tour={tour}
        scenes={tour.scenes || []}
        currentSceneId={currentSceneId}
        onSelectScene={goToScene}
        getImageUrl={getImageUrl}
        isMobile={isMobile}
        showUI={effectiveShowUI}
      />

      {/* Floorplan Minimap Overlay */}
      {(tour?.floorplan || tour?.floor2Plan) && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? '80px' : '24px',
          left: isMobile ? '12px' : '24px',
          opacity: effectiveShowUI ? 1 : 0,
          transition: 'opacity 0.5s ease',
          pointerEvents: effectiveShowUI ? 'auto' : 'none',
          zIndex: 15
        }}>
          <MiniMap
            ref={miniMapRef}
            tour={tour}
            currentSceneId={currentSceneId}
            onSelectScene={goToScene}
            editMode={false}
          />
        </div>
      )}

      {/* Modernized Floating Control Console (Bottom Right Overlay) */}
      <ViewerControlPanel
        viewerRef={viewerRef}
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        onReplayIntro={handleReplayIntro}
        showUI={effectiveShowUI}
        isMobile={isMobile}
      />

      {/* Subtle Guide Hints (Bottom Left Overlay - Auto-fades after user interaction) */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? 14 : 24,
        left: (tour?.floorplan || tour?.floor2Plan) ? (isMobile ? 12 : 240) : (isMobile ? 12 : 24),
        display: isMobile ? 'none' : 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(10, 8, 16, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '6px 14px',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        fontSize: 11,
        fontWeight: 500,
        color: 'rgba(240, 238, 255, 0.65)',
        opacity: (effectiveShowUI && !hasInteracted) ? 1 : 0,
        transition: 'opacity 0.5s ease',
        zIndex: 1001,
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}>
        <Icon name="MousePointer" size="xs" style={{ color: '#a78bfa' }} />
        <span>Drag to rotate</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
        <span>Scroll to zoom</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
        <span>Arrow keys to switch scenes</span>
      </div>

      <ViewerInfoModal activeInfoHotspot={activeInfoHotspot} setActiveInfoHotspot={setActiveInfoHotspot} getImageUrl={getImageUrl} />

      {/* Subtitles Overlay */}
      {activeSubtitle && (
        <div style={{
          position: 'absolute', bottom: isMobile ? 110 : 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10, 10, 15, 0.75)', backdropFilter: 'blur(8px)',
          padding: isMobile ? '8px 16px' : '10px 24px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
          color: '#f0eeff', fontSize: isMobile ? 13 : 16, fontWeight: 500, textAlign: 'center', zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'none',
          maxWidth: 'calc(100vw - 40px)', whiteSpace: 'pre-wrap'
        }}>
          {activeSubtitle.text}
        </div>
      )}

      {/* Transition Overlay */}
      {transitioning && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(5,5,8,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '2px solid rgba(108,99,255,0.25)',
            borderTopColor: '#6c63ff',
            animation: 'spin 0.65s linear infinite',
            margin: 'auto'
          }} />
        </div>
      )}
    </div>
  );
}
