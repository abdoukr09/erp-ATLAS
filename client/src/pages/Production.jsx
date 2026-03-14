import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, Factory } from 'lucide-react';



export default function Production() {
  const [productions, setProductions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ orderId: '', productModelId: '', stage: 'fabrication', worker: '', status: 'in_progress', notes: '', completedById: '' });

  useEffect(() => { fetchProductions(); fetchOrders(); fetchProductModels(); fetchEmployees(); }, []);

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
  }

  const handleSubmit = async () => {
    try {
      const sanitizedForm = {
        ...form,
        orderId: form.orderId === '' ? null : form.orderId,
        productModelId: form.productModelId === '' ? null : form.productModelId,
        completedById: form.completedById === '' ? null : form.completedById
      };
      if (editing) {
        // If marking as completed
        if (form.status === 'completed') {
          if (!confirm('Attention: Marquer cette fiche comme terminée la rendra "Prêt" dans le Stock Produits Finis. Continuer ?')) return;
        }
        await api.put(`/production/${editing.id}`, sanitizedForm);
      } else {
        await api.post('/production', isStockProduction ? { ...sanitizedForm, orderId: null } : { ...sanitizedForm, productModelId: null });
      }
      setShowModal(false); setEditing(null);
      setForm({ orderId: '', productModelId: '', stage: 'fabrication', worker: '', status: 'in_progress', notes: '', completedById: '' });
      fetchProductions();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (p) => {
    setEditing(p);
    setIsStockProduction(!p.orderId);
    setForm({ 
      orderId: p.orderId || '', 
      productModelId: p.productModelId || '',
      stage: p.stage, 
      worker: p.worker || '', 
      status: p.status, 
      notes: p.notes || '',
      completedById: p.completedById || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this production record?')) return;
    try { await api.delete(`/production/${id}`); fetchProductions(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const filtered = productions.filter(p => {
    // Hide completed productions
    if (p.status === 'completed') return false;
    
    const s = search.toLowerCase();
    return (
      p.worker?.toLowerCase()?.includes(s) ||
      p.order?.sofaModel?.toLowerCase()?.includes(s) ||
      p.productModel?.name?.toLowerCase()?.includes(s) ||
      p.order?.customer?.name?.toLowerCase()?.includes(s)
    );
  });

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Fabrication ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { 
                setEditing(null); 
                setIsStockProduction(false);
                setForm({ orderId: '', productModelId: '', stage: 'fabrication', worker: '', status: 'in_progress', notes: '', completedById: '' }); 
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
              <th>Ouvrier (Acheminement)</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>
                  {p.orderId ? (
                    <span style={{fontWeight:600}}>Cde #{p.orderId}</span>
                  ) : (
                    <span className="badge badge-delivered">POUR STOCK</span>
                  )}
                </td>
                <td>{p.order?.customer?.name || '—'}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>
                  {p.order?.sofaModel || p.productModel?.name || '—'}
                </td>
                <td>{p.worker || '—'}</td>
                <td><span className={`badge badge-${p.status}`}>{p.status === 'pending' ? 'En attente' : p.status === 'in_progress' ? 'En cours' : 'Terminé'}</span></td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon edit" onClick={() => handleEdit(p)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" className="table-empty"><Factory size={32} style={{color:'var(--text-muted)'}} /><p>Aucune fiche de fabrication</p></td></tr>
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
                   <label>Commande *</label>
                    <select className="form-control" value={form.orderId} onChange={e => setForm({...form, orderId: e.target.value})} required>
                      <option value="">Sélectionner une commande</option>
                      {orders.filter(o => o.status === 'pending').map(o => <option key={o.id} value={o.id}>#{o.id} - {o.sofaModel} ({o.customer?.name})</option>)}
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
            
            {form.status === 'completed' && (
              <div className="form-group alert-info" style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '15px', borderRadius: '8px'}}>
                 <label style={{color: '#059669', marginBottom: '8px', display: 'block'}}><strong>Ouvrier récompensé (Optionnel)</strong></label>
                 <select className="form-control" value={form.completedById} onChange={e => setForm({...form, completedById: e.target.value})}>
                    <option value="">-- Ne créditer aucun employé --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.category})</option>)}
                 </select>
                 <p style={{fontSize: '0.8rem', marginTop: '8px', marginBottom: 0, color: 'var(--text-muted)'}}>
                    En sélectionnant un employé, ce produit sera ajouté à sa fiche de production mensuelle dans la rubrique <strong>Personnel & Paie</strong> pour le calcul des primes.
                 </p>
              </div>
            )}

            {form.status !== 'completed' && (
              <div className="form-group">
                <label>Nom ou Note d'Ouvrier (Libre)</label>
                <input className="form-control" placeholder="Acheminé vers..." value={form.worker} onChange={e => setForm({...form, worker: e.target.value})} />
              </div>
            )}
            
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" placeholder="Notes de fabrication" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </Modal>
      )}
    </div>
  );
}
