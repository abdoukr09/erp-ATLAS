import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Truck, CheckCircle } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [locations, setLocations] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [form, setForm] = useState({ 
    orderId: '', driver: '', deliveryDate: '', address: '', status: 'scheduled', notes: '',
    type: 'order', sourceLocationId: '', destLocationId: '', transferItems: [] 
  });

  // Confirm delivery modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDelivery, setConfirmDelivery] = useState(null);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('cash');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { fetchDeliveries(); fetchOrders(); fetchLocations(); fetchProductModels(); }, []);

  const fetchDeliveries = async () => {
    try { const res = await api.get('/deliveries'); setDeliveries(res.data); } catch (err) { console.error(err); }
  };
  const fetchOrders = async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); } catch (err) { console.error(err); }
  };
  const fetchLocations = async () => {
    try { const res = await api.get('/locations'); setLocations(res.data); } catch (err) { console.error(err); }
  };
  const fetchProductModels = async () => {
    try { const res = await api.get('/product-models'); setProductModels(res.data); } catch (err) { console.error(err); }
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
      setForm({ 
        orderId: '', driver: '', deliveryDate: '', address: '', status: 'scheduled', notes: '',
        type: 'order', sourceLocationId: '', destLocationId: '', transferItems: []
      });
      fetchDeliveries();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ 
      orderId: d.orderId || '', 
      driver: d.driver || '', 
      deliveryDate: d.deliveryDate || '', 
      address: d.address || '', 
      status: d.status, 
      notes: d.notes || '',
      type: d.type || 'order',
      sourceLocationId: d.sourceLocationId || '',
      destLocationId: d.destLocationId || '',
      transferItems: d.transferItems || []
    });
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
      if (confirmDelivery.type === 'transfer') {
        // BUG 4 FIX: send only the necessary fields, NOT the full spread
        await api.put(`/deliveries/${confirmDelivery.id}`, {
          status: 'delivered',
          sourceLocationId: confirmDelivery.sourceLocationId || null,
          destLocationId: confirmDelivery.destLocationId || null,
          type: 'transfer',
          driver: confirmDelivery.driver,
          deliveryDate: confirmDelivery.deliveryDate,
        });
        setShowConfirmModal(false);
        setConfirmDelivery(null);
        fetchDeliveries();
        fetchLocations();
      } else {
        await api.post(`/deliveries/${confirmDelivery.id}/confirm`, {
          paymentMethod: confirmPaymentMethod,
        });
        setShowConfirmModal(false);
        setConfirmDelivery(null);
        fetchDeliveries();
        fetchOrders();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la confirmation');
    } finally {
      setConfirming(false);
    }
  };

  const deliveryFilters = [
    { key: 'status', label: '🚚 Statut', options: [
      { value: 'scheduled', label: 'Planifié', color: '#f59e0b' },
      { value: 'in_transit', label: 'En route', color: '#3b82f6' },
      { value: 'delivered', label: 'Livré', color: '#22c55e' },
      { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
    ]},
    { key: 'type', label: '📑 Type', options: [
      { value: 'order', label: 'Livraison Client', color: '#6366f1' },
      { value: 'transfer', label: 'Transfert Interne', color: '#ec4899' },
    ]},
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filtered = deliveries.filter(d => {
    if (activeFilters.type && d.type !== activeFilters.type) return false;
    if (activeFilters.status && d.status !== activeFilters.status) return false;
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      if (!(
        d.driver?.toLowerCase()?.includes(s) ||
        d.status?.toLowerCase()?.includes(s) ||
        d.order?.sofaModel?.toLowerCase()?.includes(s) ||
        d.sourceLocation?.name?.toLowerCase()?.includes(s) ||
        d.destLocation?.name?.toLowerCase()?.includes(s) ||
        (d.order?.items && d.order.items.some(i => i.sofaModel?.toLowerCase()?.includes(s))) ||
        (d.transferItems && d.transferItems.some(ti => ti.productModel?.name?.toLowerCase()?.includes(s)))
      )) return false;
    }
    return true;
  });

  const addTransferItem = () => {
    setForm({
      ...form,
      transferItems: [...form.transferItems, { productModelId: '', quantity: 1 }]
    });
  };

  const removeTransferItem = (index) => {
    const newItems = [...form.transferItems];
    newItems.splice(index, 1);
    setForm({ ...form, transferItems: newItems });
  };

  const updateTransferItem = (index, field, value) => {
    const newItems = [...form.transferItems];
    newItems[index][field] = value;
    setForm({ ...form, transferItems: newItems });
  };
  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Livraisons ({filtered.length})</h2>
          <div className="table-actions">
            <SmartSearch
              filters={deliveryFilters}
              onFilterChange={handleFilterChange}
              placeholder="Rechercher par chauffeur, modèle..."
            />
            <button className="btn btn-primary" onClick={() => { 
                setEditing(null); 
                setForm({ 
                  orderId: '', driver: '', deliveryDate: new Date().toISOString().split('T')[0], 
                  address: '', status: 'scheduled', notes: '', 
                  type: 'order', sourceLocationId: '', destLocationId: '', transferItems: [] 
                }); 
                setShowModal(true); 
              }}>
              <Plus size={16} /> Planifier
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Commande</th><th>Client</th><th>Téléphone</th><th>Adresse</th><th>Modèle(s)</th><th>Trajet</th><th>Chauffeur</th><th>Reste à Payer</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(d => {
              const reste = d.order ? Number(d.order.remainingPayment || 0) : 0;
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
                  {d.type === 'transfer' ? (
                    <div style={{fontSize: '0.85em'}}>
                      {d.transferItems?.map((item, idx) => (
                        <div key={idx}><strong>{item.productModel?.name}</strong> x{item.quantity}</div>
                      ))}
                    </div>
                  ) : d.order?.items && d.order.items.length > 0 ? (
                    <div style={{fontSize: '0.85em'}}>
                      {d.order.items.map((item, idx) => (
                        <div key={idx}><strong>{item.sofaModel}</strong> x{item.quantity}</div>
                      ))}
                    </div>
                  ) : <span>{d.order?.sofaModel || '—'}</span>}
                </td>
                <td>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                     <span className="badge" style={{background: d.sourceLocation ? `${d.sourceLocation.color}15` : 'rgba(100,116,139,0.1)', color: d.sourceLocation?.color || '#64748b'}}>
                       {d.sourceLocation?.name || '🏭 Usine'}
                     </span>
                     <span style={{fontSize: 10, alignSelf: 'center'}}>⬇️</span>
                     <span className="badge" style={{background: d.destLocation ? `${d.destLocation.color}15` : 'rgba(100,116,139,0.1)', color: d.destLocation?.color || '#64748b'}}>
                       {d.type === 'transfer' ? (d.destLocation?.name || '🏭 Usine') : '👤 Client'}
                     </span>
                  </div>
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
                    {!isDelivered && d.type !== 'transfer' && (
                      <button
                        className="btn-icon"
                        style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e'}}
                        title="Confirmer livraison & paiement final"
                        onClick={() => openConfirmModal(d)}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {!isDelivered && d.type === 'transfer' && (
                      <button
                        className="btn-icon"
                        style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e'}}
                        title="Marquer comme Livré (Le stock sera transféré)"
                        onClick={async () => {
                          if (window.confirm("Voulez-vous marquer ce transfert comme Livré ? Le stock sera mis à jour.")) {
                            try {
                               await api.put(`/deliveries/${d.id}`, {
                                 status: 'delivered',
                                 sourceLocationId: d.sourceLocationId || null,
                                 destLocationId: d.destLocationId || null,
                                 type: 'transfer',
                                 driver: d.driver,
                                 deliveryDate: d.deliveryDate,
                               });
                               fetchDeliveries();
                               fetchLocations();
                            } catch (err) {
                               alert(err.response?.data?.error || 'Erreur lors de la confirmation.');
                            }
                          }
                        }}
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px' }}>
              <button 
                type="button"
                className={`btn ${form.type === 'order' ? 'btn-primary' : 'btn-outline'}`} 
                style={{ flex: 1 }}
                onClick={() => setForm({...form, type: 'order'})}
              >
                Livraison Client
              </button>
              <button 
                type="button"
                className={`btn ${form.type === 'transfer' ? 'btn-primary' : 'btn-outline'}`} 
                style={{ flex: 1 }}
                onClick={() => setForm({...form, type: 'transfer'})}
              >
                Transfert Interne
              </button>
            </div>
          )}

          {!editing && form.type === 'order' && (
            <div className="form-group">
              <label>Commande *</label>
              <select className="form-control" value={form.orderId} onChange={e => setForm({...form, orderId: e.target.value})} required>
                <option value="">Sélectionner une commande</option>
                {orders.filter(o => o.status === 'ready').map(o => <option key={o.id} value={o.id}>#{o.id} - {o.items?.map(i => i.sofaModel).join(', ') || o.sofaModel} ({o.customer?.name})</option>)}
              </select>
            </div>
          )}

          {form.type === 'order' && (
             <div className="form-group">
               <label>📍 Source du Stock</label>
               <select className="form-control" value={form.sourceLocationId} onChange={e => setForm({...form, sourceLocationId: e.target.value})}>
                 <option value="">🏠 Usine (Central)</option>
                 {locations.map(loc => (
                   <option key={loc.id} value={loc.id}>{loc.name}</option>
                 ))}
               </select>
             </div>
          )}

          {form.type === 'transfer' && (
            <div style={{ border: '1px dashed var(--border-color)', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>🛫 Source</label>
                  <select className="form-control" value={form.sourceLocationId} onChange={e => setForm({...form, sourceLocationId: e.target.value})}>
                    <option value="">🏠 Usine (Central)</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>🛬 Destination</label>
                  <select className="form-control" value={form.destLocationId} onChange={e => setForm({...form, destLocationId: e.target.value})}>
                    <option value="">🏠 Usine (Central)</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!editing && (
                <>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>📦 Produits à transférer</label>
                  {form.transferItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <select 
                        className="form-control" 
                        style={{ flex: 2 }} 
                        value={item.productModelId} 
                        onChange={e => updateTransferItem(idx, 'productModelId', e.target.value)}
                        required
                      >
                        <option value="">Choisir un modèle</option>
                        {productModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input 
                        className="form-control" 
                        type="number" 
                        style={{ flex: 1 }} 
                        value={item.quantity} 
                        onChange={e => updateTransferItem(idx, 'quantity', e.target.value)}
                        min="1"
                        required 
                      />
                      <button type="button" className="btn-icon danger" onClick={() => removeTransferItem(idx)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline" style={{ width: '100%', fontSize: '0.9em' }} onClick={addTransferItem}>
                    + Ajouter un produit
                  </button>
                </>
              )}
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
      {showConfirmModal && confirmDelivery && confirmDelivery.type === 'order' && (
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
            </div>
            <div style={{background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h4 style={{margin: 0, color: '#ef4444'}}>Reste à encaisser à la livraison</h4>
              <p style={{margin: 0, fontSize: 24, fontWeight: 800, color: '#ef4444'}}>
                {Number(confirmDelivery.order?.remainingPayment || 0).toLocaleString()} DA
              </p>
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
