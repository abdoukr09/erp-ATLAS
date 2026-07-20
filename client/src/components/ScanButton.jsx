import { useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { isNative } from '../native';

/**
 * Opens the full-screen camera scanner.
 * Renders nothing in a browser — desktop users have no camera to scan with, and
 * the stock pages already offer the +/- controls.
 */
export default function ScanButton({ label = 'Scanner' }) {
  const navigate = useNavigate();
  if (!isNative()) return null;

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
