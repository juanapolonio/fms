import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/marketplace',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = window.ARGO_JWT;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function getResource(path) {
  const response = await api.get(path);
  return { items: response.data.items || response.data, source: 'api' };
}
