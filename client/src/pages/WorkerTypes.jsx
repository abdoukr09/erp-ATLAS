import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Wrench, DollarSign } from 'lucide-react';
import SmartSearch from '../components/SmartSearch';

export default function WorkerTypes() {
  const [workerTypes, setWorkerTypes] = useState([]);
  const [productModels, setProductModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  // Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: '' });

  // Tariff Modal
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [editingTariff, setEditingTariff] = useState(null);
  const [tariffParentType, setTariffParentType] = useState(null);
  const [tariffForm, setTariffForm] = useState({ productModelId: '', paymentType: 'fixed', amount: 0 });

  // Expanded type (to show tariffs)
  const [expandedTypeId, setExpandedTypeId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [typesRes, modelsRes] = await Promise.all([
        api.get('/worker-types'),
        api.get('/product-models')
      ]);
      setWorkerTypes(typesRes.data);
      setProductModels(modelsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Type CRUD ---
  const handleTypeSubmit = async () => {
    try {
      if (editingType) {
        await api.put(`/worker-types/${editingType.id}`, typeForm);
      } else {
        await api.post('/worker-types', typeForm);
      }
      setShowTypeModal(false);
      setEditingType(null);
      setTypeForm({ name: '' });
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleDeleteType = async (id) => {
    if (!confirm('Supprimer ce type et tous ses tarifs associés ?')) return;
    try {
      await api.delete(`/worker-types/${id}`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  // --- Tariff CRUD ---
  const handleTariffSubmit = async () => {
    try {
      if (editingTariff) {
        await api.put(`/worker-types/tariffs/${editingTariff.id}`, tariffForm);
      } else {
        await api.post(`/worker-types/${tariffParentType.id}/tariffs`, tariffForm);
      }
      setShowTariffModal(false);
      setEditingTariff(null);
      setTariffForm({ productModelId: '', paymentType: 'fixed', amount: 0 });
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleDeleteTariff = async (tariffId) => {
    try {
      await api.delete(`/worker-types/tariffs/${tariffId}`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const workerTypeFilters = [];

  const handleFilterChange = (text, filters) => {
    setSearchText(text);
    setActiveFilters(filters);
  };

  const filteredTypes = workerTypes.filter(t =>
    t.name.toLowerCase().includes(searchText.toLowerCase())
  );

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement...</div>;

  return (
    <div className="page-transition">
      <div className="table-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2>Types d'Ouvriers & Tarifs</h2>
          <p style={{color:'var(--text-muted)', marginTop: 4}}>
            Définissez les types de tâches (Tapisseur, Emballage, etc.) et configurez le montant par modèle de produit.
          </p>
        </div>
        <div className="table-actions">
          <SmartSearch
            filters={workerTypeFilters}
            onFilterChange={handleFilterChange}
            placeholder="Rechercher un type..."
          />
          <button className="btn btn-primary" onClick={() => {
            setEditingType(null);
            setTypeForm({ name: '' });
            setShowTypeModal(true);
          }}>
            <Plus size={16} /> Nouveau Type
          </button>
        </div>
      </div>

      {filteredTypes.length === 0 ? (
        <div className="table-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Wrench size={40} style={{ color: 'var(--text-muted)', marginBottom: 15 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Aucun type d'ouvrier défini</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cliquez sur "Nouveau Type" pour créer votre premier type (ex: Tapisseur, Emballage...)</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTypes.map(type => (
            <div key={type.id} className="table-container" style={{ overflow: 'visible' }}>
              <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px',
                borderBottom: expandedTypeId === type.id ? '1px solid var(--border-color)' : 'none',
                cursor: 'pointer',
                background: expandedTypeId === type.id ? 'var(--bg-hover)' : 'transparent',
                borderRadius: expandedTypeId === type.id ? '8px 8px 0 0' : '8px',
                transition: 'all 0.2s'
              }} onClick={() => setExpandedTypeId(expandedTypeId === type.id ? null : type.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Wrench size={20} style={{ color: 'var(--primary-color)' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{type.name}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {type.tariffs?.length || 0} tarif(s) configuré(s)
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <button className="btn-icon edit" onClick={() => {
                    setEditingType(type);
                    setTypeForm({ name: type.name });
                    setShowTypeModal(true);
                  }}><Pencil size={14} /></button>
                  <button className="btn-icon danger" onClick={() => handleDeleteType(type.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              {expandedTypeId === type.id && (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                      <DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Tarifs par Modèle de Produit
                    </h4>
                    <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => {
                      setTariffParentType(type);
                      setEditingTariff(null);
                      setTariffForm({ productModelId: '', paymentType: 'fixed', amount: 0 });
                      setShowTariffModal(true);
                    }}>
                      <Plus size={14} /> Ajouter Tarif
                    </button>
                  </div>

                  {type.tariffs && type.tariffs.length > 0 ? (
                    <table style={{ fontSize: '0.9rem' }}>
                      <thead>
                        <tr>
                          <th>Modèle Produit</th>
                          <th>Type de Paiement</th>
                          <th>Montant</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {type.tariffs.map(tariff => (
                          <tr key={tariff.id}>
                            <td style={{ fontWeight: 600 }}>{tariff.productModel?.name || '—'}</td>
                            <td>
                              <span className={`badge ${tariff.paymentType === 'fixed' ? 'badge-scheduled' : 'badge-in_progress'}`}>
                                {tariff.paymentType === 'fixed' ? 'Montant Fixe' : 'Pourcentage'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                              {tariff.paymentType === 'fixed'
                                ? `${Number(tariff.amount).toLocaleString()} DA`
                                : `${Number(tariff.amount)}%`
                              }
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button className="btn-icon edit" onClick={() => {
                                  setTariffParentType(type);
                                  setEditingTariff(tariff);
                                  setTariffForm({
                                    productModelId: tariff.productModelId,
                                    paymentType: tariff.paymentType,
                                    amount: tariff.amount
                                  });
                                  setShowTariffModal(true);
                                }}><Pencil size={14} /></button>
                                <button className="btn-icon danger" onClick={() => handleDeleteTariff(tariff.id)}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.9rem' }}>
                      Aucun tarif configuré. Cliquez sur "Ajouter Tarif" pour définir le montant par produit.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Type Modal */}
      {showTypeModal && (
        <Modal title={editingType ? "Modifier le Type" : "Nouveau Type d'Ouvrier"} onClose={() => setShowTypeModal(false)} onSubmit={handleTypeSubmit}>
          <div className="form-group">
            <label>Nom du Type *</label>
            <input
              className="form-control"
              placeholder="Ex: Tapisseur, Emballage, Empochage, Couture..."
              value={typeForm.name}
              onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
              required
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Tariff Modal */}
      {showTariffModal && (
        <Modal title={`${editingTariff ? 'Modifier' : 'Nouveau'} Tarif — ${tariffParentType?.name}`} onClose={() => setShowTariffModal(false)} onSubmit={handleTariffSubmit}>
          <div className="form-group">
            <label>Modèle de Produit *</label>
            <select
              className="form-control"
              value={tariffForm.productModelId}
              onChange={e => setTariffForm({ ...tariffForm, productModelId: e.target.value })}
              required
              disabled={!!editingTariff}
            >
              <option value="">Sélectionner un modèle</option>
              {productModels.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {Number(m.basePrice).toLocaleString()} DA</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type de Paiement</label>
              <select className="form-control" value={tariffForm.paymentType} onChange={e => setTariffForm({ ...tariffForm, paymentType: e.target.value })}>
                <option value="fixed">Montant Fixe (DA)</option>
                <option value="percentage">Pourcentage (%)</option>
              </select>
            </div>
            <div className="form-group">
              <label>{tariffForm.paymentType === 'fixed' ? 'Montant (DA)' : 'Pourcentage (%)'}</label>
              <input
                className="form-control"
                type="number"
                min="0"
                step={tariffForm.paymentType === 'percentage' ? '0.01' : '1'}
                value={tariffForm.amount}
                onChange={e => setTariffForm({ ...tariffForm, amount: e.target.value })}
                placeholder={tariffForm.paymentType === 'fixed' ? 'Ex: 1500' : 'Ex: 5'}
              />
            </div>
          </div>
          {tariffForm.paymentType === 'fixed' && tariffForm.amount > 0 && (
            <div style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', color: '#065f46', marginTop: '10px' }}>
              💰 Chaque ouvrier <strong>{tariffParentType?.name}</strong> recevra <strong>{Number(tariffForm.amount).toLocaleString()} DA</strong> par unité produite pour ce modèle.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
