import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, Truck, CheckCircle } from 'lucide-react';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ orderId: '', driver: '', deliveryDate: '', address: '', status: 'scheduled', notes: '' });

  // Confirm delivery modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDelivery, setConfirmDelivery] = useState(null);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('cash');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { fetchDeliveries(); fetchOrders(); }, []);

  const fetchDeliveries = async () => {
    try { const res = await api.get('/deliveries'); setDeliveries(res.data); } catch (err) { console.error(err); }
  };
  const fetchOrders = async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      const sanitizedForm = {
        ...form,
        orderId: form.orderId === '' ? null : form.orderId
      };
      if (editing) await api.put(`/deliveries/${editing.id}`, sanitizedForm);
      else await api.post('/deliveries', sanitizedForm);
      setShowModal(false); setEditing(null);
      setForm({ orderId: '', driver: '', deliveryDate: '', address: '', status: 'scheduled', notes: '' });
      fetchDeliveries();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ orderId: d.orderId, driver: d.driver || '', deliveryDate: d.deliveryDate || '', address: d.address || '', status: d.status, notes: d.notes || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette livraison ?')) return;
    try { await api.delete(`/deliveries/${id}`); fetchDeliveries(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const openConfirmModal = (d) => {
    setConfirmDelivery(d);
    setConfirmPaymentMethod('cash');
    setShowConfirmModal(true);
  };

  const handleConfirmDelivery = async () => {
    if (!confirmDelivery) return;
    setConfirming(true);
    try {
      await api.post(`/deliveries/${confirmDelivery.id}/confirm`, {
        paymentMethod: confirmPaymentMethod,
      });
      setShowConfirmModal(false);
      setConfirmDelivery(null);
      fetchDeliveries();
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la confirmation');
    } finally {
      setConfirming(false);
    }
  };

  const filtered = deliveries.filter(d =>
    d.driver?.toLowerCase()?.includes(search.toLowerCase()) ||
    d.status?.toLowerCase()?.includes(search.toLowerCase()) ||
    d.order?.sofaModel?.toLowerCase()?.includes(search.toLowerCase()) ||
    (d.order?.items && d.order.items.some(i => i.sofaModel?.toLowerCase()?.includes(search.toLowerCase())))
  );

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Livraisons ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher une livraison..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ orderId: '', driver: '', deliveryDate: '', address: '', status: 'scheduled', notes: '' }); setShowModal(true); }}>
              <Plus size={16} /> Planifier Livraison
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Commande</th><th>Client</th><th>Téléphone</th><th>Adresse</th><th>Modèle</th><th>Chauffeur</th><th>Reste à Payer</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(d => {
              const reste = d.order ? (Number(d.order.totalPrice || 0) - Number(d.order.advancePayment || 0)) : 0;
              const isDelivered = d.status === 'delivered';
              const isFullyPaid = isDelivered || d.order?.paymentStatus === 'fully_paid' || reste <= 0;
              return (
              <tr key={d.id}>
                <td>#{d.id}</td>
                <td>Commande #{d.orderId}</td>
                <td>
                  <span style={{fontWeight:600}}>{d.order?.customer?.name || '—'}</span>
                </td>
                <td>
                  <div style={{fontWeight:500, color:'var(--text-primary)'}}>
                    {d.order?.customer?.phone || '—'}
                  </div>
                </td>
                <td>
                  <div style={{fontSize: '0.85em', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.3'}}>
                    {d.address || d.order?.deliveryAddress || d.order?.customer?.address || 'Non spécifiée'}
                  </div>
                </td>
                <td>
                  {d.order?.items && d.order.items.length > 0 ? (
                    <div style={{fontSize: '0.85em'}}>
                      {d.order.items.map((item, idx) => (
                        <div key={idx}><strong>{item.sofaModel}</strong> x{item.quantity}</div>
                      ))}
                    </div>
                  ) : <span>{d.order?.sofaModel || '—'}</span>}
                </td>
                <td>{d.driver || '—'}</td>
                <td>
                  {isFullyPaid ? (
                    <span style={{fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'3px 10px', borderRadius:20, fontSize:13}}>✓ Payé</span>
                  ) : (
                    <span style={{fontWeight:700, color:'var(--accent-red)'}}>{reste.toLocaleString()} DA</span>
                  )}
                </td>
                <td>{d.deliveryDate || '—'}</td>
                <td><span className={`badge badge-${d.status}`}>{d.status === 'scheduled' ? 'Planifiée' : d.status === 'in_transit' ? 'En transit' : d.status === 'delivered' ? 'Livrée' : d.status === 'cancelled' ? 'Annulée' : 'Échouée'}</span></td>
                <td>
                  <div className="action-buttons">
                    {!isDelivered && (
                      <button
                        className="btn-icon"
                        style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e'}}
                        title="Confirmer livraison & paiement final"
                        onClick={() => openConfirmModal(d)}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button className="btn-icon edit" onClick={() => handleEdit(d)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(d.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )}) : (
              <tr><td colSpan="9" className="table-empty"><Truck size={32} style={{color:'var(--text-muted)'}} /><p>Aucune livraison planifiée</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {showModal && (
        <Modal title={editing ? 'Modifier la Livraison' : 'Planifier une Livraison'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          {!editing && (
            <div className="form-group">
              <label>Commande *</label>
              <select className="form-control" value={form.orderId} onChange={e => setForm({...form, orderId: e.target.value})} required>
                <option value="">Sélectionner une commande</option>
                {orders.filter(o => o.status === 'ready').map(o => <option key={o.id} value={o.id}>#{o.id} - {o.items?.map(i => i.sofaModel).join(', ') || o.sofaModel} ({o.customer?.name})</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Chauffeur</label>
              <input className="form-control" placeholder="Nom du chauffeur" value={form.driver} onChange={e => setForm({...form, driver: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Date de Livraison</label>
              <input className="form-control" type="date" value={form.deliveryDate} onChange={e => setForm({...form, deliveryDate: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="scheduled">Planifiée</option>
              <option value="in_transit">En transit</option>
              <option value="delivered">Livrée</option>
              <option value="failed">Échouée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <textarea className="form-control" placeholder="Adresse de livraison" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
        </Modal>
      )}

      {/* Confirm Delivery & Final Payment Modal */}
      {showConfirmModal && confirmDelivery && (
        <Modal
          title="Confirmer Livraison & Paiement Final"
          onClose={() => setShowConfirmModal(false)}
          onSubmit={handleConfirmDelivery}
        >
          <div style={{background: 'rgba(34, 197, 94, 0.08)', borderRadius: 12, padding: '20px', marginBottom: 16, border: '1px solid rgba(34, 197, 94, 0.2)'}}>
            <p style={{margin: 0, color: 'var(--text-secondary)', fontSize: 14}}>Commande #{confirmDelivery.orderId} — <strong>{confirmDelivery.order?.sofaModel}</strong></p>
            <div style={{display: 'flex', gap: 24, marginTop: 12}}>
              <div>
                <p style={{margin: 0, fontSize: 12, color: 'var(--text-muted)'}}>Prix Total</p>
                <p style={{margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)'}}>{Number(confirmDelivery.order?.totalPrice || 0).toLocaleString()} DA</p>
              </div>
              <div>
                <p style={{margin: 0, fontSize: 12, color: 'var(--text-muted)'}}>Avance Payée</p>
                <p style={{margin: 0, fontSize: 18, fontWeight: 700, color: '#3b82f6'}}>{Number(confirmDelivery.order?.advancePayment || 0).toLocaleString()} DA</p>
              </div>
              <div>
                <p style={{margin: 0, fontSize: 12, color: 'var(--text-muted)'}}>Reste à Payer</p>
                <p style={{margin: 0, fontSize: 22, fontWeight: 800, color: '#22c55e'}}>
                  {Math.max(0, Number(confirmDelivery.order?.totalPrice || 0) - Number(confirmDelivery.order?.advancePayment || 0)).toLocaleString()} DH
                </p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Méthode de Paiement</label>
            <select className="form-control" value={confirmPaymentMethod} onChange={e => setConfirmPaymentMethod(e.target.value)}>
              <option value="cash">Espèces</option>
              <option value="bank_transfer">Virement Bancaire</option>
              <option value="check">Chèque</option>
              <option value="card">Carte Bancaire</option>
            </select>
          </div>

          <div style={{background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, padding: 12, marginTop: 8, border: '1px solid rgba(59, 130, 246, 0.2)'}}>
            <p style={{margin: 0, fontSize: 13, color: 'var(--text-secondary)'}}>
              ✅ La livraison sera marquée comme <strong>Livrée</strong><br/>
              ✅ Le paiement final sera enregistré automatiquement<br/>
              ✅ La commande sera marquée comme <strong>Entièrement Payée</strong>
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
