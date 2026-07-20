import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner, BarcodeFormat, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { X, Check, Undo2, Plus, Minus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isNative } from '../native';
import { getDeviceId } from '../lib/device';
import { findByBarcode, loadSnapshot, targetTypeFromBarcode } from '../lib/catalog';
import { enqueue, syncOutbox } from '../lib/outbox';

// Same code read twice within this window counts once — a QR sitting in front
// of the lens fires continuously otherwise.
const DEDUPE_MS = 2000;

export default function Scanner() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('loading'); // loading | scanning | unsupported | denied | error
  const [fatal, setFatal] = useState('');
  const [mode, setMode] = useState('in'); // 'in' = recharge +, 'out' = décharge −
  const [lines, setLines] = useState([]); // [{ barcode, name, targetType, unit, qty }]
  const [events, setEvents] = useState([]); // chronological, for undo
  const [lastRead, setLastRead] = useState(null); // { name, delta }
  const [warning, setWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  // Bumped to restart the camera after a validation, instead of reloading the
  // route: a hard reload would ask Capacitor's local server for /scan, and only
  // '/' is guaranteed to resolve there.
  const [session, setSession] = useState(0);

  // The MLKit listener is registered once, so anything it reads must come from
  // a ref — a captured state value would stay frozen at its initial value.
  const modeRef = useRef(mode);
  const seenRef = useRef(new Map());
  const listenerRef = useRef(null);
  const audioRef = useRef(null);
  const warnTimer = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ─── Feedback ─────────────────────────────────────────────────────────────
  const beep = useCallback((ok = true) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current || (audioRef.current = new Ctx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 200;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch { /* silent is fine, the vibration still fires */ }
  }, []);

  const flashWarning = useCallback((msg) => {
    setWarning(msg);
    clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarning(''), 3000);
  }, []);

  // ─── A barcode came in ────────────────────────────────────────────────────
  const handleCode = useCallback(async (raw) => {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;

    // Ignore a code still parked in front of the lens
    const now = Date.now();
    const last = seenRef.current.get(code);
    if (last && now - last < DEDUPE_MS) return;
    seenRef.current.set(code, now);

    if (!targetTypeFromBarcode(code)) {
      beep(false);
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      flashWarning(`Code non reconnu : ${code}`);
      return;
    }

    const article = await findByBarcode(code);
    if (!article) {
      beep(false);
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      flashWarning(`Article introuvable : ${code}`);
      return;
    }

    const delta = modeRef.current === 'in' ? 1 : -1;

    beep(true);
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});

    setLines((prev) => {
      const i = prev.findIndex((l) => l.barcode === code);
      if (i === -1) {
        return [...prev, {
          barcode: code,
          name: article.name,
          targetType: article.targetType,
          unit: article.unit || 'pcs',
          qty: delta,
        }];
      }
      const next = [...prev];
      next[i] = { ...next[i], qty: next[i].qty + delta };
      return next;
    });

    setEvents((prev) => [...prev, { barcode: code, delta }]);
    setLastRead({ name: article.name, delta });
  }, [beep, flashWarning]);

  // ─── Start / stop the camera ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!isNative()) {
        setStatus('unsupported');
        return;
      }
      try {
        const { supported } = await BarcodeScanner.isSupported();
        if (!supported) {
          setStatus('unsupported');
          return;
        }

        const perm = await BarcodeScanner.requestPermissions();
        if (perm.camera !== 'granted' && perm.camera !== 'limited') {
          setStatus('denied');
          return;
        }

        // The scanner can only name what the cache knows about
        try {
          await loadSnapshot();
        } catch {
          setStatus('error');
          setFatal("Catalogue absent de cette tablette. Connectez-vous une fois à Internet pour le télécharger, puis revenez ici.");
          return;
        }

        if (cancelled) return;

        listenerRef.current = await BarcodeScanner.addListener('barcodesScanned', (ev) => {
          for (const b of ev.barcodes || []) handleCode(b.rawValue);
        });

        document.body.classList.add('atlas-scanning');
        await BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          lensFacing: LensFacing.Back,
        });

        if (!cancelled) setStatus('scanning');
      } catch (err) {
        console.error('Scanner start failed:', err);
        document.body.classList.remove('atlas-scanning');
        setStatus('error');
        setFatal(err?.message || 'Impossible de démarrer la caméra.');
      }
    };

    start();

    return () => {
      cancelled = true;
      clearTimeout(warnTimer.current);
      document.body.classList.remove('atlas-scanning');
      listenerRef.current?.remove().catch(() => {});
      BarcodeScanner.stopScan().catch(() => {});
    };
  }, [handleCode, session]);

  /** Camera must be released before we show any opaque screen */
  const stopCamera = useCallback(async () => {
    document.body.classList.remove('atlas-scanning');
    try { await listenerRef.current?.remove(); } catch { /* already gone */ }
    try { await BarcodeScanner.stopScan(); } catch { /* already stopped */ }
  }, []);

  const close = useCallback(async () => {
    await stopCamera();
    navigate(-1);
  }, [navigate, stopCamera]);

  // ─── Session edits ────────────────────────────────────────────────────────
  const undoLast = () => {
    const last = events[events.length - 1];
    if (!last) return;
    setEvents((prev) => prev.slice(0, -1));
    setLines((prev) =>
      prev
        .map((l) => (l.barcode === last.barcode ? { ...l, qty: l.qty - last.delta } : l))
        .filter((l) => l.qty !== 0)
    );
    setLastRead(null);
  };

  const adjust = (barcode, step) => {
    setLines((prev) =>
      prev
        .map((l) => (l.barcode === barcode ? { ...l, qty: l.qty + step } : l))
        .filter((l) => l.qty !== 0)
    );
  };

  const removeLine = (barcode) => {
    setLines((prev) => prev.filter((l) => l.barcode !== barcode));
    setEvents((prev) => prev.filter((e) => e.barcode !== barcode));
  };

  // ─── Validate ─────────────────────────────────────────────────────────────
  const validate = async () => {
    const movements = lines.filter((l) => l.qty !== 0);
    if (!movements.length || saving) return;

    setSaving(true);
    await stopCamera();

    try {
      const deviceId = await getDeviceId();
      const queued = await enqueue(
        movements.map((l) => ({
          deviceId,
          userId: user?.id,
          targetType: l.targetType,
          barcode: l.barcode,
          delta: l.qty,
          source: 'scan',
        }))
      );

      // Try to push straight away; if there is no network it simply stays queued
      let synced = null;
      try {
        synced = await syncOutbox();
      } catch { /* offline — the outbox keeps it for later */ }

      setResult({
        count: queued.length,
        synced: synced && !synced.skipped ? synced : null,
        pending: synced?.remaining ?? queued.length,
      });
    } catch (err) {
      console.error('Validation failed:', err);
      setStatus('error');
      setFatal("Impossible d'enregistrer les mouvements sur la tablette.");
    } finally {
      setSaving(false);
    }
  };

  const totalMovements = lines.filter((l) => l.qty !== 0).length;
  const isIn = mode === 'in';

  // ─── Screens that replace the camera view ─────────────────────────────────
  if (result) {
    const allSent = result.pending === 0;
    return (
      <div style={S.sheet}>
        <div style={{ ...S.badge, background: allSent ? '#16a34a' : '#f59e0b' }}>
          {allSent ? <Check size={44} /> : <Loader2 size={44} />}
        </div>
        <h2 style={S.sheetTitle}>{result.count} mouvement{result.count > 1 ? 's' : ''} enregistré{result.count > 1 ? 's' : ''}</h2>
        <p style={S.sheetText}>
          {allSent
            ? 'Tout est synchronisé avec le serveur.'
            : `${result.pending} en attente — l'envoi se fera au retour du réseau.`}
        </p>
        {result.synced?.errors > 0 && (
          <p style={{ ...S.sheetText, color: '#f87171' }}>
            {result.synced.errors} mouvement(s) refusé(s) par le serveur (code inconnu).
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 28, width: '100%' }}>
          <button style={{ ...S.bigBtn, background: '#1e293b' }} onClick={() => {
            setResult(null); setLines([]); setEvents([]); setLastRead(null);
            seenRef.current.clear();
            setStatus('loading');
            setSession((n) => n + 1); // re-runs the camera effect, no navigation
          }}>
            Scanner à nouveau
          </button>
          <button style={{ ...S.bigBtn, background: '#2563eb' }} onClick={() => navigate(-1)}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div style={S.sheet}>
        <Loader2 size={40} style={{ color: '#60a5fa' }} />
        <p style={S.sheetText}>Démarrage de la caméra…</p>
      </div>
    );
  }

  if (status !== 'scanning') {
    const messages = {
      unsupported: "Le scan n'est disponible que dans l'application Android installée sur la tablette.",
      denied: "L'accès à la caméra a été refusé. Autorisez-le dans Paramètres → Applications → ERP ATLAS → Autorisations.",
      error: fatal,
    };
    return (
      <div style={S.sheet}>
        <div style={{ ...S.badge, background: '#b91c1c' }}><AlertTriangle size={44} /></div>
        <h2 style={S.sheetTitle}>Scan indisponible</h2>
        <p style={S.sheetText}>{messages[status] || fatal}</p>
        <button style={{ ...S.bigBtn, background: '#2563eb', marginTop: 28 }} onClick={() => navigate(-1)}>
          Retour
        </button>
      </div>
    );
  }

  // ─── Live scan overlay (camera shows through the transparent background) ──
  return (
    <div style={S.overlay}>
      <div style={S.topBar}>
        <button style={S.iconBtn} onClick={close} aria-label="Fermer">
          <X size={26} />
        </button>
        <span style={S.topTitle}>Scanner</span>
        <span style={S.deviceTag}>{totalMovements} article{totalMovements > 1 ? 's' : ''}</span>
      </div>

      {/* Mode is chosen BEFORE scanning and stays visible at all times */}
      <div style={S.modeRow}>
        <button
          onClick={() => setMode('in')}
          style={{ ...S.modeBtn, ...(isIn ? S.modeOnIn : S.modeOff) }}
        >
          <Plus size={26} strokeWidth={3} /> RECHARGE
        </button>
        <button
          onClick={() => setMode('out')}
          style={{ ...S.modeBtn, ...(!isIn ? S.modeOnOut : S.modeOff) }}
        >
          <Minus size={26} strokeWidth={3} /> DÉCHARGE
        </button>
      </div>

      <div style={S.viewfinderZone}>
        <div style={{ ...S.viewfinder, borderColor: isIn ? '#22c55e' : '#ef4444' }} />
        {warning && (
          <div style={S.warning}>
            <AlertTriangle size={20} /> {warning}
          </div>
        )}
        {!warning && lastRead && (
          <div style={{ ...S.lastRead, background: lastRead.delta > 0 ? 'rgba(22,163,74,.92)' : 'rgba(220,38,38,.92)' }}>
            <Check size={20} strokeWidth={3} />
            <span style={S.lastReadName}>{lastRead.name}</span>
            <strong style={S.lastReadDelta}>{lastRead.delta > 0 ? '+1' : '−1'}</strong>
          </div>
        )}
      </div>

      <div style={S.panel}>
        {lines.length === 0 ? (
          <p style={S.hint}>
            Visez un code QR ATLAS. Chaque lecture ajoute {isIn ? '+1' : '−1'}.
          </p>
        ) : (
          <div style={S.list}>
            {lines.map((l) => (
              <div key={l.barcode} style={S.line}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={S.lineName}>{l.name}</div>
                  <div style={S.lineCode}>{l.barcode}</div>
                </div>
                <button style={S.stepBtn} onClick={() => adjust(l.barcode, -1)} aria-label="Retirer 1">
                  <Minus size={20} strokeWidth={3} />
                </button>
                <div style={{ ...S.qty, color: l.qty > 0 ? '#4ade80' : '#f87171' }}>
                  {l.qty > 0 ? `+${l.qty}` : l.qty}
                </div>
                <button style={S.stepBtn} onClick={() => adjust(l.barcode, 1)} aria-label="Ajouter 1">
                  <Plus size={20} strokeWidth={3} />
                </button>
                <button style={{ ...S.stepBtn, color: '#f87171' }} onClick={() => removeLine(l.barcode)} aria-label="Supprimer la ligne">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={S.actions}>
          <button
            style={{ ...S.bigBtn, background: '#334155', flex: '0 0 42%', opacity: events.length ? 1 : 0.4 }}
            onClick={undoLast}
            disabled={!events.length}
          >
            <Undo2 size={20} /> Annuler
          </button>
          <button
            style={{ ...S.bigBtn, background: totalMovements ? '#2563eb' : '#334155', opacity: totalMovements ? 1 : 0.5 }}
            onClick={validate}
            disabled={!totalMovements || saving}
          >
            {saving ? <Loader2 size={20} /> : <Check size={22} strokeWidth={3} />}
            VALIDER{totalMovements ? ` (${totalMovements})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline styles: this screen sits over a transparent body, outside the normal
// page chrome, and must not inherit anything from index.css.
const S = {
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', zIndex: 9999, background: 'transparent',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(6px)',
  },
  topTitle: { flex: 1, color: '#fff', fontWeight: 700, fontSize: '1.05rem' },
  deviceTag: { color: '#94a3b8', fontSize: '.85rem', fontWeight: 600 },
  iconBtn: {
    background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff',
    width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer',
  },
  modeRow: { display: 'flex', gap: 10, padding: '0 12px', marginTop: 10 },
  modeBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '18px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
    fontSize: '1.05rem', fontWeight: 800, letterSpacing: '.5px',
  },
  modeOnIn: { background: '#16a34a', color: '#fff', boxShadow: '0 0 0 3px rgba(34,197,94,.45)' },
  modeOnOut: { background: '#dc2626', color: '#fff', boxShadow: '0 0 0 3px rgba(239,68,68,.45)' },
  modeOff: { background: 'rgba(15,23,42,.75)', color: '#94a3b8' },
  viewfinderZone: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, padding: 16, pointerEvents: 'none',
  },
  viewfinder: {
    width: 'min(62vw, 260px)', aspectRatio: '1', border: '4px solid', borderRadius: 20,
    boxShadow: '0 0 0 100vmax rgba(2,6,23,.35)',
  },
  lastRead: {
    display: 'flex', alignItems: 'center', gap: 10, maxWidth: '92%',
    padding: '12px 18px', borderRadius: 14, color: '#fff',
  },
  lastReadName: {
    fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  lastReadDelta: { fontSize: '1.2rem' },
  warning: {
    display: 'flex', alignItems: 'center', gap: 10, maxWidth: '92%', textAlign: 'center',
    padding: '12px 18px', borderRadius: 14, background: 'rgba(180,83,9,.95)', color: '#fff', fontWeight: 600,
  },
  panel: {
    background: 'rgba(2,6,23,.92)', backdropFilter: 'blur(8px)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '14px 12px 18px',
  },
  hint: { color: '#94a3b8', textAlign: 'center', margin: '10px 0 16px', fontSize: '.95rem' },
  list: { maxHeight: '30vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 },
  line: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    background: 'rgba(30,41,59,.9)', borderRadius: 12,
  },
  lineName: {
    color: '#f1f5f9', fontWeight: 600, fontSize: '.95rem',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  lineCode: { color: '#64748b', fontSize: '.75rem', fontFamily: 'monospace' },
  stepBtn: {
    background: 'rgba(255,255,255,.1)', border: 'none', color: '#e2e8f0',
    width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  qty: { minWidth: 44, textAlign: 'center', fontWeight: 800, fontSize: '1.15rem' },
  actions: { display: 'flex', gap: 10 },
  bigBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '18px 10px', borderRadius: 14, border: 'none', color: '#fff',
    fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer',
  },
  sheet: {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28,
    background: '#0a0e1a', zIndex: 9999, textAlign: 'center',
  },
  badge: { width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff' },
  sheetTitle: { color: '#f1f5f9', margin: 0, fontSize: '1.35rem' },
  sheetText: { color: '#94a3b8', margin: 0, maxWidth: 420, lineHeight: 1.6 },
};
