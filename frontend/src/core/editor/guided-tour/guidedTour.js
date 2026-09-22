import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React Hook to manage a Cinematic Guided Tour Walkthrough.
 * Automates horizontal panning rotation and jumps scenes at configured custom intervals.
 */
export function useGuidedTour({
  scenes = [],
  currentSceneId,
  onSceneChange,
  onCameraRotate, // callback(yawOffset, pitchOffset)
  rotationSpeed = 0.0015 // radians per frame
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isPlayingRef = useRef(isPlaying);
  const sceneTimerRef = useRef(null);
  const rotationTimerRef = useRef(null);

  // Sync ref with state for clean access inside frame loops
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
      if (rotationTimerRef.current) cancelAnimationFrame(rotationTimerRef.current);
    };
  }, []);

  // Frame loop for camera panning rotation during tour playback
  const runCameraRotationLoop = useCallback(() => {
    if (!isPlayingRef.current) return;

    if (onCameraRotate) {
      // Slow, steady horizontal pan
      onCameraRotate(rotationSpeed, 0);
    }

    rotationTimerRef.current = requestAnimationFrame(runCameraRotationLoop);
  }, [onCameraRotate, rotationSpeed]);

  const pauseTour = useCallback(() => {
    setIsPlaying(false);
    if (sceneTimerRef.current) {
      clearTimeout(sceneTimerRef.current);
      sceneTimerRef.current = null;
    }
    if (rotationTimerRef.current) {
      cancelAnimationFrame(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);

  // Recursive scheduler to support variable per-scene custom durations
  const scheduleNextScene = useCallback(() => {
    if (!isPlayingRef.current || !scenes || scenes.length === 0) return;

    const currentScene = scenes[currentStep];
    const durationSec = currentScene?.duration !== undefined ? parseFloat(currentScene.duration) : 8;
    const durationMs = Math.max(1.5, durationSec) * 1000;

    if (sceneTimerRef.current) {
      clearTimeout(sceneTimerRef.current);
    }

    sceneTimerRef.current = setTimeout(() => {
      const nextStep = (currentStep + 1) % scenes.length;
      setCurrentStep(nextStep);
      const nextScene = scenes[nextStep];
      if (nextScene && onSceneChange) {
        onSceneChange(nextScene.id);
      }
    }, durationMs);
  }, [scenes, currentStep, onSceneChange]);

  const playTour = useCallback(() => {
    if (!scenes || scenes.length === 0) return;
    setIsPlaying(true);

    // Start rotation loop
    runCameraRotationLoop();
  }, [scenes, runCameraRotationLoop]);

  // Re-run scheduler when play state or current step shifts
  useEffect(() => {
    if (isPlaying) {
      scheduleNextScene();
    }
    return () => {
      if (sceneTimerRef.current) {
        clearTimeout(sceneTimerRef.current);
      }
    };
  }, [isPlaying, currentStep, scheduleNextScene]);

  const skipNext = useCallback(() => {
    if (!scenes || scenes.length === 0) return;
    const nextStep = (currentStep + 1) % scenes.length;
    setCurrentStep(nextStep);
    const nextScene = scenes[nextStep];
    if (nextScene && onSceneChange) {
      onSceneChange(nextScene.id);
    }
  }, [scenes, currentStep, onSceneChange]);

  const skipPrev = useCallback(() => {
    if (!scenes || scenes.length === 0) return;
    const prevStep = (currentStep - 1 + scenes.length) % scenes.length;
    setCurrentStep(prevStep);
    const nextScene = scenes[prevStep];
    if (nextScene && onSceneChange) {
      onSceneChange(nextScene.id);
    }
  }, [scenes, currentStep, onSceneChange]);

  // Synchronise currentStep state if the user manually changes scene in the carousel
  useEffect(() => {
    if (scenes) {
      const idx = scenes.findIndex((s) => s.id === currentSceneId);
      if (idx !== -1 && idx !== currentStep) {
        setCurrentStep(idx);
      }
    }
  }, [currentSceneId, scenes, currentStep]);

  return {
    isPlaying,
    currentStep,
    playTour,
    pauseTour,
    skipNext,
    skipPrev
  };
}
