import axios from 'axios';
import { isNative, getRefreshToken, saveRefreshToken, clearRefreshToken } from './native';

// Last-resort URL for the APK: used only if the native build was made without
// the capacitor env file. Keeps a mis-built APK working instead of silently
// talking to itself. See client/.env.capacitor
const PRODUCTION_API_URL = 'https://erp-canape-client.vercel.app/api';

// Use Vite environment variable if provided (e.g. backend hosted on Render/Railway)
// Otherwise default to the relative '/api' endpoint (Vercel Monorepo) or localhost:5001 in dev
let API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.MODE === 'development' ? `http://${window.location.hostname}:5001/api` : '/api');

// The APK serves the bundle from https://localhost, so a relative '/api' would
// resolve inside the app itself and never reach Vercel.
if (isNative() && !/^https?:\/\//i.test(API_URL)) {
  console.warn('[ATLAS] Native build without VITE_API_URL — falling back to production. Rebuild with `npm run build:apk`.');
  API_URL = PRODUCTION_API_URL;
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true // Critical for sending HTTP-only refresh tokens securely
});

/** Endpoints that need the refresh token itself, not the access token */
const usesRefreshToken = (url = '') =>
  url.includes('/auth/refresh') || url.includes('/auth/logout');

/** Headers that tell the server this is the native app (see server/routes/auth.js) */
async function nativeAuthHeaders(url) {
  if (!isNative()) return {};
  const headers = { 'X-Client': 'capacitor' };
  if (usesRefreshToken(url)) {
    const stored = await getRefreshToken();
    if (stored) headers['X-Refresh-Token'] = stored;
  }
  return headers;
}

let _accessToken = null;

export const setAccessToken = (token) => {
  _accessToken = token;
};

// Add token to every request from memory
api.interceptors.request.use(async (config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  // No-op on the web; on native this carries the session the cookie can't
  Object.assign(config.headers, await nativeAuthHeaders(config.url));
  return config;
});

let isRefreshing = false;
let failedQueue = [];

/** Session can't be recovered: drop every credential and bounce to /login */
async function killSession() {
  setAccessToken(null);
  localStorage.removeItem('user');
  await clearRefreshToken(); // no-op on web

  // On the web the dev/Vercel server rewrites any path to index.html, so we can
  // jump straight to /login. The APK is served by Capacitor's local server from
  // the bundled files, where only '/' is guaranteed to resolve — ProtectedRoute
  // then redirects to /login on its own.
  window.location.href = isNative() ? '/' : '/login';
}

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
  async (response) => {
    // /login and /refresh hand native clients a refresh token in the body
    // (rotated on every refresh) — persist it or the next call is unauthenticated.
    if (isNative() && response.data?.refreshToken) {
      await saveRefreshToken(response.data.refreshToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Check if the server bounced us due to a dead token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Do not attempt to refresh if the original request was /login itself!
      // This causes an infinite reload loop and masks the real error (like DB connection errors).
      if (originalRequest.url.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // If the `/refresh` endpoint itself failed, the session is fully dead
      if (originalRequest.url.includes('/auth/refresh')) {
        await killSession();
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
        // Raw axios on purpose: bypasses this interceptor to avoid recursion,
        // so the native headers have to be attached by hand here.
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true,
          headers: await nativeAuthHeaders('/auth/refresh'),
        });
        const { accessToken, refreshToken } = res.data;

        if (refreshToken) await saveRefreshToken(refreshToken);

        setAccessToken(accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        // Replay the original failed request
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        await killSession();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
