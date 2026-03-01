import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role } = useAuth();
  const resolvedRole = String(role || user?.role || (user?.isAdmin ? 'admin' : '')).toLowerCase();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && resolvedRole !== String(requiredRole).toLowerCase()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
