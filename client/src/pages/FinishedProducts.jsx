import { useState, useEffect } from 'react';
import api from '../api';
import { Search, PackageCheck } from 'lucide-react';

export default function FinishedProducts() {
  const [orders, setOrders] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordRes, modRes] = await Promise.all([
        api.get('/orders'),
        api.get('/product-models')
      ]);
      setOrders(ordRes.data.filter(o => o.status === 'ready'));
      setProductModels(modRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(o =>
    o.sofaModel?.toLowerCase()?.includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase()?.includes(search.toLowerCase())
  );

  const filteredModels = productModels.filter(m =>
    m.name?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Commandes Prêtes ({filteredOrders.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID Commande</th>
              <th>Client</th>
              <th>Modèle</th>
              <th>Qté</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? filteredOrders.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td style={{ fontWeight: 600 }}>{o.customer?.name || '—'}</td>
                <td>
                  {o.items && o.items.length > 0 ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                      {o.items.map((item, idx) => (
                        <div key={idx} style={{fontSize:'0.9em'}}>{item.sofaModel}</div>
                      ))}
                    </div>
                  ) : o.sofaModel || '—'}
                </td>
                <td>
                  {o.items && o.items.length > 0 ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                      {o.items.map((item, idx) => (
                        <div key={idx} style={{fontSize:'0.9em'}}>{item.quantity}</div>
                      ))}
                    </div>
                  ) : o.quantity || '0'}
                </td>
                <td><span className={`badge badge-${o.status}`}>{o.status === 'ready' ? 'Prêt' : 'Livré'}</span></td>
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
                <td><span className={`badge ${m.stock > 0 ? 'badge-delivered' : 'badge-pending'}`} style={{ fontSize: '1.05rem' }}>{m.stock || 0}</span></td>
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
    </div>
  );
}
