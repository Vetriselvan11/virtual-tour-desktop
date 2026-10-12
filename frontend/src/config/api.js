/**
 * Dynamic API base URL resolution — environment-aware, never hardcoded.
 *
 * API_BASE resolves to the backend server root (without /api suffix).
 * Priority order:
 *  1. REACT_APP_API_URL env var (set in .env / .env.production at build time)
 *  2. window.location.origin — automatic for cPanel, VPS, Apache, XAMPP, Electron
 *     (assumes the backend is co-hosted on the same origin via a reverse proxy to /api)
 *
 * This means production builds work on any host without touching source code.
 */
let API_BASE =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:5000'
    : typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:5000');

// Force IPv4 loopback to avoid Chrome IPv6 ERR_CONNECTION_REFUSED bugs on Windows
if (API_BASE && API_BASE.includes('localhost')) {
  API_BASE = API_BASE.replace('localhost', '127.0.0.1');
}

export { API_BASE };
