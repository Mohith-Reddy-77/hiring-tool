import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { templatesApi } from '../api/hiringApi'
import { buildStructureFromRows } from '../lib/templateFields'
import { FeedbackDisplay } from '../components/FeedbackDisplay'
import './Page.css'

const FIELD_TYPES = [
  { value: 'rating', label: 'Score (1–5 stars)' },
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Paragraph' },
]

function newRow() {
  return { id: crypto.randomUUID(), label: '', type: 'rating' }
}

export function CreateTemplate() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [rows, setRows] = useState(() => [
    { id: '1', label: 'DS / Algorithms', type: 'rating' },
    { id: '2', label: 'Communication', type: 'rating' },
    { id: '3', label: 'Hiring team notes', type: 'textarea' },
  ])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  const structurePreview = useMemo(() => buildStructureFromRows(rows), [rows])

  const previewPayload = useMemo(() => {
    const ratings = {}
    let notes = ''
    for (const f of structurePreview.fields) {
      if (f.type === 'rating') ratings[f.key] = 4
      else if (f.type === 'text') ratings[f.key] = 'Short sample answer'
      else if (f.type === 'textarea') {
        if (f.key === 'notes') notes = 'Example: clear hire recommendation for backend.'
        else ratings[f.key] = 'Longer sample response for this prompt.'
      }
    }
    return { ratings, notes }
  }, [structurePreview])

  const { user } = useAuth()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoadingExisting(true)
      try {
        const res = await templatesApi.list()
        if (mounted) setExisting(res.data || [])
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingExisting(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [user?.role])

  const useTemplate = (t) => {
    if (!t || !t.structure) return
    setName(t.name || '')
    const fields = t.structure.fields || []
    const mappedRows = fields.map((f) => ({ id: f.key || crypto.randomUUID(), label: f.label || f.key || 'Question', type: f.type || 'text' }))
    setRows(mappedRows)
  }

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRow = (id) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, newRow()])
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const nonEmpty = rows.filter((r) => String(r.label || '').trim())
    if (!nonEmpty.length) {
      setError('Add at least one question with a label.')
      return
    }
    if (!name.trim()) {
      setError('Enter a template name.')
      return
    }
    const structure = buildStructureFromRows(rows)
    setLoading(true)
    try {
      await templatesApi.create({ name: name.trim(), structure })
      navigate('/candidates')
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1>Interview template</h1>
      <p className="muted intro">
        Build a form interviewers will fill for this round — star scores, short answers, and notes. No JSON required;
        add rows below and preview how feedback will look.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Existing templates</h2>
        {loadingExisting && <p className="muted">Loading templates…</p>}
        {!loadingExisting && existing.length === 0 && <p className="muted">No templates yet.</p>}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {existing.map((t) => {
            const exampleRatings = {}
            let exampleNotes = ''
            const s = t.structure || { fields: [] }
            for (const f of s.fields || []) {
              if (f.type === 'rating') exampleRatings[f.key] = 4
              else if (f.type === 'text') exampleRatings[f.key] = 'Short sample'
              else if (f.type === 'textarea') exampleNotes = exampleNotes || 'Example note'
            }
            return (
              <div key={t._id || t.id} className="card" style={{ padding: '0.6rem', minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{t.name}</strong>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={async () => {
                      try {
                        if (!window.confirm('Delete this template? This cannot be undone.')) return
                        await templatesApi.remove(t._id || t.id)
                        // reload templates to reflect current state
                        const res = await templatesApi.list()
                        setExisting(res.data || [])
                      } catch (e) {
                        alert(e.response?.data?.message || e.message)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <FeedbackDisplay structure={t.structure} ratings={exampleRatings} notes={exampleNotes} compact />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <form className="card form-card template-form" onSubmit={submit}>
        <label>
          Template name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Round 1 — DS & coding"
            required
          />
        </label>

        <div className="template-fields-head">
          <span className="template-fields-title">Questions</span>
          <button type="button" className="btn small" onClick={addRow}>
            + Add question
          </button>
        </div>

        <ul className="template-field-list">
          {rows.map((row, index) => (
            <li key={row.id} className="template-field-row">
              <span className="template-field-num">{index + 1}</span>
              <input
                type="text"
                className="template-field-label"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                placeholder="Question label (e.g. System design)"
                aria-label={`Question ${index + 1} label`}
              />
              <select
                value={row.type}
                onChange={(e) => updateRow(row.id, { type: e.target.value })}
                aria-label={`Question ${index + 1} type`}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn ghost template-field-remove"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                title="Remove"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="error">{error}</p>}

        <div className="template-preview">
          <div className="template-preview-head">Preview (how feedback will appear)</div>
          <div className="template-preview-body">
            <FeedbackDisplay
              structure={structurePreview}
              ratings={previewPayload.ratings}
              notes={previewPayload.notes}
              submittedAt={new Date().toISOString()}
              compact
            />
          </div>
        </div>

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save template'}
        </button>
      </form>
    </div>
  )
}
