import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { PackageCheck, Box } from 'lucide-react';
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

  useEffect(() => { fetchData(); }, []);

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

  const finishedFilters = [];

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
    if (searchText.trim()) {
      return m.name?.toLowerCase()?.includes(searchText.toLowerCase());
    }
    return true;
  });

  return (
    <div className="page-transition">
      <div style={{ marginBottom: '16px' }}>
        <SmartSearch
          filters={finishedFilters}
          onFilterChange={handleFilterChange}
          placeholder="Rechercher par modèle, client..."
        />
      </div>
      <div className="table-container">
        <div className="table-header">
          <h2>Commandes Prêtes ({filteredOrders.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID Commande</th>
              <th>Client</th>
              <th>Adresse & Contact</th>
              <th>Modèle</th>
              <th>Qté</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? filteredOrders.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td style={{ fontWeight: 600 }}>
                  {o.customer?.name || '—'}
                  {o.customer?.phone && <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>{o.customer.phone}</div>}
                </td>
                <td>
                  <div style={{fontSize: '0.85em', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.3'}}>
                    {o.deliveryAddress || o.customer?.address || 'Non spécifiée'}
                  </div>
                </td>
                <td>
                  {o.items && o.items.filter(i => i.status === 'ready').length > 0 ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                      {o.items.filter(i => i.status === 'ready').map((item, idx) => {
                        return (
                          <div key={idx} style={{fontSize:'0.9em', fontWeight: 600, color: 'var(--text-primary)'}}>
                            {item.sofaModel}
                          </div>
                        );
                      })}
                    </div>
                  ) : o.sofaModel || '—'}
                </td>
                <td>
                  {o.items && o.items.filter(i => i.status === 'ready').length > 0 ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                      {o.items.filter(i => i.status === 'ready').map((item, idx) => {
                        return (
                          <div key={idx} style={{fontSize:'0.9em', color: 'var(--text-primary)'}}>x{item.quantity}</div>
                        );
                      })}
                    </div>
                  ) : o.quantity || '0'}
                </td>
                <td>
                  {o.status === 'ready' ? (
                    <span className="badge badge-ready" style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e'}}>Prêt (Complet)</span>
                  ) : (
                    <span className="badge badge-pending" style={{background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04'}}>Partiel</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="table-empty"><p>Aucune commande prête</p></td></tr>
            )}
          </tbody>
        </table>

        <div className="table-header" style={{ marginTop: '30px' }}>
          <h2>Stock de Modèles (Catalog) ({filteredModels.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Modèle</th>
              <th>Catégorie</th>
              <th>Unités en Stock</th>
              <th>Capable de Produire</th>
              <th>Prix Base</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.length > 0 ? filteredModels.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.category || '—'}</td>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span className={`badge ${m.stock > 0 ? 'badge-delivered' : 'badge-pending'}`} style={{ fontSize: '1.05rem' }}>{m.stock || 0}</span>
                    {canManage && <button className="btn-icon edit" onClick={() => openStockModal(m)} title="Ajuster le stock manuellement"><Box size={14} /></button>}
                  </div>
                </td>
                <td>
                  {m.maxProducible > 0 ? (
                    <span className="badge badge-delivered" style={{background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontSize: '0.92em'}}>
                      ✓ Oui ({m.maxProducible})
                    </span>
                  ) : m.maxProducible === 0 ? (
                    <span className="badge badge-cancelled" style={{background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.92em'}}>
                      ✗ Matières Insuffisantes
                    </span>
                  ) : (
                    <span className="badge badge-pending" style={{fontSize: '0.92em'}}>Non Configuré</span>
                  )}
                </td>
                <td>{m.basePrice} DA</td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="table-empty"><p>Aucun modèle en stock</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showStockModal && activeModel && (
        <Modal title={`Ajuster Stock (${activeModel.name})`} onClose={() => setShowStockModal(false)} onSubmit={handleStockSubmit}>
          <div className="form-group">
            <label>Quantité à ajouter / retirer</label>
            <input className="form-control" type="number" placeholder="ex: 5 (ajouter) ou -2 (retirer)" value={stockForm.quantity} onChange={e => setStockForm({quantity: e.target.value})} required />
            <p style={{fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.4}}>
              ℹ️ Cette action ajoute ou retire <strong>directement</strong> le produit fini au stock <strong>sans déduire aucune matière première</strong>. Utile pour les retours, annulations, ou ajustements manuels.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
