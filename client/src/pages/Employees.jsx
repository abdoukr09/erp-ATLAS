import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Trash2, Pencil, Briefcase, Calculator, Award, ArrowRight } from 'lucide-react';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'Ouvrier', baseSalary: 0, insuranceCost: 0, notes: '' });

  // Performance View
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);

  // Payment Override Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], description: '' });

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
      setPerformanceData(res.data);
    } catch (err) {
      console.error("Error fetching performance", err);
    } finally {
      setPerfLoading(false);
    }
  };

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
    // Determine suggested payment
    const totalAdvance = selectedEmployee.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    // Real formula would be more complex if "total base" is paid dynamically. Here we suggest they pay whatever they want, but show them the base salary + bonus.
    setPaymentForm({
        amount: Number(selectedEmployee.baseSalary) || 0, // Suggest the stable base by default. Admin overrides to add bonus.
        date: new Date().toISOString().split('T')[0],
        description: `Salaire + Prime (${selectedMonth})`
    });
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
     try {
         await api.post(`/employees/${selectedEmployee.id}/payments`, paymentForm);
         setShowPaymentModal(false);
         fetchEmployees(); // refresh total lists
     } catch (err) { alert('Erreur de paiement'); }
  };

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement du personnel...</div>;

  return (
    <div className="page-transition">
      <div className="table-header" style={{ marginBottom: '20px' }}>
        <h2>Gestion du Personnel & Paie</h2>
        <p style={{color:'var(--text-muted)'}}>Gérez les ouvriers, suivez leur production mensuelle, et calculez leurs salaires et primes manuellement.</p>
        <button className="btn btn-primary" onClick={() => { 
            setEditingEmployee(null); 
            setForm({ name: '', category: 'Ouvrier', baseSalary: 0, insuranceCost: 0, notes: '' });
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
               <h4><Award size={16} style={{marginRight: 5, verticalAlign:'middle', color:'#eab308'}}/> Production du Mois ({selectedMonth})</h4>
               {perfLoading ? <p>Chargement de la production...</p> : (
                 <table style={{fontSize: '0.85rem', marginTop: '10px'}}>
                   <thead><tr><th>Date Fin</th><th>Produit Réalisé</th><th>Qté</th></tr></thead>
                   <tbody>
                     {performanceData.length > 0 ? performanceData.map(p => (
                       <tr key={p.id}>
                         <td>{p.completionDate}</td>
                         <td style={{fontWeight: 600}}>{p.productModel?.name || `Commande #${p.orderId}`}</td>
                         <td>{p.quantity}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan="3" style={{textAlign:'center', color:'var(--text-muted)'}}>Aucune production validée ce mois-ci par cet ouvrier.</td></tr>
                     )}
                   </tbody>
                   {performanceData.length > 0 && (
                     <tfoot>
                       <tr>
                         <td colSpan="2" style={{textAlign:'right', fontWeight:700}}>Total Articles Fabriqués :</td>
                         <td style={{fontWeight: 800, color:'var(--primary-color)'}}>{performanceData.reduce((sum, p) => sum + p.quantity, 0)}</td>
                       </tr>
                     </tfoot>
                   )}
                 </table>
               )}
             </div>

             <div style={{background: 'var(--bg-hover)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <h4 style={{margin: 0}}><Calculator size={16} style={{marginRight: 5, verticalAlign:'middle'}}/> Historique des Paiements</h4>
                  <button className="btn btn-primary" onClick={openPaymentModal}>Payer & Valider Bonus</button>
               </div>
               
               <table style={{fontSize: '0.85rem', background: 'transparent'}}>
                 <thead><tr><th>Date</th><th>Motif</th><th>Montant</th></tr></thead>
                 <tbody>
                    {selectedEmployee.payments?.map(p => (
                      <tr key={p.id}>
                        <td>{p.date}</td><td>{p.description}</td>
                        <td style={{color:'#10b981', fontWeight:'bold'}}>{Number(p.amount).toLocaleString()} DA</td>
                      </tr>
                    ))}
                    {(!selectedEmployee.payments || selectedEmployee.payments.length === 0) && (
                        <tr><td colSpan="3" style={{textAlign:'center'}}>Aucun versement effectué.</td></tr>
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
              <label>Rôle / Catégorie</label>
              <input className="form-control" placeholder="Ex: Tapissier, Coupeur..." value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Salaire Fixe / Base (DA)</label>
              <input className="form-control" type="number" min="0" value={form.baseSalary} onChange={e => setForm({...form, baseSalary: e.target.value})} />
            </div>
          </div>
          <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginTop: '-10px', marginBottom: '15px'}}>Laissez le Salaire Fixe à 0 si l'ouvrier est payé 100% à la pièce.</p>
          <div className="form-group">
            <label>Coût Assurance Annuelle (DA)</label>
            <input className="form-control" type="number" min="0" value={form.insuranceCost} onChange={e => setForm({...form, insuranceCost: e.target.value})} />
          </div>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title={`Versement Libre - ${selectedEmployee?.name}`} onClose={() => setShowPaymentModal(false)} onSubmit={handlePayment}>
          <div className="alert-info" style={{marginBottom: '15px', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '0.9rem'}}>
             Vous analysez la production du mois de <b>{selectedMonth}</b>.<br/> 
             C'est l'Admin (Vous) qui définit le Bonus final en fonction du travail accompli.
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date du versement</label>
              <input className="form-control" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Montant Final (DA) *</label>
              <input className="form-control" type="number" min="0" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required style={{fontWeight: 'bold', fontSize:'1.1rem', color:'#10b981'}} />
            </div>
          </div>
          <div className="form-group">
            <label>Description / Motif du Versement</label>
            <input className="form-control" placeholder="Ex: Avance, Paie du mois + Bonus..." value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} required />
          </div>
        </Modal>
      )}

    </div>
  );
}
