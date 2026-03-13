import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle } from 'lucide-react';

export default function Inventory() {
  const { hasRole } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '10', price: '', supplier: '' });

  const categoryLabels = {
    wood: 'Carcasse (Bois)',
    screws: 'Quincaillerie (Kenkeri)',
    foam: 'Mousse',
    fabric: 'Tissu',
    legs: 'Pieds',
    leather: 'Cuir',
    sponge: 'Éponge',
    other: 'Autre'
  };

  useEffect(() => { fetchMaterials(); }, []);

  const fetchMaterials = async () => {
    try { const res = await api.get('/materials'); setMaterials(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...form };
      // Handle empty optional fields
      if (payload.price === '') payload.price = null;
      if (payload.supplier === '') payload.supplier = null;

      if (editing) {
        await api.put(`/materials/${editing.id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setShowModal(false); setEditing(null);
      setForm({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '10', price: '', supplier: '' });
      fetchMaterials();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, category: m.category, stock: m.stock, unit: m.unit, minStock: m.minStock, price: m.price || '', supplier: m.supplier || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this material?')) return;
    try { await api.delete(`/materials/${id}`); fetchMaterials(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const isLowStock = (m) => Number(m.stock) <= Number(m.minStock);

  const canManage = hasRole('admin', 'production', 'gerant');

  const lowStockCount = materials.filter(isLowStock).length;
  const filtered = materials.filter(m =>
    m.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    m.category?.toLowerCase()?.includes(search.toLowerCase()) ||
    m.supplier?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      {lowStockCount > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <span><strong>{lowStockCount} article(s)</strong> en dessous du stock minimum</span>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <h2>Matières Premières ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher des articles..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', category: 'other', stock: '', unit: 'pcs', minStock: '10', price: '', supplier: '' }); setShowModal(true); }}>
                <Plus size={16} /> Ajouter Article
              </button>
            )}
          </div>
        </div>
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
                <td>{m.price ? `${Number(m.price)} DH` : '—'}</td>
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
      </div>

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
              <label>Prix (DH)</label>
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
