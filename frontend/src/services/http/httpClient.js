import axios from 'axios';
import { API_BASE } from '../../config/api';
import StandalonePathResolver from '../../core/viewer/StandalonePathResolver';

const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const getImageUrl = (url) => {
  return StandalonePathResolver.resolveAsset(url);
};

export default httpClient;
