import { CloudOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shown instead of a page that genuinely needs the server.
 * Orders, deliveries, payments and reports create records with server-assigned
 * numbers, so letting two tablets draft them offline would produce conflicts we
 * cannot resolve. Stock is different: it syncs as deltas, which always add up.
 */
export default function ConnectionRequired({ title = 'Connexion requise' }) {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '48px 24px', textAlign: 'center', minHeight: '50vh',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'rgba(180,83,9,.18)', color: '#f59e0b',
      }}>
        <CloudOff size={38} />
      </div>

      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{title}</h2>

      <p style={{ color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
        Cet écran a besoin du serveur. Reconnectez-vous à Internet pour y accéder.
      </p>

      <p style={{ color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
        En attendant, le <strong>stock</strong>, les <strong>matières premières</strong> et
        le <strong>scan</strong> restent utilisables hors ligne.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => navigate('/finished-products')}>
          Aller au stock
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/inventory')}>
          Matières premières
        </button>
      </div>
    </div>
  );
}
