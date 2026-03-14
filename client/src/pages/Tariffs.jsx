import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import { Plus, Trash2, Receipt, Calendar, ArrowRight } from 'lucide-react';

export default function Tariffs() {
  const [expenses, setExpenses] = useState([]);
  const [profitSummary, setProfitSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Loyer', frequency: 'monthly', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, profRes] = await Promise.all([
        api.get('/tariffs/expenses'),
        api.get('/tariffs/profit-summary')
      ]);
      setExpenses(expRes.data);
      setProfitSummary(profRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async () => {
    try {
      await api.post('/tariffs/expenses', expenseForm);
      setShowExpenseModal(false);
      setExpenseForm({ name: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Loyer', frequency: 'monthly', description: '' });
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

  const dailyExpenses = expenses.filter(e => e.frequency === 'daily');
  const monthlyExpenses = expenses.filter(e => e.frequency === 'monthly');
  const yearlyExpenses = expenses.filter(e => e.frequency === 'yearly');

  const ExpenseTable = ({ title, data, totalLabel, iconColor }) => (
    <div className="table-container animate-in" style={{marginBottom: '30px'}}>
      <div className="table-header">
        <h3 style={{display:'flex', alignItems:'center'}}><Calendar size={18} style={{marginRight: 8, color: iconColor}}/> {title}</h3>
      </div>
      <table style={{fontSize: '0.9rem'}}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Intitulé</th>
            <th>Catégorie / Motif</th>
            <th>Montant</th>
            <th style={{textAlign:'right'}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? data.map(e => (
            <tr key={e.id}>
              <td>{e.date}</td>
              <td style={{fontWeight:600}}>{e.name}</td>
              <td><span className="badge badge-pending">{e.category}</span></td>
              <td style={{fontWeight:700, color:'#ef4444'}}>{Number(e.amount).toLocaleString()} DA</td>
              <td style={{textAlign:'right'}}>
                <button className="btn-icon danger" onClick={() => handleExpenseDelete(e.id)}><Trash2 size={14} /></button>
              </td>
            </tr>
          )) : (
            <tr><td colSpan="5" className="table-empty"><p>Aucune dépense enregistrée</p></td></tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan="3" style={{textAlign:'right', fontWeight:700}}>{totalLabel} :</td>
              <td colSpan="2" style={{fontWeight:800, color:'#ef4444', fontSize:'1.1rem'}}>
                {data.reduce((acc, exp) => acc + Number(exp.amount), 0).toLocaleString()} DA
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  return (
    <div className="page-transition">
      <div className="table-header" style={{ marginBottom: '30px' }}>
        <div>
           <h2>Suivi des Coûts & Bénéfice</h2>
           <p style={{color:'var(--text-muted)'}}>Gérez visuellement vos dépenses quotidiennes, mensuelles et annuelles pour calculer votre rentabilité exacte.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
            <Plus size={16} /> Ajouter une Dépense
        </button>
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
               <h3 style={{fontSize: '1.5rem'}}>- {Number(profitSummary.costs.labor).toLocaleString()} DA</h3>
               <p>Masse Salariale</p>
               <small style={{color:'var(--text-muted)'}}>(Paiements validés aux employés)</small>
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
        
        {/* LEFT COLUMN */}
        <div>
          <ExpenseTable title="Dépenses Quotidiennes" data={dailyExpenses} totalLabel="Total Quotidien" iconColor="#eab308" />
          <ExpenseTable title="Charges Annuelles" data={yearlyExpenses} totalLabel="Total Annuel" iconColor="#8b5cf6" />
        </div>

        {/* RIGHT COLUMN */}
        <div>
           <ExpenseTable title="Charges Mensuelles" data={monthlyExpenses} totalLabel="Total Mensuel" iconColor="#3b82f6" />
           <div className="alert-info" style={{marginTop: '20px', padding: '15px', borderRadius: '8px', background:'var(--bg-hover)', border:'1px solid var(--border-color)'}}>
              <h4 style={{margin: '0 0 10px 0', display:'flex', alignItems:'center'}}><Receipt size={18} style={{marginRight:8}}/> À propos du calcul des charges</h4>
              <p style={{margin:0, fontSize:'0.9rem', color:'var(--text-muted)'}}>
                Toutes les dépenses (quotidiennes, mensuelles et annuelles) sont actuellement soustraites du chiffre d'affaires global pour vous donner un résultat "Net Cash". Veillez à équilibrer les charges longue durée.
              </p>
           </div>
        </div>

      </div>

      {showExpenseModal && (
        <Modal title="Nouvelle Charge / Dépense" onClose={() => setShowExpenseModal(false)} onSubmit={handleExpenseSubmit}>
          <div className="form-group" style={{marginBottom: '20px'}}>
             <label style={{marginBottom: '10px', display:'block', fontWeight:600}}>Fréquence de la charge *</label>
             <div style={{display:'flex', gap:'15px'}}>
               <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                 <input type="radio" name="frequency" value="daily" checked={expenseForm.frequency === 'daily'} onChange={e => setExpenseForm({...expenseForm, frequency: e.target.value})} /> 
                 Quotidienne (ex: Transport, Repas)
               </label>
               <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                 <input type="radio" name="frequency" value="monthly" checked={expenseForm.frequency === 'monthly'} onChange={e => setExpenseForm({...expenseForm, frequency: e.target.value})} /> 
                 Mensuelle (ex: Électricité, Employés Fixes)
               </label>
               <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                 <input type="radio" name="frequency" value="yearly" checked={expenseForm.frequency === 'yearly'} onChange={e => setExpenseForm({...expenseForm, frequency: e.target.value})} /> 
                 Annuelle (ex: Loyer Showroom, Assurance)
               </label>
             </div>
          </div>

          <div className="form-group">
            <label>Intitulé exact de la dépense *</label>
            <input className="form-control" placeholder="Ex: Achat fournitures bureau, Loyer Showroom..." value={expenseForm.name} onChange={e => setExpenseForm({...expenseForm, name: e.target.value})} required />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Catégorie (Libre)</label>
              <input className="form-control" placeholder="Ex: Loyer, Transport, Nettoyage..." value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Date de paiement</label>
              <input className="form-control" type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} required />
            </div>
          </div>
          <div className="form-group">
            <label>Montant payé (DA) *</label>
            <input className="form-control" type="number" min="0" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required style={{fontWeight: 'bold', fontSize:'1.1rem', color:'#ef4444'}}/>
          </div>
        </Modal>
      )}

    </div>
  );
}
