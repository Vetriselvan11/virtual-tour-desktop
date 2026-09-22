import { useEffect } from 'react';

/**
 * Custom React Hook to bind global keyboard shortcuts for krpano-style visual editing.
 * Checks input focus targets to avoid intercepting native textbox editing keys.
 */
export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onDelete,
  onSave,
  onToggleAutoRotate,
  onToggleFullscreen,
  onDeselect,
  onCopy,
  onPaste
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcuts if the user is typing in a form input, textarea, or editable element
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable ||
          activeEl.classList.contains('ant-select-selection-search-input'));

      if (isInput) return;

      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;
      const key = e.key.toLowerCase();

      // Ctrl + Z -> Undo
      if (ctrlKey && !shiftKey && key === 'z') {
        e.preventDefault();
        if (onUndo) onUndo();
      }

      // Ctrl + Shift + Z or Ctrl + Y -> Redo
      if (ctrlKey && ((shiftKey && key === 'z') || key === 'y')) {
        e.preventDefault();
        if (onRedo) onRedo();
      }

      // Ctrl + S -> Save
      if (ctrlKey && key === 's') {
        e.preventDefault();
        if (onSave) onSave();
      }

      // Ctrl + C -> Copy
      if (ctrlKey && key === 'c') {
        if (onCopy) {
          e.preventDefault();
          onCopy();
        }
      }

      // Ctrl + V -> Paste
      if (ctrlKey && key === 'v') {
        if (onPaste) {
          e.preventDefault();
          onPaste();
        }
      }

      // Delete or Backspace -> Delete Hotspot
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Keep Backspace from triggering browser navigate-back
        if (onDelete) {
          e.preventDefault();
          onDelete();
        }
      }

      // Space -> Toggle Auto Rotate
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (onToggleAutoRotate) onToggleAutoRotate();
      }

      // F -> Toggle Fullscreen
      if (key === 'f') {
        e.preventDefault();
        if (onToggleFullscreen) onToggleFullscreen();
      }

      // Esc -> Deselect Hotspot
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onDeselect) onDeselect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onUndo,
    onRedo,
    onDelete,
    onSave,
    onToggleAutoRotate,
    onToggleFullscreen,
    onDeselect,
    onCopy,
    onPaste
  ]);
}
