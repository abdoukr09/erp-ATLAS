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
  const [bomSearch, setBomSearch] = useState('');
  const [bomFocusIndex, setBomFocusIndex] = useState(-1);

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

  const getMirrorName = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('gauche')) return name.replace(/gauche/gi, 'droite');
    if (lower.includes('droite')) return name.replace(/droite/gi, 'gauche');
    return null;
  };

  const handleModelSubmit = async () => {
    try {
      const payload = {
        ...modelForm,
        basePrice: modelForm.basePrice ? parseFloat(modelForm.basePrice) : null
      };
      
      if (editingModel) {
        await api.put(`/product-models/${editingModel.id}`, payload);
      } else {
        await api.post('/product-models', payload);

        // Suggest mirror version (gauche ↔ droite)
        const mirrorName = getMirrorName(modelForm.name);
        if (mirrorName) {
          const existing = models.find(m => m.name.toLowerCase() === mirrorName.toLowerCase());
          if (!existing && confirm(`Voulez-vous aussi créer la version miroir ?\n\n→ "${mirrorName}"\n\n(mêmes propriétés)`)) {
            await api.post('/product-models', { ...payload, name: mirrorName });
          }
        }
      }
      
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
      
      // Mirror BOM suggestion (gauche ↔ droite)
      const mirrorModelName = getMirrorName(activeModel.name);
      if (mirrorModelName) {
        const mirrorModel = models.find(m => m.name.toLowerCase() === mirrorModelName.toLowerCase());
        if (mirrorModel && confirm(`Voulez-vous copier ces matières premières pour "${mirrorModelName}" aussi ?\n\n(Les matières gauche/droite seront automatiquement inversées)`)) {
          // Build mirrored BOM entries
          const mirroredEntries = bomEntries.map(entry => {
            const originalMat = materials.find(m => m.id === parseInt(entry.materialId));
            if (originalMat) {
              const mirrorMatName = getMirrorName(originalMat.name);
              if (mirrorMatName) {
                const mirrorMat = materials.find(m => m.name.toLowerCase() === mirrorMatName.toLowerCase());
                if (mirrorMat) {
                  return { materialId: mirrorMat.id, quantity: entry.quantity };
                }
              }
            }
            // No mirror material found — use same material (shared parts like pieds, mousse)
            return { materialId: entry.materialId, quantity: entry.quantity };
          });
          await api.post(`/product-models/${mirrorModel.id}/bom`, { materials: mirroredEntries });
        }
      }

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
              {canManage && <th>Matières</th>}
              <th>Faisabilité (Prod.)</th>
              <th>Stock (Prêt)</th>
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
                {canManage && (
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span className="badge badge-delivered">{m.materials?.length || 0} matieres</span>
                      <button className="btn-icon" onClick={() => openBomModal(m)} title="Gérer Matières"><Settings size={14} /></button>
                    </div>
                  </td>
                )}
                <td>
                  {m.maxProducible === null || (m.materials && m.materials.length === 0) ? (
                    <span className="badge badge-blue">Achat Direct</span>
                  ) : (
                    <span className={`badge ${m.maxProducible > 0 ? 'badge-delivered' : 'badge-cancelled'}`}>
                      {m.maxProducible > 0 ? `Oui (Max ${m.maxProducible})` : 'Rupture Matière'}
                    </span>
                  )}
                </td>
                <td style={{textAlign:'center'}}>
                  <span className={`badge ${m.stock > 0 ? 'badge-delivered' : 'badge-pending'}`} style={{fontSize:'1.1em', fontWeight:700}}>
                    {m.stock || 0}
                  </span>
                </td>
                <td style={{fontWeight:700}}>{Number(m.basePrice).toLocaleString()} DA</td>
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
              <label>Prix de Base (DA)</label>
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
        <Modal title={`Matières pour: ${activeModel?.name}`} onClose={() => { setShowBomModal(false); setBomSearch(''); }} onSubmit={handleBomSubmit} submitLabel="Enregistrer BOM">
          <div className="bom-editor">
            <p style={{marginBottom:16, fontSize:14, color:'var(--text-muted)'}}>Définissez les matières premières nécessaires pour fabriquer une unité de ce produit.</p>
            {bomEntries.map((entry, index) => {
              const selectedMat = materials.find(m => m.id === parseInt(entry.materialId));
              return (
                <div key={index} className="form-row" style={{alignItems:'flex-end', marginBottom:12}}>
                  <div className="form-group" style={{flex:2, position:'relative'}}>
                    <label>Matière Première</label>
                    <input
                      className="form-control"
                      placeholder="Rechercher une matière..."
                      value={bomFocusIndex === index ? bomSearch : (selectedMat ? `${selectedMat.name} (${selectedMat.unit})` : '')}
                      onChange={e => { setBomSearch(e.target.value); setBomFocusIndex(index); }}
                      onFocus={() => { setBomFocusIndex(index); setBomSearch(''); }}
                    />
                    {bomFocusIndex === index && (
                      <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:8, maxHeight:180, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                        {materials.filter(m => m.name.toLowerCase().includes(bomSearch.toLowerCase())).map(mat => (
                          <div
                            key={mat.id}
                            style={{padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid var(--border-color)'}}
                            onMouseDown={() => { updateBomRow(index, 'materialId', mat.id); setBomFocusIndex(-1); setBomSearch(''); }}
                            onMouseEnter={e => e.target.style.background='var(--bg-hover)'}
                            onMouseLeave={e => e.target.style.background='transparent'}
                          >
                            {mat.name} <span style={{color:'var(--text-muted)'}}>({mat.unit})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label>Quantité</label>
                    <input className="form-control" type="number" step="0.01" value={entry.quantity} onChange={e => updateBomRow(index, 'quantity', e.target.value)} />
                  </div>
                  <button type="button" className="btn-icon danger" style={{marginBottom:8}} onClick={() => removeBomRow(index)}><Trash2 size={14} /></button>
                </div>
              );
            })}
            <button type="button" className="btn btn-ghost" style={{width:'100%', marginTop:8}} onClick={addBomRow}>
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>
        </Modal>
      )}

      {showPackModal && (
        <Modal title={`Contenu du Pack: ${activeModel?.name}`} onClose={() => setShowPackModal(false)} onSubmit={handlePackSubmit} submitLabel="Enregistrer Pack">
          <div className="pack-editor">
            <div style={{background:'rgba(59,130,246,0.08)', borderRadius:8, padding:'10px 14px', marginBottom:16, border:'1px solid rgba(59,130,246,0.2)', fontSize:13, color:'var(--text-secondary)'}}>
              ℹ️ Les <strong>matières premières du pack</strong> seront automatiquement calculées comme la <strong>somme des matières</strong> de chaque produit × sa quantité dans le pack.
            </div>
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

