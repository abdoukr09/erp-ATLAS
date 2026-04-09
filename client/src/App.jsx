import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';

import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Deliveries from './pages/Deliveries';
import Finance from './pages/Finance';
import Catalog from './pages/Catalog';
import FinishedProducts from './pages/FinishedProducts';
import UsersPage from './pages/Users';
import Tariffs from './pages/Tariffs';
import Employees from './pages/Employees';
import WorkerTypes from './pages/WorkerTypes';
import Reports from './pages/Reports';
import './index.css';

import SessionManager from './components/SessionManager';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
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
      <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
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
