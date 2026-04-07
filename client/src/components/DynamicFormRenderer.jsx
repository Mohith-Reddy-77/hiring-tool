import { useMemo, useState, useCallback } from 'react'
import { normalizeFields } from '../lib/templateFields'
import { RatingStarsInput } from './RatingStars'
import './DynamicFormRenderer.css'

/**
 * Renders interview feedback from template structure.
 * Field shapes: { key, type: 'rating'|'text'|'textarea', label }
 * On submit: onSubmit({ ratings, notes }) — notes from field key "notes" if textarea.
 */
export function DynamicFormRenderer({
  structure,
  initialValues = {},
  onSubmit,
  submitLabel = 'Submit feedback',
  disabled = false,
}) {
  const fields = useMemo(() => normalizeFields(structure), [structure])

  const buildInitial = useCallback(() => {
    const o = { ...initialValues }
    for (const f of fields) {
      if (o[f.key] === undefined) {
        o[f.key] = f.type === 'rating' ? '' : ''
      }
    }
    return o
  }, [fields, initialValues])

  const [values, setValues] = useState(buildInitial)
  const [ratingError, setRatingError] = useState('')

  const setField = (key, v) => {
    setRatingError('')
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    for (const f of fields) {
      if (f.type === 'rating') {
        const raw = values[f.key]
        if (raw === '' || raw == null || Number(raw) < 1) {
          setRatingError('Please give a star rating for each scored category.')
          return
        }
      }
    }
    setRatingError('')
    const ratings = {}
    let notes = ''
    for (const f of fields) {
      const raw = values[f.key]
      if (f.key === 'notes' && f.type === 'textarea') {
        notes = raw ?? ''
        continue
      }
      if (f.type === 'rating') {
        ratings[f.key] = raw === '' ? null : Number(raw)
      } else {
        ratings[f.key] = raw ?? ''
      }
    }
    onSubmit?.({ ratings, notes })
  }

  const iconFor = (type) => {
    if (type === 'rating') return '★'
    if (type === 'text') return '✎'
    return '💬'
  }

  return (
    <form className="dynamic-form" onSubmit={handleSubmit}>
      {fields.map((f) => (
        <div key={f.key} className={`df-card df-card--${f.type}`}>
          <div className="df-card-head">
            <span className="df-icon" aria-hidden>
              {iconFor(f.type)}
            </span>
            <label htmlFor={f.key} className="df-label">
              {f.label || f.key}
            </label>
          </div>
          {f.type === 'rating' && (
            <RatingStarsInput
              value={values[f.key]}
              onChange={(n) => setField(f.key, n)}
              disabled={disabled}
            />
          )}
          {f.type === 'text' && (
            <input
              id={f.key}
              type="text"
              className="df-input"
              value={values[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              disabled={disabled}
              placeholder="Short answer"
            />
          )}
          {f.type === 'textarea' && (
            <textarea
              id={f.key}
              className="df-textarea"
              rows={4}
              value={values[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
              disabled={disabled}
              placeholder={f.key === 'notes' ? 'Overall notes for this round…' : 'Write here…'}
            />
          )}
        </div>
      ))}
      {ratingError && <p className="error df-error">{ratingError}</p>}
      <button type="submit" className="btn primary df-submit" disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  )
}
