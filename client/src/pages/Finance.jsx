import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, CreditCard } from 'lucide-react';

export default function Finance() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ orderId: '', amount: '', method: 'cash', notes: '' });

  useEffect(() => { fetchPayments(); fetchOrders(); }, []);

  const fetchPayments = async () => {
    try { const res = await api.get('/payments'); setPayments(res.data); } catch (err) { console.error(err); }
  };
  const fetchOrders = async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      if (editing) await api.put(`/payments/${editing.id}`, form);
      else await api.post('/payments', form);
      setShowModal(false); setEditing(null);
      setForm({ orderId: '', amount: '', method: 'cash', notes: '' });
      fetchPayments();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({ orderId: p.orderId, amount: p.amount, method: p.method, notes: p.notes || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment?')) return;
    try { await api.delete(`/payments/${id}`); fetchPayments(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);

  const filtered = payments.filter(p =>
    p.order?.sofaModel?.toLowerCase()?.includes(search.toLowerCase()) ||
    p.order?.customer?.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    p.method?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card green animate-in">
          <div className="stat-icon green"><CreditCard size={24} /></div>
          <div className="stat-info">
            <h3>{totalRevenue.toLocaleString()} DH</h3>
            <p>Chiffre d'Affaires</p>
          </div>
        </div>
        <div className="stat-card blue animate-in">
          <div className="stat-icon blue"><CreditCard size={24} /></div>
          <div className="stat-info">
            <h3>{payments.length}</h3>
            <p>Paiements Totaux</p>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>Paiements ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher des paiements..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ orderId: '', amount: '', method: 'cash', notes: '' }); setShowModal(true); }}>
              <Plus size={16} /> Ajouter Paiement
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Commande</th><th>Client</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>#{p.orderId} - {p.order?.sofaModel || ''}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{p.order?.customer?.name || '—'}</td>
                <td style={{fontWeight:700, color:'var(--accent-green)'}}>{Number(p.amount).toLocaleString()} DH</td>
                <td><span className="badge badge-scheduled">{p.method === 'cash' ? 'Espèces' : p.method === 'bank_transfer' ? 'Virement' : p.method === 'check' ? 'Chèque' : 'Carte'}</span></td>
                <td><span className={`badge badge-${p.status}`}>{p.status === 'completed' ? 'Complété' : p.status === 'pending' ? 'En attente' : 'Échoué'}</span></td>
                <td>{p.paymentDate}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon edit" onClick={() => handleEdit(p)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" className="table-empty"><CreditCard size={32} style={{color:'var(--text-muted)'}} /><p>Aucun paiement enregistré</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier le Paiement' : 'Ajouter un Paiement'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          {!editing && (
            <div className="form-group">
              <label>Commande *</label>
              <select className="form-control" value={form.orderId} onChange={e => setForm({...form, orderId: e.target.value})} required>
                <option value="">Sélectionner une commande</option>
                {orders.map(o => <option key={o.id} value={o.id}>#{o.id} - {o.sofaModel} ({Number(o.totalPrice).toLocaleString()} DH)</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Montant (DH) *</label>
              <input className="form-control" type="number" min="0" placeholder="Montant" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Méthode</label>
              <select className="form-control" value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
                <option value="cash">Espèces</option>
                <option value="bank_transfer">Virement Bancaire</option>
                <option value="check">Chèque</option>
                <option value="card">Carte Bancaire</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" placeholder="Notes de paiement" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </Modal>
      )}
    </div>
  );
}
