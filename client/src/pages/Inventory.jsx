import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';
import ScanButton from '../components/ScanButton';
import { getCachedSnapshot } from '../lib/catalog';
import { queueStockAdjustment } from '../lib/stock';
import { isNative } from '../native';

export default function Inventory() {
  const { hasRole, user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [fromCache, setFromCache] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '1', price: '', supplier: '' });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  // Catégorie: filtrée via SmartSearch (« Filtrer par »)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const categoryLabels = {
    wood: 'Carcasse (Bois)',
    screws: 'Quincaillerie (Kenkeri)',
    foam: 'Mousse',
    fabric: 'Tissu',
    legs: 'Pieds',
    leather: 'Cuir',
    sponge: 'Éponge',
    meuble: 'Meuble',
    other: 'Autre'
  };

  useEffect(() => { fetchMaterials(); }, []);

  const fetchMaterials = async () => {
    try {
      const res = await api.get('/materials');
      const data = res.data.map(m => ({
        ...m,
        stock: Number(m.stock).toString() // Removes trailing zeroes like "10.00" -> "10"
      }));
      setMaterials(data);
      setFromCache(false);
    } catch (err) {
      console.error(err);
      // No network: fall back to the catalogue cached by the last sync, so the
      // depot still sees its stock instead of an empty table.
      const snapshot = await getCachedSnapshot();
      if (snapshot?.materials?.length) {
        setMaterials(snapshot.materials.map(m => ({
          ...m,
          stock: Number(m.stock).toString(),
          minStock: m.minStock ?? 0,
        })));
        setFromCache(true);
      }
    }
  };

  const getMirrorName = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('gauche')) return name.replace(/gauche/gi, 'droite');
    if (lower.includes('droite')) return name.replace(/droite/gi, 'gauche');
    return null;
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...form };
      if (payload.price === '') payload.price = null;
      if (payload.supplier === '') payload.supplier = null;

      if (editing) {
        await api.put(`/materials/${editing.id}`, payload);
      } else {
        await api.post('/materials', payload);

        // Suggest mirror version (gauche ↔ droite)
        const mirrorName = getMirrorName(form.name);
        if (mirrorName) {
          const existing = materials.find(m => m.name.toLowerCase() === mirrorName.toLowerCase());
          if (!existing && confirm(`Voulez-vous aussi créer la version miroir ?\n\n→ "${mirrorName}"\n\n(mêmes propriétés)`)) {
            await api.post('/materials', { ...payload, name: mirrorName });
          }
        }
      }
      setShowModal(false); setEditing(null);
      setForm({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '1', price: '', supplier: '' });
      fetchMaterials();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, category: m.category, stock: m.stock, unit: m.unit, minStock: m.minStock, price: m.price || '', supplier: m.supplier || '' });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try { 
      await api.delete(`/materials/${deleteConfirmId}`); 
      fetchMaterials(); 
    } catch (err) { 
      alert(err.response?.data?.error || 'Error'); 
    }
    setDeleteConfirmId(null);
  };

  const handleStockChange = (m, newStockStr) => {
    // Optimistic UI update while typing, allows "10." or "10.5"
    setMaterials(materials.map(mat => mat.id === m.id ? { ...mat, stock: newStockStr } : mat));
  };

  const handleStockBlur = async (m) => {
    let newStock = Number(m.stock);
    if (isNaN(newStock) || newStock < 0) {
      fetchMaterials(); // Revert invalid input
      return;
    }
    try {
      await api.put(`/materials/${m.id}`, { stock: newStock });
      fetchMaterials(); // Refresh to ensure proper formatting
    } catch (err) {
      console.error(err);
      fetchMaterials();
    }
  };

  const incrementStock = (m) => adjustStock(m, 1);

  const decrementStock = (m) => adjustStock(m, -1);

  const adjustStock = async (m, delta) => {
    const cur = Number(m.stock) || 0;
    const applied = Math.max(0, cur + delta) - cur; // never below zero from a tap
    if (applied === 0) return;

    setMaterials(prev => prev.map(mat =>
      mat.id === m.id ? { ...mat, stock: (cur + applied).toString() } : mat
    ));

    // On the tablet, go through the movement queue: it works offline and adds a
    // delta instead of overwriting whatever the office set meanwhile.
    if (isNative()) {
      const ok = await queueStockAdjustment({
        barcode: m.barcode,
        delta: applied,
        targetType: 'material',
        userId: user?.id,
      });
      if (!ok) {
        alert("Cet article n'a pas de code-barres : impossible d'enregistrer le mouvement.");
        fetchMaterials();
      }
      return;
    }

    try { await api.put(`/materials/${m.id}`, { stock: cur + applied }); fetchMaterials(); }
    catch { fetchMaterials(); }
  };

  const isLowStock = (m) => Number(m.stock) <= Number(m.minStock);

  const canManage = hasRole('admin', 'production', 'gerant');

  const inventoryFilters = [
    { key: 'stockLevel', label: '📦 Stock', options: [
      { value: 'low', label: 'Matières Insuffisantes (Stock Bas)', color: '#ef4444' },
    ]},
    { key: 'category', label: '🏷️ Catégorie', options: Object.entries(categoryLabels).map(([value, label]) => ({ value, label })) },
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filtered = materials.filter(m => {
    if (activeFilters.category && m.category !== activeFilters.category) return false;
    if (activeFilters.stockLevel === 'low' && !isLowStock(m)) return false;
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      if (!(
        m.name?.toLowerCase()?.includes(s) ||
        m.category?.toLowerCase()?.includes(s) ||
        m.supplier?.toLowerCase()?.includes(s)
      )) return false;
    }
    return true;
  });

  const lowStockCount = materials.filter(isLowStock).length;

  return (
    <div className="page-transition">
      {lowStockCount > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <span><strong>{lowStockCount} article(s)</strong> en dessous du stock minimum</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
        <div className="view-toggle" style={{ display: 'flex', gap: '10px' }}>
           <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('table')}>Vue Matière Première</button>
           <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>Vue Recharge Stock</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>
            Matières Premières ({filtered.length})
            {fromCache && (
              <span style={{
                marginLeft: 10, padding: '4px 10px', borderRadius: 8, verticalAlign: 'middle',
                background: 'rgba(180,83,9,.18)', color: '#f59e0b', fontSize: '.75rem', fontWeight: 700,
              }}>
                DONNÉES LOCALES
              </span>
            )}
          </h2>
          <div className="table-actions">
            <SmartSearch
              filters={inventoryFilters}
              onFilterChange={handleFilterChange}
              placeholder="Rechercher matières, catégorie, fournisseur..."
            />
            <ScanButton />
            {canManage && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '1', price: '', supplier: '' }); setShowModal(true); }}>
                <Plus size={16} /> Ajouter Article
              </button>
            )}
          </div>
        </div>
        {viewMode === 'grid' ? (
           <div className="stock-grid" style={{
             display: 'grid',
             gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
             gap: '20px'
           }}>
             {filtered.length > 0 ? filtered.map(m => (
                <div key={m.id} className="stock-card" style={{
                   background: 'var(--bg-secondary)',
                   borderRadius: '12px',
                   padding: '15px',
                   border: isLowStock(m) ? '1px solid var(--accent-red)' : '1px solid var(--border-color)',
                   display: 'flex',
                   flexDirection: 'column',
                   gap: '12px',
                   boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{m.id}</span>
                      <span className="badge badge-scheduled" style={{ fontSize: '0.75rem' }}>{categoryLabels[m.category] || m.category}</span>
                   </div>
                   <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {m.name}
                   </div>
                   <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="btn-icon" onClick={() => decrementStock(m)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', width: '43px', height: '43px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                      <input 
                         type="number" 
                         value={m.stock} 
                         onChange={(e) => handleStockChange(m, e.target.value)} 
                         onBlur={() => handleStockBlur(m)}
                         style={{ 
                            flex: 1, 
                            textAlign: 'center', 
                            padding: '8px', 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontWeight: 'bold',
                            width: '100%',
                            appearance: 'textfield'
                         }} 
                      />
                      <button className="btn-icon" onClick={() => incrementStock(m)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', width: '43px', height: '43px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                   </div>
                </div>
             )) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                   <Package size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
                   <p>Aucun article trouvé</p>
                </div>
             )}
           </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Stock</th>
                <th>Unité</th>
                <th>Stock Min</th>
                <th>Prix</th>
                <th>Fournisseur</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(m => (
                <tr key={m.id} style={isLowStock(m) ? { background: 'rgba(239, 68, 68, 0.05)' } : {}}>
                  <td>#{m.id}</td>
                  <td style={{fontWeight:600, color:'var(--text-primary)'}}>
                    {isLowStock(m) && <AlertTriangle size={14} style={{color:'var(--accent-red)', marginRight:6, verticalAlign:'middle'}} />}
                    {m.name}
                  </td>
                  <td><span className="badge badge-scheduled">{categoryLabels[m.category] || m.category}</span></td>
                  <td style={{fontWeight:600, color: isLowStock(m) ? 'var(--accent-red)' : 'var(--accent-green)'}}>{Number(m.stock)}</td>
                  <td>{m.unit}</td>
                  <td>{Number(m.minStock)}</td>
                  <td>{m.price ? `${Number(m.price)} DA` : '—'}</td>
                  <td>{m.supplier || '—'}</td>
                  {canManage && (
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon edit" onClick={() => handleEdit(m)}><Pencil size={14} /></button>
                        <button className="btn-icon danger" onClick={() => handleDelete(m.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={canManage ? 9 : 8} className="table-empty"><Package size={32} style={{color:'var(--text-muted)'}} /><p>Aucun article en stock</p></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '30px', textAlign: 'center', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <Trash2 size={32} style={{ color: 'var(--accent-red)' }} />
            </div>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '1.3rem' }}>Supprimer l'article</h3>
            <p style={{ margin: '0 0 30px 0', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Êtes-vous sûr de vouloir supprimer cet article ? Cette action est définitive et ne peut pas être annulée.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                className="btn" 
                onClick={handleDeleteConfirm}
                style={{ flex: 1, background: 'var(--accent-red)', color: 'white', border: 'none', padding: '12px 0', fontWeight: 'bold', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                Supprimer
              </button>
              <button 
                className="btn" 
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: '8px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Modifier l'article" : 'Ajouter un article'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom *</label>
            <input className="form-control" placeholder="Nom de l'article" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Catégorie</label>
              <select className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {Object.entries(categoryLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Unité</label>
              <select className="form-control" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                <option value="pcs">Pièces</option>
                <option value="m">Mètres linéaires</option>
                <option value="m²">Mètres carrés</option>
                <option value="kg">Kilogrammes</option>
                <option value="l">Litres</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Stock Actuel</label>
              <input className="form-control" type="number" min="0" placeholder="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Stock Min (Alerte)</label>
              <input className="form-control" type="number" min="0" placeholder="10" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Prix (DA)</label>
              <input className="form-control" type="number" min="0" placeholder="Prix unitaire" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Fournisseur</label>
              <input className="form-control" placeholder="Nom du fournisseur" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
