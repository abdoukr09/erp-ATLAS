import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Factory } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [productions, setProductions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [searchText, setSearchText] = useState(initialSearch);
  const [activeFilters, setActiveFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [workerTypes, setWorkerTypes] = useState([]);
  const [form, setForm] = useState({ 
    orderItemId: '', productModelId: '', notes: '', status: 'in_progress', 
    startTime: '', endTime: '', tasks: []
  });
  const [isStockProduction, setIsStockProduction] = useState(false);

  useEffect(() => { fetchProductions(); fetchOrders(); fetchProductModels(); fetchEmployees(); fetchWorkerTypes(); }, []);

  const fetchProductions = async () => {
    try { const res = await api.get('/production'); setProductions(res.data); } catch (err) { console.error(err); }
  };

  const fetchOrders = async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); } catch (err) { console.error(err); }
  };

  const fetchProductModels = async () => {
    try { const res = await api.get('/product-models'); setProductModels(res.data); } catch (err) { console.error(err); }
  };

  const fetchEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); } catch (err) { console.error('Failed to parse workers'); }
  };

  const fetchWorkerTypes = async () => {
    try { const res = await api.get('/worker-types'); setWorkerTypes(res.data); } catch (err) { console.error(err); }
  };

  // Get the product model for the current form selection
  const getSelectedProductModel = () => {
    if (isStockProduction && form.productModelId) {
      return productModels.find(m => m.id === parseInt(form.productModelId)) || null;
    }
    if (!isStockProduction && form.orderItemId) {
      for (const o of orders) {
        const item = (o.items || []).find(i => i.id == form.orderItemId);
        if (item) {
          const itemName = (item.sofaModel || '').trim().toLowerCase();
          return productModels.find(m => (m.name || '').trim().toLowerCase() === itemName) || null;
        }
      }
    }
    return null;
  };

  // Get decomposed items: if pack, return component items; else return the product itself
  const getProductComponents = () => {
    const pm = getSelectedProductModel();
    if (!pm) return [];
    if (pm.packItems && pm.packItems.length > 0) {
      // Decompose pack into individual items
      const components = [];
      pm.packItems.forEach(pi => {
        const product = pi.product || productModels.find(m => m.id === pi.productId);
        if (product) {
          for (let i = 0; i < pi.quantity; i++) {
            components.push({ ...product, _compIdx: components.length });
          }
        }
      });
      return components;
    }
    return [{ ...pm, _packItemIndex: 0 }];
  };

  // Find tariff for a worker type and a specific product model
  const findTariff = (workerTypeId, productModelId) => {
    if (!productModelId || !workerTypeId) return null;
    const wt = workerTypes.find(t => t.id == workerTypeId);
    if (!wt || !wt.tariffs) return null;
    // Strictly find tariff for the component model
    return wt.tariffs.find(t => t.productModelId == productModelId);
  };

  const handleSubmit = async () => {
    try {
      const sanitizedForm = {
        ...form,
        orderItemId: form.orderItemId === '' ? null : form.orderItemId,
        productModelId: form.productModelId === '' ? null : form.productModelId,
      };
      if (editing) {
        await api.put(`/production/${editing.id}`, sanitizedForm);
      } else {
        await api.post('/production', isStockProduction ? { ...sanitizedForm, orderId: null } : { ...sanitizedForm, productModelId: null });
      }
      setShowModal(false); setEditing(null);
      setForm({ orderItemId: '', productModelId: '', notes: '', status: 'in_progress', tasks: [] });
      fetchProductions();
      fetchOrders();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (p) => {
    setEditing(p);
    const isStock = !p.orderId;
    setIsStockProduction(isStock);

    let pm = null;
    if (isStock && p.productModelId) {
      pm = productModels.find(m => m.id == p.productModelId) || null;
    } else if (!isStock && p.orderItemId) {
      for (const o of orders) {
        const item = (o.items || []).find(i => i.id == p.orderItemId);
        if (item) {
          const itemName = (item.sofaModel || '').trim().toLowerCase();
          pm = productModels.find(m => (m.name || '').trim().toLowerCase() === itemName) || null;
          break;
        }
      }
    }

    let components = [];
    if (pm) {
      if (pm.packItems && pm.packItems.length > 0) {
        pm.packItems.forEach(pi => {
          const product = pi.product || productModels.find(m => m.id === pi.productId);
          if (product) {
            for (let i = 0; i < pi.quantity; i++) {
              components.push({ ...product, _compIdx: components.length });
            }
          }
        });
      } else {
        components.push({ ...pm, _compIdx: 0 });
      }
    }

    const tasks = (p.workerAssignments || []).map(wa => ({
      id: wa.id,
      workerId: wa.workerId,
      workerName: wa.worker?.name || '',
      workerTypeId: wa.workerTypeId || '',
      workerTypeName: wa.workerType?.name || '',
      componentModelId: wa.componentModelId || '',
      componentIndex: wa.componentIndex || 0,
      _compIdx: wa.componentIndex || 0,
      commissionType: wa.commissionType || 'fixed',
      commissionValue: wa.commissionValue || 0,
      completedById: wa.workerId
    }));

    setForm({ 
      orderItemId: p.orderItemId || '', 
      productModelId: p.productModelId || '',
      status: p.status, 
      notes: p.notes || '',
      startDate: p.startDate || '',
      startTime: p.startTime || '',
      endDate: p.endDate || '',
      endTime: p.endTime || '',
      tasks
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/production/${id}`); fetchProductions(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  // Add a worker assignment row for a specific worker type and component
  const addWorkerForType = (workerType, componentModel) => {
    setForm({
      ...form,
      tasks: [...form.tasks, {
        id: Date.now() + Math.random(),
        workerId: '',
        workerName: '',
        workerTypeId: workerType.id,
        workerTypeName: workerType.name,
        componentModelId: componentModel.id,
        componentModelName: componentModel.name,
        _compIdx: componentModel._compIdx,
        commissionType: 'fixed',
        commissionValue: 0,
        completedById: ''
      }]
    });
  };

  const productionFilters = [
    { key: 'status', label: '📋 Statut', options: [
      { value: 'in_progress', label: 'En cours', color: '#3b82f6' },
      { value: 'pending', label: 'En attente', color: '#f59e0b' },
    ]},
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filtered = productions.filter(p => {
    if (p.status === 'completed') return false;
    if (activeFilters.status && p.status !== activeFilters.status) return false;
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      if (!(
        p.worker?.toLowerCase()?.includes(s) ||
        p.orderItem?.sofaModel?.toLowerCase()?.includes(s) ||
        p.productModel?.name?.toLowerCase()?.includes(s) ||
        p.orderItem?.order?.customer?.name?.toLowerCase()?.includes(s)
      )) return false;
    }
    return true;
  });

  // Group worker assignments by type for display in the table
  const getWorkersByType = (production) => {
    if (!production.workerAssignments || production.workerAssignments.length === 0) return null;
    const grouped = {};
    production.workerAssignments.forEach(wa => {
      const typeName = wa.workerType?.name || 'Autre';
      if (!grouped[typeName]) grouped[typeName] = [];
      grouped[typeName].push(wa.worker?.name || '?');
    });
    return grouped;
  };
  
  const formatProductionTime = (p) => {
    if (!p.startDate) return '—';
    const startStr = `${p.startDate}T${p.startTime || '00:00'}`;
    const endStr = p.endDate ? `${p.endDate}T${p.endTime || '00:00'}` : null;
    
    if (!endStr) return <span><span className="badge badge-pending">{p.startTime || '00:00'}</span> (Début)</span>;

    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 2) {
      return <span><span className="badge badge-in_progress">{p.startTime || '00:00'}</span> – <span className="badge badge-completed">{p.endTime || '00:00'}</span></span>;
    } else {
      const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      };
      return (
        <div style={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
          <div>{formatDate(p.startDate)} <span className="badge badge-in_progress">{p.startTime || '00:00'}</span></div>
          <div style={{ color: 'var(--text-muted)', margin: '2px 0' }}>↓</div>
          <div>{formatDate(p.endDate)} <span className="badge badge-completed">{p.endTime || '00:00'}</span></div>
        </div>
      );
    }
  };

  // Get ouvrier-type employees only (exclude vendeur, assistant, gérant, chauffeur)
  const ouvrierEmployees = employees.filter(e => {
    const cat = (e.category || '').toLowerCase();
    return !['vendeur', 'assistant', 'gérant', 'chauffeur'].includes(cat);
  });

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Fabrication ({filtered.length})</h2>
          <div className="table-actions">
            <SmartSearch
              filters={productionFilters}
              onFilterChange={handleFilterChange}
              placeholder="Rechercher par modèle, ouvrier, client..."
            />
            <button className="btn btn-primary" onClick={() => { 
                setEditing(null); 
                setIsStockProduction(false);
                setForm({ orderItemId: '', productModelId: '', notes: '', status: 'in_progress', tasks: [] }); 
                setShowModal(true); 
              }}>
              <Plus size={16} /> Lancer Fabrication
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cible / Commande</th>
              <th>Client</th>
              <th>Modèle</th>
              <th>Horaires</th>
              <th>Ouvriers par Type</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => {
              const workersByType = getWorkersByType(p);
              return (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td 
                    style={{ color: 'var(--accent-blue)', cursor: 'pointer' }}
                    onClick={() => navigate(`/orders?search=${p.orderItem?.id}`)}
                    title="Voir commande"
                  >
                    {p.orderItem ? (
                      <span><strong>#{p.orderItem.id}</strong> ({p.orderItem.sofaModel})</span>
                    ) : (
                      <span className="badge badge-delivered">POUR STOCK</span>
                    )}
                  </td>
                  <td 
                    style={{ fontWeight: 600, color: 'var(--accent-blue)', cursor: 'pointer' }}
                    onClick={() => navigate(`/customers?search=${p.orderItem?.order?.customer?.name}`)}
                    title="Voir client"
                  >
                    {p.orderItem?.order?.customer?.name || '—'}
                  </td>
                  <td style={{fontWeight:600, color:'var(--text-primary)'}}>
                    {p.orderItem?.sofaModel || p.productModel?.name || '—'}
                  </td>
                  <td>{formatProductionTime(p)}</td>
                  <td>
                    {workersByType ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {Object.entries(workersByType).map(([typeName, workers]) => (
                          <div key={typeName} style={{ fontSize: '0.85rem' }}>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.75rem', marginRight: 4 }}>{typeName}</span>
                            {workers.join(', ')}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td><span className={`badge badge-${p.status}`}>{p.status === 'pending' ? 'En attente' : p.status === 'in_progress' ? 'En cours' : 'Terminé'}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => handleEdit(p)}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(p.id)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="7" className="table-empty"><Factory size={32} style={{color:'var(--text-muted)'}} /><p>Aucune fiche de fabrication</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier la Fiche' : 'Nouvelle Fiche'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          {!editing && (
             <>
               <div className="form-group" style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
                 <input type="checkbox" id="isStock" checked={isStockProduction} onChange={e => setIsStockProduction(e.target.checked)} />
                 <label htmlFor="isStock" style={{marginBottom:0, cursor:'pointer'}}>Fabrication pour Stock (sans commande)</label>
               </div>

               {isStockProduction ? (
                 <div className="form-group">
                   <label>Modèle du Catalogue *</label>
                   <select className="form-control" value={form.productModelId} onChange={e => setForm({...form, productModelId: e.target.value})} required>
                     <option value="">Sélectionner un modèle</option>
                     {productModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                 </div>
               ) : (
                 <div className="form-group">
                   <label>Commande / Article *</label>
                     <select className="form-control" value={form.orderItemId} onChange={e => setForm({...form, orderItemId: e.target.value})} required disabled={editing}>
                        <option value="">Sélectionner un article</option>
                        {orders.flatMap(o => (o.items || []).filter(item => item.status === 'pending' || (editing && item.id == form.orderItemId)).map(item => (
                          <option key={item.id} value={item.id}>Cde #{o.id} - {item.sofaModel} ({o.customer?.name})</option>
                        )))}
                      </select>
                 </div>
               )}
             </>
           )}
            <div className="form-group">
              <label>Statut</label>
              <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="pending">En attente</option>
                <option value="in_progress">En cours de fabrication</option>
                <option value="completed">Terminé (Prêt pour Stock)</option>
              </select>
            </div>

            <div className="form-row" style={{ marginTop: '10px' }}>
              <div className="form-group">
                <label>📅 Date Début</label>
                <input 
                  type="date" 
                  className="form-control" 
                  style={{cursor: 'pointer'}}
                  value={form.startDate || ''} 
                  onChange={e => setForm({...form, startDate: e.target.value})} 
                  onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
                />
              </div>
              <div className="form-group">
                <label>🕒 Heure Début</label>
                <input 
                  type="time" 
                  className="form-control" 
                  style={{cursor: 'pointer'}}
                  value={form.startTime || ''} 
                  onChange={e => setForm({...form, startTime: e.target.value})} 
                  onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
                />
              </div>
            </div>

            {form.status === 'completed' && (
              <div className="form-row" style={{ marginTop: '10px' }}>
                <div className="form-group">
                  <label>📅 Date Fin</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    style={{cursor: 'pointer'}}
                    value={form.endDate || ''} 
                    onChange={e => setForm({...form, endDate: e.target.value})} 
                    onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
                  />
                </div>
                <div className="form-group">
                  <label>🕒 Heure Fin</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    style={{cursor: 'pointer'}}
                    value={form.endTime || ''} 
                    onChange={e => setForm({...form, endTime: e.target.value})} 
                    onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
                  />
                </div>
              </div>
            )}
            
            {/* Worker Type Assignment Sections */}
            {(true) && (
              <div style={{marginTop: '20px'}}>
                <label style={{marginBottom: 10, fontWeight:'bold', display:'block', fontSize: '0.95rem', color: 'var(--text-primary)'}}>
                  Assignation des Ouvriers par Type de Tâche
                </label>
                
                {workerTypes.length === 0 ? (
                  <p style={{fontSize:'0.85rem', color:'var(--text-muted)', textAlign:'center', padding:'15px', border:'1px dashed var(--border-color)', borderRadius:'6px'}}>
                    Aucun type d'ouvrier défini. Allez dans Administration → Types d'Ouvriers pour en créer.
                  </p>
                ) : (() => {
                  const components = getProductComponents();
                  if (components.length === 0) return (
                    <p style={{fontSize:'0.85rem', color:'var(--text-muted)', textAlign:'center', padding:'15px', border:'1px dashed var(--border-color)', borderRadius:'6px'}}>
                      Sélectionnez un article ou modèle pour assigner les ouvriers.
                    </p>
                  );
                  const isPack = components.length > 1 || (getSelectedProductModel()?.packItems?.length > 0);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {components.map((comp, compIdx) => (
                        <div key={`${comp.id}-${compIdx}`} style={{
                          border: isPack ? '2px solid var(--primary-color, #6366f1)' : 'none',
                          borderRadius: '12px',
                          padding: isPack ? '12px' : 0,
                          background: isPack ? 'rgba(99, 102, 241, 0.04)' : 'transparent'
                        }}>
                          {isPack && (
                            <div style={{
                              fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px',
                              color: 'var(--primary-color, #6366f1)',
                              display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                              📦 {comp.name}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {workerTypes.map(wt => {
                              const tasksForTypeAndComp = form.tasks.filter(t => 
                                t.workerTypeId == wt.id && 
                                (isPack ? t.componentModelId == comp.id && (t.componentIndex == compIdx || t._compIdx == compIdx) : true)
                              );
                              const tariff = findTariff(wt.id, comp.id);
                              
                              return (
                                <div key={wt.id} style={{
                                  border: '2px solid var(--border-color)',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))'
                                }}>
                                  <div style={{
                                    background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: tasksForTypeAndComp.length > 0 ? '1px solid var(--border-color)' : 'none'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ 
                                        fontWeight: 700, fontSize: '0.9rem', 
                                        color: 'var(--primary-color, #6366f1)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>🔧 {wt.name}</span>
                                      {tariff && (
                                        <span style={{
                                          fontSize: '0.8rem',
                                          padding: '3px 10px',
                                          background: 'rgba(16, 185, 129, 0.15)',
                                          color: '#10b981',
                                          borderRadius: '12px',
                                          fontWeight: 600,
                                          border: '1px solid rgba(16, 185, 129, 0.3)'
                                        }}>
                                          {tariff.paymentType === 'fixed'
                                            ? `${Number(tariff.amount).toLocaleString()} DA/unité`
                                            : `${Number(tariff.amount)}%`
                                          }
                                        </span>
                                      )}
                                      {!tariff && (
                                        <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                          ⚠ Pas de tarif
                                        </span>
                                      )}
                                    </div>
                                    <button type="button" className="btn btn-primary" style={{padding: '4px 10px', fontSize: '0.8rem'}} onClick={() => addWorkerForType(wt, comp)}>
                                      + Ouvrier
                                    </button>
                                  </div>

                                  {tasksForTypeAndComp.length > 0 && (
                                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {tasksForTypeAndComp.map((task) => {
                                        const globalIndex = form.tasks.findIndex(t => t.id == task.id);
                                        return (
                                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <select className="form-control" style={{ flex: 1 }} value={task.completedById || ''} onChange={e => {
                                              const val = e.target.value;
                                              const emp = employees.find(emp => emp.id === parseInt(val));
                                              const newTasks = [...form.tasks];
                                              newTasks[globalIndex].completedById = val;
                                              newTasks[globalIndex].workerId = val;
                                              newTasks[globalIndex].workerName = emp ? emp.name : '';
                                              setForm({...form, tasks: newTasks});
                                            }}>
                                              <option value="">-- Choisir un ouvrier --</option>
                                              {ouvrierEmployees.map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                              ))}
                                            </select>
                                            <button type="button" className="btn-icon danger" onClick={() => {
                                              const newTasks = form.tasks.filter(t => t.id !== task.id);
                                              setForm({...form, tasks: newTasks});
                                            }}><Trash2 size={14} /></button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* The editable assignments UI is active for all stages now, read-only block removed */}
            

            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" placeholder="Notes de fabrication" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
        </Modal>
      )}
    </div>
  );
}
