import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, Package,
  Factory, Truck, CreditCard, Settings, LogOut, Globe, Book, PackageCheck, Receipt,
  BookOpen, Box, Briefcase, ShieldCheck, Database, Wrench, ClipboardList,
  Menu, X, MapPin, Sun, Moon, QrCode, ScanLine
} from 'lucide-react';
import logoAtlas from '../assets/logo-atlas.png';
import OfflineBanner from './OfflineBanner';
import useHasCamera from '../hooks/useHasCamera';

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
  { section: 'Opérations', icon: QrCode, label: 'Étiquettes QR', path: '/labels', roles: ['admin', 'gerant', 'production'] },
  // needsCamera : masqué sur les PC sans webcam, où l'entrée ne mènerait qu'à
  // un écran « Scan indisponible ».
  { section: 'Opérations', icon: ScanLine, label: 'Scanner QR', path: '/scan', roles: ['admin', 'gerant', 'production', 'delivery', 'sales'], needsCamera: true },
  { section: 'Administration', icon: Briefcase, label: 'Personnel & Paie', path: '/employees', roles: ['admin', 'gerant'] },
  { section: 'Administration', icon: Wrench, label: "Types d'Ouvriers", path: '/worker-types', roles: ['admin'] },
  { section: 'Administration', icon: MapPin, label: 'Gestion des Emplacements', path: '/locations', roles: ['admin'] },
  { section: 'Administration', icon: ClipboardList, label: 'Rapport Journalier', path: '/reports', roles: ['admin'] },
  { section: 'Administration', icon: Receipt, label: 'Tarifs & Coûts', path: '/tariffs', roles: ['admin'] },
  { section: 'Administration', icon: MapPin, label: 'Primes de Livraison', path: '/delivery-primes', roles: ['admin'] },
  { section: 'Administration', icon: ShieldCheck, label: 'Utilisateurs', path: '/users', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const cameraAvailable = useHasCamera();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  // Close menu when ESC is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
      case '/labels': return 'Étiquettes QR';
      case '/scan': return 'Scanner QR';
      case '/employees': return 'Personnel & Paie';
      case '/worker-types': return "Types d'Ouvriers & Tarifs";
      case '/reports': return 'Rapport Journalier';
      case '/tariffs': return 'Suivi des Dépenses';
      case '/delivery-primes': return 'Primes de Livraison';
      case '/users': return 'Comptes Utilisateurs';
      case '/db-explorer': return 'Maintenance Base de données';
      default: return 'ERP ATLAS';
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const groupedMenuItems = menuItems
    .filter(item => !item.needsCamera || cameraAvailable)
    .reduce((acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = [];
      }
      acc[item.section].push(item);
      return acc;
    }, {});

  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      <div 
        className={`mobile-overlay ${isMenuOpen ? 'visible' : ''}`} 
        onClick={() => setIsMenuOpen(false)}
      />

      <aside className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={logoAtlas} alt="Atlas Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
            <div>
              <h1>ERP ATLAS</h1>
              <span>System ERP</span>
            </div>
          </div>
          {/* Close button for mobile menu */}
          <button className="menu-toggle" style={{ marginRight: 0 }} onClick={() => setIsMenuOpen(false)}>
            <X size={20} />
          </button>
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="menu-toggle" onClick={() => setIsMenuOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="topbar-title">{getPageTitle(location.pathname)}</h2>
          </div>
          <div className="topbar-actions">
            <button className="btn-icon" onClick={toggleTheme} title="Basculer le thème" style={{ marginRight: '8px' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
        </header>
        <OfflineBanner />
        <div className="page-content page-transition">
          {children}
        </div>
      </main>
    </div>
  );
}
