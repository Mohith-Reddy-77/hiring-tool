import { normalizeFields } from '../lib/templateFields'
import { RatingStarsDisplay } from './RatingStars'
import './FeedbackDisplay.css'

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pictorial feedback: stars for scores, cards for text — no raw JSON. */
export function FeedbackDisplay({ structure, ratings = {}, notes = '', submittedAt, compact = false }) {
  const fields = normalizeFields(structure)
  const hasTemplate = fields.length > 0

  const ratingEntries = []
  const textEntries = []
  const handledKeys = new Set()

  for (const f of fields) {
    handledKeys.add(f.key)
    if (f.type === 'rating') {
      const val = ratings[f.key]
      if (val == null || val === '') continue
      const num = Number(val)
      if (Number.isNaN(num)) continue
      ratingEntries.push(
        <div key={f.key} className="fd-card fd-card--score">
          <div className="fd-card-head">
            <span className="fd-icon" aria-hidden>
              ★
            </span>
            <span className="fd-label">{f.label || humanizeKey(f.key)}</span>
          </div>
          <RatingStarsDisplay value={num} size={compact ? 'sm' : 'md'} />
          <div className="fd-bar-track" aria-hidden>
            <div className="fd-bar-fill" style={{ width: `${(num / 5) * 100}%` }} />
          </div>
        </div>
      )
    } else if (f.type === 'text') {
      const val = ratings[f.key]
      if (val == null || String(val).trim() === '') continue
      textEntries.push(
        <div key={f.key} className="fd-card fd-card--text">
          <div className="fd-card-head">
            <span className="fd-icon fd-icon--text" aria-hidden>
              ✎
            </span>
            <span className="fd-label">{f.label || humanizeKey(f.key)}</span>
          </div>
          <p className="fd-text">{String(val)}</p>
        </div>
      )
    } else if (f.type === 'textarea') {
      const val = f.key === 'notes' ? notes || ratings[f.key] : ratings[f.key]
      if (val == null || String(val).trim() === '') continue
      textEntries.push(
        <div key={f.key} className="fd-card fd-card--note">
          <div className="fd-card-head">
            <span className="fd-icon fd-icon--note" aria-hidden>
              💬
            </span>
            <span className="fd-label">{f.label || humanizeKey(f.key)}</span>
          </div>
          <p className="fd-text fd-text--multiline">{String(val)}</p>
        </div>
      )
    }
  }

  /* Legacy / extra keys not in template */
  if (!hasTemplate || Object.keys(ratings).some((k) => !handledKeys.has(k))) {
    for (const [key, val] of Object.entries(ratings)) {
      if (handledKeys.has(key)) continue
      if (val == null || val === '') continue
      if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
        const num = Number(val)
        if (num >= 1 && num <= 5) {
          ratingEntries.push(
            <div key={`extra-${key}`} className="fd-card fd-card--score">
              <div className="fd-card-head">
                <span className="fd-icon" aria-hidden>
                  ★
                </span>
                <span className="fd-label">{humanizeKey(key)}</span>
              </div>
              <RatingStarsDisplay value={num} size={compact ? 'sm' : 'md'} />
              <div className="fd-bar-track" aria-hidden>
                <div className="fd-bar-fill" style={{ width: `${(num / 5) * 100}%` }} />
              </div>
            </div>
          )
        } else {
          textEntries.push(
            <div key={`extra-${key}`} className="fd-card fd-card--text">
              <div className="fd-card-head">
                <span className="fd-icon fd-icon--text" aria-hidden>
                  ✎
                </span>
                <span className="fd-label">{humanizeKey(key)}</span>
              </div>
              <p className="fd-text">{String(val)}</p>
            </div>
          )
        }
      } else {
        textEntries.push(
          <div key={`extra-${key}`} className="fd-card fd-card--note">
            <div className="fd-card-head">
              <span className="fd-icon fd-icon--note" aria-hidden>
                💬
              </span>
              <span className="fd-label">{humanizeKey(key)}</span>
            </div>
            <p className="fd-text fd-text--multiline">{String(val)}</p>
          </div>
        )
      }
    }
  }

  const showStandaloneNotes =
    notes &&
    String(notes).trim() &&
    !fields.some((f) => f.key === 'notes' && f.type === 'textarea')

  return (
    <div className={`feedback-display ${compact ? 'feedback-display--compact' : ''}`}>
      {submittedAt && (
        <div className="fd-meta">
          <span className="fd-meta-dot" />
          Submitted {new Date(submittedAt).toLocaleString()}
        </div>
      )}
      {(ratingEntries.length > 0 || textEntries.length > 0 || showStandaloneNotes) && (
        <div className="fd-grid">
          {ratingEntries}
          {textEntries}
          {showStandaloneNotes && (
            <div className="fd-card fd-card--note fd-card--wide">
              <div className="fd-card-head">
                <span className="fd-icon fd-icon--note" aria-hidden>
                  💬
                </span>
                <span className="fd-label">Interviewer notes</span>
              </div>
              <p className="fd-text fd-text--multiline">{notes}</p>
            </div>
          )}
        </div>
      )}
      {!ratingEntries.length && !textEntries.length && !showStandaloneNotes && (
        <p className="fd-empty muted">No scored fields to show.</p>
      )}
    </div>
  )
}
