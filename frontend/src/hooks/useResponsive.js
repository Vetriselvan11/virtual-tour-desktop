import { useState, useEffect } from 'react';

/**
 * Custom hook to track viewport responsiveness state based on standard design breakpoints.
 * Mobile: < 768px
 * Tablet: >= 768px and < 1024px
 * Desktop: >= 1024px
 */
export function useResponsive() {
  const [responsiveState, setResponsiveState] = useState({
    width: window.innerWidth,
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setResponsiveState({
        width: w,
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        isDesktop: w >= 1024,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return responsiveState;
}
