import { useState, useEffect } from 'react';
import httpClient from '../services/http/httpClient';
import pkg from '../../package.json';

export const STATIC_VERSION = `v${pkg.version || '1.0.0'}`;

/**
 * Custom React Hook to fetch the dynamic application version from the backend API (/api/version).
 * If the server is updated with a new package.json version, ALL active clients and old EXEs
 * connecting to the server will automatically display the new version live!
 */
export function useAppVersion() {
  const [version, setVersion] = useState(STATIC_VERSION);

  useEffect(() => {
    let isMounted = true;
    httpClient.get('/api/version')
      .then(res => {
        if (isMounted && res.data && (res.data.formatted || res.data.version)) {
          setVersion(res.data.formatted || `v${res.data.version}`);
        }
      })
      .catch(err => {
        console.warn('Backend version fetch notice, using fallback:', err.message);
      });
    return () => { isMounted = false; };
  }, []);

  return version;
}
