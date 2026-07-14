import { useState, useEffect } from 'react';
import api from '../api';
import { Settings, Box, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Locations() {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin');
  
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState({ name: '', color: '#3b82f6' });
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data);
    } catch (err) {
      console.error(err);
    }
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
      fetchLocations();
    } catch (err) { 
      alert(err.response?.data?.error || 'Error'); 
    }
  };

  const deleteLocation = async (id) => {
    if (!window.confirm('Supprimer cet emplacement ?')) return;
    try {
      await api.delete(`/locations/${id}`);
      fetchLocations();
    } catch (err) { 
      alert(err.response?.data?.error || 'Error'); 
    }
  };

  if (!canManage) {
    return <div className="page-transition"><div className="alert-banner">Accès refusé.</div></div>;
  }

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2><MapPin size={24} style={{ verticalAlign: 'middle', marginRight: 10 }} /> Gestion des Emplacements</h2>
        </div>
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
              {locations.length > 0 ? locations.map(loc => (
                <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: loc.color }} />
                    <span style={{ fontWeight: 600 }}>{loc.name}</span>
                  </div>
                  <div className="action-buttons">
                    <button type="button" className="btn-icon edit" onClick={() => { setEditingLocation(loc); setLocationForm({name: loc.name, color: loc.color}); }}><Settings size={14} /></button>
                    <button type="button" className="btn-icon danger" onClick={() => deleteLocation(loc.id)}><Box size={14} /></button>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun emplacement configuré.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
