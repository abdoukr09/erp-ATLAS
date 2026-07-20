import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '../api';
import { isNative, getRefreshToken, clearRefreshToken } from '../native';

const AuthContext = createContext(null);

/**
 * A refresh that failed without any HTTP response never reached the server, so
 * it says nothing about whether the session is still valid — it means the
 * network is down. Only a real 401 proves the session was rejected.
 */
const isNetworkFailure = (err) => !err?.response;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True when we restored the session from local storage without reaching the
  // server. Writes still queue in the outbox; reads come from the cache.
  const [offlineSession, setOfflineSession] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.post('/auth/refresh');
      const { accessToken, user: userData } = res.data;
      setAccessToken(accessToken);
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Fallback for refresh endpoint that only returns token
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          // Valid session but no cached profile (app data cleared) — fetch it
          const me = await api.get('/auth/me');
          setUser(me.data.user);
          localStorage.setItem('user', JSON.stringify(me.data.user));
        }
      }
      setOfflineSession(false);
      return true;
    } catch (err) {
      // Warehouse tablet with no signal: keep the operator working on cached
      // data instead of stranding them at a login screen they cannot pass.
      if (isNative() && isNetworkFailure(err)) {
        const savedUser = localStorage.getItem('user');
        const storedToken = await getRefreshToken();
        if (savedUser && storedToken) {
          setUser(JSON.parse(savedUser));
          setOfflineSession(true);
          return true;
        }
      }
      console.error('Silent refresh failed:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      // On native the session lives in Preferences and can outlive the cached
      // profile, so a stored token alone is enough to try a recovery.
      const nativeToken = isNative() ? await getRefreshToken() : null;
      if (savedUser || nativeToken) {
        // Attempt to recover session silently
        const success = await refreshSession();
        if (!success) {
           localStorage.removeItem('user');
           await clearRefreshToken();
           setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [refreshSession]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { accessToken, user: userData } = res.data;
    setAccessToken(accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActivity', Date.now().toString());
    setOfflineSession(false);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    // Runs before clearing storage: the interceptor still needs the token to
    // tell the server which session to revoke.
    try { await api.post('/auth/logout'); } catch (err) { /* ignore */ }
    setAccessToken(null);
    localStorage.removeItem('user');
    await clearRefreshToken();
    setOfflineSession(false);
    setUser(null);
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, refreshSession, offlineSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
