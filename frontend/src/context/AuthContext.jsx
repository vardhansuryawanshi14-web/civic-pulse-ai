import { createContext, useContext, useEffect, useState } from 'react'

import api, { clearToken, getToken, setToken } from '@/api/axios'

const AuthContext = createContext(null)

export const HOME_FOR = {
  citizen: '/citizen/dashboard',
  officer: '/officer/dashboard',
  admin: '/admin/dashboard',
}

/** Turn any axios failure into the backend's message string. */
export function errorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || fallback
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // a stored token is only a claim — /api/auth/me is what confirms it is still
  // valid and tells us who it belongs to
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get('/api/auth/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => {
        clearToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password, remember = false) => {
    const res = await api.post('/api/auth/login', { email, password, remember })
    setToken(res.data.data.token)
    setUser(res.data.data.user)
    return res.data.data.user
  }

  const register = async (payload) => {
    const res = await api.post('/api/auth/register', payload)
    setToken(res.data.data.token)
    setUser(res.data.data.user)
    return res.data.data.user
  }

  /** Adopts a token handed back by the Google callback in the URL. */
  const loginWithToken = async (token) => {
    setToken(token)
    const res = await api.get('/api/auth/me')
    setUser(res.data.data.user)
    return res.data.data.user
  }

  const logout = async () => {
    // there is no server session to end, so a failed call must not strand the
    // user in a logged-in UI — drop the token either way
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore
    } finally {
      clearToken()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
