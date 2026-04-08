import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { candidatesApi, templatesApi, usersApi, roundsApi } from '../api/hiringApi'
import { FeedbackDisplay } from '../components/FeedbackDisplay'
import { fileUrl } from '../utils/files'
import './Page.css'

const STATUSES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'HIRED']

export function CandidateDetail() {
  const { id } = useParams()
  const [candidate, setCandidate] = useState(null)
  const [rounds, setRounds] = useState([])
  const [templates, setTemplates] = useState([])
  const [interviewers, setInterviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roundForm, setRoundForm] = useState({
    name: '',
    interviewerId: '',
    templateId: '',
    scheduledAt: '',
  })
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [cRes, rRes, tRes, iRes] = await Promise.all([
        candidatesApi.get(id),
        candidatesApi.rounds(id),
        templatesApi.list(),
        usersApi.interviewers(),
      ])
      setCandidate(cRes.data)
      setEditStatus(cRes.data.status)
      setRounds(rRes.data)
      setTemplates(tRes.data)
      setInterviewers(iRes.data)
    } catch (e) {
      const status = e.response?.status
      if (status === 401 || status === 403) {
        navigate('/login', { state: { from: location }, replace: true })
        return
      }
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  const { user } = useAuth()

  useEffect(() => {
    load()
  }, [id, user?.role])

  const saveStatus = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('status', editStatus)
      const { data } = await candidatesApi.update(id, fd)
      setCandidate(data)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  const createRound = async (e) => {
    e.preventDefault()
    if (!roundForm.name || !roundForm.interviewerId || !roundForm.templateId) return
    setSaving(true)
    try {
      await roundsApi.create({
        candidateId: id,
        name: roundForm.name,
        interviewerId: roundForm.interviewerId,
        templateId: roundForm.templateId,
        ...(roundForm.scheduledAt && { scheduledAt: roundForm.scheduledAt }),
      })
      setRoundForm({ name: '', interviewerId: '', templateId: '', scheduledAt: '' })
      const { data } = await candidatesApi.rounds(id)
      setRounds(data)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  const getTemplateId = (t) => t._id || t.id || t.supabaseId || ''
  const selectedTemplate = templates.find((t) => getTemplateId(t) === roundForm.templateId)

  if (loading && !candidate) return <p className="muted">Loading…</p>
  if (error && !candidate) return <p className="error">{error}</p>
  if (!candidate) return null

  return (
    <div className="page">
      <p>
        <Link to="/candidates" className="link-strong">
          ← All profiles
        </Link>
      </p>
      <h1>{candidate.name}</h1>
      <p className="muted intro">
        Track pipeline stage, resume, and interview rounds. Interviewers submit feedback against the template chosen
        for each round.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="detail-grid">
        <div className="card detail-card">
          <div className="detail-top">
            <div className="detail-avatar" aria-hidden>
              {candidate.name?.slice(0, 1)?.toUpperCase() || 'C'}
            </div>
            <div>
              <div className="detail-name">{candidate.name}</div>
              <div className="muted detail-sub">{candidate.roleApplied}</div>
            </div>
            <div className="detail-stage">
              <span className={`badge status-${candidate.status}`}>{candidate.status}</span>
            </div>
          </div>

          <div className="detail-meta">
            <div className="detail-meta-item">
              <div className="detail-meta-label">Email</div>
              <div className="detail-meta-value">{candidate.email}</div>
            </div>
            <div className="detail-meta-item">
              <div className="detail-meta-label">Resume</div>
              <div className="detail-meta-value">
                {candidate.resumeUrl ? (
                  <a className="link-strong" href={fileUrl(candidate.resumeUrl)} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                ) : (
                  <span className="muted">Not uploaded</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={saveStatus} className="inline-form">
            <label>
              Recruitment stage
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn primary small-btn" disabled={saving}>
              Save stage
            </button>
          </form>
        </div>

        <div className="card detail-actions">
          <div className="detail-actions-title">Quick actions</div>
          <div className="muted" style={{ marginBottom: '0.75rem' }}>
            Keep the profile moving: update stage and schedule the next round.
          </div>
          <button type="button" className="btn small" onClick={() => load()} disabled={saving || loading}>
            Refresh data
          </button>
        </div>
      </div>

      <div className="page-head">
        <h2 style={{ margin: 0 }}>Interview rounds</h2>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Interviewer</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r._id}>
                <td>{r.name}</td>
                <td>{r.interviewerId?.name || r.interviewerId?.email}</td>
                <td>{r.status}</td>
                <td>{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : '—'}</td>
                <td className="feedback-cell">
                  {r.feedback ? (
                    <details className="feedback-details">
                      <summary className="feedback-summary">View feedback</summary>
                      <FeedbackDisplay
                        structure={r.templateId?.structure}
                        ratings={r.feedback.ratings}
                        notes={r.feedback.notes}
                        submittedAt={r.feedback.submittedAt || r.feedback.createdAt}
                        compact
                      />
                    </details>
                  ) : (
                    <span className="muted">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rounds.length === 0 && <p className="muted pad">No rounds scheduled.</p>}
      </div>

      <h3>Schedule a round</h3>
      <form className="card form-card" onSubmit={createRound}>
        <label>
          Round name
          <input
            value={roundForm.name}
            onChange={(e) => setRoundForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Interviewer
          <select
            value={roundForm.interviewerId}
            onChange={(e) => setRoundForm((f) => ({ ...f, interviewerId: e.target.value }))}
            required
          >
            <option value="">Select…</option>
            {interviewers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Feedback template
          <select
            value={roundForm.templateId}
            onChange={(e) => setRoundForm((f) => ({ ...f, templateId: e.target.value }))}
            required
          >
            <option value="">Select…</option>
            {templates.map((t) => {
              const tid = getTemplateId(t)
              return (
                <option key={tid} value={tid}>
                  {t.name}
                </option>
              )
            })}
          </select>
        </label>
        {selectedTemplate && (
          <div style={{ marginTop: '0.75rem' }}>
            <div className="template-preview-head">Template preview</div>
            <div className="template-preview-body" style={{ marginTop: '0.5rem' }}>
              <FeedbackDisplay structure={selectedTemplate.structure} ratings={{}} notes={''} compact />
            </div>
          </div>
        )}
        <label>
          Scheduled at (optional)
          <input
            type="datetime-local"
            value={roundForm.scheduledAt}
            onChange={(e) => setRoundForm((f) => ({ ...f, scheduledAt: e.target.value }))}
          />
        </label>
        <button type="submit" className="btn primary" disabled={saving}>
          Create round
        </button>
      </form>
    </div>
  )
}
