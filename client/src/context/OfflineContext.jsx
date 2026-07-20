import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Network } from '@capacitor/network';
import { isNative } from '../native';
import { useAuth } from './AuthContext';
import { getPendingCount, onOutboxChange, syncOutbox } from '../lib/outbox';
import { getCachedSnapshot, refreshSnapshot } from '../lib/catalog';

// ─── Offline state for the whole app ────────────────────────────────────────
// Native only. In a browser the provider reports "always online, nothing
// pending", so every offline affordance stays hidden and the web app behaves
// exactly as it did before.

const OfflineContext = createContext({
  native: false,
  online: true,
  pending: 0,
  syncing: false,
  syncedAt: null,
  lastError: null,
  syncNow: async () => {},
});

export function OfflineProvider({ children }) {
  const native = isNative();
  // Nothing may hit the API before login, or the 401 interceptor would bounce
  // the user straight back to /login on app start.
  const { user } = useAuth();

  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [lastError, setLastError] = useState(null);

  // Read inside listeners that are registered once
  const onlineRef = useRef(true);
  const syncingRef = useRef(false);

  const syncNow = useCallback(async ({ silent = false } = {}) => {
    if (!native || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    if (!silent) setLastError(null);

    try {
      const res = await syncOutbox();
      setPending(await getPendingCount());
      const snap = await getCachedSnapshot();
      if (snap?.syncedAt) setSyncedAt(snap.syncedAt);

      if (res?.errors > 0) {
        setLastError(`${res.errors} mouvement(s) refusé(s) par le serveur.`);
      } else if (!silent) {
        setLastError(null);
      }
    } catch {
      // Offline or server unreachable — the queue keeps everything for later
      if (!silent) setLastError('Synchronisation impossible : serveur injoignable.');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [native]);

  // Queue size drives the banner
  useEffect(() => {
    if (!native) return;
    getPendingCount().then(setPending);
    return onOutboxChange(setPending);
  }, [native]);

  // Cache timestamp for the "données du …" label
  useEffect(() => {
    if (!native) return;
    getCachedSnapshot().then((snap) => {
      if (snap?.syncedAt) setSyncedAt(snap.syncedAt);
    });
  }, [native]);

  // Network transitions: flush the queue as soon as the link is back
  useEffect(() => {
    if (!native || !user) return;
    let listener;
    let cancelled = false;

    const apply = (connected) => {
      const was = onlineRef.current;
      onlineRef.current = connected;
      setOnline(connected);
      // Only on the offline → online edge, so we don't re-sync on every event
      if (connected && !was) syncNow({ silent: true });
    };

    (async () => {
      const status = await Network.getStatus();
      if (cancelled) return;
      onlineRef.current = status.connected;
      setOnline(status.connected);

      listener = await Network.addListener('networkStatusChange', (s) => apply(s.connected));

      // Fresh start while connected: push anything left over from last session,
      // then pull a current catalogue.
      if (status.connected) {
        await syncNow({ silent: true });
        try {
          const snap = await refreshSnapshot();
          if (!cancelled) setSyncedAt(snap.syncedAt);
        } catch { /* keep the cached copy */ }
      }
    })();

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [native, user, syncNow]);

  return (
    <OfflineContext.Provider
      value={{ native, online, pending, syncing, syncedAt, lastError, syncNow }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
