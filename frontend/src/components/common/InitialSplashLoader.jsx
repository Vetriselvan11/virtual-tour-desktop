import React, { useState, useEffect } from 'react';
import ParticleText from './ParticleText';
import brandLogo from '../../assets/logo.png';

export default function InitialSplashLoader({ children }) {
  const [showSplash, setShowSplash] = useState(() => {
    // Check if splash has already been shown in this session
    try {
      const shown = sessionStorage.getItem('wox_builder_splash_shown');
      return !shown;
    } catch {
      return true;
    }
  });

  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!showSplash) return;

    // Timer to start fading out after particles gather and display
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, 3200);

    // Timer to completely remove splash from DOM
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
      try {
        sessionStorage.setItem('wox_builder_splash_shown', 'true');
      } catch {}
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [showSplash]);

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(() => {
      setShowSplash(false);
      try {
        sessionStorage.setItem('wox_builder_splash_shown', 'true');
      } catch {}
    }, 500);
  };

  return (
    <>
      {showSplash && (
        <div
          onClick={handleSkip}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#09090f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: fadingOut ? 0 : 1,
            transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: fadingOut ? 'none' : 'auto',
            cursor: 'pointer',
            overflow: 'hidden',
            userSelect: 'none'
          }}
        >
          {/* Ambient Glow Backdrop */}
          <div style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220, 23, 193, 0.15) 0%, rgba(250, 8, 11, 0.06) 50%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }} />

          {/* Top Logo Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            zIndex: 2,
            transform: 'translateY(10px)'
          }}>
            <img
              src={brandLogo}
              alt="WoX BUILDER Logo"
              style={{
                height: 52,
                width: 'auto',
                maxWidth: 240,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 16px rgba(207, 168, 67, 0.4))'
              }}
            />
          </div>

          {/* Particle Text Container */}
          <div style={{ width: '100%', height: 360, position: 'relative', zIndex: 2 }}>
            <ParticleText
              text="WoX BUILDER"
              particleSize={2.2}
              density={5}
              color="#dc17c1"
              highlightColor="#fa080b"
              scatter={190}
              gatherDuration={1600}
              stagger={420}
              pointerRepel={42}
              repelRadius={120}
              idleDrift={0.8}
              trigger="mount"
              fontSize="clamp(2.8rem, 7vw, 5.2rem)"
              fontWeight={800}
              fontFamily="inherit"
              glow
            />
          </div>

          {/* Bottom Hint */}
          <div style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.45)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 16,
            zIndex: 2
          }}>
            Click anywhere to enter studio • Starting 360 Engine...
          </div>
        </div>
      )}
      {children}
    </>
  );
}
