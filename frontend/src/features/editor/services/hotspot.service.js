import httpClient from '../../../services/http/httpClient';

export const updateHotspots = (tourId, sceneId, hotspots) =>
  httpClient.put(`/api/hotspots/${tourId}`, { sceneId, hotspots }).then(r => r.data);
