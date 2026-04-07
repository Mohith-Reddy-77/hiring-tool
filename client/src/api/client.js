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

// Global response handler: if server returns 401, clear local auth and redirect to login
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err && err.response && err.response.status === 401) {
      try {
        localStorage.removeItem('hiring_token')
        localStorage.removeItem('hiring_user')
      } catch (e) {}
      // navigate to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
