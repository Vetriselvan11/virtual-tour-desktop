import httpClient from '../../../services/http/httpClient';

export const analyzeTour = async (tourId, data = {}) => {
  const res = await httpClient.post(`/api/analysis/${tourId}/analyze`, data);
  return res.data;
};

export const analyzeTourScenes = async (tourId, data = {}) => {
  const res = await httpClient.post(`/api/analysis/${tourId}/analyze`, data);
  return res.data;
};

export const getAnalysisJobStatus = async (jobId) => {
  const res = await httpClient.get(`/api/analysis/jobs/${jobId}`);
  return res.data;
};

export const getTourIntelligence = async (tourId) => {
  const res = await httpClient.get(`/api/analysis/${tourId}`);
  return res.data;
};

export const acceptAiSuggestion = async (tourId, suggestionId, options = {}) => {
  const res = await httpClient.post(`/api/analysis/${tourId}/suggestions/${suggestionId}/accept`, options);
  return res.data;
};

export const rejectAiSuggestion = async (tourId, suggestionId) => {
  const res = await httpClient.post(`/api/analysis/${tourId}/suggestions/${suggestionId}/reject`);
  return res.data;
};
