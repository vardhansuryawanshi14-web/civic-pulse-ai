import axios from 'axios'

const TOKEN_KEY = 'civicpulse_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
})

// The frontend is on Vercel and the API on Railway, so a session cookie would be
// third-party and Chrome drops it. Auth rides on this header instead.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Photos are loaded through <img src>, which cannot carry an Authorization
 * header, so this one route takes the token in the query string instead. The
 * backend still runs the same ownership and ward checks on it.
 */
export const photoUrl = (complaintId) =>
  `${api.defaults.baseURL}/api/complaints/${complaintId}/photo?token=${encodeURIComponent(getToken() || '')}`

export default api
