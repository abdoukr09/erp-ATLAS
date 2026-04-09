import { useState, useEffect } from 'react';
import api from '../api';
import Layout from '../components/Layout';
import { 
  Calendar, Factory, CreditCard, Truck, Users, FileText, 
  ChevronLeft, ChevronRight, Package, ArrowDown, ArrowUp, Clock, AlertTriangle
} from 'lucide-react';

const SECTION_COLORS = {
  production: { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.25)', icon: '#6366f1' },
  salaries: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.25)', icon: '#10b981' },
  orders: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', icon: '#f59e0b' },
  payments: { bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.25)', icon: '#38bdf8' },
  deliveries: { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.25)', icon: '#a855f7' },
  audit: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.25)', icon: '#f43f5e' }
};

export default function Reports() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({ production: true, salaries: true, orders: true, payments: true, deliveries: true, audit: false });

  useEffect(() => { fetchReport(); }, [date]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/daily?date=${date}`);
      setReport(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const toggleSection = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  const formatProductionTime = (p) => {
    if (!p.startDate) return '—';
    if (!p.endDate) return <span><span className="badge badge-pending" style={{fontSize:'0.7rem'}}>{p.startTime || '00:00'}</span> Début</span>;

    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 2) {
      return <span><span className="badge badge-in_progress" style={{fontSize:'0.7rem'}}>{p.startTime || '00:00'}</span> – <span className="badge badge-completed" style={{fontSize:'0.7rem'}}>{p.endTime || '00:00'}</span></span>;
    } else {
      const fd = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      };
      return (
        <div style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
          <div>{fd(p.startDate)} <span style={{fontWeight:600}}>{p.startTime || '00:00'}</span></div>
          <div style={{ color: 'var(--text-muted)', margin:'2px 0' }}>↓ {fd(p.endDate)} <span style={{fontWeight:600}}>{p.endTime || '00:00'}</span></div>
        </div>
      );
    }
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  const SummaryCard = ({ icon: Icon, label, value, color, sub }) => (
    <div style={{
      background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex', alignItems: 'center', gap: '14px',
      flex: 1, minWidth: '160px'
    }}>
      <div style={{ width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}22` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );

  const SectionHeader = ({ sectionKey, icon: Icon, title, count, colors }) => (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', cursor: 'pointer', borderRadius: '10px',
        background: colors.bg, border: `1px solid ${colors.border}`,
        transition: 'all 0.2s', marginBottom: expanded[sectionKey] ? '12px' : 0
      }}
      onClick={() => toggleSection(sectionKey)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon size={18} style={{ color: colors.icon }} />
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ 
          background: colors.icon, color: '#fff', fontSize: '0.75rem', fontWeight: 700,
          padding: '2px 8px', borderRadius: '10px', minWidth: '22px', textAlign: 'center'
        }}>{count}</span>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded[sectionKey] ? '▲ Réduire' : '▼ Développer'}</span>
    </div>
  );

  if (loading) return <div className="page-transition" style={{textAlign:'center', padding:'50px'}}>Chargement du rapport...</div>;
  if (!report) return <div className="page-transition" style={{textAlign:'center', padding:'50px', color:'var(--text-muted)'}}>Impossible de charger le rapport. Réessayez.</div>;

  const s = report.summary || {};

  return (
    <div className="page-transition">
      {/* Date Navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: 0 }}>📋 Rapport Journalier</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Récapitulatif complet de l'activité de l'entreprise
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-outline" style={{ padding: '6px 10px' }} onClick={() => changeDate(-1)}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} style={{ color: 'var(--primary-color)' }} />
            <input
              type="date"
              className="form-control"
              style={{ width: '160px', textAlign: 'center', fontWeight: 600, cursor: 'pointer' }}
              value={date}
              onChange={e => setDate(e.target.value)}
              onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
            />
          </div>
          <button className="btn btn-outline" style={{ padding: '6px 10px' }} onClick={() => changeDate(1)} disabled={isToday}>
            <ChevronRight size={16} />
          </button>
          {!isToday && (
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setDate(new Date().toISOString().split('T')[0])}>
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard icon={Factory} label="Fabrications" value={s.productionsCount} color="#6366f1" />
        <SummaryCard icon={Users} label="Paie Employés" value={s.employeePaymentsCount} color="#10b981" sub={s.employeePaymentsTotal > 0 ? `${Number(s.employeePaymentsTotal).toLocaleString()} DA` : null} />
        <SummaryCard icon={Package} label="Commandes" value={s.ordersCount} color="#f59e0b" />
        <SummaryCard icon={CreditCard} label="Paiements Clients" value={s.customerPaymentsCount} color="#38bdf8" sub={s.customerPaymentsTotal > 0 ? `${Number(s.customerPaymentsTotal).toLocaleString()} DA` : null} />
        <SummaryCard icon={Truck} label="Livraisons" value={s.deliveriesCount} color="#a855f7" />
        <SummaryCard icon={FileText} label="Modifications" value={s.modificationsCount} color="#f43f5e" />
      </div>

      {/* ===== PRODUCTION ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="production" icon={Factory} title="Fabrication" count={s.productionsCount} colors={SECTION_COLORS.production} />
        {expanded.production && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.productions.length > 0 ? (
              <table style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>ID</th><th>Horaires</th><th>Modèle</th><th>Client / Cde</th><th>Statut</th><th>Ouvriers</th></tr></thead>
                <tbody>
                  {report.productions.map(p => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{formatProductionTime(p)}</td>
                      <td style={{fontWeight:600}}>{p.orderItem?.sofaModel || p.productModel?.name || '—'}</td>
                      <td>{p.orderItem ? `Cde #${p.orderItem.order?.id} — ${p.orderItem.order?.customer?.name || ''}` : <span className="badge badge-delivered">STOCK</span>}</td>
                      <td><span className={`badge badge-${p.status}`}>{p.status === 'in_progress' ? 'En cours' : p.status === 'completed' ? 'Terminé' : 'En attente'}</span></td>
                      <td>
                        {p.workerAssignments?.length > 0 ? (
                          <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                            {p.workerAssignments.map(wa => (
                              <div key={wa.id} style={{fontSize:'0.8rem'}}>
                                {wa.workerType && <span className="badge badge-scheduled" style={{fontSize:'0.7rem', marginRight:3}}>{wa.workerType.name}</span>}
                                {wa.worker?.name}
                                {wa.commissionValue > 0 && <span style={{color:'var(--accent-green)', marginLeft:4, fontWeight:600}}>
                                  {wa.commissionType === 'fixed' ? `${Number(wa.commissionValue).toLocaleString()} DA` : `${wa.commissionValue}%`}
                                </span>}
                              </div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucune fabrication ce jour.</p>}
          </div>
        )}
      </div>

      {/* ===== EMPLOYEE PAYMENTS ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="salaries" icon={Users} title="Paie & Salaires" count={s.employeePaymentsCount} colors={SECTION_COLORS.salaries} />
        {expanded.salaries && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.employeePayments.length > 0 ? (
              <table style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>Employé</th><th>Catégorie</th><th>Montant</th><th>Description</th></tr></thead>
                <tbody>
                  {report.employeePayments.map(ep => (
                    <tr key={ep.id}>
                      <td style={{fontWeight:600}}>{ep.employee?.name || '—'}</td>
                      <td><span className="badge badge-in_progress">{ep.employee?.category}</span></td>
                      <td style={{fontWeight:700, color:'var(--accent-green)'}}>
                        {Number(ep.amount).toLocaleString()} DA
                      </td>
                      <td style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>{ep.description || '—'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'rgba(16, 185, 129, 0.05)'}}>
                    <td colSpan="2" style={{fontWeight:700, textAlign:'right'}}>TOTAL</td>
                    <td style={{fontWeight:700, color:'var(--accent-green)', fontSize:'1rem'}}>
                      {Number(s.employeePaymentsTotal).toLocaleString()} DA
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucun versement ce jour.</p>}
          </div>
        )}
      </div>

      {/* ===== ORDERS ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="orders" icon={Package} title="Commandes" count={s.ordersCount} colors={SECTION_COLORS.orders} />
        {expanded.orders && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.orders.length > 0 ? (
              <table style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>Cde #</th><th>Client</th><th>Statut</th><th>Articles</th><th>Total</th></tr></thead>
                <tbody>
                  {report.orders.map(o => (
                    <tr key={o.id}>
                      <td style={{fontWeight:600}}>#{o.id}</td>
                      <td>{o.customer?.name || '—'}</td>
                      <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                      <td style={{fontSize:'0.8rem'}}>
                        {o.items?.map(i => `${i.sofaModel} ×${i.quantity}`).join(', ') || '—'}
                      </td>
                      <td style={{fontWeight:600}}>{Number(o.totalPrice || 0).toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucune commande ce jour.</p>}
          </div>
        )}
      </div>

      {/* ===== CUSTOMER PAYMENTS ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="payments" icon={CreditCard} title="Paiements Clients Reçus" count={s.customerPaymentsCount} colors={SECTION_COLORS.payments} />
        {expanded.payments && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.customerPayments.length > 0 ? (
              <table style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>Client</th><th>Cde #</th><th>Montant</th><th>Type</th></tr></thead>
                <tbody>
                  {report.customerPayments.map(cp => (
                    <tr key={cp.id}>
                      <td style={{fontWeight:600}}>{cp.order?.customer?.name || '—'}</td>
                      <td>#{cp.order?.id}</td>
                      <td style={{fontWeight:700, color:'var(--accent-green)'}}>{Number(cp.amount).toLocaleString()} DA</td>
                      <td><span className="badge badge-scheduled">{cp.type || 'Paiement'}</span></td>
                    </tr>
                  ))}
                  <tr style={{background:'rgba(56, 189, 248, 0.05)'}}>
                    <td colSpan="2" style={{fontWeight:700, textAlign:'right'}}>TOTAL</td>
                    <td style={{fontWeight:700, color:'var(--accent-green)', fontSize:'1rem'}}>{Number(s.customerPaymentsTotal).toLocaleString()} DA</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucun paiement reçu ce jour.</p>}
          </div>
        )}
      </div>

      {/* ===== DELIVERIES ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="deliveries" icon={Truck} title="Livraisons" count={s.deliveriesCount} colors={SECTION_COLORS.deliveries} />
        {expanded.deliveries && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.deliveries.length > 0 ? (
              <table style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>Cde #</th><th>Client</th><th>Statut</th><th>Notes</th></tr></thead>
                <tbody>
                  {report.deliveries.map(d => (
                    <tr key={d.id}>
                      <td style={{fontWeight:600}}>#{d.order?.id || d.orderId}</td>
                      <td>{d.order?.customer?.name || '—'}</td>
                      <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                      <td style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>{d.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucune livraison ce jour.</p>}
          </div>
        )}
      </div>

      {/* ===== AUDIT LOG ===== */}
      <div style={{ marginBottom: '20px' }}>
        <SectionHeader sectionKey="audit" icon={FileText} title="Journal des Modifications" count={s.modificationsCount} colors={SECTION_COLORS.audit} />
        {expanded.audit && (
          <div className="table-container" style={{ padding: '0' }}>
            {report.auditLogs.length > 0 ? (
              <table style={{ fontSize: '0.82rem' }}>
                <thead><tr><th>Heure</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>ID</th><th>Détails</th></tr></thead>
                <tbody>
                  {report.auditLogs.map(a => (
                    <tr key={a.id}>
                      <td style={{color:'var(--text-muted)'}}><Clock size={12} style={{marginRight:3}}/>{formatTime(a.createdAt)}</td>
                      <td style={{fontWeight:600}}>{a.userName}</td>
                      <td>
                        <span className={`badge ${a.action === 'DELETE' ? 'badge-cancelled' : a.action === 'UPDATE' ? 'badge-in_progress' : 'badge-delivered'}`}>
                          {a.action}
                        </span>
                      </td>
                      <td>{a.modelName}</td>
                      <td>#{a.recordId}</td>
                      <td style={{maxWidth:'400px', fontSize:'0.78rem', color:'var(--text-muted)'}}>
                        {a.action === 'UPDATE' && a.oldValues && a.newValues ? (
                          <div style={{display:'flex', flexDirection:'column', gap:'3px'}}>
                            {Object.keys(a.newValues).filter(k => k !== 'updatedAt' && k !== 'createdAt').map(key => (
                              <div key={key} style={{ padding: '2px 0' }}>
                                <strong style={{color:'var(--text-primary)'}}>{key}:</strong>{' '}
                                <span style={{color:'#f43f5e', textDecoration:'line-through'}}>{String(a.oldValues[key] ?? '—')}</span>
                                {' → '}
                                <span style={{color:'#10b981', fontWeight: 600}}>{String(a.newValues[key] ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        ) : a.action === 'DELETE' && a.oldValues ? (
                          <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                            <span style={{color:'#f43f5e', fontWeight: 600, marginBottom: 3}}>🗑️ Supprimé</span>
                            {Object.entries(a.oldValues).filter(([k]) => !['createdAt','updatedAt','id'].includes(k)).map(([key, val]) => (
                              <div key={key} style={{ padding: '1px 0' }}>
                                <strong>{key}:</strong> {String(val ?? '—')}
                              </div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Aucune modification ce jour.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
