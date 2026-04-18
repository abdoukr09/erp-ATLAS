import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Box, MapPin, Settings } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';

export default function FinishedProducts() {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin', 'gerant', 'production');
  const [orders, setOrders] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  
  const [showStockModal, setShowStockModal] = useState(false);
  const [activeModel, setActiveModel] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: '' });

  // Multi-location state
  const [activeTab, setActiveTab] = useState('general');
  const [locations, setLocations] = useState([]);
  const [locationStocks, setLocationStocks] = useState([]);
  const [locationForm, setLocationForm] = useState({ name: '', color: '#3b82f6' });
  const [editingLocation, setEditingLocation] = useState(null);

  // Transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ productModelId: '', quantity: 1, sourceLocationId: '', destLocationId: '' });
  const [transferingModelName, setTransferingModelName] = useState('');

  useEffect(() => { fetchData(); fetchLocationData(); }, []);

  const fetchData = async () => {
    try {
      const [ordRes, modRes] = await Promise.all([
        api.get('/orders'),
        api.get('/product-models')
      ]);
      setOrders(ordRes.data.filter(o => 
        o.status !== 'cancelled' && 
        o.status !== 'delivered' && 
        o.items && 
        o.items.some(i => i.status === 'ready')
      ));
      setProductModels(modRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocationData = async () => {
    try {
      const [locRes, stockRes] = await Promise.all([
        api.get('/locations'),
        api.get('/locations/stock')
      ]);
      setLocations(locRes.data);
      setLocationStocks(stockRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openStockModal = (model) => {
    setActiveModel(model);
    setStockForm({ quantity: '' });
    setShowStockModal(true);
  };

  const handleStockSubmit = async () => {
    if (!stockForm.quantity) return;
    try {
      await api.put(`/product-models/${activeModel.id}/stock`, { quantityToAdd: parseInt(stockForm.quantity) });
      setShowStockModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleLocationSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!locationForm.name) return;
    try {
      if (editingLocation) {
        await api.put(`/locations/${editingLocation.id}`, locationForm);
      } else {
        await api.post('/locations', locationForm);
      }
      setEditingLocation(null);
      setLocationForm({ name: '', color: '#3b82f6' });
      fetchLocationData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleTransferSubmit = async () => {
    try {
      await api.post('/deliveries/quick-transfer', transferForm);
      setShowTransferModal(false);
      fetchLocationData();
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Erreur lors du transfert'); }
  };

  const deleteLocation = async (id) => {
    if (!window.confirm('Supprimer cet emplacement ?')) return;
    try {
      await api.delete(`/locations/${id}`);
      fetchLocationData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  // Filters for Vue Générale: no location filter (it's meaningless in catalog view)
  const generalFilters = [
    { 
      key: 'prodState', 
      label: 'État de Production',
      options: [
        { value: 'insufficient', label: 'Matières Insuffisantes (Rupture)', color: '#ef4444' },
        { value: 'zero_producible', label: '0 Stock + Peut être fabriqué', color: '#3b82f6' },
        { value: 'zero_rupture', label: '0 Stock + Matières en Rupture', color: '#f59e0b' },
        { value: 'available_safe', label: 'En Stock + Matières OK', color: '#22c55e' },
        { value: 'stock_rupture', label: 'En Stock + Matières en Rupture', color: '#ef4444' },
      ]
    }
  ];

  // Filters for Par Emplacement: both production state AND location
  const localFilters = [
    {
      key: 'prodState',
      label: 'État de Production',
      options: [
        { value: 'insufficient', label: 'Matières Insuffisantes (Rupture)', color: '#ef4444' },
        { value: 'zero_producible', label: '0 Stock + Peut être fabriqué', color: '#3b82f6' },
        { value: 'zero_rupture', label: '0 Stock + Matières en Rupture', color: '#f59e0b' },
        { value: 'available_safe', label: 'En Stock + Matières OK', color: '#22c55e' },
        { value: 'stock_rupture', label: 'En Stock + Matières en Rupture', color: '#ef4444' },
      ]
    },
    {
      key: 'location',
      label: '📍 Emplacement',
      options: [
        { value: 'usine', label: 'Usine (Central)', color: '#64748b' },
        ...locations.map(loc => ({ value: loc.id.toString(), label: loc.name, color: loc.color }))
      ]
    }
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filteredOrders = orders.filter(o => {
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      if (!(
        o.sofaModel?.toLowerCase()?.includes(s) ||
        o.customer?.name?.toLowerCase()?.includes(s) ||
        (o.items && o.items.some(i => i.sofaModel?.toLowerCase()?.includes(s)))
      )) return false;
    }
    return true;
  });

  const filteredModels = productModels.filter(m => {
    if (activeFilters.prodState) {
      const stock = Number(m.stock || 0);
      const max = Number(m.maxProducible || 0);
      switch (activeFilters.prodState) {
        case 'insufficient': if (max > 0) return false; break;
        case 'zero_producible': if (!(stock === 0 && max > 0)) return false; break;
        case 'zero_rupture': if (!(stock === 0 && max === 0)) return false; break;
        case 'available_safe': if (!(stock > 0 && max > 0)) return false; break;
        case 'stock_rupture': if (!(stock > 0 && max === 0)) return false; break;
      }
    }
    if (searchText.trim()) return m.name?.toLowerCase()?.includes(searchText.toLowerCase());
    return true;
  });

  const getUsineStock = (modelId, globalStock) => {
    const locTotal = locationStocks
      .filter(ls => ls.productModelId === modelId)
      .reduce((sum, ls) => sum + (Number(ls.quantity) || 0), 0);
    return Math.max(0, globalStock - locTotal);
  };

  const filteredLocationStocks = locationStocks.filter(ls => {
    if (searchText.trim() && !ls.productModel?.name?.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (activeFilters.location && activeFilters.location !== ls.locationId.toString()) return false;
    return true;
  });

  const displayUsineStock = activeFilters.location ? activeFilters.location === 'usine' : true;

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('general')}>Vue Générale & Catalog</button>
          <button className={`btn ${activeTab === 'local' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('local')}><MapPin size={16} /> Par Emplacement</button>
          <button className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('manage')}><Settings size={16} /> Gestion des Emplacements</button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        {activeTab === 'general' && (
          <SmartSearch filters={generalFilters} onFilterChange={handleFilterChange} placeholder="Rechercher par modèle, client..." />
        )}
        {activeTab === 'local' && (
          <SmartSearch filters={localFilters} onFilterChange={handleFilterChange} placeholder="Rechercher par modèle ou emplacement..." />
        )}
        {activeTab === 'manage' && (
          <SmartSearch filters={[]} onFilterChange={handleFilterChange} placeholder="Rechercher un emplacement..." />
        )}
      </div>

      {activeTab === 'general' && (
        <div className="table-container">
          <div className="table-header"><h2>Commandes Prêtes ({filteredOrders.length})</h2></div>
          <table>
            <thead><tr><th>ID Commande</th><th>Client</th><th>Adresse & Contact</th><th>Modèle</th><th>Qté</th><th>Statut</th></tr></thead>
            <tbody>
              {filteredOrders.length > 0 ? filteredOrders.map(o => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td style={{ fontWeight: 600 }}>{o.customer?.name || '—'}{o.customer?.phone && <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>{o.customer.phone}</div>}</td>
                  <td><div style={{fontSize: '0.85em', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.3'}}>{o.deliveryAddress || o.customer?.address || 'Non spécifiée'}</div></td>
                  <td>{o.items?.filter(i => i.status === 'ready').map((item, idx) => <div key={idx} style={{fontSize:'0.9em', fontWeight: 600}}>{item.sofaModel}</div>) || o.sofaModel}</td>
                  <td>{o.items?.filter(i => i.status === 'ready').map((item, idx) => <div key={idx} style={{fontSize:'0.9em'}}>x{item.quantity}</div>) || o.quantity}</td>
                  <td><span className="badge" style={{background: 'rgba(34,197,94,0.15)', color:'#22c55e'}}>{o.status === 'ready' ? 'Prêt' : 'Partiel'}</span></td>
                </tr>
              )) : <tr><td colSpan="6" className="table-empty">Aucune commande prête</td></tr>}
            </tbody>
          </table>
          <div className="table-header" style={{ marginTop: '30px' }}><h2>Stock de Modèles (Catalog) ({filteredModels.length})</h2></div>
          <table>
            <thead><tr><th>Modèle</th><th>Catégorie</th><th>Capacité de Prod.</th><th>Total Entreprise</th><th>Dont à l'Usine</th><th>Prix Base</th></tr></thead>
            <tbody>
              {filteredModels.map(m => {
                const globalStock = m.stock || 0;
                const usineStock = getUsineStock(m.id, globalStock);
                const maxProd = m.maxProducible || 0;
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.category || '—'}</td>
                    <td><span style={{fontWeight:500, color: maxProd > 0 ? '#22c55e' : '#ef4444'}}>{maxProd > 0 ? `Oui, max(${maxProd})` : 'Non (Rupture)'}</span></td>
                    <td><div style={{display:'flex', alignItems:'center', gap:8}}><span className="badge" style={{background: globalStock > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: globalStock > 0 ? '#22c55e' : '#ef4444'}}>{globalStock}</span>{canManage && <button className="btn-icon edit" onClick={() => openStockModal(m)}><Box size={14} /></button>}</div></td>
                    <td><span className="badge" style={{background: usineStock > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: usineStock > 0 ? '#22c55e' : '#ef4444'}}>{usineStock}</span></td>
                    <td>{m.basePrice} DA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'local' && (
        <div className="table-container">
          <div className="table-header"><h2>Répartition par Emplacement</h2></div>
          <table>
            <thead><tr><th>Emplacement</th><th>Modèle</th><th>Quantité Locale</th><th>Total en Entreprise</th><th style={{width: 60}}>Actions</th></tr></thead>
            <tbody>
              {displayUsineStock && filteredModels.filter(m => getUsineStock(m.id, m.stock) > 0).map(m => (
                <tr key={`usine-${m.id}`}>
                   <td><span className="badge" style={{background: 'rgba(100,116,139,0.15)', color: '#64748b'}}>🏭 Usine</span></td>
                   <td style={{fontWeight: 600}}>{m.name}</td>
                   <td><span className="badge badge-delivered">{getUsineStock(m.id, m.stock)}</span></td>
                   <td style={{color: 'var(--text-muted)'}}>{m.stock} total</td>
                   <td>
                     <button className="btn-icon edit" onClick={() => {
                       setTransferingModelName(m.name);
                       setTransferForm({ productModelId: m.id, quantity: 1, sourceLocationId: '', destLocationId: '' });
                       setShowTransferModal(true);
                     }} title="Déplacer vers un autre emplacement">
                       <MapPin size={14} />
                     </button>
                   </td>
                </tr>
              ))}
              {filteredLocationStocks.map(ls => (
                <tr key={ls.id}>
                  <td><span className="badge" style={{background: `${ls.location?.color}20`, color: ls.location?.color, border: `1px solid ${ls.location?.color}40`}}>📍 {ls.location?.name}</span></td>
                  <td style={{fontWeight: 600}}>{ls.productModel?.name}</td>
                  <td><span className="badge badge-ready">{ls.quantity}</span></td>
                  <td style={{color: 'var(--text-muted)'}}>{productModels.find(pm => pm.id === ls.productModelId)?.stock || ls.quantity} total</td>
                  <td>
                     <button className="btn-icon edit" onClick={() => {
                       setTransferingModelName(ls.productModel?.name);
                       setTransferForm({ productModelId: ls.productModelId, quantity: 1, sourceLocationId: ls.locationId, destLocationId: '' });
                       setShowTransferModal(true);
                     }} title="Déplacer vers un autre emplacement">
                       <MapPin size={14} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="table-container">
          <div className="table-header"><h2>Gestion des Emplacements</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', padding: '20px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3>{editingLocation ? 'Modifier l\'emplacement' : 'Créer un nouvel emplacement'}</h3>
              <form onSubmit={handleLocationSubmit} style={{ marginTop: '20px' }}>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Nom de l'emplacement (Showroom, Dépôt...)</label>
                  <input className="form-control" placeholder="ex: Showroom Alger" value={locationForm.name} onChange={e => setLocationForm({...locationForm, name: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Couleur d'identification</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="color" value={locationForm.color} onChange={e => setLocationForm({...locationForm, color: e.target.value})} style={{ width: 50, height: 40, border: 'none', padding: 0 }} />
                    <input className="form-control" value={locationForm.color} onChange={e => setLocationForm({...locationForm, color: e.target.value})} style={{ flex: 1 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingLocation ? "Mettre à jour" : "Créer"}</button>
                  {editingLocation && <button type="button" className="btn btn-outline" onClick={() => { setEditingLocation(null); setLocationForm({name:'', color:'#3b82f6'}); }}>Annuler</button>}
                </div>
              </form>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3>Emplacements Existants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {locations.map(loc => (
                  <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: loc.color }} /><span style={{ fontWeight: 600 }}>{loc.name}</span></div>
                    <div className="action-buttons">
                      <button type="button" className="btn-icon edit" onClick={() => { setEditingLocation(loc); setLocationForm({name: loc.name, color: loc.color}); }}><Settings size={14} /></button>
                      <button type="button" className="btn-icon danger" onClick={() => deleteLocation(loc.id)}><Box size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockModal && activeModel && (
        <Modal title={`Ajuster Stock Global (${activeModel.name})`} onClose={() => setShowStockModal(false)} onSubmit={handleStockSubmit}>
          <div className="form-group">
            <label>Quantité à ajouter / retirer</label>
            <input className="form-control" type="number" placeholder="ex: 5 (ajouter) ou -2 (retirer)" value={stockForm.quantity} onChange={e => setStockForm({quantity: e.target.value})} required />
            <p style={{fontSize: 13, color: 'var(--text-secondary)', marginTop: 8}}>ℹ️ Cette action modifie le <strong>Stock Global</strong>.</p>
          </div>
        </Modal>
      )}

      {showTransferModal && (
        <Modal title={`Déplacement Rapide : ${transferingModelName}`} onClose={() => setShowTransferModal(false)} onSubmit={handleTransferSubmit}>
          <div className="form-group" style={{marginBottom: 20}}>
            <label>Quantité à déplacer</label>
            <input className="form-control" type="number" value={transferForm.quantity} onChange={e => setTransferForm({...transferForm, quantity: e.target.value})} min="1" required />
          </div>
          <div className="form-group" style={{marginBottom: 20}}>
            <label>🛫 Origine (Retirer depuis)</label>
            <div className="form-control" style={{background: 'var(--bg-secondary)', color: 'var(--text-muted)'}}>
              {transferForm.sourceLocationId ? locations.find(l => l.id === transferForm.sourceLocationId)?.name : '🏭 Usine (Central)'}
            </div>
          </div>
          <div className="form-group">
            <label>🛬 Destination (Envoyer vers)</label>
            <select className="form-control" value={transferForm.destLocationId} onChange={e => setTransferForm({...transferForm, destLocationId: e.target.value})}>
              <option value="">🏠 Usine (Central)</option>
              {locations.filter(l => l.id !== transferForm.sourceLocationId).map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <p style={{marginTop: 8, fontSize: 13, color: 'var(--text-secondary)'}}>
              ℹ️ Une livraison "Transfert Interne Rapide" sera automatiquement créée dans l'historique des Livraisons pour tracer ce mouvement.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
