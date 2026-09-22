const path = require('path');
const { UPLOADS_DIR } = require('../../config/directories.config');

/**
 * Normalizes an asset reference URL or path into a canonical relative path.
 * Strips http(s) protocols, hostnames, query strings, hashes, and leading '/uploads/'.
 * Converts all backslashes to forward slashes.
 * Rejects path traversal attempts.
 * 
 * Examples:
 *   "/uploads/tour_123/image_456.jpg?v=1" -> "tour_123/image_456.jpg"
 *   "uploads\\audio\\ambient.mp3"         -> "audio/ambient.mp3"
 *   "/uploads/icons/icon_star.png"        -> "icons/icon_star.png"
 *   "data:image/svg+xml;..."              -> null (inline data URI)
 * 
 * @param {string} rawReference
 * @returns {string|null} Normalized relative path or null if not a local file reference
 */
function normalizeAssetReference(rawReference) {
  if (!rawReference || typeof rawReference !== 'string') return null;

  const trimmed = rawReference.trim();
  if (!trimmed) return null;

  // Ignore data URIs, blob URIs, or external HTTP(S) links
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    // If it's a full URL to the current local server, extract the pathname
    try {
      const parsed = new URL(trimmed);
      return normalizeAssetReference(parsed.pathname);
    } catch {
      return null; // External unparseable URL
    }
  }

  // Strip query parameters and hash fragments
  const cleanPath = trimmed.split('?')[0].split('#')[0];

  // Prevent path traversal
  if (cleanPath.includes('..')) {
    throw new Error(`Security violation: Path traversal detected in asset reference "${cleanPath}"`);
  }

  // Normalize slashes
  let normalized = cleanPath.replace(/\\/g, '/');

  // Strip leading slashes
  normalized = normalized.replace(/^\/+/, '');

  // Strip leading 'uploads/' prefix if present
  if (normalized.startsWith('uploads/')) {
    normalized = normalized.slice('uploads/'.length);
  }

  // Strip leading slashes again just in case
  normalized = normalized.replace(/^\/+/, '');

  return normalized || null;
}

/**
 * Validates that a target path is safely contained within a base directory.
 * Prevents directory traversal.
 * 
 * @param {string} baseDir - Base root directory
 * @param {string} targetPath - Relative or absolute target path
 * @returns {boolean} True if safe, false if traversal attempted
 */
function isPathSafe(baseDir, targetPath) {
  if (!baseDir || !targetPath) return false;
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, targetPath);
  
  // Ensure the resolved target starts with the base directory path
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

/**
 * Resolves a normalized asset relative path to an absolute path on disk within UPLOADS_DIR.
 * Throws an error if path traversal is detected.
 * 
 * @param {string} normalizedPath - Canonical relative path (e.g. "tour_123/image.jpg")
 * @param {string} [uploadsDir] - Root uploads directory (defaults to configured UPLOADS_DIR)
 * @returns {string} Absolute disk path
 */
function getDiskPath(normalizedPath, uploadsDir = UPLOADS_DIR) {
  const norm = normalizeAssetReference(normalizedPath);
  if (!norm) {
    throw new Error('Invalid or empty asset reference provided for disk resolution');
  }

  if (!isPathSafe(uploadsDir, norm)) {
    throw new Error(`Security violation: Access denied for path outside uploads root: "${norm}"`);
  }

  return path.resolve(uploadsDir, norm);
}

/**
 * Converts an absolute disk path within UPLOADS_DIR to a client web URL.
 * 
 * @param {string} diskPath - Absolute disk path
 * @param {string} [uploadsDir] - Root uploads directory
 * @returns {string} Client URL (e.g. "/uploads/tour_123/image.jpg")
 */
function getUrlFromDiskPath(diskPath, uploadsDir = UPLOADS_DIR) {
  if (!diskPath) return '';
  const resolvedDisk = path.resolve(diskPath);
  const resolvedUploads = path.resolve(uploadsDir);

  if (!resolvedDisk.startsWith(resolvedUploads)) {
    throw new Error(`Disk path "${diskPath}" is not within uploads directory "${uploadsDir}"`);
  }

  const relative = path.relative(resolvedUploads, resolvedDisk);
  const webRelative = relative.replace(/\\/g, '/');
  return `/uploads/${webRelative}`;
}

module.exports = {
  normalizeAssetReference,
  isPathSafe,
  getDiskPath,
  getUrlFromDiskPath
};
