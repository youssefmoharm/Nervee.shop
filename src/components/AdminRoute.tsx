import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="nv-checker w-10 h-10 animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If not already marked as admin, verify via server
  if (!isAdmin) {
    // In supervised mode, show unauthorized page
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-4xl font-bold text-navy mb-4">Access Denied</h1>
          <p className="text-navy/60 mb-6">You do not have admin access to this area.</p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
