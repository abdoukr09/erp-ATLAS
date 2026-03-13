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
      setProductModels(modRes.data.filter(m => m.stock > 0));
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
                <td>{o.sofaModel}</td>
                <td>{o.quantity}</td>
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
              <th>Prix Base</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.length > 0 ? filteredModels.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.category || '—'}</td>
                <td><span className="badge badge-delivered" style={{ fontSize: '1.1rem' }}>{m.stock}</span> units</td>
                <td>{m.basePrice} DA</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="table-empty"><p>Aucun modèle en stock</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
