const fs = require('fs');
const { ValidationError } = require('../errors/AppError');

/**
 * Validates file buffer against known image/media magic bytes signatures.
 * Prevents extension spoofing (e.g. .exe renamed to .jpg).
 * 
 * @param {Buffer} buffer - Initial bytes of the file (at least 64 bytes)
 * @returns {{ isValid: boolean, format: string|null, mime: string|null }}
 */
function inspectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, format: null, mime: null };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { isValid: true, format: 'jpeg', mime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { isValid: true, format: 'png', mime: 'image/png' };
  }

  // 3. GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return { isValid: true, format: 'gif', mime: 'image/gif' };
  }

  // 4. WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { isValid: true, format: 'webp', mime: 'image/webp' };
  }

  // 5. SVG: text containing <svg
  const textSample = buffer.slice(0, Math.min(buffer.length, 1024)).toString('utf8').trim();
  if (textSample.includes('<svg') || (textSample.startsWith('<?xml') && textSample.includes('<svg'))) {
    return { isValid: true, format: 'svg', mime: 'image/svg+xml' };
  }

  // 6. MP3: ID3 or MPEG sync 0xFF 0xFB/F3/F2
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
    (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)
  ) {
    return { isValid: true, format: 'mp3', mime: 'audio/mpeg' };
  }

  // 7. MP4 / M4A / MOV: .... ftyp
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  ) {
    return { isValid: true, format: 'mp4', mime: 'video/mp4' };
  }

  // 8. WAV: RIFF .... WAVE
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45
  ) {
    return { isValid: true, format: 'wav', mime: 'audio/wav' };
  }

  // 9. OGG: OggS
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53
  ) {
    return { isValid: true, format: 'ogg', mime: 'audio/ogg' };
  }

  // 10. WebM / MKV: 1A 45 DF A3
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
  ) {
    return { isValid: true, format: 'webm', mime: 'video/webm' };
  }

  return { isValid: false, format: null, mime: null };
}

/**
 * Extracts basic dimensions (width, height) from PNG, JPEG, GIF, and WebP buffers in pure JS.
 * 
 * @param {Buffer} buffer
 * @param {string} format
 * @returns {{ width: number, height: number, isEquirectangular: boolean }|null}
 */
function extractImageDimensions(buffer, format) {
  if (!buffer || buffer.length < 24) return null;

  try {
    let width = 0;
    let height = 0;

    if (format === 'png' && buffer.length >= 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if (format === 'gif' && buffer.length >= 10) {
      width = buffer.readUInt16LE(6);
      height = buffer.readUInt16LE(8);
    } else if (format === 'jpeg') {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        // SOF0 (0xC0) to SOF3 (0xC3) or SOF9 (0xC9) to SOF11 (0xCB) contain image dimensions
        if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC9 && marker <= 0xCB)) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          break;
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    } else if (format === 'webp' && buffer.length >= 30) {
      // VP8 lossy or VP8L lossless
      const vp8 = buffer.slice(12, 16).toString('ascii');
      if (vp8 === 'VP8 ' && buffer.length >= 30) {
        width = (buffer.readUInt16LE(26) & 0x3fff);
        height = (buffer.readUInt16LE(28) & 0x3fff);
      } else if (vp8 === 'VP8L' && buffer.length >= 25) {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        width = 1 + (((b1 & 0x3F) << 8) | b0);
        height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      }
    }

    if (width > 0 && height > 0) {
      const ratio = width / height;
      // 360 equirectangular panoramas typically have a 2:1 aspect ratio (between 1.95 and 2.05)
      const isEquirectangular = ratio >= 1.9 && ratio <= 2.1;
      return { width, height, isEquirectangular };
    }
  } catch {
    // Gracefully handle incomplete or irregular headers
  }

  return null;
}

/**
 * Validates a file on disk for integrity, magic byte headers, and format correctness.
 * Throws a ValidationError if invalid.
 * 
 * @param {string} filePath - Absolute path to file on disk
 * @param {string[]} [allowedFormats=['jpeg', 'png', 'webp', 'gif', 'svg']]
 * @returns {{ format: string, mime: string, width?: number, height?: number, isEquirectangular?: boolean }}
 */
function validateImageFile(filePath, allowedFormats = ['jpeg', 'png', 'webp', 'gif', 'svg']) {
  if (!fs.existsSync(filePath)) {
    throw new ValidationError(`Uploaded file not found on disk: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new ValidationError('Uploaded file is empty (0 bytes)');
  }

  // Read header (up to 4096 bytes) for magic byte verification
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(Math.min(stats.size, 4096));
  fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);

  const { isValid, format, mime } = inspectMagicBytes(buffer);

  if (!isValid || !allowedFormats.includes(format)) {
    throw new ValidationError(
      `Invalid or corrupted image file. Detected format: "${format || 'unknown'}". Allowed formats: ${allowedFormats.join(', ')}`
    );
  }

  const dimensions = extractImageDimensions(buffer, format);

  return {
    format,
    mime,
    size: stats.size,
    width: dimensions?.width,
    height: dimensions?.height,
    isEquirectangular: dimensions?.isEquirectangular ?? false
  };
}

module.exports = {
  inspectMagicBytes,
  extractImageDimensions,
  validateImageFile
};
