import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, MapPin, ArrowRight, Truck } from 'lucide-react';

const ALGERIAN_WILAYAS = [
  "01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna", "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "09 - Blida", "10 - Bouira",
  "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou", "16 - Alger", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda",
  "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine", "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla",
  "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arreridj", "35 - Boumerdès", "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela",
  "41 - Souk Ahras", "42 - Tipaza", "43 - Mila", "44 - Aïn Defla", "45 - Naâma", "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - El M'Ghair", "50 - El Meniaa",
  "51 - Ouled Djellal", "52 - Bordj Baji Mokhtar", "53 - Béni Abbès", "54 - Timimoun", "55 - Touggourt", "56 - Djanet", "57 - In Salah", "58 - In Guezzam"
];

export default function DeliveryPrimes() {
  const [primes, setPrimes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [routeType, setRouteType] = useState('wilaya'); // 'wilaya' or 'location'
  const [form, setForm] = useState({
    sourceLocationId: '',
    destLocationId: '',
    destWilaya: '',
    prime: '',
    notes: '',
  });

  useEffect(() => {
    fetchPrimes();
    fetchLocations();
  }, []);

  const fetchPrimes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/delivery-primes');
      setPrimes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({ sourceLocationId: '', destLocationId: '', destWilaya: '', prime: '', notes: '' });
    setRouteType('wilaya');
    setEditing(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        sourceLocationId: form.sourceLocationId || null,
        destLocationId: routeType === 'location' ? (form.destLocationId || null) : null,
        destWilaya: routeType === 'wilaya' ? (form.destWilaya || null) : null,
        prime: Number(form.prime),
        notes: form.notes || null,
      };

      if (editing) {
        await api.put(`/delivery-primes/${editing.id}`, payload);
      } else {
        await api.post('/delivery-primes', payload);
      }
      setShowModal(false);
      resetForm();
      fetchPrimes();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  const handleEdit = (p) => {
    setEditing(p);
    setRouteType(p.destWilaya ? 'wilaya' : 'location');
    setForm({
      sourceLocationId: p.sourceLocationId || '',
      destLocationId: p.destLocationId || '',
      destWilaya: p.destWilaya || '',
      prime: Number(p.prime) || '',
      notes: p.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette route de livraison ?')) return;
    try {
      await api.delete(`/delivery-primes/${id}`);
      fetchPrimes();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  // Group primes by type
  const wilayaPrimes = primes.filter(p => p.destWilaya);
  const locationPrimes = primes.filter(p => p.destLocationId);

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement des primes de livraison...</div>;

  return (
    <div className="page-transition">
      {/* Header */}
      <div className="table-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={24} style={{ color: 'var(--primary-color)' }} />
            Primes de Livraison
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Configurez les primes par route de livraison. Chaque trajet (source → destination) a un montant fixe.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} /> Ajouter Route
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.04))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total Routes</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>{primes.length}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Routes Wilaya (Clients)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e' }}>{wilayaPrimes.length}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(236, 72, 153, 0.04))',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Routes Internes (Transferts)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ec4899' }}>{locationPrimes.length}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Prime Moyenne</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
            {primes.length > 0 ? Math.round(primes.reduce((s, p) => s + Number(p.prime), 0) / primes.length).toLocaleString() : 0} DA
          </div>
        </div>
      </div>

      {/* Wilaya Routes Table */}
      {wilayaPrimes.length > 0 && (
        <div className="table-container" style={{ marginBottom: '24px' }}>
          <div className="table-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={18} style={{ color: '#22c55e' }} />
              Livraisons Client — Routes par Wilaya ({wilayaPrimes.length})
            </h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th></th>
                <th>Destination (Wilaya)</th>
                <th>Prime</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wilayaPrimes.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="badge" style={{
                      background: p.sourceLocation ? `${p.sourceLocation.color}15` : 'rgba(100,116,139,0.1)',
                      color: p.sourceLocation?.color || '#64748b',
                      fontWeight: 600,
                    }}>
                      {p.sourceLocation?.name || '🏭 Usine'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      fontWeight: 600,
                    }}>
                      📍 {p.destWilaya}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.05rem' }}>
                      {Number(p.prime).toLocaleString()} DA
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 200 }}>{p.notes || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => handleEdit(p)}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Location Routes Table */}
      {locationPrimes.length > 0 && (
        <div className="table-container" style={{ marginBottom: '24px' }}>
          <div className="table-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} style={{ color: '#ec4899' }} />
              Transferts Internes — Routes par Emplacement ({locationPrimes.length})
            </h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th></th>
                <th>Destination</th>
                <th>Prime</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locationPrimes.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="badge" style={{
                      background: p.sourceLocation ? `${p.sourceLocation.color}15` : 'rgba(100,116,139,0.1)',
                      color: p.sourceLocation?.color || '#64748b',
                      fontWeight: 600,
                    }}>
                      {p.sourceLocation?.name || '🏭 Usine'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: p.destLocation ? `${p.destLocation.color}15` : 'rgba(100,116,139,0.1)',
                      color: p.destLocation?.color || '#64748b',
                      fontWeight: 600,
                    }}>
                      {p.destLocation?.name || '🏭 Usine'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.05rem' }}>
                      {Number(p.prime).toLocaleString()} DA
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 200 }}>{p.notes || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => handleEdit(p)}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {primes.length === 0 && (
        <div className="table-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', opacity: 0.6 }}>
          <MapPin size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ color: 'var(--text-muted)', margin: 0 }}>Aucune prime de livraison configurée</h3>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400 }}>
            Ajoutez des routes pour définir les primes des livreurs selon le trajet effectué.
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal 
          title={editing ? 'Modifier la Route' : 'Nouvelle Route de Livraison'} 
          onClose={() => { setShowModal(false); resetForm(); }} 
          onSubmit={handleSubmit}
        >
          {/* Route Type Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn ${routeType === 'wilaya' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => { setRouteType('wilaya'); setForm({ ...form, destLocationId: '' }); }}
            >
              📍 Livraison Client (Wilaya)
            </button>
            <button
              type="button"
              className={`btn ${routeType === 'location' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => { setRouteType('location'); setForm({ ...form, destWilaya: '' }); }}
            >
              🏪 Transfert Interne
            </button>
          </div>

          {/* Source */}
          <div className="form-group">
            <label>🛫 Source</label>
            <select
              className="form-control"
              value={form.sourceLocationId}
              onChange={e => setForm({ ...form, sourceLocationId: e.target.value })}
            >
              <option value="">🏭 Usine (Central)</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Destination */}
          {routeType === 'wilaya' ? (
            <div className="form-group">
              <label>📍 Destination (Wilaya)</label>
              <select
                className="form-control"
                value={form.destWilaya}
                onChange={e => setForm({ ...form, destWilaya: e.target.value })}
                required
              >
                <option value="">Sélectionner une wilaya...</option>
                {ALGERIAN_WILAYAS.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>🏪 Destination (Emplacement)</label>
              <select
                className="form-control"
                value={form.destLocationId}
                onChange={e => setForm({ ...form, destLocationId: e.target.value })}
                required
              >
                <option value="">🏭 Usine (Central)</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prime Amount */}
          <div className="form-group">
            <label>💰 Montant de la Prime (DA)</label>
            <input
              className="form-control"
              type="number"
              min="0"
              step="100"
              placeholder="Ex: 5000"
              value={form.prime}
              onChange={e => setForm({ ...form, prime: e.target.value })}
              required
            />
          </div>

          {/* Route Preview */}
          {(form.sourceLocationId || form.destWilaya || form.destLocationId) && form.prime && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <span className="badge" style={{
                background: 'rgba(100,116,139,0.1)',
                color: '#64748b',
                fontWeight: 600,
                padding: '6px 12px',
              }}>
                {form.sourceLocationId
                  ? locations.find(l => l.id == form.sourceLocationId)?.name || '?'
                  : '🏭 Usine'
                }
              </span>
              <ArrowRight size={18} style={{ color: '#6366f1' }} />
              <span className="badge" style={{
                background: routeType === 'wilaya' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(236, 72, 153, 0.1)',
                color: routeType === 'wilaya' ? '#22c55e' : '#ec4899',
                fontWeight: 600,
                padding: '6px 12px',
              }}>
                {routeType === 'wilaya'
                  ? `📍 ${form.destWilaya || '...'}`
                  : (form.destLocationId ? locations.find(l => l.id == form.destLocationId)?.name : '🏭 Usine')
                }
              </span>
              <span style={{ marginLeft: 8, fontWeight: 800, color: '#f59e0b', fontSize: '1.1rem' }}>
                = {Number(form.prime).toLocaleString()} DA
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label>Notes (optionnel)</label>
            <textarea
              className="form-control"
              placeholder="Ex: Tarif haute saison, route longue distance..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
