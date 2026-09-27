import { type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

  // Server-side enforcement lives in RLS + edge requireAdmin + admin-gated
  // RPCs; this gate is the UX layer. Non-admins stay on this screen (no auto
  // redirect) so the denial is visible instead of a silent bounce home.
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6" data-testid="admin-access-denied">
          <h1 className="text-4xl font-bold text-navy mb-4">Access Denied</h1>
          <p className="text-navy/60 mb-6">You do not have admin access to this area.</p>
          <Link
            to="/"
            className="nv-eyebrow inline-block bg-navy text-white px-6 py-3 hover:bg-navy-2 transition-colors"
          >
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
