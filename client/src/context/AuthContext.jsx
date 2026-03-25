import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        if (savedUser) setUser(JSON.parse(savedUser));
      }
      return true;
    } catch (err) {
      console.error('Silent refresh failed:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        // Attempt to recover session silently
        const success = await refreshSession();
        if (!success) {
           localStorage.removeItem('user');
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
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (err) { /* ignore */ }
    setAccessToken(null);
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
