import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, Package,
  Factory, Truck, CreditCard, Settings, LogOut, Sofa, Book, PackageCheck, Receipt
} from 'lucide-react';

const allNavItems = [
  { section: 'Principal', items: [
    { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'sales', 'gerant', 'production'] },
  ]},
  { section: 'Commerce', items: [
    { path: '/orders', label: 'Commandes', icon: ShoppingCart, roles: ['admin', 'sales', 'gerant'] },
    { path: '/customers', label: 'Clients', icon: Users, roles: ['admin', 'sales', 'gerant'] },
    { path: '/catalog', label: 'Catalogue', icon: Book, roles: ['admin', 'production', 'gerant', 'sales'] },
    { path: '/finance', label: 'Finances', icon: CreditCard, roles: ['admin', 'sales', 'gerant'] },
  ]},
  { section: 'Opérations', items: [
    { path: '/production', label: 'Fabrication', icon: Factory, roles: ['admin', 'production', 'gerant'] },
    { path: '/finished-products', label: 'Stock (Produits Finis)', icon: PackageCheck, roles: ['admin', 'production', 'gerant', 'delivery', 'sales'] },
    { path: '/inventory', label: 'Matières Premières', icon: Package, roles: ['admin', 'production', 'gerant'] },
    { path: '/deliveries', label: 'Livraisons', icon: Truck, roles: ['admin', 'delivery'] },
  ]},
  { section: 'Administration', items: [
    { path: '/tariffs', label: 'Tarifs & Coûts', icon: Receipt, roles: ['admin'] },
    { path: '/users', label: 'Utilisateurs', icon: Settings, roles: ['admin'] },
  ]},
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const ObjectTitles = {
      '/': 'Tableau de bord',
      '/orders': 'Commandes',
      '/customers': 'Clients',
      '/catalog': 'Catalogue Produits',
      '/finance': 'Finances',
      '/production': 'Fabrication',
      '/finished-products': 'Stock (Produits Finis)',
      '/inventory': 'Matières Premières',
      '/deliveries': 'Livraisons',
      '/tariffs': 'Tarifs & Coûts',
      '/users': 'Utilisateurs',
    };
    return ObjectTitles[location.pathname] || 'ERP Le Canapé';
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon"><Sofa size={22} /></div>
            <div>
              <h1>Le Canapé</h1>
              <span>ERP System</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {allNavItems.map(section => {
            const visibleItems = section.items.filter(item => item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section}>
                <div className="nav-section-title">{section.section}</div>
                {visibleItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <item.icon className="nav-icon" size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{getInitials(user?.fullName)}</div>
            <div className="user-details">
              <div className="user-name">{user?.fullName}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button className="btn-logout" onClick={logout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <h2 className="topbar-title">{getPageTitle()}</h2>
          <div className="topbar-actions">
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
        </header>
        <div className="page-content page-transition">
          {children}
        </div>
      </main>
    </div>
  );
}
