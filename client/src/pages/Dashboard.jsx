import { useState, useEffect } from 'react';
import api from '../api';
import {
  ShoppingCart, Users, Package, Factory,
  Truck, CreditCard, AlertTriangle, TrendingUp, CalendarDays, Banknote
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#14b8a6', '#ef4444'];

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-transition"><p style={{color:'var(--text-muted)'}}>Loading dashboard...</p></div>;
  if (!data) return <div className="page-transition"><p style={{color:'var(--text-muted)'}}>Failed to load data.</p></div>;

  const { stats, lowStockMaterials, recentOrders, monthlyRevenue, monthlyRevenueByType, orderStatusDistribution } = data;

  const statusLabels = {
    pending: 'En attente',
    in_production: 'En fabrication',
    ready: 'Prêt',
    delivered: 'Livré',
    cancelled: 'Annulé',
  };

  const paymentStatusLabels = {
    unpaid: 'Non payé',
    advance_paid: 'Avance payée',
    fully_paid: 'Entièrement payé',
  };

  const pieData = orderStatusDistribution?.map(item => ({
    name: statusLabels[item.status] || item.status,
    value: parseInt(item.count),
  })) || [];

  // Build stacked bar chart data: combine advance + final by month
  const buildStackedBarData = () => {
    if (!monthlyRevenueByType || monthlyRevenueByType.length === 0) {
      // Fallback to simple monthly revenue
      return (monthlyRevenue || []).map(item => ({
        month: item.month,
        advance: 0,
        final: 0,
        other: parseFloat(item.total),
      }));
    }

    const monthMap = {};
    monthlyRevenueByType.forEach(item => {
      if (!monthMap[item.month]) {
        monthMap[item.month] = { month: item.month, advance: 0, final: 0, other: 0 };
      }
      const type = item.type || 'other';
      monthMap[item.month][type] = parseFloat(item.total);
    });

    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  };

  const stackedBarData = buildStackedBarData();

  return (
    <div className="page-transition">
      {lowStockMaterials?.length > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <span><strong>{lowStockMaterials.length} article(s)</strong> en dessous du stock minimum !</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card blue animate-in">
          <div className="stat-icon blue"><ShoppingCart size={24} /></div>
          <div className="stat-info">
            <h3>{stats.totalOrders}</h3>
            <p>Commandes</p>
          </div>
        </div>
        <div className="stat-card orange animate-in">
          <div className="stat-icon orange"><Factory size={24} /></div>
          <div className="stat-info">
            <h3>{stats.activeProductions}</h3>
            <p>En Fabrication</p>
          </div>
        </div>
        <div className="stat-card teal animate-in">
          <div className="stat-icon teal"><Users size={24} /></div>
          <div className="stat-info">
            <h3>{stats.totalCustomers}</h3>
            <p>Clients</p>
          </div>
        </div>
        {hasRole('admin', 'gerant') && (
          <div className="stat-card green animate-in">
            <div className="stat-icon green"><TrendingUp size={24} /></div>
            <div className="stat-info">
              <h3>{stats.totalRevenue.toLocaleString()} DA</h3>
              <p>Chiffre d'Affaires (Total)</p>
            </div>
          </div>
        )}
        {hasRole('admin', 'gerant') && (
          <div className="stat-card blue animate-in" style={{background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.15) 100%)'}}>
            <div className="stat-icon blue"><Banknote size={24} /></div>
            <div className="stat-info">
              <h3>{stats.totalAdvancePayments.toLocaleString()} DA</h3>
              <p>Avances Reçues</p>
            </div>
          </div>
        )}
        {hasRole('admin', 'gerant') && (
          <div className="stat-card green animate-in" style={{background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.15) 100%)'}}>
            <div className="stat-icon green"><CreditCard size={24} /></div>
            <div className="stat-info">
              <h3>{stats.totalFinalPayments.toLocaleString()} DA</h3>
              <p>Paiements Finaux</p>
            </div>
          </div>
        )}
        {(hasRole('admin', 'sales', 'gerant')) && (
          <div className="stat-card green animate-in" style={{background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.15) 100%)'}}>
            <div className="stat-icon green"><CalendarDays size={24} /></div>
            <div className="stat-info">
              <h3>{stats.todayRevenue ? stats.todayRevenue.toLocaleString() : '0'} DA</h3>
              <p>Chiffre d'Affaires (Aujourd'hui)</p>
            </div>
          </div>
        )}
        <div className="stat-card purple animate-in">
          <div className="stat-icon purple"><Truck size={24} /></div>
          <div className="stat-info">
            <h3>{stats.pendingDeliveries}</h3>
            <p>Livraisons en attente</p>
          </div>
        </div>
        <div className="stat-card pink animate-in">
          <div className="stat-icon amber"><Package size={24} /></div>
          <div className="stat-info">
            <h3>{stats.lowStockCount}</h3>
            <p>Stock Faible</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {hasRole('admin', 'gerant') && (
          <div className="chart-card">
            <h3>Revenus Mensuels — Avances vs Paiements Finaux (DA)</h3>
            {stackedBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stackedBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.2)" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(value, name) => {
                      const labels = { advance: 'Avances', final: 'Paiements Finaux', other: 'Autres' };
                      return [`${Number(value).toLocaleString()} DA`, labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels = { advance: 'Avances', final: 'Paiements Finaux', other: 'Autres' };
                      return labels[value] || value;
                    }}
                  />
                  <Bar dataKey="advance" stackId="revenue" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="final" stackId="revenue" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="other" stackId="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{color:'var(--text-muted)', textAlign:'center', padding:'60px 0'}}>Aucune donnée de revenu</p>
            )}
          </div>
        )}

        <div className="chart-card">
          <h3>Statut des Commandes</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px', color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{color:'var(--text-muted)', textAlign:'center', padding:'60px 0'}}>No orders yet</p>
          )}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>Commandes Récentes</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Modèle</th>
              <th>Total</th>
              <th>Avance</th>
              <th>Paiement Final</th>
              <th>Statut Paiement</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders?.length > 0 ? recentOrders.map(order => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.customer?.name || '—'}</td>
                <td>{order.sofaModel}</td>
                <td>{Number(order.totalPrice).toLocaleString()} DA</td>
                <td style={{color: '#3b82f6', fontWeight: 600}}>{Number(order.advancePayment || 0).toLocaleString()} DA</td>
                <td style={{color: '#22c55e', fontWeight: 600}}>{Number(order.remainingPayment || 0).toLocaleString()} DA</td>
                <td>
                  <span className={`badge badge-${order.paymentStatus === 'fully_paid' ? 'delivered' : order.paymentStatus === 'advance_paid' ? 'in_production' : 'pending'}`}>
                    {paymentStatusLabels[order.paymentStatus] || order.paymentStatus || 'Non payé'}
                  </span>
                </td>
                <td><span className={`badge badge-${order.status}`}>{statusLabels[order.status] || order.status}</span></td>
                <td>{order.orderDate}</td>
              </tr>
            )) : (
              <tr><td colSpan="9" className="table-empty"><p>Aucune commande récente.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
