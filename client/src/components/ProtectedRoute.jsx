import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import ConnectionRequired from './ConnectionRequired';
import Layout from './Layout';

// `bare` skips the Layout chrome — used by the scanner, which needs the whole
// screen (and a transparent background for the camera preview).
// `offlineCapable` marks the pages that can render from the local cache; the
// others show ConnectionRequired instead of an empty screen when the tablet has
// no network. Always false-by-default: a page is offline-ready only on purpose.
export default function ProtectedRoute({ children, roles, bare = false, offlineCapable = false }) {
  const { user, loading } = useAuth();
  const { native, online } = useOffline();

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

  if (native && !online && !offlineCapable) {
    return bare ? <ConnectionRequired /> : <Layout><ConnectionRequired /></Layout>;
  }

  return bare ? children : <Layout>{children}</Layout>;
}
