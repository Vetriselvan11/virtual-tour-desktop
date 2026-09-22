import httpClient from '../../../services/http/httpClient';

const LOCAL_STORAGE_KEY = 'wox_tours_backup';

const getLocalTours = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading local tours:', e);
  }
  // Default initial sample tour if empty
  const defaultTour = [{
    id: 'demo-tour-1',
    _id: 'demo-tour-1',
    title: 'WoX 360 Virtual Experience',
    description: 'Sample interactive 360° virtual tour',
    status: 'draft',
    scenes: [],
    updatedAt: new Date().toISOString()
  }];
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultTour));
  } catch {}
  return defaultTour;
};

const saveLocalTours = (tours) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tours));
  } catch (e) {
    console.error('Error saving local tours:', e);
  }
};

export const getTours = async () => {
  try {
    const res = await httpClient.get('/api/tours');
    if (res.data && Array.isArray(res.data)) {
      saveLocalTours(res.data);
      return res.data;
    }
    return getLocalTours();
  } catch (err) {
    console.warn('Backend API unavailable, using local tour storage:', err.message);
    return getLocalTours();
  }
};

export const getTour = async (id) => {
  if (!id || id === 'undefined') {
    const local = getLocalTours();
    if (local && local.length > 0) return local[0];
  }

  // 1. Check if there are active localStorage drafts/edits first
  try {
    const cached = localStorage.getItem(`tour_edits_${id}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.data || parsed.scenes)) {
        return parsed.data || parsed;
      }
    }
  } catch (e) {}

  // 2. Fetch from backend API
  try {
    const res = await httpClient.get(`/api/tours/${id}`);
    if (res.data) return res.data;
  } catch (err) {
    console.warn(`Backend API unavailable for tour ${id}, using local storage fallback`);
  }

  // 3. Fallback to local storage tours
  const local = getLocalTours();
  const found = local.find(t => (t.id === id || t._id === id));
  if (found) return found;

  return {
    id,
    _id: id,
    title: 'WoX 360 Virtual Experience',
    scenes: [],
    updatedAt: new Date().toISOString()
  };
};

export const createTour = async (data) => {
  const newTour = {
    id: `tour_${Date.now()}`,
    _id: `tour_${Date.now()}`,
    title: data.title || 'New 360 Virtual Tour',
    description: data.description || '',
    scenes: data.scenes || [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const res = await httpClient.post('/api/tours', data);
    if (res.data) {
      const local = getLocalTours();
      local.unshift(res.data);
      saveLocalTours(local);
      return res.data;
    }
  } catch (err) {
    console.warn('Backend API unavailable for creation, saving locally:', err.message);
  }

  const local = getLocalTours();
  local.unshift(newTour);
  saveLocalTours(local);
  return newTour;
};

export const updateTour = async (id, data) => {
  try {
    const res = await httpClient.put(`/api/tours/${id}`, data);
    if (res.data) return res.data;
  } catch (err) {
    console.warn('Backend API update failed, saving locally:', err.message);
  }
  const local = getLocalTours();
  const idx = local.findIndex(t => (t.id === id || t._id === id));
  if (idx !== -1) {
    local[idx] = { ...local[idx], ...data, updatedAt: new Date().toISOString() };
    saveLocalTours(local);
    return local[idx];
  }
  return data;
};

export const updateTourFolders = async (id, folders) => {
  try {
    const res = await httpClient.put(`/api/tours/${id}/folders`, { folders });
    if (res.data) return res.data;
  } catch (err) {
    console.warn('Backend API folder update failed, falling back to full update:', err.message);
  }
  return updateTour(id, { folders });
};

export const deleteTour = async (id) => {
  try {
    await httpClient.delete(`/api/tours/${id}`);
  } catch (err) {
    console.warn('Backend API delete failed, deleting locally:', err.message);
  }
  const local = getLocalTours();
  const updated = local.filter(t => (t.id !== id && t._id !== id));
  saveLocalTours(updated);
  return { success: true };
};

export const exportTourZip = (tourId, onProgress) => {
  return httpClient.get(`/api/tours/${tourId}/export`, {
    responseType: 'blob',
    timeout: 0, // Prevent 30s timeout on heavy zip bundling
    onDownloadProgress: (e) => {
      if (onProgress) {
        const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
        onProgress(percent);
      }
    }
  }).then(r => r.data).catch((err) => {
    const msg = err.response?.data?.error || err.message || 'Export service requires backend connection';
    throw new Error(`Export failed: ${msg}`);
  });
};
