import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle } from 'lucide-react';
import api from '../api';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD_MS = 14 * 60 * 1000; // 14 minutes

export default function SessionManager({ children }) {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  // Update activity timestamp in localStorage to sync across tabs
  const updateActivity = useCallback(() => {
    if (showWarning) return; // Don't reset if warning is active
    localStorage.setItem('lastActivity', Date.now().toString());
  }, [showWarning]);

  useEffect(() => {
    if (!user) return; // Only track when logged in

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Throttle activity updates to once per second
    let throttleTimer;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        updateActivity();
        throttleTimer = null;
      }, 1000);
    };

    events.forEach(e => window.addEventListener(e, handleActivity));
    
    // Initialize
    if (!localStorage.getItem('lastActivity')) updateActivity();

    // Check inactivity every second
    const interval = setInterval(() => {
      const lastActivityStr = localStorage.getItem('lastActivity');
      if (!lastActivityStr) return;
      
      const lastActivity = parseInt(lastActivityStr, 10);
      const now = Date.now();
      const diff = now - lastActivity;

      if (diff >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval);
        logout();
      } else if (diff >= WARNING_THRESHOLD_MS) {
        setShowWarning(true);
        setTimeLeft(Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - diff) / 1000)));
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearInterval(interval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, showWarning, logout, updateActivity]);

  const handleKeepAlive = async () => {
    try {
      // Silently refresh the backend token to extend the real JWT
      const res = await api.post('/auth/refresh', {});
      if (res.data.accessToken) {
         localStorage.setItem('token', res.data.accessToken);
      }
      localStorage.setItem('lastActivity', Date.now().toString());
      setShowWarning(false);
    } catch (err) {
      // If refresh fails (e.g. refresh token expired), log out immediately
      logout();
    }
  };

  return (
    <>
      {children}
      {showWarning && user && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content animate-in" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ color: '#ca8a04', marginBottom: '15px' }}>
              <AlertTriangle size={48} />
            </div>
            <h3 style={{ margin: '0 0 10px 0' }}>Session Expirante</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Pour des raisons de sécurité, votre session va expirer dans <strong>{timeLeft} secondes</strong> suite à une inactivité prolongée.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => logout()}>Se déconnecter</button>
              <button className="btn btn-primary" onClick={handleKeepAlive}>Rester connecté</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
