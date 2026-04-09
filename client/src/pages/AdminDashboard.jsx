import { useEffect, useState } from 'react'
import { usersApi, authApi } from '../api/hiringApi'
import { useAuth } from '../context/AuthContext'
import './Page.css'

export function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('RECRUITER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState(null)
  const [confirmRole, setConfirmRole] = useState(null)
  const [confirmMessage, setConfirmMessage] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await usersApi.list()
      setUsers(res.data || [])
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  const { user: currentUser, login } = useAuth()

  function openConfirm(userId, role, message) {
    const u = users.find((x) => x.id === userId)
    setConfirmUser(u)
    setConfirmRole(role)
    setConfirmMessage(message || `Change role of ${u?.name || userId} to ${role}?`)
    setConfirmOpen(true)
  }

  const changeRole = (userId, role) => {
    // Use a message that includes the user's name
    openConfirm(userId, role)
  }

  const approveAs = (userId, role = 'RECRUITER') => {
    openConfirm(userId, role, `Approve ${users.find((x) => x.id === userId)?.name || userId} as ${role}?`)
  }

  async function doConfirm() {
    try {
      setConfirmOpen(false)
      if (!confirmUser || !confirmRole) return
      await usersApi.assignRole(confirmUser.id, { role: confirmRole })
      // Refresh listing to reflect server state
      await fetchUsers()
      // If the changed user is the current user, refresh their profile so role-based views update immediately
      try {
        if (currentUser && confirmUser && String(currentUser.id) === String(confirmUser.id)) {
          const meRes = await authApi.me()
          if (meRes?.data?.user) {
            const newToken = meRes.data.token || sessionStorage.getItem('hiring_token')
            // update auth context with fresh profile and token
            login(newToken, meRes.data.user)
          }
        }
      } catch (refreshErr) {
        // non-fatal
        console.warn('Failed to refresh current user profile after role change', refreshErr)
      }
      setConfirmUser(null)
      setConfirmRole(null)
      setConfirmMessage('')
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    }
  }

  async function submitInvite() {
    setError(null)
    if (!inviteEmail) return setError('Please provide an email')
    try {
      setLoading(true)
      await usersApi.invite({ email: inviteEmail, role: inviteRole })
      setInviteEmail('')
      setInviteRole('RECRUITER')
      await fetchUsers()
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page">
      <h1>Admin — User management</h1>
      <p className="muted">Assign roles to users. Roles: ADMIN, RECRUITER, INTERVIEWER.</p>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="invitee email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
          <option value="ADMIN">ADMIN</option>
          <option value="RECRUITER">RECRUITER</option>
          <option value="INTERVIEWER">INTERVIEWER</option>
        </select>
        <button className="btn primary" onClick={submitInvite}>Send Invite</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                {u.role === 'PENDING' ? (
                  <>
                    <button className="btn" onClick={() => approveAs(u.id, 'ADMIN')}>Approve as Admin</button>
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => approveAs(u.id, 'RECRUITER')}>Approve as Recruiter</button>
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => approveAs(u.id, 'INTERVIEWER')}>Approve as Interviewer</button>
                  </>
                ) : (
                  <select
                    value={u.role || ''}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="RECRUITER">RECRUITER</option>
                    <option value="INTERVIEWER">INTERVIEWER</option>
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 6, width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>{confirmMessage}</h3>
            <p className="muted">This action will change the user's role and grant access to the corresponding dashboard.</p>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn primary" style={{ marginLeft: 8 }} onClick={doConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
