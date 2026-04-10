import { useState } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, onSubmit, submitLabel = 'Enregistrer', submitDisabled = false }) {
  const [saving, setSaving] = useState(false);

  const isLocked = saving || submitDisabled;

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return; // Block all double-clicks globally
    setSaving(true);
    try {
      await onSubmit();
    } catch (err) {
      // Error is handled by the caller (alert, toast, etc.)
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">{children}</div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isLocked}>Annuler</button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isLocked} 
              style={isLocked ? {opacity: 0.6, cursor: 'not-allowed'} : {}}
            >
              {saving ? 'Enregistrement...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
