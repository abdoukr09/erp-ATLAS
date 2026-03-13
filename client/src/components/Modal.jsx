import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, onSubmit, submitLabel = 'Save' }) {
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
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
