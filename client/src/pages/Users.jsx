import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SmartSearch from '../components/SmartSearch';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState(initialSearch);
  const [activeFilters, setActiveFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'sales', email: '', active: true });
  
  // Password validation state
  const [pwdError, setPwdError] = useState('');
  const [isPwdTouched, setIsPwdTouched] = useState(false);

  const WEAK_PASSWORDS = ['123', '123456', 'password', 'qwerty', 'azerty', 'admin'];

  const validatePassword = (value, isEditing) => {
    if (isEditing && !value) return ''; // Allowed to leave empty when editing to keep old password
    if (WEAK_PASSWORDS.includes(value.toLowerCase())) {
      return "Mot de passe trop faible ! (ex: 123, password interdit)";
    }
    if (value.length < 6 || value.length > 8) return "Doit faire entre 6 et 8 caractères.";
    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return "Doit contenir au moins une lettre et un chiffre.";
    return '';
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setForm({...form, password: val});
    setIsPwdTouched(true);
    setPwdError(validatePassword(val, !!editing));
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try { const res = await api.get('/users'); setUsers(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    // Trigger validation
    const vErr = validatePassword(form.password, !!editing);
    if (vErr) {
      setPwdError(vErr);
      setIsPwdTouched(true);
      return;
    }

    // Safety checks for active status
    if (editing && editing.id === currentUser.id && !form.active) {
      alert("Erreur: Vous ne pouvez pas vous désactiver vous-même !");
      return;
    }
    if (editing && editing.role === 'admin' && !form.active) {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.active);
      if (activeAdmins.length <= 1 && editing.active) {
        alert("Erreur: Impossible de désactiver le dernier administrateur actif.");
        return;
      }
    }

    try {
      const payload = { ...form };
      if (editing && !form.password) delete payload.password;
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      
      setShowModal(false); setEditing(null);
      setForm({ username: '', password: '', fullName: '', role: 'sales', email: '', active: true });
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, email: u.email || '', active: u.active ?? true });
    setIsPwdTouched(false);
    setPwdError('');
    setShowModal(true);
  };

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      alert("Erreur: Vous ne pouvez pas vous désactiver vous-même !");
      return;
    }

    if (user.role === 'admin' && user.active) {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.active);
      if (activeAdmins.length <= 1) {
        alert("Erreur: Impossible de désactiver le dernier administrateur actif.");
        return;
      }
      if (!confirm("Attention: Vous allez désactiver un administrateur. Confirmer ?")) return;
    }

    try {
      await api.put(`/users/${user.id}`, { active: !user.active });
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); fetchUsers(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const userFilters = [
    { key: 'role', label: '👤 Rôle', options: [
      { value: 'admin', label: 'Admin', color: '#ef4444' },
      { value: 'gerant', label: 'Gérant', color: '#8b5cf6' },
      { value: 'sales', label: 'Commercial', color: '#3b82f6' },
      { value: 'production', label: 'Production', color: '#f59e0b' },
      { value: 'delivery', label: 'Livreur', color: '#10b981' },
    ]},
    { key: 'status', label: '⚡ Statut', options: [
      { value: 'active', label: 'Actif', color: '#22c55e' },
      { value: 'inactive', label: 'Inactif', color: '#ef4444' },
    ]},
  ];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filtered = users.filter(u => {
    if (activeFilters.role && u.role !== activeFilters.role) return false;
    if (activeFilters.status === 'active' && !u.active) return false;
    if (activeFilters.status === 'inactive' && u.active) return false;
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      if (!(
        u.username.toLowerCase().includes(s) ||
        u.fullName.toLowerCase().includes(s) ||
        u.role.toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s)
      )) return false;
    }
    return true;
  });

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Utilisateurs ({filtered.length})</h2>
          <div className="table-actions">
            <SmartSearch
              filters={userFilters}
              onFilterChange={handleFilterChange}
              placeholder="Rechercher par nom, rôle, email..."
              initialSearchText={initialSearch}
            />
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ username: '', password: '', fullName: '', role: 'sales', email: '' }); setIsPwdTouched(false); setPwdError(''); setShowModal(true); }}>
              <Plus size={16} /> Ajouter Utilisateur
            </button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nom d'utilisateur</th><th>Nom complet</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(u => (
              <tr key={u.id}>
                <td>#{u.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{u.username}</td>
                <td>{u.fullName}</td>
                <td>{u.email || '—'}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role === 'admin' ? 'Admin' : u.role === 'sales' ? 'Commercial' : u.role === 'production' ? 'Production' : u.role === 'delivery' ? 'Livreur' : u.role === 'gerant' ? 'Gérant' : u.role}</span></td>
                <td><span className={`badge ${u.active ? 'badge-completed' : 'badge-cancelled'}`}>{u.active ? 'Actif' : 'Inactif'}</span></td>
                <td style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                  {u.isOnline ? (
                    <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981ff', display: 'inline-block' }}></span>
                      En ligne
                    </span>
                  ) : (
                    u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais'
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className={`btn-icon ${u.active ? 'secondary' : 'success'}`} 
                      onClick={() => handleToggleStatus(u)} 
                      title={u.id === currentUser.id ? 'Action impossible' : (u.active ? 'Désactiver' : 'Activer')}
                      disabled={u.id === currentUser.id}
                      style={u.id === currentUser.id ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                    >
                      <Settings size={14} style={{ color: u.active ? 'var(--accent-red)' : 'var(--accent-green)' }} />
                    </button>
                    <button className="btn-icon edit" onClick={() => handleEdit(u)} title="Modifier"><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(u.id)} title="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" className="table-empty"><Settings size={32} style={{color:'var(--text-muted)'}} /><p>Aucun utilisateur trouvé</p></td></tr>
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
              <input 
                className="form-control" 
                type="password" 
                placeholder={editing ? 'Laisser vide pour conserver' : 'Mot de passe'} 
                value={form.password} 
                onChange={handlePasswordChange} 
                style={{
                  borderColor: (!isPwdTouched || (editing && !form.password)) ? '' : pwdError ? '#ff4d4f' : '#52c41a',
                  outline: 'none'
                }}
                required={!editing} 
              />
              {isPwdTouched && pwdError && (
                <p style={{ color: '#ff4d4f', fontSize: '13px', margin: '5px 0 0 0' }}>
                  {pwdError}
                </p>
              )}
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
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '25px' }}>
              <input 
                type="checkbox" 
                id="user-active"
                checked={form.active} 
                onChange={e => setForm({...form, active: e.target.checked})} 
                disabled={editing && editing.id === currentUser.id}
                style={{ width: '18px', height: '18px', cursor: editing && editing.id === currentUser.id ? 'not-allowed' : 'pointer', opacity: editing && editing.id === currentUser.id ? 0.5 : 1 }}
              />
              <label htmlFor="user-active" style={{ cursor: editing && editing.id === currentUser.id ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: editing && editing.id === currentUser.id ? 0.5 : 1 }}>
                Utilisateur Actif {editing && editing.id === currentUser.id && "(Vous ne pouvez pas vous désactiver)"}
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
