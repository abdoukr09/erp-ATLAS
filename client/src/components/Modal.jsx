import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, onSubmit, submitLabel = 'Save', submitDisabled = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <div className="modal-body">{children}</div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitDisabled}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitDisabled} style={submitDisabled ? {opacity: 0.6, cursor: 'not-allowed'} : {}}>{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
