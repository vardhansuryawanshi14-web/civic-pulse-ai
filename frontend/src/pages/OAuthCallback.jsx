import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { HOME_FOR, useAuth } from '@/context/AuthContext'
import { Loading } from '@/components/ProtectedRoute'

/**
 * Landing spot for the Google sign-in redirect. The backend cannot return JSON
 * on a redirect, so it hands the token over in the query string; this stores it,
 * gets the user, and sends them to their own dashboard.
 */
export default function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const [error, setError] = useState('')
  // React 18 runs effects twice in development, and the second run would call
  // /api/auth/me a second time for no reason
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const token = params.get('token')
    if (!token) {
      navigate('/login?error=google_failed', { replace: true })
      return
    }

    loginWithToken(token)
      .then((user) => navigate(HOME_FOR[user.role] || '/login', { replace: true }))
      .catch(() => setError('Could not complete Google sign-in. Please try again.'))
  }, [params, navigate, loginWithToken])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="text-sm text-primary hover:underline"
        >
          Back to login
        </button>
      </div>
    )
  }

  return <Loading />
}
