import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/common/Icon';

// Subcomponent: Navigation overlay buttons
export function ViewerBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'rgba(14, 10, 22, 0.72)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
        transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
        outline: 'none'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(30, 22, 45, 0.9)';
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(14, 10, 22, 0.72)';
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }}
    >
      {children}
    </button>
  );
}

// Console layout styled elements
export const dirBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f0eeff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  transition: 'all 0.15s ease',
  outline: 'none'
};

export const zoomBtnStyle = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f0eeff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 'bold',
  transition: 'all 0.15s ease',
  outline: 'none'
};

export const smallControlBtnStyle = {
  width: '26px',
  height: '22px',
  borderRadius: '6px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#f0eeff',
  fontSize: '10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  outline: 'none'
};

/**
 * Modernized Floating Control Console (D-Pad + Zoom)
 */
export function ViewerControlPanel({
  viewerRef,
  autoRotate,
  setAutoRotate,
  onReplayIntro,
  showUI,
  isMobile
}) {
  const [vrSupported, setVrSupported] = useState(false);
  const [isVREnabled, setIsVREnabled] = useState(false);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkCapabilities = async () => {
      // 1. WebXR Check
      if (viewerRef?.current?.checkVRSupported) {
        const supported = await viewerRef.current.checkVRSupported();
        if (isMounted) setVrSupported(Boolean(supported));
      } else if (typeof navigator !== 'undefined' && navigator.xr?.isSessionSupported) {
        try {
          const supported = await navigator.xr.isSessionSupported('immersive-vr');
          if (isMounted) setVrSupported(Boolean(supported));
        } catch (e) {
          if (isMounted) setVrSupported(false);
        }
      } else {
        if (isMounted) setVrSupported(false);
      }

      // 2. Gyroscope Check
      if (typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined') {
        if (isMounted) setGyroSupported(true);
      }

      // Sync gyro state if available
      if (viewerRef?.current?.isGyroEnabled) {
        if (isMounted) setGyroEnabled(Boolean(viewerRef.current.isGyroEnabled()));
      }
    };

    checkCapabilities();

    // Hook WebXRManager session state callback
    const xr = viewerRef?.current?.getWebXRManager?.();
    if (xr) {
      xr.onSessionStateChange = (active) => {
        if (isMounted) setIsVREnabled(Boolean(active));
      };
      if (isMounted) setIsVREnabled(Boolean(xr.enabled));
    }

    // Backup check after mount to catch async Three.js engine readiness
    const timer = setTimeout(() => {
      checkCapabilities();
      const lateXr = viewerRef?.current?.getWebXRManager?.();
      if (lateXr && isMounted) {
        lateXr.onSessionStateChange = (active) => {
          if (isMounted) setIsVREnabled(Boolean(active));
        };
        setIsVREnabled(Boolean(lateXr.enabled));
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const activeXr = viewerRef?.current?.getWebXRManager?.();
      if (activeXr && activeXr.onSessionStateChange) {
        activeXr.onSessionStateChange = null;
      }
    };
  }, [viewerRef?.current]);

  const handleToggleVR = useCallback(async () => {
    if (viewerRef?.current?.toggleVR) {
      await viewerRef.current.toggleVR();
    } else if (viewerRef?.current?.enterVR) {
      if (isVREnabled) {
        viewerRef.current?.exitVR?.();
      } else {
        await viewerRef.current.enterVR();
      }
    }
  }, [viewerRef, isVREnabled]);

  const handleToggleGyro = useCallback(async () => {
    if (!gyroEnabled) {
      const granted = await viewerRef?.current?.requestGyroPermission?.();
      if (granted !== false) {
        viewerRef?.current?.enableGyro?.();
        setGyroEnabled(true);
      }
    } else {
      viewerRef?.current?.disableGyro?.();
      setGyroEnabled(false);
    }
  }, [viewerRef, gyroEnabled]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isMobile ? 90 : 24,
        right: isMobile ? 10 : 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 15,
        opacity: showUI ? 1 : 0,
        transition: 'opacity 0.45s ease',
        pointerEvents: showUI ? 'auto' : 'none',
        transformOrigin: 'bottom right'
      }}
    >
      {/* Navigation Directional Pad — hidden on mobile (touch drag = rotate) */}
      {!isMobile && <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 30px)',
          gridTemplateRows: 'repeat(3, 30px)',
          gap: 4,
          background: 'linear-gradient(180deg, rgba(16, 12, 24, 0.82) 0%, rgba(8, 6, 14, 0.9) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          padding: 8,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div />
        <button
          onClick={() => viewerRef.current?.rotate(0, -0.15)}
          style={dirBtnStyle}
          title="Tilt Up"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Icon name="ArrowUp" size="xs" />
        </button>
        <div />

        <button
          onClick={() => viewerRef.current?.rotate(-0.2, 0)}
          style={dirBtnStyle}
          title="Pan Left"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateX(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Icon name="ArrowLeft" size="xs" />
        </button>

        {/* Center Auto-Rotate Button */}
        <button
          onClick={() => setAutoRotate(a => !a)}
          title={autoRotate ? 'Pause Auto-Rotate' : 'Start Auto-Rotate'}
          style={{
            ...dirBtnStyle,
            background: autoRotate ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.08)',
            border: autoRotate ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
            color: autoRotate ? '#10b981' : '#f0eeff',
            boxShadow: autoRotate ? '0 0 12px rgba(16, 185, 129, 0.45)' : 'none'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Icon name={autoRotate ? "Pause" : "Play"} size="xs" />
        </button>

        <button
          onClick={() => viewerRef.current?.rotate(0.2, 0)}
          style={dirBtnStyle}
          title="Pan Right"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateX(1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Icon name="ArrowRight" size="xs" />
        </button>

        <div />
        <button
          onClick={() => viewerRef.current?.rotate(0, 0.15)}
          style={dirBtnStyle}
          title="Tilt Down"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Icon name="ArrowDown" size="xs" />
        </button>
        <div />
      </div>}

      {/* Action Row: Zoom Pill + VR Button — D-Pad hidden on mobile (touch swipe = rotate) */}
      {!isMobile && (
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center'
        }}
      >
        {/* Zoom Controller Toggle Pill */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: 'linear-gradient(180deg, rgba(16, 12, 24, 0.82) 0%, rgba(8, 6, 14, 0.9) 100%)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            padding: '4px 8px',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            height: 34,
            boxSizing: 'border-box'
          }}
        >
          <button
            onClick={() => viewerRef.current?.zoomOut()}
            style={zoomBtnStyle}
            title="Zoom Out"
            aria-label="Zoom Out"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <Icon name="Minus" size="xs" />
          </button>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(240,238,255,0.6)',
              padding: '0 3px',
              letterSpacing: '0.08em',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            ZOOM
          </span>
          <button
            onClick={() => viewerRef.current?.zoomIn()}
            style={zoomBtnStyle}
            title="Zoom In"
            aria-label="Zoom In"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <Icon name="Plus" size="xs" />
          </button>
        </div>

        {/* VR Action Pill */}
        {vrSupported && (
          <button
            onClick={handleToggleVR}
            aria-label={isVREnabled ? "Exit VR" : "Enter VR"}
            title={isVREnabled ? "Exit Virtual Reality (VR)" : "Enter Virtual Reality (VR)"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isVREnabled
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.45) 100%)'
                : 'linear-gradient(180deg, rgba(16, 12, 24, 0.82) 0%, rgba(8, 6, 14, 0.9) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              padding: '4px 12px',
              borderRadius: 24,
              border: isVREnabled
                ? '1.5px solid #10b981'
                : '1px solid rgba(255,255,255,0.12)',
              boxShadow: isVREnabled
                ? '0 0 16px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              color: isVREnabled ? '#10b981' : '#f0eeff',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
              outline: 'none',
              height: 34,
              boxSizing: 'border-box'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.borderColor = isVREnabled ? '#10b981' : 'rgba(167, 139, 250, 0.4)';
              if (!isVREnabled) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = isVREnabled ? '#10b981' : 'rgba(255,255,255,0.12)';
              if (!isVREnabled) e.currentTarget.style.background = 'linear-gradient(180deg, rgba(16, 12, 24, 0.82) 0%, rgba(8, 6, 14, 0.9) 100%)';
            }}
          >
            <Icon name="FaVrCardboard" size="xs" style={{ color: isVREnabled ? '#10b981' : '#a78bfa' }} />
            <span>{isVREnabled ? "EXIT VR" : "VR"}</span>
          </button>
        )}
      </div>
      )}

      {isMobile && (
        /* Mobile: compact vertical control pill */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: 'linear-gradient(180deg, rgba(16, 12, 24, 0.82) 0%, rgba(8, 6, 14, 0.9) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          padding: '6px',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          alignItems: 'center',
        }}>
          {/* Zoom Out */}
          <button
            onClick={() => viewerRef.current?.zoomOut()}
            style={{ ...zoomBtnStyle, width: 32, height: 32 }}
            title="Zoom Out"
            aria-label="Zoom Out"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <Icon name="Minus" size="xs" />
          </button>

          {/* Auto-Rotate */}
          <button
            onClick={() => setAutoRotate(a => !a)}
            title={autoRotate ? 'Pause Auto-Rotate' : 'Start Auto-Rotate'}
            aria-label={autoRotate ? 'Pause Auto-Rotate' : 'Start Auto-Rotate'}
            style={{
              ...zoomBtnStyle,
              width: 32, height: 32,
              background: autoRotate ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.08)',
              border: autoRotate ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
              color: autoRotate ? '#10b981' : '#f0eeff',
              boxShadow: autoRotate ? '0 0 12px rgba(16, 185, 129, 0.45)' : 'none'
            }}
          >
            <Icon name={autoRotate ? "Pause" : "Play"} size="xs" />
          </button>

          {/* Zoom In */}
          <button
            onClick={() => viewerRef.current?.zoomIn()}
            style={{ ...zoomBtnStyle, width: 32, height: 32 }}
            title="Zoom In"
            aria-label="Zoom In"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <Icon name="Plus" size="xs" />
          </button>

          {/* Gyroscope Button (Mobile only if gyro supported) */}
          {gyroSupported && (
            <button
              onClick={handleToggleGyro}
              title={gyroEnabled ? 'Disable Gyroscope' : 'Enable Gyroscope'}
              aria-label={gyroEnabled ? 'Disable Gyroscope' : 'Enable Gyroscope'}
              style={{
                ...zoomBtnStyle,
                width: 32,
                height: 32,
                background: gyroEnabled ? 'rgba(108, 99, 255, 0.35)' : 'rgba(255,255,255,0.08)',
                border: gyroEnabled ? '1.5px solid #6c63ff' : '1px solid rgba(255,255,255,0.1)',
                color: gyroEnabled ? '#a78bfa' : '#f0eeff',
                boxShadow: gyroEnabled ? '0 0 12px rgba(108, 99, 255, 0.45)' : 'none'
              }}
            >
              <Icon name="Compass" size="xs" />
            </button>
          )}

          {/* VR Button (Mobile only if WebXR supported) */}
          {vrSupported && (
            <button
              onClick={handleToggleVR}
              title={isVREnabled ? 'Exit VR' : 'Enter VR'}
              aria-label={isVREnabled ? 'Exit VR' : 'Enter VR'}
              style={{
                ...zoomBtnStyle,
                width: 32,
                height: 32,
                background: isVREnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.08)',
                border: isVREnabled ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                color: isVREnabled ? '#10b981' : '#f0eeff',
                boxShadow: isVREnabled ? '0 0 12px rgba(16, 185, 129, 0.45)' : 'none'
              }}
            >
              <Icon name="FaVrCardboard" size="xs" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

