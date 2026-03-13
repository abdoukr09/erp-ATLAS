import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Search, Users as UsersIcon } from 'lucide-react';

const ALGERIAN_WILAYAS = [
  "01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna", "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "09 - Blida", "10 - Bouira",
  "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou", "16 - Alger", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda",
  "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine", "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla",
  "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arreridj", "35 - Boumerdès", "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela",
  "41 - Souk Ahras", "42 - Tipaza", "43 - Mila", "44 - Aïn Defla", "45 - Naâma", "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - El M'Ghair", "50 - El Meniaa",
  "51 - Ouled Djellal", "52 - Bordj Baji Mokhtar", "53 - Béni Abbès", "54 - Timimoun", "55 - Touggourt", "56 - Djanet", "57 - In Salah", "58 - In Guezzam"
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', notes: '' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
      } else {
        await api.post('/customers', form);
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', phone: '', email: '', address: '', city: '', notes: '' });
      fetchCustomers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (customer) => {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone || '', email: customer.email || '', address: customer.address || '', city: customer.city || '', notes: customer.notes || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase()?.includes(search.toLowerCase()) ||
    c.phone?.toLowerCase()?.includes(search.toLowerCase()) ||
    c.city?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="page-transition">
      <div className="table-container">
        <div className="table-header">
          <h2>Clients ({filtered.length})</h2>
          <div className="table-actions">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input className="search-input" placeholder="Rechercher des clients..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', address: '', city: '', notes: '' }); setShowModal(true); }}>
              <Plus size={16} /> Ajouter Client
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
               <th>ID</th>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Wilaya</th>
              <th>Commandes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(c => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td style={{fontWeight:600, color:'var(--text-primary)'}}>{c.name}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.email || '—'}</td>
                <td>{c.city || '—'}</td>
                <td><span className="badge badge-scheduled">{c.orders?.length || 0}</span></td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon edit" onClick={() => handleEdit(c)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7" className="table-empty"><UsersIcon size={32} style={{color:'var(--text-muted)'}} /><p>Aucun client trouvé</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier le Client' : 'Ajouter un Client'} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom complet *</label>
            <input className="form-control" placeholder="Nom du client" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Téléphone</label>
              <input className="form-control" placeholder="Numéro de téléphone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" placeholder="Adresse email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
          </div>
           <div className="form-row">
            <div className="form-group">
              <label>Wilaya / Ville</label>
              <input className="form-control" list="wilayas-list" placeholder="Sélectionner ou saisir une wilaya..." value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
              <datalist id="wilayas-list">
                {ALGERIAN_WILAYAS.map(w => <option key={w} value={w} />)}
              </datalist>
            </div>
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <textarea className="form-control" placeholder="Adresse complète" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" placeholder="Notes supplémentaires" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </Modal>
      )}
    </div>
  );
}
