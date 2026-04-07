import { useEffect, useState } from 'react'
import { roundsApi, feedbackApi } from '../api/hiringApi'
import { fileUrl } from '../utils/files'
import { DynamicFormRenderer } from '../components/DynamicFormRenderer'
import { FeedbackDisplay } from '../components/FeedbackDisplay'
import './Page.css'

export function InterviewRoundPage() {
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [feedbackByRound, setFeedbackByRound] = useState({})
  const [loadingFb, setLoadingFb] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await roundsApi.myRounds()
      setRounds(data)
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const loadFeedback = async (roundId) => {
    setLoadingFb((prev) => ({ ...prev, [roundId]: true }))
    try {
      const { data } = await roundsApi.feedback(roundId)
      setFeedbackByRound((prev) => ({ ...prev, [roundId]: data }))
    } catch (e) {
      if (e.response?.status === 404) {
        setFeedbackByRound((prev) => ({ ...prev, [roundId]: null }))
      }
    } finally {
      setLoadingFb((prev) => ({ ...prev, [roundId]: false }))
    }
  }

  useEffect(() => {
    if (!expandedId) return
    loadFeedback(expandedId)
  }, [expandedId])

  const toggle = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
    setSubmitError('')
  }

  const onFeedbackSubmit = async (roundId, { ratings, notes }) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await feedbackApi.submit({ roundId, ratings, notes })
      await loadFeedback(roundId)
      await load()
    } catch (e) {
      setSubmitError(e.response?.data?.message || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="muted">Loading your rounds…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <div className="page">
      <h1>My interview rounds</h1>
      <p className="muted">
        Rounds assigned to you for this candidate. Open a round, add notes against the template, then submit — one
        submission per round.
      </p>
      {rounds.length === 0 && <p className="muted">No rounds assigned yet.</p>}
      <ul className="round-list">
        {rounds.map((r) => {
          const open = expandedId === r._id
          const fb = feedbackByRound[r._id]
          const loading = loadingFb[r._id]
          const structure = r.templateId?.structure
          const showReadonly = Boolean(fb && fb.submittedAt)
          const showForm = !loading && fb === null && r.status === 'PENDING'

          return (
            <li key={r._id} className="card round-card">
              <button type="button" className="round-toggle" onClick={() => toggle(r._id)}>
                <span className="round-title">{r.name}</span>
                <span className="muted">
                  {r.candidateId?.name} · {r.status}
                </span>
                <span className="chev">{open ? '▼' : '▶'}</span>
              </button>
              {open && (
                <div className="round-body">
                  <p>
                    <strong>Candidate:</strong> {r.candidateId?.email}
                  </p>
                  {r.candidateId?.resumeUrl && (
                    <p>
                      <strong>Resume:</strong>{' '}
                      <a href={fileUrl(r.candidateId.resumeUrl)} target="_blank" rel="noopener noreferrer">
                        Open resume
                      </a>
                    </p>
                  )}
                  {loading && <p className="muted">Loading feedback…</p>}
                  {showReadonly && (
                    <div className="feedback-readonly">
                      <FeedbackDisplay
                        structure={structure}
                        ratings={fb.ratings}
                        notes={fb.notes}
                        submittedAt={fb.submittedAt}
                      />
                    </div>
                  )}
                  {r.status === 'COMPLETED' && !showReadonly && !loading && (
                    <p className="muted">This round is completed.</p>
                  )}
                  {showForm && structure && (
                    <DynamicFormRenderer
                      structure={structure}
                      onSubmit={(payload) => onFeedbackSubmit(r._id, payload)}
                      submitLabel="Submit feedback"
                      disabled={submitting}
                    />
                  )}
                  {showForm && !structure && <p className="error">Template missing.</p>}
                  {submitError && open && <p className="error">{submitError}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default InterviewRoundPage
