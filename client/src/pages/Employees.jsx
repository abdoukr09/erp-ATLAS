import { useState, useEffect, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Pencil, Briefcase, Calculator, Award, ArrowRight, Truck } from 'lucide-react';

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'Ouvrier', baseSalary: 0, insuranceCost: 12000, commissionRate: 0, notes: '' });

  // Performance View
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceData, setPerformanceData] = useState({ productions: [], sales: [] });
  const [perfLoading, setPerfLoading] = useState(false);

  // Payment Override Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ 
    baseAmount: 0, 
    bonusAmount: 0, 
    date: new Date().toISOString().split('T')[0], 
    description: '', 
    type: 'fixed', 
    customRate: 0 
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async (empId, month) => {
    if (!empId) return;
    try {
      setPerfLoading(true);
      const res = await api.get(`/employees/${empId}/performance?month=${month}`);
      setPerformanceData(res.data || { productions: [], sales: [] });
    } catch (err) {
      console.error("Error fetching performance", err);
    } finally {
      setPerfLoading(false);
    }
  };
  
  const totalSalesFinal = performanceData.sales?.reduce((sum, s) => sum + (Number(s.finalPrice || s.totalPrice || 0) * (Number(s.splitPercentage || 100) / 100)), 0) || 0;
  const totalProductionValue = performanceData.productions?.reduce((sum, p) => sum + (Number(p.basePrice || 0) * Number(p.quantity || 1)), 0) || 0;
  // Calculate total earned commission from tariff-based production records
  const totalEarnedCommission = performanceData.productions?.reduce((sum, p) => {
    if (p.commissionType === 'fixed') return sum + (Number(p.commissionValue || 0) * Number(p.quantity || 1));
    const valBase = Number(p.basePrice || 0) * Number(p.quantity || 1);
    return sum + (valBase * (Number(p.commissionValue || 0) / 100));
  }, 0) || 0;
  // Sales commission for vendeurs
  const totalSalesCommission = totalSalesFinal * (Number(selectedEmployee?.commissionRate || 0) / 100);
  // Delivery primes for chauffeurs
  const totalDeliveryPrimes = performanceData.deliveries?.reduce((sum, d) => sum + (Number(d.routePrime || 0)), 0) || 0;

  useEffect(() => {
    if (selectedEmployee) {
      fetchPerformance(selectedEmployee.id, selectedMonth);
    }
  }, [selectedEmployee, selectedMonth]);

  const handleSubmit = async () => {
    try {
      if (editingEmployee) await api.put(`/employees/${editingEmployee.id}`, form);
      else await api.post('/employees', form);
      setShowModal(false);
      fetchEmployees();
    } catch (err) { alert('Erreur sauvegarde'); }
  };

  const handleDelete = async (id) => {
    if(!confirm("Supprimer cet employé ?")) return;
    try {
      await api.delete(`/employees/${id}`);
      if(selectedEmployee?.id === id) setSelectedEmployee(null);
      fetchEmployees();
    } catch (err) { alert('Erreur suppression'); }
  };

  const openPaymentModal = () => {
    const isVendeur = selectedEmployee.category === 'Vendeur';
    const isChauffeur = selectedEmployee.category === 'Chauffeur';
    let bonus;
    if (isVendeur) {
      bonus = Math.round(totalSalesCommission);
    } else if (isChauffeur) {
      bonus = Math.round(totalDeliveryPrimes);
    } else {
      bonus = Math.round(totalEarnedCommission);
    }
    setPaymentForm({
        baseAmount: Number(selectedEmployee.baseSalary) || 0,
        bonusAmount: bonus,
        date: new Date().toISOString().split('T')[0],
        description: `Salaire + Prime (${selectedMonth})`
    });
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
     try {
         const finalAmount = Number(paymentForm.baseAmount) + Number(paymentForm.bonusAmount);
         const payload = {
           amount: finalAmount,
           date: paymentForm.date,
           description: paymentForm.description
         };
         const res = await api.post(`/employees/${selectedEmployee.id}/payments`, payload);
         setShowPaymentModal(false);
         fetchEmployees(); // refresh total lists
         
         // Update the selected employee locally to show the new payment immediately
         setSelectedEmployee(prev => {
             if (!prev) return prev;
             return { ...prev, payments: [...(prev.payments || []), res.data] };
         });
     } catch (err) { alert(err.response?.data?.error || `Erreur de paiement: ${err.message}`); console.error(err); }
  };

  const handleDeletePayment = async (payId) => {
    try {
      if (!selectedEmployee) return;
      await api.delete(`/employees/${selectedEmployee.id}/payments/${payId}`);
      fetchEmployees();
      setSelectedEmployee(prev => {
        if (!prev) return prev;
        return { ...prev, payments: prev.payments.filter(p => p.id !== payId) };
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression du paiement');
    }
  };

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement du personnel...</div>;

  return (
    <div className="page-transition">
      <div className="table-header" style={{ marginBottom: '20px' }}>
        <h2>Gestion du Personnel & Paie</h2>
        <p style={{color:'var(--text-muted)'}}>Gérez les ouvriers, suivez leur production mensuelle, et calculez leurs salaires et primes manuellement.</p>
        {['admin', 'gerant', 'production'].includes(user?.role) && (
          <button className="btn btn-primary" onClick={() => { 
              setEditingEmployee(null); 
              setForm({ name: '', category: 'Ouvrier', baseSalary: 0, insuranceCost: 0, commissionRate: 0, notes: '' });
              setShowModal(true); 
          }}>
            <Plus size={16} /> Ajouter Employé
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* EMPLOYEES LIST */}
        <div className="table-container">
          <div className="table-header">
            <h3><Briefcase size={20} style={{marginRight: 8, verticalAlign:'middle'}}/> Liste des Employés</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Salaire Fixe (Base)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length > 0 ? employees.map(e => (
                <tr key={e.id} style={{ cursor: 'pointer', backgroundColor: selectedEmployee?.id === e.id ? 'var(--bg-hover)' : '' }} onClick={() => setSelectedEmployee(e)}>
                  <td style={{fontWeight:600}}>{e.name}</td>
                  <td><span className="badge badge-scheduled">{e.category}</span></td>
                  <td style={{fontWeight:500}}>{Number(e.baseSalary).toLocaleString()} DA</td>
                  <td onClick={(evt) => evt.stopPropagation()}>
                    {['admin', 'gerant', 'production'].includes(user?.role) && (
                      <div className="action-buttons">
                        <button className="btn-icon edit" onClick={() => { setEditingEmployee(e); setForm(e); setShowModal(true); }}><Pencil size={14} /></button>
                        <button className="btn-icon danger" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="table-empty"><p>Aucun employé enregistré</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PERFORMANCE & PAYMENT PANEL */}
        {selectedEmployee ? (
          <div className="table-container animate-in">
             <div className="table-header" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px'}}>
               <div>
                  <h3 style={{color: 'var(--primary-color)'}}>{selectedEmployee.name}</h3>
                  <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Role: {selectedEmployee.category} | Salaire de base: {Number(selectedEmployee.baseSalary).toLocaleString()} DA</p>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <button 
                   type="button"
                   className="btn btn-outline" 
                   style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                   onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
                 >
                   Aujourd'hui
                 </button>
                 <input 
                    type="date" 
                    className="form-control" 
                    style={{width: '160px', cursor: 'pointer'}} 
                    value={`${selectedMonth}-01`} 
                    onChange={e => {
                      if (e.target.value) {
                        setSelectedMonth(e.target.value.substring(0, 7));
                      }
                    }}
                    onClick={(e) => {
                      if (e.target.showPicker) e.target.showPicker();
                    }}
                  />
               </div>
             </div>

             <div style={{marginBottom: '20px'}}>
               <h4><Award size={16} style={{marginRight: 5, verticalAlign:'middle', color:'#eab308'}}/> Performance du Mois ({selectedMonth})</h4>
               {perfLoading ? <p>Chargement...</p> : (
                 <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                   {/* Production Table (Ouvriers) */}
                   {selectedEmployee.category !== 'Vendeur' && selectedEmployee.category !== 'Assistant' && selectedEmployee.category !== 'Gérant' && (
                     <div>
                       <h5 style={{fontSize:'0.9rem', marginBottom:5, color:'var(--text-secondary)'}}>Production (Ouvriers / Artisans)</h5>
                       <table style={{fontSize: '0.85rem'}}>
                         <thead><tr><th>Date</th><th>Commande/Modèle</th><th>Type</th><th>Valeur Base</th><th>Commission</th></tr></thead>
                         <tbody>
                          {(performanceData.productions || []).length > 0 ? (performanceData.productions || []).map(p => {
                            const valBase = Number(p.basePrice || 0) * Number(p.quantity || 1);
                            // Use stored commission from tariff if available, otherwise fall back to employee rate
                            let comm;
                            if (p.commissionType === 'fixed') {
                              comm = Number(p.commissionValue || 0) * Number(p.quantity || 1);
                            } else {
                              comm = valBase * (Number(p.commissionValue || 0) / 100);
                            }
                            return (
                              <tr key={p.id + '-' + (p.workerTypeName || '')}>
                                <td>{p.completionDate}</td>
                                <td style={{fontWeight: 600}}>
                                  {p.orderId ? `Cde #${p.orderId}` : (p.productModel?.name || 'Stock')} (x{p.quantity || 1})
                                </td>
                                <td>
                                  {p.workerTypeName ? (
                                    <span className="badge badge-scheduled" style={{fontSize:'0.75rem'}}>{p.workerTypeName}</span>
                                  ) : '—'}
                                </td>
                                <td>{valBase.toLocaleString()} DA</td>
                                <td style={{color:'var(--accent-green)', fontWeight:'bold'}}>
                                  +{Math.round(comm).toLocaleString()} DA
                                  {p.commissionType === 'fixed' && <span style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block'}}>fixe</span>}
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan="5" style={{textAlign:'center', color:'var(--text-muted)'}}>Aucune production ce mois-ci.</td></tr>
                          )}
                         </tbody>
                       </table>
                     </div>
                   )}

                   {/* Sales Table (Salesmen) */}
                   {(selectedEmployee.category === 'Vendeur' || selectedEmployee.category === 'Gérant') && (
                     <div>
                       <h5 style={{fontSize:'0.9rem', marginBottom:5, color:'var(--text-secondary)'}}>Ventes (Commerciaux)</h5>
                       <table style={{fontSize: '0.85rem'}}>
                         <thead><tr><th>Date</th><th>Commande</th><th>Total Vente</th><th>Commission</th></tr></thead>
                         <tbody>
                          {(performanceData.sales || []).length > 0 ? (performanceData.sales || []).map(s => {
                            const totalCde = Number(s.finalPrice || s.totalPrice || 0);
                            const split = Number(s.splitPercentage || 100);
                            const volumePerso = totalCde * (split / 100);
                            const comm = volumePerso * (Number(selectedEmployee.commissionRate || 0) / 100);
                            return (
                              <tr key={s.id}>
                                <td>{s.orderDate}</td>
                                <td>#{s.id} - <span style={{fontWeight: 600}}>Vente</span></td>
                                <td>
                                  {totalCde.toLocaleString()} DA
                                  {split < 100 && <span style={{fontSize:'0.8em', color:'var(--accent-blue)', display:'block'}}>Partagé ({split}%) &gt; Net: {volumePerso.toLocaleString()} DA</span>}
                                </td>
                                <td style={{color:'var(--accent-green)', fontWeight:'bold'}}>+{comm.toLocaleString()} DA</td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan="3" style={{textAlign:'center', color:'var(--text-muted)'}}>Aucune vente enregistrée ce mois-ci.</td></tr>
                          )}
                         </tbody>
                       </table>
                     </div>
                   )}

                    {/* Delivery Table (Chauffeurs) */}
                    {selectedEmployee.category === 'Chauffeur' && (
                      <div>
                        <h5 style={{fontSize:'0.9rem', marginBottom:5, color:'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6}}>
                          <Truck size={14} /> Livraisons (Chauffeurs / Livreurs)
                        </h5>
                        <table style={{fontSize: '0.85rem'}}>
                          <thead><tr><th>Date</th><th>Trajet</th><th>Commande(s)</th><th>Prime</th></tr></thead>
                          <tbody>
                           {(performanceData.deliveries || []).length > 0 ? (performanceData.deliveries || []).map(d => {
                             return (
                               <tr key={d.id}>
                                 <td>{d.deliveryDate}</td>
                                 <td>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                     <span className="badge" style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b', fontSize: '0.8em', padding: '2px 8px' }}>
                                       {d.sourceLocation?.name || '🏭 Usine'}
                                     </span>
                                     <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                                     <span className="badge" style={{ background: d.destWilaya ? 'rgba(34,197,94,0.1)' : 'rgba(236,72,153,0.1)', color: d.destWilaya ? '#22c55e' : '#ec4899', fontSize: '0.8em', padding: '2px 8px' }}>
                                       {d.destWilaya || d.destLocation?.name || '🏭 Usine'}
                                     </span>
                                   </div>
                                 </td>
                                 <td style={{ fontSize: '0.85em' }}>
                                   {d.deliveryOrders?.length > 0
                                     ? d.deliveryOrders.map(dO => (
                                         <div key={dO.id}>#{dO.order?.id} {dO.order?.customer?.name || ''}</div>
                                       ))
                                     : d.order ? `#${d.order.id} ${d.order.customer?.name || ''}` : (d.type === 'transfer' ? 'Transfert' : '—')
                                   }
                                 </td>
                                 <td style={{color: d.routePrime > 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight:'bold'}}>
                                   {d.routePrime > 0 ? `+${Number(d.routePrime).toLocaleString()} DA` : 'Non configuré'}
                                 </td>
                               </tr>
                             );
                           }) : (
                             <tr><td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)'}}>Aucune livraison ce mois-ci.</td></tr>
                           )}
                          </tbody>
                        </table>
                        {(performanceData.deliveries || []).length > 0 && (
                          <div style={{ textAlign: 'right', marginTop: 8, fontSize: '0.9rem', fontWeight: 700, color: '#22c55e' }}>
                            Total Primes: {totalDeliveryPrimes.toLocaleString()} DA
                          </div>
                        )}
                      </div>
                    )}
                 </div>
               )}
             </div>

             <div style={{background: 'var(--bg-hover)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <h4 style={{margin: 0}}><Calculator size={16} style={{marginRight: 5, verticalAlign:'middle'}}/> Historique des Paiements</h4>
                  <button className="btn btn-primary" onClick={openPaymentModal}>Payer & Valider Bonus</button>
               </div>
               
               <table style={{fontSize: '0.85rem', background: 'transparent'}}>
                 <thead><tr><th>Date</th><th>Motif</th><th>Montant</th><th>Action</th></tr></thead>
                 <tbody>
                    {selectedEmployee.payments?.map(p => (
                      <tr key={p.id}>
                        <td>{p.date}</td><td>{p.description}</td>
                        <td style={{color:'#10b981', fontWeight:'bold'}}>{Number(p.amount).toLocaleString()} DA</td>
                        <td>
                          {['admin', 'gerant', 'production'].includes(user?.role) && (
                            <button className="btn-icon danger" onClick={() => handleDeletePayment(p.id)} title="Annuler ce paiement">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!selectedEmployee.payments || selectedEmployee.payments.length === 0) && (
                        <tr><td colSpan="4" style={{textAlign:'center'}}>Aucun versement effectué.</td></tr>
                    )}
                 </tbody>
               </table>
             </div>

          </div>
        ) : (
           <div className="table-container" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight: '300px', opacity: 0.5}}>
              <p><ArrowRight size={20} style={{marginRight: 10, verticalAlign:'middle'}}/> Cliquez sur un employé pour voir sa production et gérer sa paie.</p>
           </div>
        )}

      </div>

      {/* --- MODALS --- */}
      {showModal && (
        <Modal title={editingEmployee ? "Modifier Employé" : "Nouvel Employé"} onClose={() => setShowModal(false)} onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom Complet *</label>
            <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rôle / Catégorie *</label>
              <select className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required>
                <option value="Ouvrier">Ouvrier (Usine)</option>
                <option value="Vendeur">Vendeur (Commercial)</option>
                <option value="Chauffeur">Chauffeur / Livreur</option>
              </select>
            </div>
            <div className="form-group">
              <label>Salaire Fixe Mensuel (DA)</label>
              <input className="form-control" type="number" min="0" value={form.baseSalary} onChange={e => setForm({...form, baseSalary: e.target.value})} />
            </div>
          </div>
          {form.category === 'Vendeur' && (
            <div className="form-group">
              <label>Taux de Commission Ventes (%)</label>
              <input className="form-control" type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={e => setForm({...form, commissionRate: e.target.value})} />
            </div>
          )}
          <div className="form-group">
            <label>Coût Assurance Annuelle (DA)</label>
            <input className="form-control" type="number" min="0" value={form.insuranceCost} onChange={e => setForm({...form, insuranceCost: e.target.value})} />
          </div>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title={`Versement - ${selectedEmployee?.name}`} onClose={() => setShowPaymentModal(false)} onSubmit={handlePayment}>
          <div style={{marginBottom: '15px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.9rem'}}>
             Paie de <b>{selectedMonth}</b>.
             {selectedEmployee?.category === 'Vendeur'
               ? ` Prime calculée à ${selectedEmployee.commissionRate}% sur les ventes.`
               : selectedEmployee?.category === 'Chauffeur'
                ? ` Prime calculée automatiquement depuis les tarifs de livraison.`
                : ` Prime calculée automatiquement depuis les tarifs de fabrication.`
             }
          </div>

          <div className="form-row" style={{ marginBottom: '15px' }}>
            <div className="form-group">
              <label>Salaire Fixe (Base)</label>
              <input className="form-control" type="number" min="0" value={paymentForm.baseAmount} onChange={e => setPaymentForm({...paymentForm, baseAmount: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Prime</label>
              <input className="form-control" type="number" min="0" value={paymentForm.bonusAmount} onChange={e => setPaymentForm({...paymentForm, bonusAmount: e.target.value})} />
              <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginTop: 4}}>
                {selectedEmployee?.category === 'Vendeur'
                  ? `${selectedEmployee.commissionRate}% de ${totalSalesFinal.toLocaleString()} DA ventes = ${Math.round(totalSalesCommission).toLocaleString()} DA`
                  : selectedEmployee?.category === 'Chauffeur'
                   ? `${(performanceData.deliveries || []).length} livraisons = ${totalDeliveryPrimes.toLocaleString()} DA`
                   : `Tarifs fabrication : ${Math.round(totalEarnedCommission).toLocaleString()} DA`
                }
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid rgba(16, 185, 129, 0.2)'}}>
             <label style={{color: '#10b981', marginBottom: 2}}>Total à Verser</label>
             <div style={{fontWeight: 'bold', fontSize:'1.4rem', color:'#10b981'}}>
                {(Number(paymentForm.baseAmount) + Number(paymentForm.bonusAmount)).toLocaleString()} DA
             </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date du versement</label>
              <input 
                className="form-control" 
                type="date" 
                style={{cursor: 'pointer'}}
                value={paymentForm.date} 
                onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} 
                onClick={(e) => {
                  if (e.target.showPicker) e.target.showPicker();
                }}
                required 
              />
            </div>
            <div className="form-group">
              <label>Description / Motif</label>
              <input className="form-control" placeholder="Ex: Avance, Paie du mois + Bonus..." value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} required />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
