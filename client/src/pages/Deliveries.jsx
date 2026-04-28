import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Truck, CheckCircle, X, MapPin } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';

const ALGERIAN_WILAYAS = [
  "01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna", "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "09 - Blida", "10 - Bouira",
  "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou", "16 - Alger", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda",
  "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine", "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla",
  "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arreridj", "35 - Boumerdès", "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela",
  "41 - Souk Ahras", "42 - Tipaza", "43 - Mila", "44 - Aïn Defla", "45 - Naâma", "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - El M'Ghair", "50 - El Meniaa",
  "51 - Ouled Djellal", "52 - Bordj Baji Mokhtar", "53 - Béni Abbès", "54 - Timimoun", "55 - Touggourt", "56 - Djanet", "57 - In Salah", "58 - In Guezzam"
];

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [locations, setLocations] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [chauffeurs, setChauffeurs] = useState([]);
  const [form, setForm] = useState({ 
    orderId: '', orderIds: [], driver: '', driverId: '', deliveryDate: '', address: '', status: 'scheduled', notes: '',
    type: 'order', sourceLocationId: '', destLocationId: '', destWilaya: '', transferItems: [] 
  });

  // Confirm delivery modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDelivery, setConfirmDelivery] = useState(null);
  const [confirmResolutions, setConfirmResolutions] = useState({});
  const [confirming, setConfirming] = useState(false);

  // Order selection search state
  const [orderSearchText, setOrderSearchText] = useState('');
  const [orderSearchWilaya, setOrderSearchWilaya] = useState('');

  useEffect(() => { fetchDeliveries(); fetchOrders(); fetchLocations(); fetchProductModels(); fetchChauffeurs(); }, []);

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
  const fetchChauffeurs = async () => {
    try {
      const res = await api.get('/employees');
      setChauffeurs(res.data.filter(e => e.category === 'Chauffeur'));
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      const sanitizedForm = {
        ...form,
        orderId: form.orderId === '' ? null : form.orderId,
        orderIds: form.orderIds.length > 0 ? form.orderIds : (form.orderId ? [form.orderId] : []),
        driverId: form.driverId || null,
        destWilaya: form.type === 'order' ? (form.destWilaya || null) : null,
      };
      if (editing) await api.put(`/deliveries/${editing.id}`, sanitizedForm);
      else await api.post('/deliveries', sanitizedForm);
      setShowModal(false); setEditing(null);
      setForm({ 
        orderId: '', orderIds: [], driver: '', driverId: '', deliveryDate: '', address: '', status: 'scheduled', notes: '',
        type: 'order', sourceLocationId: '', destLocationId: '', destWilaya: '', transferItems: []
      });
      fetchDeliveries();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ 
      orderId: d.orderId || '', 
      orderIds: d.deliveryOrders?.map(dO => dO.order?.id).filter(Boolean) || [],
      driver: d.driver || '', 
      driverId: d.driverId || '',
      deliveryDate: d.deliveryDate || '', 
      address: d.address || '', 
      status: d.status, 
      notes: d.notes || '',
      type: d.type || 'order',
      sourceLocationId: d.sourceLocationId || '',
      destLocationId: d.destLocationId || '',
      destWilaya: d.destWilaya || '',
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
    
    // Initialize resolutions for all orders AND their items
    const initialResolutions = {};
    const deliveryOrders = d.deliveryOrders?.length > 0 ? d.deliveryOrders.map(dO => dO.order).filter(Boolean) : (d.order ? [d.order] : []);
    
    deliveryOrders.forEach(o => {
      const itemStatuses = {};
      o.items?.forEach(item => {
        if (item.status !== 'delivered' && item.status !== 'cancelled') {
          for (let i = 0; i < (item.quantity || 1); i++) {
            itemStatuses[`${item.id}_${i}`] = 'delivered';
          }
        }
      });

      initialResolutions[o.id] = {
        orderId: o.id,
        status: 'delivered', 
        itemStatuses, // Track each item individually
        paymentMethod: 'cash'
      };
    });
    
    setConfirmResolutions(initialResolutions);
    setShowConfirmModal(true);
  };

  const handleConfirmDelivery = async () => {
    if (!confirmDelivery) return;
    setConfirming(true);
    try {
      if (confirmDelivery.type === 'transfer') {
        await api.put(`/deliveries/${confirmDelivery.id}`, {
          status: 'delivered',
          sourceLocationId: confirmDelivery.sourceLocationId || null,
          destLocationId: confirmDelivery.destLocationId || null,
          type: 'transfer',
          driver: confirmDelivery.driver,
          driverId: confirmDelivery.driverId || null,
          deliveryDate: confirmDelivery.deliveryDate,
        });
        setShowConfirmModal(false);
        setConfirmDelivery(null);
        fetchDeliveries();
        fetchLocations();
      } else {
        await api.post(`/deliveries/${confirmDelivery.id}/confirm`, {
          resolutions: Object.values(confirmResolutions)
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
        d.driverEmployee?.name?.toLowerCase()?.includes(s) ||
        d.status?.toLowerCase()?.includes(s) ||
        d.order?.sofaModel?.toLowerCase()?.includes(s) ||
        d.sourceLocation?.name?.toLowerCase()?.includes(s) ||
        d.destLocation?.name?.toLowerCase()?.includes(s) ||
        d.destWilaya?.toLowerCase()?.includes(s) ||
        (d.order?.items && d.order.items.some(i => i.sofaModel?.toLowerCase()?.includes(s))) ||
        (d.transferItems && d.transferItems.some(ti => ti.productModel?.name?.toLowerCase()?.includes(s))) ||
        (d.deliveryOrders && d.deliveryOrders.some(dO => 
          dO.order?.customer?.name?.toLowerCase()?.includes(s) ||
          dO.order?.sofaModel?.toLowerCase()?.includes(s)
        ))
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

  // Toggle an order in the multi-select
  const toggleOrderSelection = (orderId) => {
    const id = Number(orderId);
    setForm(prev => {
      // Force all IDs in orderIds to be Numbers to avoid type mismatch
      const currentIds = prev.orderIds.map(x => Number(x));
      const exists = currentIds.includes(id);
      const newIds = exists ? currentIds.filter(x => x !== id) : [...currentIds, id];
      
      let newDestWilaya = prev.destWilaya;
      if (!exists && newIds.length > 0 && !newDestWilaya) {
        const addedOrder = orders.find(o => Number(o.id) === id);
        if (addedOrder) {
          newDestWilaya = addedOrder.deliveryWilaya || addedOrder.customer?.city || '';
        }
      }
      
      return { ...prev, orderIds: newIds, orderId: newIds[0] || '', destWilaya: newDestWilaya };
    });
  };

  // Get all orders for a delivery (from deliveryOrders junction or fallback to single order)
  const getDeliveryOrders = (d) => {
    if (d.deliveryOrders && d.deliveryOrders.length > 0) {
      return d.deliveryOrders.map(dO => dO.order).filter(Boolean);
    }
    if (d.order) return [d.order];
    return [];
  };

  const filteredModalOrders = orders.filter(o => {
    // ONLY show orders that are fully Ready (Prêt) or partially delivered
    if (o.status !== 'ready' && o.status !== 'partially_delivered') return false;
    const targetWilaya = o.deliveryWilaya || o.customer?.city || '';
    if (orderSearchWilaya && !targetWilaya.includes(orderSearchWilaya) && !(o.deliveryAddress || '').includes(orderSearchWilaya)) return false;
    if (orderSearchText.trim()) {
      const s = orderSearchText.toLowerCase();
      if (!(
        o.id.toString().includes(s) ||
        o.customer?.name?.toLowerCase()?.includes(s) ||
        o.sofaModel?.toLowerCase()?.includes(s) ||
        (o.items && o.items.some(i => i.sofaModel?.toLowerCase()?.includes(s))) ||
        o.customer?.city?.toLowerCase()?.includes(s) ||
        o.deliveryAddress?.toLowerCase()?.includes(s)
      )) return false;
    }
    return true;
  });

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
                  orderId: '', orderIds: [], driver: '', driverId: '', deliveryDate: new Date().toISOString().split('T')[0], 
                  address: '', status: 'scheduled', notes: '', 
                  type: 'order', sourceLocationId: '', destLocationId: '', destWilaya: '', transferItems: [] 
                }); 
                setShowModal(true); 
              }}>
              <Plus size={16} /> Planifier
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Commande(s)</th><th>Client(s)</th><th>Téléphone</th><th>Adresse</th><th>Modèle(s)</th><th>Trajet</th><th>Chauffeur</th><th>Reste à Payer</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(d => {
              const deliveryOrdersList = getDeliveryOrders(d);
              // Sum up remaining payment for ALL orders in this delivery
              const reste = deliveryOrdersList.reduce((sum, o) => sum + Number(o.remainingPayment || 0), 0);
              const isDelivered = d.status === 'delivered';
              const isFullyPaid = isDelivered || (deliveryOrdersList.length > 0 && deliveryOrdersList.every(o => o.paymentStatus === 'fully_paid' || Number(o.remainingPayment || 0) <= 0));
              return (
              <tr key={d.id}>
                <td>#{d.id}</td>
                <td>
                   {deliveryOrdersList.length > 0 ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                       {deliveryOrdersList.map(o => (
                         <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           <span className="badge badge-scheduled" style={{ fontSize: '0.8em', fontWeight: 800, background: '#6366f1', color: '#fff' }}>
                             #{o.id}
                           </span>
                           <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                             ({o.items?.length || 0} art.)
                           </span>
                         </div>
                       ))}
                     </div>
                   ) : d.type === 'transfer' ? (
                     <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>Transfert</span>
                   ) : '—'}
                 </td>
                <td>
                  {deliveryOrdersList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {deliveryOrdersList.map(o => (
                        <div key={o.id} style={{ 
                          padding: '4px 8px', 
                          background: 'rgba(99, 102, 241, 0.04)', 
                          borderRadius: 6,
                          borderLeft: '3px solid #6366f1',
                          fontSize: '0.85em'
                        }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            <span style={{ color: '#6366f1' }}>#{o.id}</span> — {o.customer?.name || 'Client inconnu'}
                          </div>
                          <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                            📞 {o.customer?.phone || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td>
                  {deliveryOrdersList.length > 0 ? (
                    <div style={{ fontSize: '0.85em' }}>
                      {deliveryOrdersList.map(o => (
                        <div key={o.id}>{o.customer?.phone || '—'}</div>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td>
                   <div style={{fontSize: '0.85em', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.3'}}>
                     {deliveryOrdersList.length > 0 ? (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         {deliveryOrdersList.map(o => (
                           <div key={o.id} style={{ borderBottom: deliveryOrdersList.length > 1 ? '1px dashed #eee' : 'none', paddingBottom: 2 }}>
                             <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>#{o.id}:</span> {o.deliveryAddress || o.customer?.address || 'N/A'}
                           </div>
                         ))}
                       </div>
                     ) : (d.address || 'Non spécifiée')}
                     {d.destWilaya && (
                       <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.95em', marginTop: 4, background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                         🚩 {d.destWilaya}
                       </div>
                     )}
                   </div>
                 </td>
                <td>
                  {d.type === 'transfer' ? (
                    <div style={{fontSize: '0.85em'}}>
                      {d.transferItems?.map((item, idx) => (
                        <div key={idx}><strong>{item.productModel?.name}</strong> x{item.quantity}</div>
                      ))}
                    </div>
                   ) : deliveryOrdersList.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {deliveryOrdersList.map(o => (
                        <div key={o.id} style={{ padding: '10px', background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', color: '#1e293b', marginBottom: '8px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                           <span>CMD #{o.id}</span>
                           <span style={{ 
                             textTransform: 'uppercase',
                             color: o.status === 'delivered' ? '#22c55e' : (o.status === 'problem' || o.status === 'partially_delivered' ? '#f59e0b' : 'var(--text-muted)')
                           }}>
                             {o.status === 'partially_delivered' ? 'Partielle' : o.status}
                           </span>
                         </div>
                         {o.items?.filter(item => d.status === 'delivered' || (item.status !== 'delivered' && item.status !== 'cancelled')).map((item, idx) => (
                           <div key={idx} style={{ 
                             fontSize: '13px', 
                             display: 'flex', 
                             justifyContent: 'space-between',
                             padding: '2px 0',
                             borderTop: idx > 0 ? '1px dashed rgba(0,0,0,0.03)' : 'none'
                           }}>
                             <span>• <strong>{item.sofaModel}</strong> <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                             <span style={{ 
                               fontSize: '10px', 
                               fontWeight: 700,
                               color: item.status === 'delivered' ? '#22c55e' : (item.status === 'problem' ? '#ef4444' : 'var(--text-muted)')
                             }}>
                               {item.status === 'delivered' ? '✓' : (item.status === 'problem' ? '⚠️' : '')}
                             </span>
                           </div>
                         )) || <span>{o.sofaModel || '—'}</span>}
                       </div>
                     ))}
                   </div>
                   ) : <span>{d.order?.sofaModel || "—"}</span>}
                 </td>
                 <td>
                   <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                      <span className="badge" style={{background: d.sourceLocation ? `${d.sourceLocation.color}15` : 'rgba(100,116,139,0.1)', color: d.sourceLocation?.color || '#64748b'}}>
                        {d.sourceLocation?.name || '🏭 Usine'}
                      </span>
                      <span style={{fontSize: 10, alignSelf: 'center'}}>⬇️</span>
                      <span className="badge" style={{background: d.destLocation ? `${d.destLocation.color}15` : d.destWilaya ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: d.destLocation?.color || (d.destWilaya ? '#22c55e' : '#64748b')}}>
                        {d.type === 'transfer' 
                          ? (d.destLocation?.name || '🏭 Usine') 
                          : (d.destWilaya || '👤 Client')}
                      </span>
                   </div>
                 </td>
                 <td>
                   <div>
                     <span style={{ fontWeight: 600 }}>{d.driverEmployee?.name || d.driver || '—'}</span>
                     {d.driverEmployee && (
                       <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>🚛 Livreur</div>
                     )}
                   </div>
                 </td>
                 <td>
                   {d.type === 'transfer' ? (
                     <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>—</span>
                   ) : isFullyPaid ? (
                     <span style={{fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'3px 10px', borderRadius:20, fontSize:13}}>✓ Payé</span>
                   ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                       {deliveryOrdersList.map(o => (
                         <div key={o.id} style={{ 
                           fontSize: '12px', 
                           background: Number(o.remainingPayment) > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                           padding: '4px 8px',
                           borderRadius: '6px',
                           color: Number(o.remainingPayment) > 0 ? 'var(--accent-red)' : '#22c55e', 
                           fontWeight: 700 
                         }}>
                           <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>#{o.id}: </span>
                           {Number(o.remainingPayment || 0).toLocaleString()} DA
                         </div>
                       ))}
                       {deliveryOrdersList.length > 1 && (
                         <div style={{ borderTop: '1px solid #eee', marginTop: 4, paddingTop: 4, textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>
                           {reste.toLocaleString()} DA
                         </div>
                       )}
                     </div>
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
                                 driverId: d.driverId || null,
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
              <tr><td colSpan="12" className="table-empty"><Truck size={32} style={{color:'var(--text-muted)'}} /><p>Aucune livraison planifiée</p></td></tr>
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
              <label>Commande(s) * <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>— Sélectionnez une ou plusieurs</span></label>
              
              {/* Selected Orders Tray */}
              {form.orderIds.length > 0 && (
                <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    📦 {form.orderIds.length} COMMANDE{form.orderIds.length > 1 ? 'S' : ''} SÉLECTIONNÉE{form.orderIds.length > 1 ? 'S' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {form.orderIds.map(id => {
                      const o = orders.find(x => x.id === Number(id));
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '30px', border: '1px solid #dee2e6', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>#{id}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{o?.customer?.name || '...'}</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>📞 {o?.customer?.phone || '—'} | 📍 {o?.deliveryWilaya || o?.customer?.city || '—'}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleOrderSelection(id); }}
                            style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', height: '18px', width: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Rechercher par client, modèle, ID..."
                  value={orderSearchText}
                  onChange={(e) => setOrderSearchText(e.target.value)}
                  style={{ flex: 2 }}
                />
                <select
                  className="form-control"
                  value={orderSearchWilaya}
                  onChange={(e) => setOrderSearchWilaya(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Toutes les wilayas</option>
                  {ALGERIAN_WILAYAS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div style={{ 
                border: '1px solid var(--border-color)', borderRadius: '8px', 
                maxHeight: '200px', overflowY: 'auto', padding: '4px',
                background: 'var(--bg-primary)',
              }}>
                {filteredModalOrders.length > 0 ? (
                  filteredModalOrders.map(o => {
                    const isSelected = form.orderIds.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        onClick={() => toggleOrderSelection(o.id)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          marginBottom: '2px',
                          background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ accentColor: '#6366f1', cursor: 'pointer', pointerEvents: 'none' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>#{o.id}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                            {o.items?.map(i => (
                              <span key={i.id} style={{ color: i.status === 'ready' ? '#22c55e' : (i.status === 'problem' ? '#f59e0b' : 'inherit') }}>
                                {i.sofaModel}{i.status === 'ready' ? ' ✓' : ''} 
                              </span>
                            )) || o.sofaModel}
                          </span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.85em' }}>
                            ({o.customer?.name})
                          </span>
                          <span className="badge badge-ready" style={{ marginLeft: 8, fontSize: '0.7em', padding: '2px 6px', background: o.status === 'partially_delivered' ? '#fef3c7' : '#dcfce7', color: o.status === 'partially_delivered' ? '#92400e' : '#166534' }}>
                            {o.status === 'partially_delivered' ? 'Partielle' : 'Prêt'}
                          </span>
                          <span style={{ marginLeft: 8, color: '#22c55e', fontSize: '0.85em', fontWeight: 600 }}>
                            📍 {o.deliveryWilaya || o.customer?.city || '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aucune commande prête trouvée pour cette recherche
                  </div>
                )}
              </div>
              {form.orderIds.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.85em', color: '#6366f1', fontWeight: 600 }}>
                  {form.orderIds.length} commande{form.orderIds.length > 1 ? 's' : ''} sélectionnée{form.orderIds.length > 1 ? 's' : ''}
                </div>
              )}
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

          {form.type === 'order' && (
            <div className="form-group">
              <label>📍 Destination (Wilaya)</label>
              <select
                className="form-control"
                value={form.destWilaya}
                onChange={e => setForm({ ...form, destWilaya: e.target.value })}
              >
                <option value="">Sélectionner une wilaya...</option>
                {ALGERIAN_WILAYAS.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 4 }}>
                Utilisée pour calculer la prime du livreur
              </div>
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
              <label>🚛 Chauffeur / Livreur</label>
              <select
                className="form-control"
                value={form.driverId}
                onChange={e => {
                  const selectedId = e.target.value;
                  const emp = chauffeurs.find(c => c.id == selectedId);
                  setForm({ ...form, driverId: selectedId, driver: emp ? emp.name : '' });
                }}
              >
                <option value="">— Sélectionner un livreur —</option>
                {chauffeurs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!form.driverId && (
                <input 
                  className="form-control" 
                  style={{ marginTop: 8 }} 
                  placeholder="Ou saisir un nom manuellement" 
                  value={form.driver} 
                  onChange={e => setForm({...form, driver: e.target.value})} 
                />
              )}
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
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {(() => {
              const deliveryOrdersList = confirmDelivery.deliveryOrders?.length > 0 
                ? confirmDelivery.deliveryOrders.map(dO => dO.order).filter(Boolean) 
                : (confirmDelivery.order ? [confirmDelivery.order] : []);

              return deliveryOrdersList.map(o => {
                const res = confirmResolutions[o.id] || { status: 'delivered', paymentMethod: 'cash' };
                
                return (
                  <div key={o.id} style={{
                    background: res.status === 'delivered' ? 'rgba(34, 197, 94, 0.08)' : (res.status === 'problem' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)'), 
                    borderRadius: 12, padding: '16px', marginBottom: 16, 
                    border: `1px solid ${res.status === 'delivered' ? 'rgba(34, 197, 94, 0.2)' : (res.status === 'problem' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.2)')}`
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12}}>
                      <div>
                        <span className="badge badge-scheduled" style={{ marginBottom: 4 }}>Commande #{o.id}</span>
                        <p style={{margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--text-primary)'}}>{o.customer?.name}</p>
                        <p style={{margin: 0, fontSize: 13, color: 'var(--text-muted)'}}>📍 {o.deliveryAddress || o.customer?.address}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>STATUT GLOBAL</label>
                        <select 
                          className="form-control" 
                          style={{ width: '160px', padding: '6px', fontSize: '14px',
                            background: res.status === 'delivered' ? '#f0fdf4' : (res.status === 'problem' ? '#fffbeb' : '#fef2f2'),
                            borderColor: res.status === 'delivered' ? '#bbf7d0' : (res.status === 'problem' ? '#fde68a' : '#fecaca'),
                            fontWeight: 600,
                            color: res.status === 'delivered' ? '#166534' : (res.status === 'problem' ? '#92400e' : '#991b1b')
                          }}
                          value={res.status}
                          onChange={e => {
                            const newStatus = e.target.value;
                            const newItemStatuses = {...res.itemStatuses};
                            // Propagate global status to all items if changed to delivered/cancelled
                            Object.keys(newItemStatuses).forEach(itemId => {
                              newItemStatuses[itemId] = newStatus;
                            });
                            setConfirmResolutions({...confirmResolutions, [o.id]: {...res, status: newStatus, itemStatuses: newItemStatuses}});
                          }}
                        >
                          <option value="delivered">✅ Tout est Livré</option>
                          <option value="problem">⚠️ Problèmes (Mixte)</option>
                          <option value="cancelled">❌ Annulée (Total)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '10px', marginTop: 12, border: '1px solid rgba(0,0,0,0.03)' }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Vérification des articles (Unité par Unité)</label>
                      {o.items?.filter(item => item.status !== 'delivered' && item.status !== 'cancelled').flatMap(item => {
                        // Create an array of length item.quantity to show each unit individually
                        const units = Array.from({ length: item.quantity || 1 });
                        return units.map((_, unitIdx) => {
                          const unitKey = `${item.id}_${unitIdx}`;
                          return (
                            <div key={unitKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                              <div style={{ fontSize: 14 }}>
                                <strong>{item.sofaModel}</strong> 
                                {item.quantity > 1 && <span style={{ color: '#6366f1', fontSize: '0.8em', marginLeft: 8, background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: 10 }}>Unité {unitIdx + 1}/{item.quantity}</span>}
                              </div>
                              <select 
                                value={res.itemStatuses?.[unitKey] || 'delivered'}
                                className="form-control"
                                style={{ width: '130px', padding: '2px 6px', height: '28px', fontSize: '12px' }}
                                onChange={e => {
                                  const newItemStatuses = {...res.itemStatuses, [unitKey]: e.target.value};
                                  // If any unit is problem, set master status to problem.
                                  const anyProblem = Object.values(newItemStatuses).some(s => s === 'problem');
                                  const anyCancelled = Object.values(newItemStatuses).some(s => s === 'cancelled');
                                  let newMasterStatus = 'delivered';
                                  if (anyProblem || anyCancelled) newMasterStatus = 'problem';
                                  
                                  setConfirmResolutions({...confirmResolutions, [o.id]: {...res, status: newMasterStatus, itemStatuses: newItemStatuses}});
                                }}
                              >
                                <option value="delivered">✅ Reçu OK</option>
                                <option value="problem">⚠️ Problème</option>
                                <option value="cancelled">❌ Refusé</option>
                              </select>
                            </div>
                          );
                        });
                      })}
                    </div>

                    <div style={{display: 'flex', gap: 24, marginTop: 12}}>
                      <div>
                        <p style={{margin: 0, fontSize: 12, color: 'var(--text-muted)'}}>Prix Total</p>
                        <p style={{margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)'}}>{Number(o.totalPrice || 0).toLocaleString()} DA</p>
                      </div>
                      <div>
                        <p style={{margin: 0, fontSize: 12, color: 'var(--text-muted)'}}>Avance</p>
                        <p style={{margin: 0, fontSize: 15, fontWeight: 600, color: '#3b82f6'}}>{Number(o.advancePayment || 0).toLocaleString()} DA</p>
                      </div>
                    </div>

                    {res.status === 'delivered' && (
                      <div style={{marginTop: 12}}>
                        <div style={{background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                          <span style={{margin: 0, color: '#ef4444', fontSize: 14, fontWeight: 600}}>Reste à encaisser</span>
                          <span style={{margin: 0, fontSize: 18, fontWeight: 800, color: '#ef4444'}}>
                            {Number(o.remainingPayment || 0).toLocaleString()} DA
                          </span>
                        </div>
                        {Number(o.remainingPayment || 0) > 0 && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 12 }}>Méthode de Paiement (Reste)</label>
                            <select 
                              className="form-control" 
                              value={res.paymentMethod} 
                              onChange={e => setConfirmResolutions({...confirmResolutions, [o.id]: {...res, paymentMethod: e.target.value}})}
                              style={{ padding: '6px' }}
                            >
                              <option value="cash">Espèces</option>
                              <option value="bank_transfer">Virement Bancaire</option>
                              <option value="check">Chèque</option>
                              <option value="card">Carte Bancaire</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {res.status === 'problem' && (
                      <div style={{marginTop: 12, padding: 8, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, fontSize: 13, color: '#92400e'}}>
                        La commande sera repassée en <strong>Fabrication</strong> avec une note de réparation. Le stock n'est pas restitué.
                      </div>
                    )}

                    {res.status === 'cancelled' && (
                      <div style={{marginTop: 12, padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, fontSize: 13, color: '#991b1b'}}>
                        La commande sera <strong>Annulée</strong>. Le stock restera dans l'inventaire source.
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <div style={{ 
            marginTop: 20, paddingTop: 15, borderTop: '2px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-secondary)', padding: '15px', borderRadius: '12px'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>TOTAL DU VOYAGE À ENCAISSER</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}> (Uniquement les commandes marquées ✅)</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>
                {(() => {
                  const deliveryOrdersList = confirmDelivery.deliveryOrders?.length > 0 
                    ? confirmDelivery.deliveryOrders.map(dO => dO.order).filter(Boolean) 
                    : (confirmDelivery.order ? [confirmDelivery.order] : []);
                  
                  const totalToCollect = deliveryOrdersList.reduce((sum, o) => {
                    const res = confirmResolutions[o.id];
                    if (res && res.status === 'delivered') {
                      return sum + Number(o.remainingPayment || 0);
                    }
                    return sum;
                  }, 0);
                  return totalToCollect.toLocaleString();
                })()} DA
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
