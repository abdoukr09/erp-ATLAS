import axios from 'axios';

// Use Vite environment variable if provided (e.g. backend hosted on Render/Railway)
// Otherwise default to the relative '/api' endpoint (Vercel Monorepo) or localhost:5001 in dev
const API_URL = import.meta.env.VITE_API_URL 
  || (import.meta.env.MODE === 'development' ? `http://${window.location.hostname}:5001/api` : '/api');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true // Critical for sending HTTP-only refresh tokens securely
});

let _accessToken = null;

export const setAccessToken = (token) => {
  _accessToken = token;
};

// Add token to every request from memory
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle 401 errors seamlessly by queueing up a fresh token exchange
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if the server bounced us due to a dead token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the `/refresh` endpoint itself failed, the session is fully dead
      if (originalRequest.url === '/auth/refresh') {
        setAccessToken(null);
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Suspend concurrent requests while the refresh flies
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = res.data;
        
        setAccessToken(accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        
        processQueue(null, accessToken);
        
        // Replay the original failed request
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        setAccessToken(null);
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
