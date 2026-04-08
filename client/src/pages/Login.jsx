import { useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/hiringApi'
import { useAuth } from '../context/AuthContext'
import './Page.css'

export function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const location = useLocation()

  if (isAuthenticated) {
    // If already authenticated, prefer sending admins to /admin, pending users to /pending,
    // otherwise return to the originally requested page or home.
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />
    if (user?.role === 'PENDING') return <Navigate to="/pending" replace />
    const dest = location.state?.from?.pathname || '/'
    return <Navigate to={dest} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (mode === 'login') {
        ({ data } = await authApi.login({ email, password }))
        login(data.token, data.user)
      } else {
        // Do not send a role on registration; server will create account with PENDING role
        ({ data } = await authApi.register({ name, email, password }))
        login(data.token, data.user)
      }
      // If the user is an ADMIN, always send them to the admin dashboard.
      if (data?.user?.role === 'ADMIN') {
        navigate('/admin', { replace: true })
        return
      }
      // If the user is pending approval, send them to the pending page
      if (data?.user?.role === 'PENDING') {
        navigate('/pending', { replace: true })
        return
      }
      // Otherwise navigate back to the original requested page if provided, otherwise home
      const dest = location.state?.from?.pathname || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero-badge">Internal tool</div>
        <h1 className="auth-hero-title">Recruitment pipeline</h1>
        <p className="auth-hero-subtitle">
          Track candidate profiles across stages, schedule interview rounds, and capture interviewer feedback with
          templates.
        </p>
        <div className="auth-hero-stats">
          <div className="auth-stat">
            <div className="auth-stat-num">1</div>
            <div className="auth-stat-label">Profile</div>
          </div>
          <div className="auth-stat">
            <div className="auth-stat-num">2</div>
            <div className="auth-stat-label">Rounds</div>
          </div>
          <div className="auth-stat">
            <div className="auth-stat-num">3</div>
            <div className="auth-stat-label">Feedback</div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Create account
          </button>
        </div>

        <form className="card form-card auth-card" onSubmit={handleSubmit}>
          <h2 className="auth-card-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted auth-card-sub">{mode === 'login' ? 'Use your email and password to access the pipeline.' : 'An administrator will assign your role after approval.'}</p>

          {mode === 'register' && (
            <>
              <label>
                Full name
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Priya N." />
              </label>
            </>
          )}
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@company.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="At least 6 characters"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
