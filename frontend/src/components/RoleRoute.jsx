import { Navigate, Outlet } from 'react-router-dom'

import { HOME_FOR, useAuth } from '@/context/AuthContext'
import { Loading } from '@/components/ProtectedRoute'

/**
 * Wraps ProtectedRoute's children with a role check.
 * Wrong role lands on that user's own home, never on the page they asked for.
 */
export default function RoleRoute({ roles }) {
  const { user, loading } = useAuth()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={HOME_FOR[user.role] || '/login'} replace />
  return <Outlet />
}
