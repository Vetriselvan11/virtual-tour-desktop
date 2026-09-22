import { useState, useCallback } from 'react';
import { message } from 'antd';
import { v4 as uuidv4 } from 'uuid';

export function useHotspotManager(tour, currentSceneId, setTourState, viewerRef) {
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [selectedHotspots, setSelectedHotspots] = useState([]);
  const [clipboardHotspot, setClipboardHotspot] = useState(null);
  const [activeHotspotToConnect, setActiveHotspotToConnect] = useState(null);
  
  const clearSelection = useCallback(() => {
    setSelectedHotspot(null);
    setSelectedHotspots([]);
  }, []);

  const handleHotspotClick = useCallback((hs, e) => {
    if (e && e.shiftKey) {
      setSelectedHotspots(prev => {
        const exists = prev.some(h => h.id === hs.id);
        let next;
        if (exists) {
          next = prev.filter(h => h.id !== hs.id);
        } else {
          next = [...prev, hs];
        }
        if (next.length > 0) {
          setSelectedHotspot(next[next.length - 1]);
        } else {
          setSelectedHotspot(null);
        }
        return next;
      });
    } else {
      setSelectedHotspot(hs);
      setSelectedHotspots([hs]);
    }
  }, []);

  const handleAddHotspot = useCallback(({ yaw, pitch }) => {
    if (!currentSceneId || !tour) return;
    const newHotspot = {
      id: `hs_${uuidv4().slice(0, 8)}`,
      yaw, pitch,
      type: 'navigation',
      color: '#6c63ff',
      size: 40,
      opacity: 0.9,
      icon: 'arrow',
      tooltip: 'New Hotspot',
      targetScene: null,
      animationType: 'pulse',
      showLabel: true,
      alwaysVisible: false,
      events: { onClick: 'navigate', onHover: '' },
    };
    const updated = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? { ...s, hotspots: [...(s.hotspots || []), newHotspot] }
          : s
      ),
    };
    setTourState(updated);
    setSelectedHotspot(newHotspot);
    setSelectedHotspots([newHotspot]);
    message.success('Hotspot added!');
  }, [currentSceneId, tour, setTourState]);

  const handleHotspotUpdate = useCallback((updated) => {
    if (!tour) return;
    setSelectedHotspot(updated);
    setSelectedHotspots(prev => prev.map(h => h.id === updated.id ? updated : h));
    const updatedTour = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? { ...s, hotspots: (s.hotspots || []).map(h => h.id === updated.id ? updated : h) }
          : s
      ),
    };
    setTourState(updatedTour);
  }, [tour, currentSceneId, setTourState]);

  const handleHotspotDelete = useCallback((hsId) => {
    if (!tour) return;
    const updatedTour = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? { ...s, hotspots: (s.hotspots || []).filter(h => h.id !== hsId) }
          : s
      ),
    };
    setTourState(updatedTour);
    clearSelection();
  }, [tour, currentSceneId, setTourState, clearSelection]);

  const handleBulkHotspotUpdate = useCallback((updates) => {
    if (selectedHotspots.length === 0 || !tour) return;
    const updatedIds = selectedHotspots.map(h => h.id);
    const updatedHotspots = selectedHotspots.map(h => ({ ...h, ...updates }));
    setSelectedHotspots(updatedHotspots);
    if (selectedHotspot && updatedIds.includes(selectedHotspot.id)) {
      setSelectedHotspot({ ...selectedHotspot, ...updates });
    }
    const updatedTour = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? {
              ...s,
              hotspots: (s.hotspots || []).map(h => updatedIds.includes(h.id) ? { ...h, ...updates } : h)
            }
          : s
      ),
    };
    setTourState(updatedTour);
  }, [selectedHotspots, selectedHotspot, tour, currentSceneId, setTourState]);

  const handleBulkHotspotDelete = useCallback(() => {
    if (selectedHotspots.length === 0 || !tour) return;
    const deletedIds = selectedHotspots.map(h => h.id);
    const updatedTour = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? { ...s, hotspots: (s.hotspots || []).filter(h => !deletedIds.includes(h.id)) }
          : s
      ),
    };
    setTourState(updatedTour);
    clearSelection();
    message.info(`${deletedIds.length} hotspots deleted`);
  }, [selectedHotspots, tour, currentSceneId, setTourState, clearSelection]);

  const handleDuplicateHotspot = useCallback((hs) => {
    if (!tour) return;
    const copyHs = {
      ...hs,
      id: `hs_${uuidv4().slice(0, 8)}`,
      yaw: hs.yaw + 0.15,
      pitch: hs.pitch,
      tooltip: `${hs.tooltip} (Copy)`
    };
    const updated = {
      ...tour,
      scenes: tour.scenes.map(s =>
        s.id === currentSceneId
          ? { ...s, hotspots: [...(s.hotspots || []), copyHs] }
          : s
      ),
    };
    setTourState(updated);
    setSelectedHotspot(copyHs);
    setSelectedHotspots([copyHs]);
    message.success('Hotspot duplicated!');
  }, [tour, currentSceneId, setTourState]);

  const handlePasteHotspot = useCallback((targetYaw) => {
    if (clipboardHotspot && tour) {
      let currentYaw = 0;
      if (typeof targetYaw === 'number') {
        currentYaw = targetYaw;
      } else if (viewerRef?.current?.spherical?.theta !== undefined) {
        currentYaw = viewerRef.current.spherical.theta;
      }
      const pasteHs = {
        ...clipboardHotspot,
        id: `hs_${uuidv4().slice(0, 8)}`,
        yaw: currentYaw + 0.2,
        pitch: 0,
        tooltip: `${clipboardHotspot.tooltip} (Copy)`
      };
      const updated = {
        ...tour,
        scenes: tour.scenes.map(s =>
          s.id === currentSceneId
            ? { ...s, hotspots: [...(s.hotspots || []), pasteHs] }
            : s
        ),
      };
      setTourState(updated);
      setSelectedHotspot(pasteHs);
      setSelectedHotspots([pasteHs]);
      message.success('Hotspot style pasted!');
    }
  }, [clipboardHotspot, viewerRef, tour, currentSceneId, setTourState]);

  return {
    selectedHotspot,
    setSelectedHotspot,
    selectedHotspots,
    setSelectedHotspots,
    clipboardHotspot,
    setClipboardHotspot,
    activeHotspotToConnect,
    setActiveHotspotToConnect,
    clearSelection,
    handleHotspotClick,
    handleAddHotspot,
    handleHotspotUpdate,
    handleHotspotDelete,
    handleBulkHotspotUpdate,
    handleBulkHotspotDelete,
    handleDuplicateHotspot,
    handlePasteHotspot
  };
}
