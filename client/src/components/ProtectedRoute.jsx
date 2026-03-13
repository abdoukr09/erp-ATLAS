import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    // Redirect non-admin users to their default modules instead of looping to '/'
    if (user.role === 'sales') return <Navigate to="/orders" replace />;
    if (user.role === 'production') return <Navigate to="/production" replace />;
    if (user.role === 'delivery') return <Navigate to="/deliveries" replace />;
    if (user.role === 'gerant') return <Navigate to="/inventory" replace />;
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}
