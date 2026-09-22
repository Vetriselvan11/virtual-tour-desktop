import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/common/Icon';

function SmoothVideoPlayer({ src, isYouTube }) {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Update buffer progress percentage
  const updateBufferProgress = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const buffered = video.buffered;
    if (buffered && buffered.length > 0) {
      // Find the buffered range covering current time or the furthest end
      const currentTime = video.currentTime;
      let loadedEnd = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
          loadedEnd = buffered.end(i);
          break;
        }
        if (buffered.end(i) > loadedEnd) {
          loadedEnd = buffered.end(i);
        }
      }
      const pct = Math.min(100, Math.round((loadedEnd / video.duration) * 100));
      setBufferPercent(pct);
      if (pct >= 95 || loadedEnd - currentTime > 3) {
        setIsBuffering(false);
      }
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setIsBuffering(false);
    setBufferPercent(0);
    setHasError(false);
  }, [src]);

  if (isYouTube) {
    return (
      <iframe
        title="viewer-video"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        src={src.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 1. Shimmer Loading Skeleton (Initial Load) */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'linear-gradient(90deg, #11111a 0%, #1a1a28 50%, #11111a 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s infinite linear',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 20
        }}>
          {/* Animated Spinner & Icon */}
          <div style={{ position: 'relative', width: 54, height: 54 }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(255, 77, 109, 0.2)',
              borderTopColor: '#ff4d6d',
              animation: 'spin 0.9s infinite linear'
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ff4d6d'
            }}>
              <Icon name="Video" size="sm" />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f0eeff', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 3 }}>
              Loading Video...
            </div>
            <div style={{ color: 'rgba(240,238,255,0.45)', fontSize: 11, fontFamily: 'monospace' }}>
              {bufferPercent > 0 ? `Buffered ${bufferPercent}%` : 'Preparing offline stream'}
            </div>
          </div>

          {/* Buffer Progress Bar */}
          <div style={{
            width: '60%', maxWidth: 200, height: 4,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 2, overflow: 'hidden', marginTop: 4
          }}>
            <div style={{
              width: `${Math.max(12, bufferPercent)}%`, height: '100%',
              background: 'linear-gradient(90deg, #ff4d6d, #a855f7)',
              borderRadius: 2, transition: 'width 0.25s ease'
            }} />
          </div>
        </div>
      )}

      {/* 2. In-Between Buffering HUD (When Video is Stalled / Waiting) */}
      {!isLoading && isBuffering && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          background: 'rgba(10, 10, 15, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, pointerEvents: 'none', animation: 'fadeIn 0.15s ease'
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid rgba(255, 77, 109, 0.25)',
            borderTopColor: '#ff4d6d',
            animation: 'spin 0.8s infinite linear'
          }} />
          <div style={{
            padding: '4px 12px', background: 'rgba(20, 20, 30, 0.85)',
            borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0eeff', fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}>
            <span>Buffering...</span>
            <span style={{ color: '#ff4d6d', fontFamily: 'monospace' }}>{bufferPercent}%</span>
          </div>
        </div>
      )}

      {/* 3. Error Fallback */}
      {hasError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 12,
          background: '#14141e', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 10
        }}>
          <div style={{ color: '#ff4d4f', fontSize: 28 }}>⚠️</div>
          <div style={{ color: '#f0eeff', fontSize: 13, fontWeight: 600 }}>Failed to Load Video</div>
          <div style={{ color: 'rgba(240,238,255,0.5)', fontSize: 11, maxWidth: 320 }}>
            {errorMessage || 'The video file could not be streamed. Ensure the format is supported (MP4 / WebM).'}
          </div>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            style={{
              marginTop: 6, padding: '6px 16px', background: '#ff4d6d',
              border: 'none', borderRadius: '6px', color: '#fff',
              fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Retry Playback
          </button>
        </div>
      )}

      {/* 4. Native HTML5 Video Element with Full Buffer Listeners */}
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        preload="auto"
        src={src}
        onLoadStart={() => {
          setIsLoading(true);
          setIsBuffering(false);
        }}
        onLoadedMetadata={() => {
          updateBufferProgress();
        }}
        onProgress={updateBufferProgress}
        onCanPlay={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onCanPlayThrough={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onWaiting={() => {
          setIsBuffering(true);
          updateBufferProgress();
        }}
        onStalled={() => {
          setIsBuffering(true);
          updateBufferProgress();
        }}
        onPlaying={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onError={(e) => {
          setIsLoading(false);
          setIsBuffering(false);
          setHasError(true);
          setErrorMessage(videoRef.current?.error?.message || 'Video playback failed');
        }}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'contain',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
      />
    </div>
  );
}

export function ViewerInfoModal({ activeInfoHotspot, setActiveInfoHotspot, getImageUrl }) {
  if (!activeInfoHotspot) return null;
  const isVideo = activeInfoHotspot.type === 'video' || activeInfoHotspot.icon === 'video';
  const isYouTube = activeInfoHotspot.linkUrl && (activeInfoHotspot.linkUrl.includes('youtube.com') || activeInfoHotspot.linkUrl.includes('youtu.be'));

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Embedded Video & Information Dialog Modal */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(5, 5, 8, 0.8)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={() => setActiveInfoHotspot(null)}
      >
        <div style={{
          background: '#14141e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          width: '92%', maxWidth: '560px',
          padding: '22px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 32px rgba(255, 77, 109, 0.08)',
          position: 'relative',
          animation: 'fadeIn 0.22s ease-out'
        }}
        onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 18,
                color: isVideo ? '#ff4d6d' : '#00d4ff',
                display: 'flex', alignItems: 'center'
              }}>
                <Icon name={isVideo ? 'Video' : 'Info'} size="sm" />
              </span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: '#f0eeff', letterSpacing: '0.02em' }}>
                {isVideo ? 'VIDEO PLAYER' : 'INFORMATION'}
              </span>
            </div>
            <button
              onClick={() => setActiveInfoHotspot(null)}
              style={{
                background: 'none', border: 'none', color: 'rgba(240,238,255,0.4)',
                cursor: 'pointer', outline: 'none', transition: 'color 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(240,238,255,0.4)'}
            >
              <Icon name="X" size="sm" />
            </button>
          </div>

          {/* Body */}
          <div style={{ color: '#f0eeff', fontSize: 13, lineHeight: '1.6' }}>
            {activeInfoHotspot.tooltip && (
              <p style={{ marginBottom: 14, fontSize: 14, fontWeight: 500, color: '#f0eeff' }}>
                {activeInfoHotspot.tooltip}
              </p>
            )}

            {/* Video Player Box with Shimmer Skeleton & Buffer Indicator */}
            {isVideo && activeInfoHotspot.linkUrl && (
              <div style={{
                position: 'relative', paddingBottom: '56.25%', height: 0,
                borderRadius: '12px', overflow: 'hidden',
                background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)'
              }}>
                <SmoothVideoPlayer
                  src={getImageUrl(activeInfoHotspot.linkUrl)}
                  isYouTube={isYouTube}
                />
              </div>
            )}

            {/* Audio Embeds */}
            {(activeInfoHotspot.type === 'audio' || activeInfoHotspot.icon === 'sound') && (activeInfoHotspot.audioUrl || activeInfoHotspot.linkUrl) && (
              <div style={{ marginTop: 10 }}>
                <audio
                  controls
                  autoPlay
                  preload="auto"
                  src={getImageUrl(activeInfoHotspot.audioUrl || activeInfoHotspot.linkUrl)}
                  style={{ width: '100%', height: '40px', borderRadius: '8px' }}
                />
              </div>
            )}

            {/* Text Description Box */}
            {(activeInfoHotspot.type === 'info' || activeInfoHotspot.icon === 'info') && (
              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.04)',
                color: 'rgba(240,238,255,0.65)'
              }}>
                This hotspot offers detailed insight about this particular perspective of the location. You can customize the tooltip, label, type, and icon configurations back in the editor mode panel.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

