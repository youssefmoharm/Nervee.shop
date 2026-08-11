import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="nv-checker w-10 h-10 animate-pulse" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Real authorization happens server-side via RLS (admin_users table) on
  // every query and via place_order/edge functions — this guard is only a
  // UX convenience so non-admins don't see an empty/broken dashboard shell.
  if (!isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
