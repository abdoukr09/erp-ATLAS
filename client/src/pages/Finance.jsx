import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, CreditCard, CalendarDays } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';
import { useAuth } from '../context/AuthContext';

export default function Finance() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState(initialSearch);
  const [activeFilters, setActiveFilters] = useState({});
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
  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = payments.filter(p => p.status === 'completed' && p.paymentDate === today).reduce((sum, p) => sum + Number(p.amount), 0);

  const financeFilters = [
    { key: 'method', label: '💳 Méthode', options: [
      { value: 'cash', label: 'Espèces', color: '#10b981' },
      { value: 'bank_transfer', label: 'Virement', color: '#3b82f6' },
      { value: 'check', label: 'Chèque', color: '#f59e0b' },
      { value: 'card', label: 'Carte', color: '#8b5cf6' },
    ]},
    { key: 'type', label: '🏷️ Type', options: [
      { value: 'advance', label: 'Avance', color: '#3b82f6' },
      { value: 'final', label: 'Paiement Final', color: '#22c55e' },
      { value: 'other', label: 'Autre', color: '#64748b' },
    ]},
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filtered = payments
    .filter(p => {
      if (activeFilters.method && p.method !== activeFilters.method) return false;
      if (activeFilters.type && p.type !== activeFilters.type) return false;
      if (searchText.trim()) {
        const s = searchText.toLowerCase();
        if (!(
          (p.order?.items && p.order.items.some(i => i.sofaModel?.toLowerCase()?.includes(s))) ||
          p.order?.sofaModel?.toLowerCase()?.includes(s) ||
          p.order?.customer?.name?.toLowerCase()?.includes(s) ||
          p.method?.toLowerCase()?.includes(s) ||
          `#${p.orderId}`.includes(s)
        )) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.paymentDate || '';
      const dateB = b.paymentDate || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.id - a.id;
    });

  return (
    <div className="page-transition">
      <div className="stats-grid" style={{marginBottom:24}}>
        {hasRole('admin') && (
          <div className="stat-card green animate-in">
            <div className="stat-icon green"><CreditCard size={24} /></div>
            <div className="stat-info">
              <h3>{totalRevenue.toLocaleString()} DA</h3>
              <p>Chiffre d'Affaires (Total)</p>
            </div>
          </div>
        )}
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
            <SmartSearch
              filters={financeFilters}
              onFilterChange={handleFilterChange}
              placeholder="Rechercher par client, ID commande, description..."
              initialSearchText={initialSearch}
            />
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ orderId: '', amount: '', method: 'cash', notes: '' }); setShowModal(true); }}>
              <Plus size={16} /> Ajouter Paiement
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Commande</th><th>Client</th><th>Type</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td 
                  style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => p.orderId && navigate(`/orders?search=${p.orderId}`)}
                  title={p.orderId ? "Voir commande" : ""}
                >
                  {p.orderId ? `#${p.orderId}` : '—'}
                  <div style={{fontSize: '0.85em', color: 'var(--text-muted)'}}>
                    {p.order?.items && p.order.items.length > 0 
                      ? p.order.items.map(i => i.sofaModel).join(', ') 
                      : p.order?.sofaModel || ''}
                  </div>
                </td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{p.order?.customer?.name || '—'}</td>
                <td>
                  {(p.type === 'advance' && Number(p.order?.totalPrice || Infinity) > 0 && Number(p.amount) >= Number(p.order?.totalPrice)) ? (
                    <span style={{fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'3px 10px', borderRadius:20, fontSize:12}}>Paiement Complet</span>
                  ) : p.type === 'advance' ? (
                    <span className="badge badge-blue">Avance</span>
                  ) : p.type === 'final' ? (
                    <span style={{fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'3px 10px', borderRadius:20, fontSize:12}}>Paiement Final</span>
                  ) : (
                    <span className="badge badge-scheduled">Autre</span>
                  )}
                </td>
                <td style={{fontWeight:700, color:'var(--accent-green)'}}>{Number(p.amount).toLocaleString()} DA</td>
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
              <tr><td colSpan="9" className="table-empty"><CreditCard size={32} style={{color:'var(--text-muted)'}} /><p>Aucun paiement enregistré</p></td></tr>
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
                {orders.map(o => <option key={o.id} value={o.id}>#{o.id} - {o.items?.map(i => i.sofaModel).join(', ') || o.sofaModel} ({Number(o.totalPrice).toLocaleString()} DA)</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Montant (DA) *</label>
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
