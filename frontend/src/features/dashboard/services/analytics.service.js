import httpClient from '../../../services/http/httpClient';

/**
 * Frontend Analytics API Service.
 */
export const getTourOverview = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/overview`, { params });
  return res.data?.data || null;
};

export const getSceneAnalytics = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/scenes`, { params });
  return res.data?.data || [];
};

export const getHotspotAnalytics = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/hotspots`, { params });
  return res.data?.data || [];
};

export const getObjectAnalytics = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/objects`, { params });
  return res.data?.data || [];
};

export const getCinematicAnalytics = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/cinematics`, { params });
  return res.data?.data || [];
};

export const getSceneHeatmap = async (tourId, sceneId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/scenes/${sceneId}/heatmap`, { params });
  return res.data?.data || null;
};

export const downloadAnalyticsCsv = async (tourId, params = {}) => {
  const res = await httpClient.get(`/api/analytics/tours/${tourId}/export`, {
    params,
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `analytics_${tourId}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
};
