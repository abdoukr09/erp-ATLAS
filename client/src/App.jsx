import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { lazy, Suspense } from 'react';
import './index.css';

import SessionManager from './components/SessionManager';

// Only Login loads immediately. Everything else loads on-demand when the user navigates there.
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Production = lazy(() => import('./pages/Production'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const Finance = lazy(() => import('./pages/Finance'));
const Catalog = lazy(() => import('./pages/Catalog'));
const FinishedProducts = lazy(() => import('./pages/FinishedProducts'));
const UsersPage = lazy(() => import('./pages/Users'));
const Tariffs = lazy(() => import('./pages/Tariffs'));
const Employees = lazy(() => import('./pages/Employees'));
const WorkerTypes = lazy(() => import('./pages/WorkerTypes'));
const Reports = lazy(() => import('./pages/Reports'));
const DeliveryPrimes = lazy(() => import('./pages/DeliveryPrimes'));
const Locations = lazy(() => import('./pages/Locations'));

// Lightweight loading fallback
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '60vh', color: 'var(--text-muted)', fontSize: '0.95rem'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border-color)',
        borderTopColor: 'var(--primary-color, #6366f1)',
        borderRadius: '50%', animation: 'spin 0.6s linear infinite',
        margin: '0 auto 12px'
      }} />
      Chargement...
    </div>
  </div>
);

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute roles={['admin', 'sales', 'gerant']}><Dashboard /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute roles={['admin', 'sales', 'gerant']}><Customers /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute roles={['admin', 'sales', 'gerant', 'production']}><Orders /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute roles={['admin', 'production', 'gerant']}><Inventory /></ProtectedRoute>} />
        <Route path="/catalog" element={<ProtectedRoute roles={['admin', 'production', 'gerant', 'sales']}><Catalog /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute roles={['admin', 'production', 'gerant']}><Production /></ProtectedRoute>} />
        <Route path="/finished-products" element={<ProtectedRoute roles={['admin', 'production', 'gerant', 'delivery', 'sales']}><FinishedProducts /></ProtectedRoute>} />
        <Route path="/deliveries" element={<ProtectedRoute roles={['admin', 'delivery']}><Deliveries /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute roles={['admin', 'sales', 'gerant']}><Finance /></ProtectedRoute>} />
        <Route path="/tariffs" element={<ProtectedRoute roles={['admin']}><Tariffs /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute roles={['admin', 'gerant', 'production']}><Employees /></ProtectedRoute>} />
        <Route path="/worker-types" element={<ProtectedRoute roles={['admin']}><WorkerTypes /></ProtectedRoute>} />
        <Route path="/locations" element={<ProtectedRoute roles={['admin']}><Locations /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
        <Route path="/delivery-primes" element={<ProtectedRoute roles={['admin']}><DeliveryPrimes /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionManager>
          <AppRoutes />
        </SessionManager>
      </AuthProvider>
    </BrowserRouter>
  );
}
