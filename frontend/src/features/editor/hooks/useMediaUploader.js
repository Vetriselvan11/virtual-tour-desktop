import { useState, useRef } from 'react';
import { message } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { exportTourZip } from '../../../features/dashboard/services/tour.service';
import { uploadFolderPanoramas, uploadImage } from '../../../features/editor/services/upload.service';

// ─── Resource Budgets ──────────────────────────────────────────────────────────
const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB architectural limit
const UPLOAD_CHUNK_SIZE     = 3;   // files per HTTP request (bounded server-side thumbnail load)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function useMediaUploader(tourId, tour, setTourState, setCurrentSceneId, clearSelection, handleAddScene, startWalk, stopWalk, viewerRef) {
  const [isUploadingFolder, setIsUploadingFolder] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);

  const folderInputRef    = useRef(null);
  const singleInputRef    = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const recordedChunksRef = useRef([]);

  const cleanAndCapitalize = (filename) => {
    const base    = filename.replace(/\.[^.]+$/, '');
    const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleFolderUploadChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const allowed    = /\.(jpe?g|png|webp)$/i;
    const imageFiles = selectedFiles.filter(f => allowed.test(f.name));

    if (imageFiles.length === 0) {
      message.error('No valid 360° panoramic image files found in the selected folder!');
      return;
    }

    // ── Pre-flight: 10 GB total size check ─────────────────────────────────────
    const totalBytes = imageFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_IMPORT_SIZE_BYTES) {
      message.error(
        `Import rejected: total size ${formatBytes(totalBytes)} exceeds the 10 GB limit. ` +
        `Please split your import into smaller batches.`,
        8 // seconds visible
      );
      if (folderInputRef.current) folderInputRef.current.value = '';
      return;
    }

    // ── Duplicate detection ──────────────────────────────────────────────────
    const uniqueFiles    = [];
    const duplicateNames = [];
    for (const file of imageFiles) {
      const cleanName   = cleanAndCapitalize(file.name);
      const isDuplicate = tour?.scenes?.some(s => s.name?.toLowerCase() === cleanName.toLowerCase());
      if (isDuplicate) duplicateNames.push(cleanName);
      else uniqueFiles.push(file);
    }

    if (uniqueFiles.length === 0) {
      message.warning('All folder panoramas already exist in this virtual tour!');
      return;
    }
    if (duplicateNames.length > 0) {
      message.warning(`Skipped ${duplicateNames.length} duplicate rooms already in tour.`);
    }

    // ── Bounded upload queue ─────────────────────────────────────────────────
    setIsUploadingFolder(true);
    setFolderUploadProgress(0);
    try {
      const allResultFiles = [];
      const totalCount     = uniqueFiles.length;

      for (let i = 0; i < totalCount; i += UPLOAD_CHUNK_SIZE) {
        const chunk = uniqueFiles.slice(i, i + UPLOAD_CHUNK_SIZE);

        const chunkResults = await uploadFolderPanoramas(tourId, chunk, (chunkProgress) => {
          // Map chunk-level progress to overall progress
          const overall = Math.min(99, Math.round(
            ((i + (chunkProgress / 100) * chunk.length) / totalCount) * 100
          ));
          setFolderUploadProgress(overall);
        });

        if (Array.isArray(chunkResults)) {
          allResultFiles.push(...chunkResults);
        }

        // Mark chunk completion in progress bar
        setFolderUploadProgress(Math.min(99, Math.round(((i + chunk.length) / totalCount) * 100)));

        // Yield to browser event loop — keeps UI responsive between chunks
        await new Promise(resolve => setTimeout(resolve, 15));
      }

      setFolderUploadProgress(100);

      // ── Single batched React state update for ALL new scenes ───────────────
      const newScenes = allResultFiles.map(file => ({
        id: `scene_${uuidv4().slice(0, 8)}`,
        name: cleanAndCapitalize(file.originalName),
        image: file.url,
        preview: file.previewUrl || file.url,
        thumbnail: file.thumbnailUrl || file.url,
        tiles: file.tiles || null,
        hotspots: [],
      }));

      const updatedTour = {
        ...tour,
        scenes: [...(tour.scenes || []), ...newScenes],
        startScene: tour.startScene || newScenes[0]?.id
      };

      // ONE React state update for the entire import (not N individual updates)
      setTourState(updatedTour);
      if (newScenes.length > 0) setCurrentSceneId(newScenes[0].id);
      clearSelection();
      message.success(`Successfully uploaded and imported ${newScenes.length} panoramic scenes!`);
    } catch (err) {
      message.error('Folder import failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setIsUploadingFolder(false);
      setFolderUploadProgress(0);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleSingleUploadChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = /\.(jpe?g|png|webp)$/i;
    if (!allowed.test(file.name)) {
      message.error('Only 360° panoramic image files are allowed!');
      return;
    }

    const cleanName = cleanAndCapitalize(file.name);
    if (tour?.scenes?.some(s => s.name?.toLowerCase() === cleanName.toLowerCase())) {
      message.warning(`Scene "${cleanName}" already exists!`);
      return;
    }

    const hide = message.loading(`Uploading scene image "${cleanName}"...`, 0);
    try {
      const result = await uploadImage(tourId, file);
      const newScene = {
        id: `scene_${uuidv4().slice(0, 8)}`,
        name: cleanName,
        image: result.url,
        preview: result.previewUrl || result.url,
        thumbnail: result.thumbnailUrl || result.url,
        tiles: result.tiles || null,
        hotspots: [],
      };
      handleAddScene(newScene);
      message.success(`Scene "${newScene.name}" added successfully!`);
    } catch (err) {
      message.error('Upload failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      hide();
      if (singleInputRef.current) singleInputRef.current.value = '';
    }
  };

  const handleExportTour = async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportTourZip(tourId, (progress) => { setExportProgress(progress); });
      const url  = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href  = url;
      const safeTitle = (tour?.title || 'tour').toLowerCase().replace(/\s+/g, '_');
      link.setAttribute('download', `${safeTitle}_virtual_tour.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Build downloaded successfully!');
    } catch (err) {
      message.error('Failed to download build: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportVideo = () => {
    const canvas = viewerRef.current?.getCanvas();
    if (!canvas) {
      message.error('Could not capture 3D viewer stream. Canvas not found.');
      return;
    }
    try {
      const stream   = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob      = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url       = URL.createObjectURL(blob);
        const a         = document.createElement('a');
        a.href          = url;
        const safeTitle = (tour?.title || 'tour').toLowerCase().replace(/\s+/g, '_');
        a.download      = `${safeTitle}_walkthrough.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecordingVideo(false);
        message.success('Video walkthrough saved successfully!');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingVideo(true);
      startWalk();
    } catch (err) {
      console.error(err);
      message.error('Failed to start video recording. Your browser may not support this feature.');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      stopWalk();
    }
  };

  return {
    isUploadingFolder,
    folderUploadProgress,
    exporting,
    exportProgress,
    isRecordingVideo,
    folderInputRef,
    singleInputRef,
    handleFolderUploadChange,
    handleSingleUploadChange,
    handleExportTour,
    handleExportVideo,
    stopVideoRecording
  };
}
