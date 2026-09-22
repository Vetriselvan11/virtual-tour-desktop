import httpClient from '../../../services/http/httpClient';

export const uploadImage = (tourId, file, onProgress) => {
  const formData = new FormData();
  formData.append('image', file);
  return httpClient.post(`/api/upload/${tourId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
    }
  }).then(r => r.data);
};

export const uploadFolderPanoramas = (tourId, files, onProgress) => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }
  return httpClient.post(`/api/upload-folder/${tourId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5 minutes for large panoramic folder uploads
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    }
  }).then(r => r.data);
};
