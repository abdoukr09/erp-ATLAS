import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Search, Book, Settings, Layers } from 'lucide-react';

export default function Catalog() {
  const { hasRole } = useAuth();
  const [models, setModels] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [showModelModal, setShowModelModal] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [activeModel, setActiveModel] = useState(null);
  const [modelForm, setModelForm] = useState({ name: '', category: 'Sofa', description: '', basePrice: '', isPack: false });
  const [bomEntries, setBomEntries] = useState([]);
  const [packEntries, setPackEntries] = useState([]);

  const canManage = hasRole('admin', 'gerant', 'production');

  useEffect(() => {
    fetchModels();
    fetchMaterials();
  }, []);

  const fetchModels = async () => {
    try { const res = await api.get('/product-models'); setModels(res.data); } catch (err) { console.error(err); }
  };

  const fetchMaterials = async () => {
    try { const res = await api.get('/materials'); setMaterials(res.data); } catch (err) { console.error(err); }
  };

  const handleModelSubmit = async () => {
    try {
      // Ensure basePrice is either a valid number or null
      const payload = {
        ...modelForm,
        basePrice: modelForm.basePrice ? parseFloat(modelForm.basePrice) : null
      };
      
      if (editingModel) await api.put(`/product-models/${editingModel.id}`, payload);
      else await api.post('/product-models', payload);
      
      setShowModelModal(false); setEditingModel(null);
      setModelForm({ name: '', category: 'Sofa', description: '', basePrice: '', isPack: false });
      fetchModels();
    } catch (err) { 
      alert(err.response?.data?.error || 'Error'); 
    }
  };

  const handleModelDelete = async (id) => {
    if (!confirm('Désirez-vous supprimer ce modèle ?')) return;
    try { await api.delete(`/product-models/${id}`); fetchModels(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const openBomModal = (model) => {
    setActiveModel(model);
    setBomEntries(model.materials.map(m => ({
      materialId: m.id,
      quantity: m.ModelMaterial.quantity
    })));
    setShowBomModal(true);
  };
  
  const openPackModal = (model) => {
    setActiveModel(model);
    setPackEntries(model.packItems?.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    })) || []);
    setShowPackModal(true);
  };

  const handleBomSubmit = async () => {
    try {
      await api.post(`/product-models/${activeModel.id}/bom`, { materials: bomEntries });
      setShowBomModal(false);
      fetchModels();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handlePackSubmit = async () => {
    try {
      await api.post(`/product-models/${activeModel.id}/pack`, { items: packEntries });
      setShowPackModal(false);
      fetchModels();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const addBomRow = () => setBomEntries([...bomEntries, { materialId: '', quantity: 1 }]);
  const removeBomRow = (index) => setBomEntries(bomEntries.filter((_, i) => i !== index));
  const updateBomRow = (index, field, value) => {
    const newEntries = [...bomEntries];
    newEntries[index][field] = value;
    setBomEntries(newEntries);
  };

  const addPackRow = () => setPackEntries([...packEntries, { productId: '', quantity: 1 }]);
  const removePackRow = (index) => setPackEntries(packEntries.filter((_, i) => i !== index));
  const updatePackRow = (index, field, value) => {
    const newEntries = [...packEntries];
    newEntries[index][field] = value;
    setPackEntries(newEntries);
  };

  const filtered = models.filter(m =>
    m.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    m.category?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Catalogue Produits ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher des modèles..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => { setEditingModel(null); setModelForm({ name: '', category: 'Sofa', description: '', basePrice: '' }); setShowModelModal(true); }}>
                <Plus size={16} /> Nouveau Modèle
              </button>
            )}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom du Modèle</th>
              <th>Catégorie</th>
              <th>Type</th>
              <th>Matières</th>
              <th>Stock</th>
              <th>Prix de Base</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(m => (
              <tr key={m.id}>
                <td>#{m.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{m.name}</td>
                <td><span className="badge badge-scheduled">{m.category}</span></td>
                <td>
                  {m.isPack ? (
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span className="badge badge-blue">Pack ({m.packItems?.length || 0})</span>
                      {canManage && <button className="btn-icon" onClick={() => openPackModal(m)} title="Gérer Contenu Pack"><Layers size={14} /></button>}
                    </div>
                  ) : (
                    <span className="badge badge-pending">Simple</span>
                  )}
                </td>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className="badge badge-delivered">{m.materials?.length || 0} matieres</span>
                    {canManage && <button className="btn-icon" onClick={() => openBomModal(m)} title="Gérer Matières"><Settings size={14} /></button>}
                  </div>
                </td>
                <td style={{textAlign:'center'}}>
                  <span className={`badge ${m.stock > 0 ? 'badge-delivered' : 'badge-pending'}`} style={{fontSize:'1.1em', fontWeight:700}}>
                    {m.stock || 0}
                  </span>
                </td>
                <td style={{fontWeight:700}}>{Number(m.basePrice).toLocaleString()} DH</td>
                {canManage && (
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => { setEditingModel(m); setModelForm({ name: m.name, category: m.category, description: m.description || '', basePrice: m.basePrice, isPack: m.isPack }); setShowModelModal(true); }}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleModelDelete(m.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan="6" className="table-empty"><Book size={32} style={{color:'var(--text-muted)'}} /><p>Aucun modèle trouvé</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModelModal && (
        <Modal title={editingModel ? 'Modifier Modèle' : 'Nouveau Modèle'} onClose={() => setShowModelModal(false)} onSubmit={handleModelSubmit}>
          <div className="form-group">
            <label>Nom du Produit *</label>
            <input className="form-control" placeholder="Ex: Salon L Lemon" value={modelForm.name} onChange={e => setModelForm({...modelForm, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Catégorie</label>
              <input className="form-control" placeholder="Ex: Sofa, Chaise..." value={modelForm.category} onChange={e => setModelForm({...modelForm, category: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Prix de Base (DH)</label>
              <input className="form-control" type="number" value={modelForm.basePrice} onChange={e => setModelForm({...modelForm, basePrice: e.target.value})} />
            </div>
          </div>
          <div className="form-group" style={{flexDirection:'row', display:'flex', alignItems:'center', gap:8, marginBottom:16}}>
            <input type="checkbox" id="isPack" checked={modelForm.isPack} onChange={e => setModelForm({...modelForm, isPack: e.target.checked})} />
            <label htmlFor="isPack" style={{marginBottom:0, cursor:'pointer'}}>C'est un Pack ? (Contient d'autres produits)</label>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" placeholder="Caractéristiques du modèle..." value={modelForm.description} onChange={e => setModelForm({...modelForm, description: e.target.value})} />
          </div>
        </Modal>
      )}

      {showBomModal && (
        <Modal title={`Matières pour: ${activeModel?.name}`} onClose={() => setShowBomModal(false)} onSubmit={handleBomSubmit} submitLabel="Enregistrer BOM">
          <div className="bom-editor">
            <p style={{marginBottom:16, fontSize:14, color:'var(--text-muted)'}}>Définissez les matières premières nécessaires pour fabriquer une unité de ce produit.</p>
            {bomEntries.map((entry, index) => (
              <div key={index} className="form-row" style={{alignItems:'flex-end', marginBottom:12}}>
                <div className="form-group" style={{flex:2}}>
                  <label>Matière Première</label>
                  <select className="form-control" value={entry.materialId} onChange={e => updateBomRow(index, 'materialId', e.target.value)}>
                    <option value="">Choisir...</option>
                    {materials.map(mat => <option key={mat.id} value={mat.id}>{mat.name} ({mat.unit})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex:1}}>
                  <label>Quantité</label>
                  <input className="form-control" type="number" step="0.01" value={entry.quantity} onChange={e => updateBomRow(index, 'quantity', e.target.value)} />
                </div>
                <button type="button" className="btn-icon danger" style={{marginBottom:8}} onClick={() => removeBomRow(index)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{width:'100%', marginTop:8}} onClick={addBomRow}>
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>
        </Modal>
      )}

      {showPackModal && (
        <Modal title={`Contenu du Pack: ${activeModel?.name}`} onClose={() => setShowPackModal(false)} onSubmit={handlePackSubmit} submitLabel="Enregistrer Pack">
          <div className="pack-editor">
            <p style={{marginBottom:16, fontSize:14, color:'var(--text-muted)'}}>Ajoutez les produits qui composent ce pack.</p>
            {packEntries.map((entry, index) => (
              <div key={index} className="form-row" style={{alignItems:'flex-end', marginBottom:12}}>
                <div className="form-group" style={{flex:2}}>
                  <label>Produit</label>
                  <select className="form-control" value={entry.productId} onChange={e => updatePackRow(index, 'productId', e.target.value)}>
                    <option value="">Choisir...</option>
                    {models.filter(m => m.id !== activeModel.id && !m.isPack).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{flex:1}}>
                  <label>Quantité</label>
                  <input className="form-control" type="number" min="1" value={entry.quantity} onChange={e => updatePackRow(index, 'quantity', parseInt(e.target.value) || 1)} />
                </div>
                <button type="button" className="btn-icon danger" style={{marginBottom:8}} onClick={() => removePackRow(index)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{width:'100%', marginTop:8}} onClick={addPackRow}>
              <Plus size={14} /> Ajouter un produit au pack
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

