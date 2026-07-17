import axios from 'axios';

const formatBaseUrl = (url: string) => {
  let formatted = url.trim().replace(/\/+$/, '');
  if (formatted.startsWith('/')) {
    return formatted;
  }
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = `http://${formatted}`;
  }
  return formatted.endsWith('/api') ? formatted : `${formatted}/api`;
};

export const getApiBaseURL = () => {
  if (import.meta.env.DEV) {
    const customUrl = localStorage.getItem('api_server_url');
    if (customUrl) {
      return formatBaseUrl(customUrl);
    }
  } else {
    // In production/staging, check if hostname is not localhost (browser environment)
    // and return the same-origin relative path '/api' to bypass CORS preflights.
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168.')) {
      return '/api';
    }
  }
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  return 'https://api.saarlekha.com/api';
};

const api = axios.create({
  baseURL: getApiBaseURL(),
});

export const updateApiBaseURL = (newUrl: string) => {
  const formatted = formatBaseUrl(newUrl);
  localStorage.setItem('api_server_url', newUrl.trim());
  api.defaults.baseURL = formatted;
};

// Request interceptor to add the JWT token and cache-control headers to every request
api.interceptors.request.use(
  (config) => {
    // Dynamically align baseURL on every request just in case it was updated
    config.baseURL = getApiBaseURL();
    
    // Disable caching for all API requests
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const tenantId = localStorage.getItem('selected_tenant_id');
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }
    
    // Bypass localtunnel warning page for mobile testing
    config.headers['bypass-tunnel-reminder'] = 'true';
    
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
