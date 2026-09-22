import React from 'react';
import Icon from '../../common/Icon';

export const ICON_OPTIONS = [
  { value: 'arrow', label: 'Arrow', iconName: 'ArrowRight' },
  { value: 'arrow-up', label: 'Up', iconName: 'ArrowUp' },
  { value: 'arrow-down', label: 'Down', iconName: 'ArrowDown' },
  { value: 'info', label: 'Info', iconName: 'Info' },
  { value: 'link', label: 'Link', iconName: 'Link2' },
  { value: 'video', label: 'Video', iconName: 'Video' },
  { value: 'star', label: 'Star', iconName: 'Star' },
  { value: 'circle', label: 'Circle', iconName: 'Circle' },
  { value: 'stairs', label: 'Stairs', iconName: 'FaStairs' },
  { value: 'door', label: 'Door', iconName: 'FaDoorClosed' },
  { value: 'sound', label: 'Sound', iconName: 'Volume2' },
  { value: 'eye', label: 'Eye', iconName: 'Eye' },
];

// Curated Architectural Quick-Pick SVG Icons (Embedded data URLs)
export const QUICK_PICK_ICONS = [
  {
    name: 'Bed',
    label: 'Bedroom',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`
  },
  {
    name: 'Bath',
    label: 'Bathroom',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-1C4.7 2.5 4 3.2 4 4v3"/><path d="M4 12h16a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-3a2 2 0 0 1 2-2Z"/><path d="M6 21v1"/><path d="M18 21v1"/></svg>`
  },
  {
    name: 'Kitchen',
    label: 'Kitchen',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v20"/><path d="M6 2v20"/><path d="M6 6h12"/><path d="M6 14h12"/><path d="M10 2v4"/><path d="M14 2v4"/></svg>`
  },
  {
    name: 'Pool',
    label: 'Pool / Patio',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
  },
  {
    name: 'Camera',
    label: 'Photos',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`
  },
  {
    name: 'WiFi',
    label: 'WiFi',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`
  },
  {
    name: 'Coffee',
    label: 'Cafe / Dining',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`
  },
  {
    name: 'Tag',
    label: 'Price Tag',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`
  }
];

export const TYPE_OPTIONS = [
  { value: 'navigation', label: 'Navigation', icon: <Icon name="ArrowRight" size="sm" />, color: 'var(--accent)' },
  { value: 'info', label: 'Information', icon: <Icon name="Info" size="sm" />, color: 'var(--cyan)' },
  { value: 'link', label: 'External Link', icon: <Icon name="Globe" size="sm" />, color: 'var(--amber)' },
  { value: 'video', label: 'Video', icon: <Icon name="Video" size="sm" />, color: 'var(--red)' },
  { value: 'audio', label: 'Audio Zone', icon: <Icon name="Volume2" size="sm" />, color: 'var(--accent-bright)' },
  { value: 'action', label: 'Custom Action', icon: <Icon name="Zap" size="sm" />, color: 'var(--green)' },
];

export const ANIM_OPTIONS = [
  { value: 'none', label: 'None', iconName: 'Minus' },
  { value: 'pulse', label: 'Pulse', iconName: 'Activity' },
  { value: 'glow', label: 'Glow', iconName: 'Sparkles' },
  { value: 'bounce', label: 'Bounce', iconName: 'FaUpDown' },
  { value: 'spin', label: 'Spin', iconName: 'RotateCw' },
];

export const EVENT_PRESETS = [
  { value: 'navigate', label: 'Go to scene' },
  { value: 'open-url', label: 'Open URL' },
  { value: 'show-modal', label: 'Show info panel' },
  { value: 'play-video', label: 'Play video' },
  { value: 'play-audio', label: 'Play audio' },
  { value: 'toggle-floorplan', label: 'Toggle floorplan' },
];

export const PRESET_COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
  '#f43f5e', '#ff6b35', '#a855f7', '#ec4899',
];

export const labelStyle = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  letterSpacing: '0.06em',
  fontWeight: 600
};
