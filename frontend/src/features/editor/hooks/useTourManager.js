import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, message } from 'antd';
import { getTour, updateTour } from '../../../features/dashboard/services/tour.service';

export function useTourManager(tourId, tour, setTourState, resetHistory, setCurrentSceneId, setEditMode, setAutoRotate, clearSelection, manualDraftMode) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'saving' | 'failed'
  
  const lastSavedTourRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const saveQueueRef = useRef({
    isSaving: false,
    latestData: null
  });

  const fetchTour = useCallback(async (viewportStateRef) => {
    setLoading(true);
    try {
      const data = await getTour(tourId);
      
      // Auto-detect and safely migrate legacy localStorage data into persistent Tour model
      let needsMigration = false;
      const migratedTour = { ...data };

      const legacyF2Plan = localStorage.getItem(`tour_floorplan_f2_${tourId}`);
      if (!migratedTour.floor2Plan && legacyF2Plan) {
        migratedTour.floor2Plan = legacyF2Plan;
        needsMigration = true;
      }

      const legacyF2Pins = localStorage.getItem(`tour_floorplan_pins_f2_${tourId}`);
      if ((!migratedTour.floor2Pins || Object.keys(migratedTour.floor2Pins).length === 0) && legacyF2Pins) {
        try {
          const parsedPins = JSON.parse(legacyF2Pins);
          if (parsedPins && typeof parsedPins === 'object' && Object.keys(parsedPins).length > 0) {
            migratedTour.floor2Pins = parsedPins;
            needsMigration = true;
          }
        } catch (e) {
          console.error('Error parsing legacy F2 pins for migration:', e);
        }
      }

      const legacyFolders = localStorage.getItem(`tour_folders_${tourId}`);
      if ((migratedTour.folders === undefined || migratedTour.folders === null) && legacyFolders) {
        try {
          const parsedFolders = JSON.parse(legacyFolders);
          if (parsedFolders && typeof parsedFolders === 'object' && Object.keys(parsedFolders).length > 0) {
            migratedTour.folders = parsedFolders;
            needsMigration = true;
          }
        } catch (e) {
          console.error('Error parsing legacy folders for migration:', e);
        }
      } else if (migratedTour.folders && legacyFolders) {
        try {
          localStorage.removeItem(`tour_folders_${tourId}`);
        } catch {}
      }

      // If migration occurred, persist to backend and clear localStorage only on success
      if (needsMigration) {
        updateTour(tourId, migratedTour).then(() => {
          localStorage.removeItem(`tour_floorplan_f2_${tourId}`);
          localStorage.removeItem(`tour_floorplan_pins_f2_${tourId}`);
          localStorage.removeItem(`tour_folders_${tourId}`);
        }).catch(err => {
          console.warn('Migration auto-persist failed; retaining legacy localStorage backup:', err);
        });
      }

      const cached = localStorage.getItem(`tour_edits_${tourId}`);
      let parsed = null;
      if (cached) {
        try {
          parsed = JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing cached edits:', e);
        }
      }

      const dbTimestamp = migratedTour.updatedAt ? new Date(migratedTour.updatedAt).getTime() : 0;
      const cachedTimestamp = parsed?.timestamp || 0;
      const hasNewerCache = cachedTimestamp > dbTimestamp;
      const shouldPrompt = parsed && hasNewerCache && (parsed.saveFailed || manualDraftMode);

      if (shouldPrompt) {
        Modal.confirm({
          title: manualDraftMode ? 'Restore unsaved changes?' : 'Recover unsaved edits?',
          content: manualDraftMode 
            ? 'We found unsaved changes from your last session. Would you like to restore them?'
            : 'It looks like the last save to the server failed or was interrupted, but we have a backup. Would you like to recover your work?',
          okText: manualDraftMode ? 'Restore' : 'Recover',
          cancelText: 'Discard Backup',
          onOk: () => {
            resetHistory(parsed.tour);
            lastSavedTourRef.current = parsed.tour;
            if (parsed.currentSceneId) setCurrentSceneId(parsed.currentSceneId);
            setEditMode(parsed.editMode !== undefined ? parsed.editMode : true);
            setAutoRotate(!!parsed.autoRotate);
            message.success('Restored changes successfully!');
            
            if (!manualDraftMode) {
              triggerDebouncedSave(parsed.tour, viewportStateRef);
            }
          },
          onCancel: () => {
            localStorage.removeItem(`tour_edits_${tourId}`);
            resetHistory(migratedTour);
            lastSavedTourRef.current = migratedTour;
            const startId = migratedTour.startScene || migratedTour.scenes?.[0]?.id;
            if (startId) setCurrentSceneId(startId);
          }
        });
      } else {
        resetHistory(migratedTour);
        lastSavedTourRef.current = migratedTour;
        const startId = migratedTour.startScene || migratedTour.scenes?.[0]?.id;
        if (startId) setCurrentSceneId(startId);
        if (cached) {
          localStorage.removeItem(`tour_edits_${tourId}`);
        }
      }
    } catch (err) {
      message.error('Failed to load tour');
    } finally {
      setLoading(false);
    }
  }, [tourId, manualDraftMode, resetHistory, setCurrentSceneId, setEditMode, setAutoRotate]); // eslint-disable-line

  const performSave = useCallback(async (tourData, viewportStateRef) => {
    if (saveQueueRef.current.isSaving) {
      saveQueueRef.current.latestData = tourData;
      return;
    }

    saveQueueRef.current.isSaving = true;
    setSyncStatus('saving');

    try {
      await updateTour(tourId, tourData);
      setSyncStatus('saved');
      lastSavedTourRef.current = tourData;
      
      localStorage.removeItem(`tour_edits_${tourId}`);

      if (saveQueueRef.current.latestData) {
        const nextData = saveQueueRef.current.latestData;
        saveQueueRef.current.latestData = null;
        saveQueueRef.current.isSaving = false;
        performSave(nextData, viewportStateRef);
      } else {
        saveQueueRef.current.isSaving = false;
      }
    } catch (err) {
      console.error('Autosave failed:', err);
      setSyncStatus('failed');
      saveQueueRef.current.isSaving = false;

      const vp = viewportStateRef.current;
      localStorage.setItem(`tour_edits_${tourId}`, JSON.stringify({
        tour: tourData,
        timestamp: Date.now(),
        currentSceneId: vp.currentSceneId,
        selectedHotspotId: vp.selectedHotspotId,
        editMode: vp.editMode,
        autoRotate: vp.autoRotate,
        saveFailed: true
      }));
    }
  }, [tourId]);

  const triggerDebouncedSave = useCallback((tourData, viewportStateRef) => {
    if (manualDraftMode) return;
    setSyncStatus('saving');
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      performSave(tourData, viewportStateRef);
    }, 500);
  }, [manualDraftMode, performSave]);

  const handleSave = async () => {
    if (!tour) return;
    setSaving(true);
    try {
      await updateTour(tourId, tour);
      message.success(manualDraftMode ? 'Draft saved successfully!' : 'Tour saved successfully!');
      localStorage.removeItem(`tour_edits_${tourId}`);
      lastSavedTourRef.current = tour;
      setSyncStatus('saved');
    } catch {
      message.error('Save failed');
      setSyncStatus('failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddScene = useCallback((newScene) => {
    const updated = {
      ...tour,
      scenes: [...(tour.scenes || []), newScene],
      startScene: tour.startScene || newScene.id,
    };
    setTourState(updated);
    setCurrentSceneId(newScene.id);
    clearSelection();
  }, [tour, setTourState, setCurrentSceneId, clearSelection]);

  const handleDeleteScene = useCallback((sceneId, currentSceneId) => {
    const updatedFolders = tour.folders ? { ...tour.folders } : {};
    Object.keys(updatedFolders).forEach(f => {
      if (Array.isArray(updatedFolders[f])) {
        updatedFolders[f] = updatedFolders[f].filter(id => id !== sceneId);
      }
    });

    const updatedF1Pins = tour.floorplanPins ? { ...tour.floorplanPins } : {};
    delete updatedF1Pins[sceneId];

    const updatedF2Pins = tour.floor2Pins ? { ...tour.floor2Pins } : {};
    delete updatedF2Pins[sceneId];

    const updated = {
      ...tour,
      scenes: (tour.scenes || []).filter(s => s.id !== sceneId),
      folders: updatedFolders,
      floorplanPins: updatedF1Pins,
      floor2Pins: updatedF2Pins,
      startScene: tour.startScene === sceneId
        ? tour.scenes.find(s => s.id !== sceneId)?.id || null
        : tour.startScene,
    };
    setTourState(updated);
    if (currentSceneId === sceneId) {
      setCurrentSceneId(updated.scenes[0]?.id || null);
    }
    clearSelection();
  }, [tour, setTourState, setCurrentSceneId, clearSelection]);

  const handleReorderScenes = useCallback((reorderedScenes) => {
    const updated = {
      ...tour,
      scenes: reorderedScenes,
    };
    setTourState(updated);
  }, [tour, setTourState]);

  return {
    loading,
    saving,
    syncStatus,
    setSyncStatus,
    fetchTour,
    handleSave,
    handleAddScene,
    handleDeleteScene,
    handleReorderScenes,
    triggerDebouncedSave,
    lastSavedTourRef
  };
}
