import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import DatabaseExplorer from './pages/DatabaseExplorer';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Deliveries from './pages/Deliveries';
import Finance from './pages/Finance';
import Catalog from './pages/Catalog';
import FinishedProducts from './pages/FinishedProducts';
import UsersPage from './pages/Users';
import './index.css';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute roles={['admin']}><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute roles={['admin','sales']}><Customers /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute roles={['admin','sales']}><Orders /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute roles={['admin','production','gerant']}><Inventory /></ProtectedRoute>} />
      <Route path="/catalog" element={<ProtectedRoute roles={['admin','production','gerant']}><Catalog /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute roles={['admin','production','gerant']}><Production /></ProtectedRoute>} />
      <Route path="/finished-products" element={<ProtectedRoute roles={['admin','production','gerant','delivery','sales']}><FinishedProducts /></ProtectedRoute>} />
      <Route path="/deliveries" element={<ProtectedRoute roles={['admin','delivery']}><Deliveries /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute roles={['admin','sales']}><Finance /></ProtectedRoute>} />
      <Route path="/database" element={<ProtectedRoute roles={['admin']}><DatabaseExplorer /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
