import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

export function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="layout">
      <header className="header">
        <div className="brand-block">
          <Link to="/" className="brand">
            Recruitment pipeline
          </Link>
          <span className="brand-tagline">Internal hiring stages &amp; interview flow</span>
        </div>
        <nav className="nav">
          {isAuthenticated && (
            <>
              {user?.role === 'RECRUITER' && (
                <>
                  <Link to="/candidates">Profiles</Link>
                  <Link to="/templates/new">Interview templates</Link>
                </>
              )}
              {user?.role === 'INTERVIEWER' && <Link to="/my-rounds">My rounds</Link>}
              {user?.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
              <span className="user-pill">
                {user?.name} ({user?.role})
              </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                Log out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
