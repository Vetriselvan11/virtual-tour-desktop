import httpClient from '../../../services/http/httpClient';

export const validateTourForPublish = async (tourId, data = {}) => {
  const res = await httpClient.post(`/api/publish/${tourId}/validate`, data);
  return res.data;
};

export const publishTour = async (tourId, data = {}) => {
  const res = await httpClient.post(`/api/publish/${tourId}`, data);
  return res.data;
};

export const getPublishJobStatus = async (jobId) => {
  const res = await httpClient.get(`/api/publish/jobs/${jobId}`);
  return res.data;
};

export const getTourVersions = async (tourId) => {
  const res = await httpClient.get(`/api/publish/${tourId}/versions`);
  return res.data;
};

export const rollbackTourVersion = async (tourId, versionId) => {
  const res = await httpClient.post(`/api/publish/${tourId}/versions/${versionId}/rollback`);
  return res.data;
};

export const unpublishTour = async (tourId) => {
  const res = await httpClient.post(`/api/publish/${tourId}/unpublish`);
  return res.data;
};

export const getPublicTourManifest = async (slugOrId, versionId = null) => {
  const url = versionId
    ? `/api/publish/public/${slugOrId}?versionId=${versionId}`
    : `/api/publish/public/${slugOrId}`;
  const res = await httpClient.get(url);
  return res.data;
};
