import { useState, useCallback } from 'react';

/**
 * Custom React Hook to handle Editor State History (Undo / Redo stacks)
 * Saves complete tour JSON snapshots to guarantee absolute correctness
 * without complex differential delta calculations.
 */
export function useHistoryManager(initialState) {
  const [past, setPast] = useState([]);
  const [present, setPresent] = useState(initialState);
  const [future, setFuture] = useState([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pushState = useCallback((newState) => {
    // Prevent pushing identical states
    if (JSON.stringify(newState) === JSON.stringify(present)) return;
    
    setPast((prevPast) => [...prevPast, present]);
    setPresent(newState);
    setFuture([]); // Clear redo stack on new action
  }, [present]);

  const undo = useCallback(() => {
    if (!canUndo) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setPast(newPast);
    setFuture((prevFuture) => [present, ...prevFuture]);
    setPresent(previous);
    return previous;
  }, [canUndo, past, present]);

  const redo = useCallback(() => {
    if (!canRedo) return null;

    const next = future[0];
    const newFuture = future.slice(1);

    setPast((prevPast) => [...prevPast, present]);
    setPresent(next);
    setFuture(newFuture);
    return next;
  }, [canRedo, future, present]);

  const resetHistory = useCallback((state) => {
    setPast([]);
    setPresent(state);
    setFuture([]);
  }, []);

  return {
    state: present,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory
  };
}
