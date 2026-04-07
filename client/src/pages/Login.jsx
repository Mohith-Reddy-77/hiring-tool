import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../api/hiringApi'
import { useAuth } from '../context/AuthContext'
import './Page.css'

export function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [role, setRole] = useState('RECRUITER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data } = await authApi.login({ email, password })
        login(data.token, data.user)
      } else {
        const { data } = await authApi.register({ name, email, password, role })
        login(data.token, data.user)
      }
      navigate('/')
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
          <p className="muted auth-card-sub">
            {mode === 'login'
              ? 'Use your email and password to access the pipeline.'
              : 'Choose a role. Recruiters manage profiles; interviewers submit feedback.'}
          </p>

          {mode === 'register' && (
            <>
              <label>
                Full name
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Priya N." />
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="RECRUITER">Recruiter</option>
                  <option value="INTERVIEWER">Interviewer</option>
                </select>
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
