import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Page.css'

export function WaitingApproval() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1>Waiting for approval</h1>
      <p className="muted">Thanks {user?.name || ''}. Your account is pending admin approval. You will be notified when a role is assigned.</p>
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => { logout(); navigate('/login') }}>Sign out</button>
      </div>
    </div>
  )
}

export default WaitingApproval
