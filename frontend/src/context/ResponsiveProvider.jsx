import React, { createContext, useContext } from 'react';
import { useResponsive } from '../hooks/useResponsive';

const ResponsiveContext = createContext(null);

/**
 * Context Provider that exposes real-time responsiveness states to child trees.
 */
export function ResponsiveProvider({ children }) {
  const responsive = useResponsive();
  return (
    <ResponsiveContext.Provider value={responsive}>
      {children}
    </ResponsiveContext.Provider>
  );
}

/**
 * Convenience hook to access the current responsive context values.
 */
export function useResponsiveContext() {
  const context = useContext(ResponsiveContext);
  if (!context) {
    // Fallback if rendered outside the Provider
    const width = window.innerWidth;
    return {
      width,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
    };
  }
  return context;
}
