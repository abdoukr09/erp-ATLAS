import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, Package,
  Factory, Truck, CreditCard, Settings, LogOut, Sofa, Book, PackageCheck, Receipt,
  BookOpen, Box, Briefcase, ShieldCheck, Database, Wrench, ClipboardList
} from 'lucide-react';

const menuItems = [
  { section: 'Principal', icon: LayoutDashboard, label: 'Tableau de bord', path: '/', roles: ['admin', 'gerant', 'sales'] },
  { section: 'Commerce', icon: BookOpen, label: 'Catalogue', path: '/catalog', roles: ['admin', 'sales', 'gerant', 'production'] },
  { section: 'Commerce', icon: Users, label: 'Clients', path: '/customers', roles: ['admin', 'sales', 'gerant'] },
  { section: 'Commerce', icon: ShoppingCart, label: 'Commandes', path: '/orders', roles: ['admin', 'sales', 'gerant', 'production'] },
  { section: 'Commerce', icon: CreditCard, label: 'Finances', path: '/finance', roles: ['admin', 'sales', 'gerant'] },
  { section: 'Opérations', icon: Box, label: 'Matières Premières', path: '/inventory', roles: ['admin', 'production', 'gerant'] },
  { section: 'Opérations', icon: PackageCheck, label: 'Stock (Produits Finis)', path: '/finished-products', roles: ['admin', 'production', 'gerant', 'delivery', 'sales'] },
  { section: 'Opérations', icon: Factory, label: 'Fabrication', path: '/production', roles: ['admin', 'production', 'gerant'] },
  { section: 'Opérations', icon: Truck, label: 'Livraisons', path: '/deliveries', roles: ['admin', 'delivery', 'gerant'] },
  { section: 'Administration', icon: Briefcase, label: 'Personnel & Paie', path: '/employees', roles: ['admin', 'gerant'] },
  { section: 'Administration', icon: Wrench, label: "Types d'Ouvriers", path: '/worker-types', roles: ['admin'] },
  { section: 'Administration', icon: ClipboardList, label: 'Rapport Journalier', path: '/reports', roles: ['admin'] },
  { section: 'Administration', icon: Receipt, label: 'Tarifs & Coûts', path: '/tariffs', roles: ['admin'] },
  { section: 'Administration', icon: ShieldCheck, label: 'Utilisateurs', path: '/users', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = (path) => {
    switch(path) {
      case '/': return 'Tableau de bord';
      case '/catalog': return 'Catalogue de Modèles';
      case '/customers': return 'Gestion des Clients';
      case '/orders': return 'Suivi des Commandes';
      case '/finance': return 'Rapports Financiers';
      case '/inventory': return 'Stock Matières Premières';
      case '/finished-products': return 'Stock Modèles Finis';
      case '/production': return 'Suivi de Production';
      case '/deliveries': return 'Bons de Livraison';
      case '/employees': return 'Personnel & Paie';
      case '/worker-types': return "Types d'Ouvriers & Tarifs";
      case '/reports': return 'Rapport Journalier';
      case '/tariffs': return 'Suivi des Dépenses';
      case '/users': return 'Comptes Utilisateurs';
      case '/db-explorer': return 'Maintenance Base de données';
      default: return 'ERP Le Canapé';
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

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
          {Object.entries(groupedMenuItems).map(([section, items]) => {
            const visibleItems = items.filter(item => item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section}>
                <div className="nav-section-title">{section}</div>
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
          <h2 className="topbar-title">{getPageTitle(location.pathname)}</h2>
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
