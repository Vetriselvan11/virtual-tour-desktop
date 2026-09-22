import * as THREE from 'three';
import { getImageUrl } from '../../services/http/httpClient';

const imageCache = new Map();

function resolveIconUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return getImageUrl ? getImageUrl(url) : url;
}

function getOrLoadImage(rawUrl, onLoaded) {
  const url = resolveIconUrl(rawUrl);
  if (!url) return null;

  if (imageCache.has(url)) {
    const entry = imageCache.get(url);
    if (entry.loaded) return entry.img;
    if (onLoaded) entry.callbacks.push(onLoaded);
    return null;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry = { img, loaded: false, callbacks: onLoaded ? [onLoaded] : [] };
  imageCache.set(url, entry);

  img.onload = () => {
    entry.loaded = true;
    const cbs = entry.callbacks;
    entry.callbacks = [];
    cbs.forEach((cb) => {
      try { cb(img); } catch (e) { console.error(e); }
    });
  };
  img.onerror = () => {
    console.warn('Failed to load custom icon:', url);
    entry.failed = true;
  };
  img.src = url;
  return null;
}

const ringTextureCache = new Map();

/**
 * High-Resolution Vector Icon Canvas Generator for WoX BUILDER.
 * Renders anti-aliased glyphs, directional arrows, and custom uploaded SVG/PNG/GIF icons,
 * tinted dynamically to preserve custom hex colors and semi-transparent radial glowing halos.
 */
export const HotspotIcons = {
  /**
   * Generates a canvas texture for a given hotspot and visual states.
   * @param {Object} hotspot - Hotspot configuration parameters
   * @param {boolean} isHovered - Hover highlight state
   * @param {boolean} isSelected - Active selection state
   * @returns {THREE.CanvasTexture} Texture asset loaded in memory
   */
  createTexture: (hotspot, isHovered, isSelected) => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const radius = size / 3.2; // Optimized radius to allow outer selection rings
    const color = hotspot.color || '#6c63ff';
    const isCustom = hotspot.icon === 'custom' || !!hotspot.customIcon;
    const customIconUrl = hotspot.customIcon;
    const iconStyle = hotspot.iconStyle || 'badge'; // 'badge' | 'frameless'

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const render = (loadedImg) => {
      ctx.clearRect(0, 0, size, size);

      if (isCustom && customIconUrl && iconStyle === 'frameless') {
        // --- FRAMELESS CUSTOM ICON MODE ---
        // 1. Soft radial glow
        const glowGrad = ctx.createRadialGradient(center, center, radius * 0.3, center, center, size / 2);
        glowGrad.addColorStop(0, color);
        glowGrad.addColorStop(0.4, color + '55');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(center, center, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // 2. Selection ring if selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(center, center, radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // 3. Draw custom image
        if (loadedImg) {
          const imgDim = size * 0.72;
          ctx.drawImage(loadedImg, (size - imgDim) / 2, (size - imgDim) / 2, imgDim, imgDim);
        } else {
          // Placeholder spinner/dot
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(center, center, radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // --- BADGE MODE (Presets & Framed Custom Icons) ---
        // 1. Immersive Drop Shadow Outer Glow (Radial Gradient)
        const glowGrad = ctx.createRadialGradient(center, center, radius * 0.4, center, center, size / 2);
        glowGrad.addColorStop(0, color);
        glowGrad.addColorStop(0.35, color + '48');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(center, center, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // 2. Dashboard Pinned Selection ring (Dashed rotating halo)
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(center, center, radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // 3. Main Glyph Background Circle
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // White inner borders
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isHovered || isSelected ? 4 : 3;
        ctx.stroke();

        // 4. Content: Custom Image or Vector Preset
        if (isCustom && customIconUrl) {
          if (loadedImg) {
            // Automatically crop and center custom image inside the circle (object-fit: cover)
            const targetDim = (radius - 1) * 2;
            const imgW = loadedImg.naturalWidth || loadedImg.width || 1;
            const imgH = loadedImg.naturalHeight || loadedImg.height || 1;
            const aspect = imgW / imgH;

            let drawW, drawH;
            if (aspect >= 1) {
              drawH = targetDim;
              drawW = targetDim * aspect;
            } else {
              drawW = targetDim;
              drawH = targetDim / aspect;
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, radius - 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(loadedImg, center - drawW / 2, center - drawH / 2, drawW, drawH);
            ctx.restore();
          } else {
            // Loading placeholder
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(center, center, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Standard Preset Glyphs
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const iconType = hotspot.icon || 'arrow';

          if (iconType === 'arrow-left' || (iconType === 'arrow' && hotspot.type === 'navigation' && hotspot.yaw < -1.5)) {
            ctx.beginPath();
            ctx.moveTo(76, 44);
            ctx.lineTo(52, 64);
            ctx.lineTo(76, 84);
            ctx.stroke();
          } else if (iconType === 'arrow-right' || (iconType === 'arrow' && hotspot.type === 'navigation' && hotspot.yaw > 1.5)) {
            ctx.beginPath();
            ctx.moveTo(52, 44);
            ctx.lineTo(76, 64);
            ctx.lineTo(52, 84);
            ctx.stroke();
          } else if (iconType === 'arrow-up') {
            ctx.beginPath();
            ctx.moveTo(44, 76);
            ctx.lineTo(64, 52);
            ctx.lineTo(84, 76);
            ctx.stroke();
          } else if (iconType === 'arrow-down') {
            ctx.beginPath();
            ctx.moveTo(44, 52);
            ctx.lineTo(64, 76);
            ctx.lineTo(84, 52);
            ctx.stroke();
          } else if (iconType === 'arrow-back') {
            ctx.beginPath();
            ctx.moveTo(44, 54);
            ctx.lineTo(64, 84);
            ctx.lineTo(84, 54);
            ctx.stroke();
          } else if (iconType === 'arrow' || iconType === 'arrow-forward') {
            ctx.beginPath();
            ctx.moveTo(44, 74);
            ctx.lineTo(64, 44);
            ctx.lineTo(84, 74);
            ctx.stroke();
          } else if (iconType === 'door') {
            ctx.beginPath();
            ctx.rect(48, 40, 32, 48);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(72, 64, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (iconType === 'stairs') {
            ctx.beginPath();
            ctx.moveTo(44, 82);
            ctx.lineTo(44, 70);
            ctx.lineTo(56, 70);
            ctx.lineTo(56, 58);
            ctx.lineTo(68, 58);
            ctx.lineTo(68, 46);
            ctx.lineTo(80, 46);
            ctx.stroke();
          } else if (iconType === 'sound' || iconType === 'audio' || hotspot.type === 'audio') {
            ctx.beginPath();
            ctx.moveTo(46, 56);
            ctx.lineTo(54, 56);
            ctx.lineTo(66, 46);
            ctx.lineTo(66, 82);
            ctx.lineTo(54, 72);
            ctx.lineTo(46, 72);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(66, 64, 10, -Math.PI / 3, Math.PI / 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(66, 64, 17, -Math.PI / 3, Math.PI / 3);
            ctx.stroke();
          } else if (iconType === 'eye') {
            ctx.beginPath();
            ctx.moveTo(42, 64);
            ctx.quadraticCurveTo(64, 44, 86, 64);
            ctx.quadraticCurveTo(64, 84, 42, 64);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(64, 64, 8, 0, Math.PI * 2);
            ctx.fill();
          } else if (iconType === 'info' || hotspot.type === 'info') {
            ctx.beginPath();
            ctx.arc(center, 48, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(center, 58);
            ctx.lineTo(center, 80);
            ctx.stroke();
          } else if (iconType === 'video' || hotspot.type === 'video') {
            ctx.beginPath();
            ctx.moveTo(54, 46);
            ctx.lineTo(82, 64);
            ctx.lineTo(54, 82);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else if (iconType === 'link' || hotspot.type === 'link') {
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(54, 64, 10, Math.PI * 0.75, Math.PI * 1.75);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(74, 64, 10, -Math.PI * 0.25, Math.PI * 0.75);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(56, 56);
            ctx.lineTo(72, 72);
            ctx.stroke();
          } else if (iconType === 'star') {
            ctx.beginPath();
            const points = 5;
            const outerR = 20;
            const innerR = 8.5;
            for (let i = 0; i < points * 2; i++) {
              const r = i % 2 === 0 ? outerR : innerR;
              const angle = (i * Math.PI) / points - Math.PI / 2;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
          } else if (iconType === 'circle') {
            ctx.beginPath();
            ctx.arc(center, center, 14, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(center, center, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }
      }

      texture.needsUpdate = true;
    };

    if (isCustom && customIconUrl) {
      const syncImg = getOrLoadImage(customIconUrl, (asyncImg) => {
        render(asyncImg);
      });
      render(syncImg);
    } else {
      render(null);
    }

    return texture;
  },

  /**
   * Pulsing outline halo texture. Cached by color to eliminate duplicate allocations.
   * @param {string} color - Hex color
   */
  createRingTexture: (color) => {
    const key = color || '#6c63ff';
    if (ringTextureCache.has(key)) {
      return ringTextureCache.get(key);
    }

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.strokeStyle = key;
    ctx.lineWidth = 3;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    ringTextureCache.set(key, texture);
    return texture;
  },

  /**
   * Releases all cached ring textures from GPU memory.
   */
  clearRingCache: () => {
    ringTextureCache.forEach((texture) => {
      try {
        texture.dispose();
      } catch (err) {
        console.warn('Error disposing ring texture:', err);
      }
    });
    ringTextureCache.clear();
  }
};
