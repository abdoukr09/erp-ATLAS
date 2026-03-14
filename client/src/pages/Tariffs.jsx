import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Trash2, Pencil, Briefcase, Receipt, DollarSign } from 'lucide-react';

export default function Tariffs() {
  const [employees, setEmployees] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [profitSummary, setProfitSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', category: 'Ouvrier', insuranceCost: 0, notes: '' });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], description: '' });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Loyer', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, expRes, profRes] = await Promise.all([
        api.get('/tariffs/employees'),
        api.get('/tariffs/expenses'),
        api.get('/tariffs/profit-summary')
      ]);
      setEmployees(empRes.data);
      setExpenses(expRes.data);
      setProfitSummary(profRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- EMPLOYEES LOGIC ---
  const handleEmployeeSubmit = async () => {
    try {
      if (editingEmployee) await api.put(`/tariffs/employees/${editingEmployee.id}`, employeeForm);
      else await api.post('/tariffs/employees', employeeForm);
      setShowEmployeeModal(false);
      fetchData();
    } catch (err) { alert('Error saving employee'); }
  };

  const handleEmployeeDelete = async (id) => {
    if(!confirm("Supprimer cet employé ?")) return;
    try {
      await api.delete(`/tariffs/employees/${id}`);
      fetchData();
    } catch (err) { alert('Error deleting employee'); }
  };

  // --- PAYMENTS LOGIC ---
  const handlePaymentSubmit = async () => {
    try {
      await api.post(`/tariffs/employees/${selectedEmployee.id}/payments`, paymentForm);
      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, date: new Date().toISOString().split('T')[0], description: '' });
      fetchData();
    } catch (err) { alert('Error recording payment'); }
  };

  const deletePayment = async (empId, payId) => {
     if(!confirm("Annuler ce paiement ?")) return;
     try {
         await api.delete(`/tariffs/employees/${empId}/payments/${payId}`);
         fetchData();
     } catch(err) { alert('Error deleting payment'); }
  };

  // --- EXPENSES LOGIC ---
  const handleExpenseSubmit = async () => {
    try {
      await api.post('/tariffs/expenses', expenseForm);
      setShowExpenseModal(false);
      setExpenseForm({ name: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Loyer', description: '' });
      fetchData();
    } catch (err) { alert('Error saving expense'); }
  };

  const handleExpenseDelete = async (id) => {
    if(!confirm("Supprimer cette dépense ?")) return;
    try {
      await api.delete(`/tariffs/expenses/${id}`);
      fetchData();
    } catch (err) { alert('Error deleting expense'); }
  };

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement des données financières...</div>;

  return (
    <div className="page-transition">
      <div className="table-header" style={{ marginBottom: '30px' }}>
        <h2>Tarifs & Rentabilité</h2>
        <p style={{color:'var(--text-muted)'}}>Calculez votre bénéfice réel basé sur les paiements réels, les charges et le coût théorique des matières.</p>
      </div>

      {profitSummary && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '40px' }}>
          <div className="stat-card blue animate-in">
             <div className="stat-info">
               <h3 style={{fontSize: '1.8rem'}}>{Number(profitSummary.revenue).toLocaleString()} DA</h3>
               <p>Chiffre d'Affaires Brut</p>
               <small style={{color:'var(--text-muted)'}}>(Paiements Encaissés)</small>
             </div>
          </div>
          <div className="stat-card orange animate-in">
             <div className="stat-info">
               <h3 style={{fontSize: '1.5rem'}}>- {Number(profitSummary.costs.materials).toLocaleString()} DA</h3>
               <p>Coût Estimé Matières</p>
               <small style={{color:'var(--text-muted)'}}>(Basé sur BOM des livraisons)</small>
             </div>
          </div>
          <div className="stat-card purple animate-in">
             <div className="stat-info">
               <h3 style={{fontSize: '1.5rem'}}>- {Number(profitSummary.costs.expenses + profitSummary.costs.labor).toLocaleString()} DA</h3>
               <p>Charges & Paiements</p>
               <small style={{color:'var(--text-muted)'}}>(Dépenses + Paiements employés)</small>
             </div>
          </div>
          <div className="stat-card green animate-in" style={{background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.2) 100%)', border: '1px solid rgba(34, 197, 94, 0.3)'}}>
             <div className="stat-info">
               <h3 style={{fontSize: '2.2rem', color: '#22c55e'}}>{Number(profitSummary.netProfit).toLocaleString()} DA</h3>
               <p style={{fontWeight:'bold', color: 'var(--text-primary)'}}>Bénéfice Net (Réel)</p>
             </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* EMPLOYEES TABLE */}
        <div className="table-container">
          <div className="table-header">
            <h3><Briefcase size={20} style={{marginRight: 8, verticalAlign:'middle'}}/> Employés & Paiements</h3>
            <button className="btn btn-primary" onClick={() => { 
                setEditingEmployee(null); 
                setEmployeeForm({ name: '', category: 'Ouvrier', insuranceCost: 0, notes: '' });
                setShowEmployeeModal(true); 
            }}>
              <Plus size={16} /> Ajouter Employé
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Assurance (Fixe)</th>
                <th>Total Payé</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length > 0 ? employees.map(e => {
                const totalPaid = e.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
                return (
                <tr key={e.id}>
                  <td style={{fontWeight:600}}>{e.name}</td>
                  <td><span className="badge badge-scheduled">{e.category}</span></td>
                  <td>{Number(e.insuranceCost).toLocaleString()} DA</td>
                  <td style={{fontWeight:700, color:'#10b981'}}>{totalPaid.toLocaleString()} DA</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon success" onClick={() => { setSelectedEmployee(e); setShowPaymentModal(true); }} title="Enregistrer un paiement"><DollarSign size={14} /></button>
                      <button className="btn-icon edit" onClick={() => { setEditingEmployee(e); setEmployeeForm(e); setShowEmployeeModal(true); }}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => handleEmployeeDelete(e.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )}) : (
                <tr><td colSpan="5" className="table-empty"><p>Aucun employé enregistré</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* EXPENSES TABLE */}
        <div className="table-container">
          <div className="table-header">
            <h3><Receipt size={20} style={{marginRight: 8, verticalAlign:'middle'}}/> Charges & Dépenses Libres</h3>
            <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
              <Plus size={16} /> Ajouter Dépense
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Intitulé</th>
                <th>Catégorie</th>
                <th>Montant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td style={{fontWeight:600}}>{e.name}</td>
                  <td><span className="badge badge-pending">{e.category}</span></td>
                  <td style={{fontWeight:700, color:'#ef4444'}}>{Number(e.amount).toLocaleString()} DA</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon danger" onClick={() => handleExpenseDelete(e.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="table-empty"><p>Aucune dépense enregistrée</p></td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{textAlign:'right', fontWeight:700}}>Total Charges :</td>
                <td colSpan="2" style={{fontWeight:800, color:'#ef4444', fontSize:'1.1rem'}}>
                  {expenses.reduce((acc, exp) => acc + Number(exp.amount), 0).toLocaleString()} DA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>

      {/* --- MODALS --- */}
      {showEmployeeModal && (
        <Modal title={editingEmployee ? "Modifier Employé" : "Nouvel Employé"} onClose={() => setShowEmployeeModal(false)} onSubmit={handleEmployeeSubmit}>
          <div className="form-group">
            <label>Nom Complet *</label>
            <input className="form-control" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rôle / Catégorie</label>
              <input className="form-control" placeholder="Ex: Tapissier, Coupeur..." value={employeeForm.category} onChange={e => setEmployeeForm({...employeeForm, category: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Coût Assurance (Fixe / An)</label>
              <input className="form-control" type="number" min="0" value={employeeForm.insuranceCost} onChange={e => setEmployeeForm({...employeeForm, insuranceCost: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}

      {showPaymentModal && selectedEmployee && (
        <Modal title={`Payer: ${selectedEmployee.name}`} onClose={() => setShowPaymentModal(false)} onSubmit={handlePaymentSubmit}>
          
          <div className="table-container" style={{marginBottom: '20px', maxHeight: '150px', overflowY: 'auto'}}>
            <table style={{fontSize: '0.85rem'}}>
               <thead><tr><th>Date</th><th>Motif</th><th>Montant</th><th></th></tr></thead>
               <tbody>
                 {selectedEmployee.payments?.map(p => (
                    <tr key={p.id}>
                      <td>{p.date}</td><td>{p.description}</td>
                      <td style={{color:'#10b981', fontWeight:'bold'}}>{Number(p.amount).toLocaleString()} DA</td>
                      <td><button type="button" className="btn-icon danger" style={{padding:0}} onClick={() => deletePayment(selectedEmployee.id, p.id)}><Trash2 size={12}/></button></td>
                    </tr>
                 ))}
               </tbody>
            </table>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date du paiement</label>
              <input className="form-control" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Montant (DA) *</label>
              <input className="form-control" type="number" min="0" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required />
            </div>
          </div>
          <div className="form-group">
            <label>Description / Motif (Optionnel)</label>
            <input className="form-control" placeholder="Ex: Salaire du mois, Avance pour la tâche X..." value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} />
          </div>
        </Modal>
      )}

      {showExpenseModal && (
        <Modal title="Nouvelle Charge / Dépense Libre" onClose={() => setShowExpenseModal(false)} onSubmit={handleExpenseSubmit}>
          <div className="form-group">
            <label>Intitulé de la dépense *</label>
            <input className="form-control" placeholder="Ex: Facture Sonelgaz, Achat fourniture..." value={expenseForm.name} onChange={e => setExpenseForm({...expenseForm, name: e.target.value})} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Catégorie Libre</label>
              <input className="form-control" placeholder="Ex: Loyer, Transport, Divers..." value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input className="form-control" type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} required />
            </div>
          </div>
          <div className="form-group">
            <label>Montant (DA) *</label>
            <input className="form-control" type="number" min="0" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required />
          </div>
        </Modal>
      )}

    </div>
  );
}
