import { useEffect, useState } from 'react'
import { usersApi, authApi } from '../api/hiringApi'
import { useAuth } from '../context/AuthContext'
import './Page.css'
import './AdminDashboard.css'

export function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('RECRUITER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [query, setQuery] = useState('')
   const [roleFilter, setRoleFilter] = useState('ALL')
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

  const filteredUsers = users
    .filter((u) => {
      if (!query) return true
      const q = query.toLowerCase()
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    })
    .filter((u) => {
      if (!roleFilter || roleFilter === 'ALL') return true
      return String(u.role || '').toUpperCase() === String(roleFilter).toUpperCase()
    })

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
      const res = await usersApi.invite({ email: inviteEmail, role: inviteRole, name: inviteEmail.split('@')[0] })
      // If API returned but email failed, surface the error
      if (res?.data && res.data.emailSent === false) {
        const reason = res.data.emailError || 'Invite created but email failed to send'
        setError(reason)
        return
      }
      // Show queued/sent status to admin
      if (res?.data && res.data.emailQueued) {
        setStatus('Invite created. Email will be sent in background. Refresh will show the user.')
      } else if (res?.data && res.data.emailSent) {
        setStatus('Invite created and email sent.')
      } else {
        setStatus('Invite created.')
      }
      setInviteEmail('')
      setInviteRole('RECRUITER')
      await fetchUsers()
      // auto-clear status after a short time
      setTimeout(() => setStatus(null), 7000)
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner">Loading…</div></div>
  return (
    <div className="page admin-page">
      <div className="admin-header">
        <div>
          <h1>Admin — User management</h1>
          <p className="muted">Assign roles to users. Roles: <strong>ADMIN</strong>, <strong>RECRUITER</strong>, <strong>INTERVIEWER</strong>.</p>
        </div>
        <div className="admin-actions">
          <div className="search-wrap">
            <input className="input search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="select role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="ALL">All roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="RECRUITER">RECRUITER</option>
                <option value="INTERVIEWER">INTERVIEWER</option>
                <option value="PENDING">PENDING</option>
              </select>
              <button className="btn" onClick={fetchUsers} title="Refresh users">Refresh</button>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {status && <div className="alert muted">{status}</div>}

      <div className="admin-grid">
        <div className="card invite-card">
          <h3>Invite user</h3>
          <p className="muted">Send a Google SSO invite. Email will be sent in background.</p>
          <div className="form-row">
            <input className="input" placeholder="invitee email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="RECRUITER">RECRUITER</option>
              <option value="INTERVIEWER">INTERVIEWER</option>
            </select>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={submitInvite}>Send Invite</button>
            <button className="btn" onClick={() => { setInviteEmail(''); setInviteRole('RECRUITER'); }}>Clear</button>
          </div>
        </div>

        <div className="card users-card">
          <h3>
            Users
            <span className="users-badge">{filteredUsers.length}</span>
          </h3>
          <div className="table-wrap">
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
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className={`role-badge role-${(u.role || '').toLowerCase()}`}>{u.role}</span></td>
                    <td>
                      {u.role === 'PENDING' ? (
                        <div className="action-group">
                          <button className="btn" onClick={() => approveAs(u.id, 'ADMIN')}>Admin</button>
                          <button className="btn" onClick={() => approveAs(u.id, 'RECRUITER')}>Recruiter</button>
                          <button className="btn" onClick={() => approveAs(u.id, 'INTERVIEWER')}>Interviewer</button>
                        </div>
                      ) : (
                        <select value={u.role || ''} onChange={(e) => changeRole(u.id, e.target.value)}>
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
          </div>
        </div>
      </div>
      {confirmOpen && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h3>{confirmMessage}</h3>
            <p className="muted">This action will change the user's role and grant access to the corresponding dashboard.</p>
            <div className="confirm-actions">
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn primary" style={{ marginLeft: 8 }} onClick={doConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {filteredUsers.length === 0 && (
        <div className="empty-state">
          {users.length === 0
            ? 'No users yet — invite someone using the panel on the left.'
            : 'No users match the current filters.'}
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
