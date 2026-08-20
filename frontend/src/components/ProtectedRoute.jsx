import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      Loading…
    </div>
  )
}

/** Blocks every route behind a logged-in session. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export { Loading }
