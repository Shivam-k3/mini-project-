import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = null, allowFirstLogin = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Force password change on first login
  if (user.firstLogin && !allowFirstLogin) {
    return <Navigate to="/change-password" replace />;
  }

  // Suspended account check
  if (user.status === 'suspended') {
    return <Navigate to="/login" replace />;
  }

  // Role authorization check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
