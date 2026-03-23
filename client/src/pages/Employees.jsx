import { useState, useEffect, useContext } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Pencil, Briefcase, Calculator, Award, ArrowRight } from 'lucide-react';

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
  const totalActivityVolume = totalSalesFinal + totalProductionValue;

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
    const suggestedBonus = totalActivityVolume * (Number(selectedEmployee.commissionRate || 0) / 100);

    setPaymentForm({
        baseAmount: Number(selectedEmployee.baseSalary) || 0,
        bonusAmount: Math.round(suggestedBonus),
        date: new Date().toISOString().split('T')[0],
        description: `Salaire + Prime (${selectedMonth})`,
        type: 'percentage', // Default back to admin-percentage-decision
        customRate: selectedEmployee.commissionRate || 0
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
        <button className="btn btn-primary" onClick={() => { 
            setEditingEmployee(null); 
            setForm({ name: '', category: 'Ouvrier', baseSalary: 0, insuranceCost: 0, commissionRate: 0, notes: '' });
            setShowModal(true); 
        }}>
          <Plus size={16} /> Nouvel Employé
        </button>
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
                    <div className="action-buttons">
                      <button className="btn-icon edit" onClick={() => { setEditingEmployee(e); setForm(e); setShowModal(true); }}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></button>
                    </div>
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
               <input 
                  type="month" 
                  className="form-control" 
                  style={{width: '150px'}} 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)} 
                />
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
                         <thead><tr><th>Date</th><th>Commande/Modèle</th><th>Valeur Base</th><th>Commission</th></tr></thead>
                         <tbody>
                          {(performanceData.productions || []).length > 0 ? (performanceData.productions || []).map(p => {
                            const valBase = Number(p.basePrice || 0) * Number(p.quantity || 1);
                            const comm = valBase * (Number(selectedEmployee.commissionRate || 0) / 100);
                            return (
                              <tr key={p.id}>
                                <td>{p.completionDate}</td>
                                <td style={{fontWeight: 600}}>
                                  {p.orderId ? `Cde #${p.orderId}` : (p.productModel?.name || 'Stock')} (x{p.quantity || 1})
                                </td>
                                <td>{valBase.toLocaleString()} DA</td>
                                <td style={{color:'var(--accent-green)', fontWeight:'bold'}}>
                                  +{comm.toLocaleString()} DA
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr><td colSpan="3" style={{textAlign:'center', color:'var(--text-muted)'}}>Aucune production ce mois-ci.</td></tr>
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
                          {['admin', 'gerant'].includes(user?.role) && (
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
                <option value="Tapissier">Tapissier</option>
                <option value="Menuisier">Menuisier</option>
                <option value="Coupeur">Coupeur</option>
                <option value="Couturier">Couturier</option>
                <option value="Chauffeur">Chauffeur / Livreur</option>
                <option value="Assistant">Assistant</option>
                <option value="Gérant">Gérant</option>
              </select>
            </div>
            <div className="form-group">
              <label>Salaire Fixe Mensuel (DA)</label>
              <input className="form-control" type="number" min="0" value={form.baseSalary} onChange={e => setForm({...form, baseSalary: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Taux de Commission par défaut (%)</label>
              <input className="form-control" type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={e => {
                  let parsedRate = parseFloat(e.target.value);
                  if (isNaN(parsedRate)) parsedRate = 0;
                  setForm({...form, commissionRate: e.target.value});
              }} onBlur={e => {
                  let parsedRate = parseFloat(e.target.value);
                  if (isNaN(parsedRate)) parsedRate = 0;
                  setForm({...form, commissionRate: Math.round(parsedRate * 100) / 100});
              }} />
            </div>
            <div className="form-group">
              <label>Coût Assurance Annuelle (DA)</label>
              <input className="form-control" type="number" min="0" value={form.insuranceCost} onChange={e => setForm({...form, insuranceCost: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title={`Versement Libre - ${selectedEmployee?.name}`} onClose={() => setShowPaymentModal(false)} onSubmit={handlePayment}>
          <div className="alert-info" style={{marginBottom: '15px', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '0.9rem'}}>
             Vous préparez la paie de <b>{selectedMonth}</b>.<br/> 
             Choisissez comment vous souhaitez définir la prime pour ce mois.
          </div>
          
          <div className="form-group" style={{marginBottom:15}}>
              <label>Comment voulez-vous définir la prime ?</label>
              <div style={{display:'flex', gap:10, marginTop:5}}>
                <button type="button" className={`btn ${paymentForm.type === 'fixed' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPaymentForm({...paymentForm, type: 'fixed', bonusAmount: 0})}>
                  ✏️ Saisir / Forcer un montant
                </button>
                <button type="button" className={`btn ${paymentForm.type === 'percentage' ? 'btn-primary' : 'btn-outline'}`} onClick={() => {
                  const calcBonus = totalActivityVolume * (paymentForm.customRate / 100);
                  setPaymentForm({...paymentForm, type: 'percentage', bonusAmount: Math.round(calcBonus)});
                }}>
                  📊 Calculer avec un pourcentage (Admin Seul)
                </button>
              </div>
          </div>

          <div className="form-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
            <div className="form-group">
              <label>1. Salaire Fixe (Base)</label>
              <input className="form-control" type="number" min="0" value={paymentForm.baseAmount} onChange={e => setPaymentForm({...paymentForm, baseAmount: e.target.value})} title="Vous pouvez modifier le salaire fixe exceptionnellement" />
            </div>

            {paymentForm.type === 'fixed' ? (
              <div className="form-group">
                <label>2. Montant de la Prime (DA)</label>
                <input className="form-control" type="number" min="0" value={paymentForm.bonusAmount} onChange={e => setPaymentForm({...paymentForm, bonusAmount: e.target.value})} placeholder="Saisir la prime manuellement" />
              </div>
            ) : (
              <div className="form-group" style={{background:'#f8fafc', padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0'}}>
                <label>2. Taux de Commission (%)</label>
                <div style={{display:'flex', alignItems:'center', gap: '10px'}}>
                  <input className="form-control" type="number" step="0.01" min="0" max="100" style={{width: '80px'}} value={paymentForm.customRate} onChange={e => {
                    // Fix float precision issues (e.g. 5.99999999 -> 6.0)
                    let parsedRate = parseFloat(e.target.value);
                    if (isNaN(parsedRate)) parsedRate = 0;
                    
                    const rate = Math.round(parsedRate * 100) / 100;
                    const calcBonus = totalActivityVolume * (rate / 100);
                    // Use the exact typed string to prevent jumps, but calculate with the clean rate
                    setPaymentForm({...paymentForm, customRate: e.target.value, bonusAmount: Math.round(calcBonus)});
                  }} />
                  <div style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>
                    = <strong style={{color:'var(--primary-color)'}}>{Number(paymentForm.bonusAmount).toLocaleString()} DA</strong> de prime calculée
                  </div>
                </div>
                 <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginTop:4}}>
                  Basé sur : {totalActivityVolume.toLocaleString()} DA de volume d'activité
                </div>
              </div>
            )}
          </div>

          <div className="form-row" style={{ background: '#ecfdf5', padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
             <div className="form-group" style={{marginBottom: 0}}>
                <label style={{color: '#065f46'}}>Total à Verser (Base + Prime) *</label>
                <div style={{fontWeight: 'bold', fontSize:'1.4rem', color:'#10b981'}}>
                   {(Number(paymentForm.baseAmount) + Number(paymentForm.bonusAmount)).toLocaleString()} DA
                </div>
             </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date du versement</label>
              <input className="form-control" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description / Motif du Versement</label>
              <input className="form-control" placeholder="Ex: Avance, Paie du mois + Bonus..." value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} required />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
