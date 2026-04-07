import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { candidatesApi } from '../api/hiringApi'
import './Page.css'

const statusOrder = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']

export function CandidateList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await candidatesApi.list()
        if (!cancelled) {
          const sorted = [...data].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
          setItems(sorted)
        }
      } catch (e) {
        if (!cancelled) {
          const status = e.response?.status
          if (status === 401 || status === 403) {
            // redirect to login preserving this location
            navigate('/login', { state: { from: location }, replace: true })
            return
          }
          setError(e.response?.data?.message || e.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="muted">Loading profiles…</p>
  if (error) return <p className="error">{error}</p>

  const counts = items.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-head">
        <h1>Candidate profiles</h1>
        <Link to="/candidates/new" className="btn primary">
          Add profile
        </Link>
      </div>
      <div className="card summary-card">
        <div className="summary-left">
          <p className="muted summary-text">
            Add a profile, move it through recruitment stages, and attach interview rounds until a hire (or exit)
            decision.
          </p>
          <div className="summary-chips">
            {statusOrder.map((s) => (
              <span key={s} className={`chip chip-${s}`}>
                <span className="chip-dot" aria-hidden />
                {s}
                <span className="chip-count">{counts[s] || 0}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="summary-right">
          <div className="kpi">
            <div className="kpi-num">{items.length}</div>
            <div className="kpi-label">Total profiles</div>
          </div>
        </div>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role applied</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c._id}>
                <td>
                  <Link to={`/candidates/${c._id}`} className="link-strong">
                    {c.name}
                  </Link>
                </td>
                <td>{c.email}</td>
                <td>{c.roleApplied}</td>
                <td>
                  <span className={`badge status-${c.status}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="muted pad">No profiles yet.</p>}
      </div>
    </div>
  )
}
