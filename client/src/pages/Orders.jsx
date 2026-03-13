import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, ShoppingCart } from 'lucide-react';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    customerId: '', sofaModel: '', quantity: 1, unitPrice: '', 
    discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', 
    deliveryAddress: '', notes: '', status: 'pending', useStock: false
  });

  useEffect(() => { fetchOrders(); fetchCustomers(); fetchProductModels(); }, []);

  const fetchOrders = async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try { const res = await api.get('/customers'); setCustomers(res.data); } catch (err) { console.error(err); }
  };

  const fetchProductModels = async () => {
    try { const res = await api.get('/product-models'); setProductModels(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await api.put(`/orders/${editing.id}`, form);
      } else {
        await api.post('/orders', form);
      }
      setShowModal(false); setEditing(null);
      setForm({ customerId: '', sofaModel: '', quantity: 1, unitPrice: '', discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', deliveryAddress: '', notes: '', status: 'pending', useStock: false });
      fetchOrders();
      fetchOrders();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (order) => {
    setEditing(order);
    setForm({
      customerId: order.customerId, sofaModel: order.sofaModel,
      quantity: order.quantity, unitPrice: order.unitPrice,
      discountPercentage: order.discountPercentage || 0,
      advancePayment: order.advancePayment || '', paymentMethod: 'cash', 
      deliveryAddress: order.deliveryAddress || '', notes: order.notes || '', status: order.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this order?')) return;
    try { await api.delete(`/orders/${id}`); fetchOrders(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const filtered = orders.filter(o =>
    o.sofaModel?.toLowerCase()?.includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    o.status?.toLowerCase()?.includes(search.toLowerCase())
  );

  const statusLabels = {
    pending: 'En attente',
    in_production: 'En fabrication',
    ready: 'Prêt',
    delivered: 'Livré',
    cancelled: 'Annulé'
  };

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Commandes ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ customerId: '', sofaModel: '', quantity: 1, unitPrice: '', discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', deliveryAddress: '', notes: '', status: 'pending', useStock: false }); setShowModal(true); }}>
              <Plus size={16} /> Nouvelle Commande
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Modèle</th>
              <th>Qté</th>
              <th>Total / Avance / Reste</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{o.customer?.name || '—'}</td>
                <td>{o.sofaModel}</td>
                <td>{o.quantity}</td>
                <td>
                  <div style={{fontWeight:600}}>{Number(o.totalPrice).toLocaleString()} DA</div>
                  {Number(o.discountPercentage) > 0 && (
                    <div style={{fontSize:'0.75em', color:'var(--accent-blue)'}}>Remise: {o.discountPercentage}%</div>
                  )}
                  <div style={{fontSize:'0.85em', color:'var(--text-muted)'}}>
                    Avance: {Number(o.advancePayment || 0).toLocaleString()} DH
                  </div>
                  <div style={{fontSize:'0.85em', fontWeight:600, color: (Number(o.totalPrice) <= Number(o.advancePayment || 0)) ? 'var(--accent-green)' : 'var(--accent-red)'}}>
                    {(Number(o.totalPrice) <= Number(o.advancePayment || 0)) 
                      ? 'Versement complet' 
                      : `Reste: ${(Number(o.totalPrice) - Number(o.advancePayment || 0)).toLocaleString()} DA`}
                  </div>
                </td>
                <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status] || o.status}</span></td>
                <td>{o.orderDate}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon edit" onClick={() => handleEdit(o)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(o.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" className="table-empty"><ShoppingCart size={32} style={{color:'var(--text-muted)'}} /><p>Aucune commande trouvée</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier la Commande' : 'Nouvelle Commande'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Client *</label>
            <select className="form-control" value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} required>
              <option value="">Sélectionner un client</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Modèle *</label>
              <input className="form-control" list="product-models-list" placeholder="Saisir ou sélectionner un modèle..." value={form.sofaModel} onChange={e => {
                const val = e.target.value;
                const model = productModels.find(m => m.name === val);
                setForm({...form, sofaModel: val, unitPrice: model?.basePrice || form.unitPrice});
              }} required />
              <datalist id="product-models-list">
                {productModels.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Quantité</label>
              <input className="form-control" type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 1})} />
            </div>
          </div>
          {!editing && (
            <div className="form-group" style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
              <input type="checkbox" id="useStock" checked={form.useStock} onChange={e => setForm({...form, useStock: e.target.checked})} />
              <label htmlFor="useStock" style={{marginBottom:0, cursor:'pointer'}}>Prendre du stock disponible (si disponible)</label>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Prix unitaire (DA)</label>
              <input className="form-control" type="number" min="0" placeholder="Prix par unité" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Remise (%)</label>
              <input className="form-control" type="number" min="0" max="100" value={form.discountPercentage} onChange={e => setForm({...form, discountPercentage: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Total après remise: <span style={{color:'var(--accent-blue)', fontWeight:700}}>{( (parseInt(form.quantity) || 1) * (parseFloat(form.unitPrice) || 0) * (1 - (parseFloat(form.discountPercentage) || 0) / 100) ).toLocaleString()} DA</span></label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Avance (DA)</label>
              <input className="form-control" type="number" min="0" placeholder="Montant de l'avance" value={form.advancePayment} onChange={e => setForm({...form, advancePayment: e.target.value})} />
            </div>
          </div>
          {!editing && (
            <div className="form-row">
              <div className="form-group">
                <label>Mode de paiement (Avance)</label>
                <select className="form-control" value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}>
                  <option value="cash">Espèces</option>
                  <option value="bank_transfer">Virement Bancaire</option>
                  <option value="check">Chèque</option>
                  <option value="card">Carte Bancaire</option>
                </select>
              </div>
            </div>
          )}
          {editing && (
            <div className="form-group">
              <label>Statut</label>
              <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="pending">En attente</option>
                <option value="in_production">En fabrication</option>
                <option value="ready">Prêt</option>
                <option value="delivered">Livré</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Adresse de Livraison</label>
            <textarea className="form-control" placeholder="Adresse complète" value={form.deliveryAddress} onChange={e => setForm({...form, deliveryAddress: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" placeholder="Notes de la commande" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </Modal>
      )}
    </div>
  );
}
