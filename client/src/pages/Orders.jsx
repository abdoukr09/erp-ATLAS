import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Search, ShoppingCart } from 'lucide-react';

export default function Orders() {
  const { user } = useAuth();
  const isProduction = user?.role === 'production';
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customTotal, setCustomTotal] = useState('');
  const [form, setForm] = useState({
    customerId: '', 
    items: [{ sofaModel: '', quantity: 1, unitPrice: '', fabric: '', color: '' }], 
    salesmen: [], 
    discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', 
    deliveryAddress: '', notes: '', status: 'pending', useStock: false
  });
  const [employees, setEmployees] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const handleCreateQuickCustomer = async (name) => {
    try {
      const res = await api.post('/customers', { name, phone: '', address: '' });
      setCustomers([...customers, res.data]);
      setForm({...form, customerId: res.data.id});
      setCustomerSearch(name);
      setShowCustomerDropdown(false);
    } catch (err) {
      console.error("Quick customer creation failed", err);
    }
  };

  useEffect(() => { fetchOrders(); fetchCustomers(); fetchProductModels(); fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); } catch (err) { console.error(err); }
  };

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
      if (!form.customerId) {
        alert("Veuillez sélectionner ou créer un client.");
        return;
      }

      const blankModel = form.items.some(item => !item.sofaModel || item.sofaModel.trim() === '');
      if (blankModel) {
        alert("Veuillez sélectionner un modèle pour tous les articles.");
        return;
      }

      const baseTotal = form.items.reduce((acc, item) => {
        const qty = parseInt(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const itemDiscount = parseFloat(item.discountPercentage) || 0;
        return acc + (qty * price * (1 - itemDiscount / 100));
      }, 0);
      
      let finalTotal = Math.round(baseTotal * (1 - (parseFloat(form.discountPercentage) || 0) / 100));
      let finalDiscountPct = parseFloat(form.discountPercentage) || 0;

      if (customTotal !== '') {
        const parsedCustom = parseFloat(customTotal);
        if (!isNaN(parsedCustom)) {
          finalTotal = parsedCustom;
          if (baseTotal > 0) {
            finalDiscountPct = ((baseTotal - finalTotal) / baseTotal) * 100;
            if (finalDiscountPct < 0) finalDiscountPct = 0;
          }
        }
      }

      const payload = { ...form, totalPrice: finalTotal, discountPercentage: finalDiscountPct };

      if (editing) {
        await api.put(`/orders/${editing.id}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      setShowModal(false); setEditing(null); setCustomTotal('');
      setForm({ customerId: '', items: [{ sofaModel: '', quantity: 1, unitPrice: '', fabric: '', color: '' }], salesmen: [], discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', deliveryAddress: '', notes: '', status: 'pending', useStock: false });
      fetchOrders();
    } catch (err) { 
      const errMsg = err.response?.data?.details 
        ? err.response.data.details.join(', ') 
        : err.response?.data?.error || 'Transaction Error';
      alert(`Erreur: ${errMsg}`); 
    }
  };

  const calculatePricing = () => {
    const baseTotal = form.items.reduce((acc, item) => {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      const itemDiscount = parseFloat(item.discountPercentage) || 0;
      return acc + (qty * price * (1 - itemDiscount / 100));
    }, 0);

    let finalPrice = baseTotal;
    let globalDiscountPct = parseFloat(form.discountPercentage) || 0;
    
    if (customTotal !== '') {
      finalPrice = parseFloat(customTotal) || 0;
      if (baseTotal > 0) {
        globalDiscountPct = ((baseTotal - finalPrice) / baseTotal) * 100;
        if (globalDiscountPct < 0) globalDiscountPct = 0;
      }
    } else {
      finalPrice = baseTotal * (1 - globalDiscountPct / 100);
    }

    const discountAmount = baseTotal - finalPrice;

    return {
      baseTotal: Math.round(baseTotal),
      finalPrice: Math.round(finalPrice),
      discountAmount: Math.round(discountAmount),
      globalDiscountPct: globalDiscountPct.toFixed(2)
    };
  };

  const handleEdit = (order) => {
    setEditing(order);
    setCustomTotal(order.totalPrice ? String(order.totalPrice) : '');
    setCustomerSearch(order.customer?.name || '');
    setForm({
      customerId: order.customerId, 
      items: order.items || [],
      salesmen: order.salesmen ? order.salesmen.map(s => ({ salesmanId: s.salesmanId, splitPercentage: s.splitPercentage })) : [],
      discountPercentage: order.discountPercentage || 0,
      advancePayment: order.advancePayment || '', paymentMethod: 'cash', 
      deliveryAddress: order.deliveryAddress || '', notes: order.notes || '', status: order.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/orders/${id}`); fetchOrders(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const filtered = orders.filter(o =>
    (o.items && o.items.some(i => i.sofaModel?.toLowerCase()?.includes(search.toLowerCase()))) ||
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
            {!isProduction && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setCustomerSearch(''); setForm({ customerId: '', items: [{ sofaModel: '', quantity: 1, unitPrice: '', fabric: '', color: '' }], salesmen: [], discountPercentage: 0, advancePayment: '', paymentMethod: 'cash', deliveryAddress: '', notes: '', status: 'pending', useStock: false }); setShowModal(true); }}>
                <Plus size={16} /> Nouvelle Commande
              </button>
            )}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Modèle</th>
              <th>Qté</th>
              {isProduction ? <th>Destination (Adresse)</th> : <th>Total / Avance / Reste</th>}
              <th>Statut</th>
              <th>Date</th>
              {!isProduction && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{o.customer?.name || '—'}</td>
                <td>
                  {o.items && o.items.length > 0 ? (
                    <ul style={{margin: 0, paddingLeft: '15px', fontSize: '0.85em'}}>
                      {o.items.map((item, idx) => (
                        <li key={idx}><span style={{fontWeight:600}}>{item.sofaModel}</span></li>
                      ))}
                    </ul>
                  ) : <span style={{color: 'var(--text-muted)'}}>{o.sofaModel || '—'}</span>}
                </td>
                <td>
                  {o.items && o.items.length > 0 ? (
                    <ul style={{margin: 0, paddingLeft: '0px', listStyle: 'none', fontSize: '0.85em'}}>
                      {o.items.map((item, idx) => (
                        <li key={idx}>x{item.quantity}</li>
                      ))}
                    </ul>
                  ) : <span>{o.quantity || '—'}</span>}
                </td>
                <td>
                  {isProduction ? (
                    <div style={{fontSize: '0.85em', color: 'var(--text-secondary)'}}>
                      {o.deliveryAddress || o.customer?.address || 'Adresse au magasin ou non spécifiée'}
                    </div>
                  ) : (
                    <>
                      <div style={{fontWeight:600}}>{Number(o.totalPrice).toLocaleString()} DA</div>
                      {Number(o.discountPercentage) > 0 && (
                        <div style={{fontSize:'0.75em', color:'var(--accent-blue)'}}>Remise: {o.discountPercentage}%</div>
                      )}
                      <div style={{fontSize:'0.85em', color:'var(--text-muted)'}}>
                        Avance: {Number(o.advancePayment || 0).toLocaleString()} DA
                      </div>
                      <div style={{fontSize:'0.85em', fontWeight:600, color: (Number(o.remainingPayment) <= 0 || o.paymentStatus === 'fully_paid') ? 'var(--accent-green)' : 'var(--accent-red)'}}>
                        {(Number(o.remainingPayment) <= 0 || o.paymentStatus === 'fully_paid') 
                          ? 'Versement complet' 
                          : `Reste: ${Number(o.remainingPayment).toLocaleString()} DA`}
                      </div>
                    </>
                  )}
                </td>
                <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status] || o.status}</span></td>
                <td>{o.orderDate}</td>
                {!isProduction && (
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => handleEdit(o)}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(o.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
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
            <div style={{ position: 'relative' }}>
              <input 
                className="form-control" 
                type="text" 
                placeholder="Rechercher ou taper un nouveau client" 
                value={customerSearch} 
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  if (e.target.value === '') setForm({ ...form, customerId: '' });
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              />
              {showCustomerDropdown && (
                <ul style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, 
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
                  borderRadius: '5px', maxHeight: '200px', overflowY: 'auto', padding: 0, margin: '5px 0 0 0', listStyle: 'none',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                    <li key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', background: form.customerId === c.id ? 'var(--accent-blue-transparent)' : 'transparent' }} onClick={() => {
                      setForm({ ...form, customerId: c.id });
                      setCustomerSearch(c.name);
                      setShowCustomerDropdown(false);
                    }}>
                      {c.name}
                    </li>
                  ))}
                  {customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && customerSearch.trim() !== '' && (
                    <li style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: 600 }} onClick={() => handleCreateQuickCustomer(customerSearch)}>
                      [+] Créer "{customerSearch}"
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Vendeurs (Sellsman) - Commission Partagée</label>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px'}}>
              {employees.filter(e => e.category?.toLowerCase().includes('vendeur') || e.category?.toLowerCase().includes('sellsman') || e.category?.toLowerCase().includes('commercial')).map(e => {
                const isChecked = form.salesmen.some(s => s.salesmanId === e.id);
                return (
                  <label key={e.id} style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', padding:'4px 8px', background:'var(--bg-primary)', borderRadius:'5px'}}>
                    <input type="checkbox" checked={isChecked} onChange={e2 => {
                        let newSalesmen = [...form.salesmen];
                        if (e2.target.checked) {
                          newSalesmen.push({ salesmanId: e.id, splitPercentage: 100 / (newSalesmen.length + 1) });
                        } else {
                          newSalesmen = newSalesmen.filter(s => s.salesmanId !== e.id);
                        }
                        newSalesmen = newSalesmen.map(s => ({ ...s, splitPercentage: 100 / newSalesmen.length }));
                        setForm({...form, salesmen: newSalesmen});
                    }} />
                    <span>{e.name}</span>
                  </label>
                );
              })}
            </div>
          </div>


          {/* Multiple Items Section */}
          <div className="form-section" style={{marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '15px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '10px'}}>
              <h3 style={{fontSize: '0.95em', fontWeight: 600}}>Articles / Modèles</h3>
              <button type="button" className="btn btn-secondary btn-sm" style={{padding: '4px 8px', fontSize: '0.85em'}} onClick={() => setForm({...form, items: [...form.items, { sofaModel: '', quantity: 1, unitPrice: '', discountPercentage: 0, color: '' }]})}>
                <Plus size={14} /> Ajouter un modèle
              </button>
            </div>
            {form.items.map((item, index) => (
              <div key={index} className="form-card" style={{background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '10px', position: 'relative'}}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Modèle *</label>
                    <input className="form-control" list="product-models-list" value={item.sofaModel} onChange={e => {
                      const newItems = [...form.items];
                      newItems[index].sofaModel = e.target.value;
                      const model = productModels.find(m => m.name === e.target.value);
                      if (model) newItems[index].unitPrice = model.basePrice;
                      setForm({...form, items: newItems});
                    }} required />
                  </div>
                  <div className="form-group" style={{maxWidth: '100px'}}>
                    <label>Quantité</label>
                    <input className="form-control" type="number" min="1" value={item.quantity} onChange={e => {
                      const newItems = [...form.items];
                      newItems[index].quantity = parseInt(e.target.value) || 1;
                      setForm({...form, items: newItems});
                    }} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Prix Unitaire (DA)</label>
                    <input className="form-control" type="number" value={item.unitPrice} onChange={e => {
                      const newItems = [...form.items];
                      newItems[index].unitPrice = e.target.value;
                      setForm({...form, items: newItems});
                    }} />
                  </div>
                  <div className="form-group" style={{maxWidth: '120px'}}>
                    <label>Remise (%)</label>
                    <input className="form-control" type="number" min="0" max="100" step="0.1" value={item.discountPercentage || 0} onChange={e => {
                      const newItems = [...form.items];
                      newItems[index].discountPercentage = e.target.value;
                      setForm({...form, items: newItems});
                    }} />
                  </div>
                </div>
                {form.items.length > 1 && (
                  <button type="button" className="btn-icon danger" style={{position: 'absolute', top: '10px', right: '10px'}} onClick={() => {
                    const newItems = form.items.filter((_, i) => i !== index);
                    setForm({...form, items: newItems});
                  }}><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
          
          <datalist id="product-models-list">
            {productModels.map(m => <option key={m.id} value={m.name} />)}
          </datalist>

          {!editing && (
            <div className="form-group" style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
              <input type="checkbox" id="useStock" checked={form.useStock} onChange={e => setForm({...form, useStock: e.target.checked})} />
              <label htmlFor="useStock" style={{marginBottom:0, cursor:'pointer'}}>Prendre du stock disponible (si disponible)</label>
            </div>
          )}
          
 <div></div> 
          
          {/* Dashboard-style Pricing Summary */}
          {(() => {
            const pricing = calculatePricing();
            return (
              <div className="form-section" style={{marginTop: '20px', background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                <h3 style={{fontSize: '1.05em', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)'}}>Résumé & Remise Globale</h3>
                
                <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start'}}>
                  
                  <div style={{flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label style={{color: 'var(--text-muted)', fontSize: '0.85em', fontWeight: 600, textTransform: 'uppercase'}}>Total Brut</label>
                    <div style={{fontSize: '1.3em', fontWeight: 600, color: 'var(--text-primary)'}}>{pricing.baseTotal.toLocaleString()} DA</div>
                  </div>

                  <div className="form-group" style={{flex: '2 1 250px', margin: 0}}>
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px'}}>
                      <label style={{margin:0, fontSize: '0.85em', fontWeight: 600}}>Mode de Clôture :</label>
                      <div style={{display: 'flex', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)'}}>
                        <button 
                          type="button"
                          style={{padding: '4px 12px', border: 'none', background: customTotal === '' ? 'var(--accent-blue)' : 'transparent', color: customTotal === '' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85em', transition: 'all 0.2s', fontWeight: customTotal === '' ? 600 : 400}}
                          onClick={() => setCustomTotal('')}
                        >
                          % Remise
                        </button>
                        <button 
                          type="button"
                          style={{padding: '4px 12px', border: 'none', background: customTotal !== '' ? 'var(--accent-blue)' : 'transparent', color: customTotal !== '' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85em', transition: 'all 0.2s', fontWeight: customTotal !== '' ? 600 : 400}}
                          onClick={() => setCustomTotal(pricing.finalPrice.toString())}
                        >
                          Prix Fixe
                        </button>
                      </div>
                    </div>

                    {customTotal === '' ? (
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input 
                          className="form-control" 
                          type="number" 
                          min="0" max="100" step="0.1" 
                          placeholder="Ex: 10"
                          style={{maxWidth: '120px'}}
                          value={form.discountPercentage} 
                          onChange={e => {
                            let val = parseFloat(e.target.value);
                            if (val > 100) val = 100;
                            if (val < 0) val = 0;
                            setForm({...form, discountPercentage: isNaN(val) ? '' : val});
                          }} 
                        />
                        <span style={{fontSize: '0.9em', color: 'var(--text-muted)'}}>% de remise</span>
                      </div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <input 
                            className="form-control" 
                            type="number" 
                            min="0"
                            placeholder="Montant négocié"
                            style={{borderColor: 'var(--accent-blue)', maxWidth: '150px'}}
                            value={customTotal} 
                            onChange={e => {
                              let val = parseFloat(e.target.value);
                              if (val < 0) val = 0;
                              setCustomTotal(isNaN(val) ? '' : val);
                            }} 
                          />
                          <span style={{fontSize: '0.9em', color: 'var(--text-muted)'}}>DA (Forcé)</span>
                        </div>
                        <div style={{fontSize: '0.85em', color: 'var(--accent-blue)', fontWeight: 500}}>
                          Équivaut à une remise de {pricing.globalDiscountPct}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{flex: '1 1 200px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px'}}>
                    {pricing.discountAmount > 0 && (
                      <div style={{color: 'var(--accent-green)', fontSize: '0.9em', marginBottom: '5px', fontWeight: 600}}>
                        Économie: -{pricing.discountAmount.toLocaleString()} DA
                      </div>
                    )}
                    <label style={{color: 'var(--text-muted)', fontSize: '0.85em', fontWeight: 600, textTransform: 'uppercase'}}>Net à Payer</label>
                    <div style={{fontSize: '1.6em', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1}}>{pricing.finalPrice.toLocaleString()} DA</div>
                  </div>

                </div>
              </div>
            );
          })()}
          <div className="form-row">
            <div className="form-group">
              <label>Avance (DA) {editing && <span style={{fontSize: '0.8em', color: 'var(--text-muted)'}}>(Voir Finances)</span>}</label>
              <input className="form-control" type="number" min="0" placeholder="Montant de l'avance" value={form.advancePayment} onChange={e => setForm({...form, advancePayment: e.target.value})} disabled={!!editing} />
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
