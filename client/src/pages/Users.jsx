import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, Settings } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'sales', email: '' });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try { const res = await api.get('/users'); setUsers(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...form };
      if (editing && !form.password) delete payload.password;
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      setShowModal(false); setEditing(null);
      setForm({ username: '', password: '', fullName: '', role: 'sales', email: '' });
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, email: u.email || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); fetchUsers(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Utilisateurs ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher des utilisateurs..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ username: '', password: '', fullName: '', role: 'sales', email: '' }); setShowModal(true); }}>
              <Plus size={16} /> Ajouter Utilisateur
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nom d'utilisateur</th><th>Nom complet</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(u => (
              <tr key={u.id}>
                <td>#{u.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{u.username}</td>
                <td>{u.fullName}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role === 'admin' ? 'Admin' : u.role === 'sales' ? 'Commercial' : u.role === 'production' ? 'Production' : u.role === 'delivery' ? 'Livreur' : u.role === 'gerant' ? 'Gérant' : u.role}</span></td>
                <td><span className={`badge ${u.active ? 'badge-completed' : 'badge-cancelled'}`}>{u.active ? 'Actif' : 'Inactif'}</span></td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon edit" onClick={() => handleEdit(u)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(u.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7" className="table-empty"><Settings size={32} style={{color:'var(--text-muted)'}} /><p>Aucun utilisateur trouvé</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier l\'Utilisateur' : 'Ajouter un Utilisateur'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Nom d'utilisateur *</label>
              <input className="form-control" placeholder="Nom d'utilisateur" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>{editing ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
              <input className="form-control" type="password" placeholder={editing ? 'Laisser vide pour conserver' : 'Mot de passe'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editing} />
            </div>
          </div>
          <div className="form-group">
            <label>Nom complet *</label>
            <input className="form-control" placeholder="Nom complet" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rôle</label>
              <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="admin">Administrateur</option>
                <option value="gerant">Gérant</option>
                <option value="sales">Commercial</option>
                <option value="production">Production</option>
                <option value="delivery">Livreur</option>
              </select>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" placeholder="Adresse email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
