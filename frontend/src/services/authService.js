const ADMIN_ID = process.env.REACT_APP_ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'password';

/**
 * VistaSphere Authentication Service
 * Lightweight, client-side authentication supporting local, Electron, and offline modes.
 * Designed with placeholders/structure to support future JWT, database, or cloud auth integrations.
 */
export const authService = {
  /**
   * Log in user using credentials
   * @param {string} id 
   * @param {string} password 
   * @returns {Promise<boolean>}
   */
  async login(id, password) {
    // Basic sanitization
    const sanitizedId = (id || '').trim();
    const sanitizedPassword = password || '';

    // Validate credentials locally
    if (sanitizedId === ADMIN_ID && sanitizedPassword === ADMIN_PASSWORD) {
      localStorage.setItem('vista_auth', 'true');
      return true;
    }

    // Delay on failure to prevent brute-forcing and improve UX feeling
    await new Promise(resolve => setTimeout(resolve, 800));
    return false;
  },

  /**
   * Log out user and clear session
   */
  logout() {
    localStorage.removeItem('vista_auth');
  },

  /**
   * Check if current session is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return localStorage.getItem('vista_auth') === 'true';
  }
};

export default authService;
