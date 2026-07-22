import { useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import useHasCamera from '../hooks/useHasCamera';

/**
 * Ouvre le scanner plein écran.
 * S'affiche partout où il y a une caméra : dans l'APK, et sur le site ouvert
 * depuis un téléphone ou une tablette. Sur un PC sans webcam le bouton reste
 * invisible — les pages de stock y offrent déjà les boutons +/−.
 */
export default function ScanButton({ label = 'Scanner' }) {
  const navigate = useNavigate();
  const cameraAvailable = useHasCamera();

  if (!cameraAvailable) return null;

  return (
    <button
      className="btn"
      onClick={() => navigate('/scan')}
      style={{
        background: '#16a34a',
        color: '#fff',
        fontWeight: 700,
        padding: '12px 20px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <ScanLine size={20} /> {label}
    </button>
  );
}
