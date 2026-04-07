import axios from 'axios'

// In production, frontend may call a separate backend URL. Set `VITE_API_URL`
// in Vercel environment variables to your Render backend origin (e.g. https://api.example.com)
// The client expects backend routes under the `/api` prefix, so if `VITE_API_URL`
// is provided we append `/api` to it. Fall back to the relative `/api` for local dev.
const envBase = (import.meta.env && import.meta.env.VITE_API_URL) || ''
const base = envBase ? envBase.replace(/\/$/, '') + '/api' : '/api'

const api = axios.create({
  baseURL: base,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

// Initialize Authorization header from sessionStorage on module load to
// avoid a race where components fetch data before `AuthProvider` mounts
// and calls `setAuthToken` (causing 401s on refresh).
try {
  const initialToken = sessionStorage.getItem('hiring_token')
  if (initialToken) setAuthToken(initialToken)
} catch (e) {
  // sessionStorage may be unavailable in some environments; ignore silently
}

export default api
