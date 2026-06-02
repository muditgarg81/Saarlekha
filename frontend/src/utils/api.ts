import axios from 'axios';

const formatBaseUrl = (url: string) => {
  let formatted = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = `http://${formatted}`;
  }
  return formatted.endsWith('/api') ? formatted : `${formatted}/api`;
};

export const getApiBaseURL = () => {
  const customUrl = localStorage.getItem('api_server_url');
  if (customUrl) {
    return formatBaseUrl(customUrl);
  }
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getApiBaseURL(),
});

export const updateApiBaseURL = (newUrl: string) => {
  const formatted = formatBaseUrl(newUrl);
  localStorage.setItem('api_server_url', newUrl.trim());
  api.defaults.baseURL = formatted;
};

// Request interceptor to add the JWT token to every request
api.interceptors.request.use(
  (config) => {
    // Dynamically align baseURL on every request just in case it was updated
    config.baseURL = getApiBaseURL();
    
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
