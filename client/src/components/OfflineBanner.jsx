import { CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

/** "données du 19/07 à 14:32" — tells the operator how stale the numbers are */
function formatStamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Permanent status strip on the tablet.
 * Stays out of the way when everything is synced and online; becomes loud as
 * soon as work is waiting to be uploaded.
 */
export default function OfflineBanner() {
  const { native, online, pending, syncing, syncedAt, lastError, syncNow } = useOffline();

  // Web keeps its original chrome, and a synced online tablet needs no strip
  if (!native) return null;
  if (online && pending === 0 && !lastError) return null;

  const offline = !online;
  const tone = offline
    ? { bg: 'rgba(180,83,9,.96)', icon: <CloudOff size={18} /> }
    : lastError
      ? { bg: 'rgba(185,28,28,.96)', icon: <AlertTriangle size={18} /> }
      : { bg: 'rgba(37,99,235,.96)', icon: <Check size={18} /> };

  const message = offline
    ? pending > 0
      ? `Hors ligne — ${pending} opération${pending > 1 ? 's' : ''} en attente`
      : 'Hors ligne — les données affichées sont locales'
    : lastError
      ? lastError
      : `${pending} opération${pending > 1 ? 's' : ''} à envoyer`;

  const stamp = formatStamp(syncedAt);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 16px', background: tone.bg, color: '#fff', fontWeight: 600,
      }}
    >
      {tone.icon}
      <span style={{ flex: 1, minWidth: 180 }}>{message}</span>

      {stamp && (
        <span style={{ opacity: 0.85, fontSize: '.85rem', fontWeight: 500 }}>
          données du {stamp}
        </span>
      )}

      <button
        onClick={() => syncNow()}
        disabled={syncing || offline}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, border: 'none', cursor: offline ? 'default' : 'pointer',
          background: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 700,
          opacity: syncing || offline ? 0.55 : 1,
        }}
      >
        <RefreshCw size={16} style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
        {syncing ? 'Envoi…' : 'Synchroniser'}
      </button>
    </div>
  );
}
