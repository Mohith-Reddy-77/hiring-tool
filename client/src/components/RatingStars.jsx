import './RatingStars.css'

const StarSvg = ({ filled }) => (
  <svg viewBox="0 0 24 24" className={`rs-star-svg ${filled ? 'rs-star-svg--on' : ''}`} aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

/** Read-only: 1–5 as stars + numeric badge */
export function RatingStarsDisplay({ value, max = 5, size = 'md' }) {
  const v = Math.max(0, Math.min(max, Math.round(Number(value) || 0)))
  return (
    <div className={`rs-display rs-display--${size}`} role="img" aria-label={`${v} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="rs-display-star">
          <StarSvg filled={i < v} />
        </span>
      ))}
      <span className="rs-display-num">
        {v}/{max}
      </span>
    </div>
  )
}

/** Click/tap to set rating */
export function RatingStarsInput({ value, onChange, disabled, max = 5, size = 'md' }) {
  const v = value === '' || value == null ? 0 : Number(value)
  return (
    <div className={`rs-input rs-input--${size}`}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const filled = v >= n
        return (
          <button
            key={n}
            type="button"
            className={`rs-input-star ${filled ? 'rs-input-star--on' : ''}`}
            onClick={() => !disabled && onChange?.(n)}
            disabled={disabled}
            aria-label={`Rate ${n} of ${max}`}
          >
            <StarSvg filled={filled} />
          </button>
        )
      })}
      <span className="rs-input-hint">{v > 0 ? `${v} / ${max}` : `Choose 1–${max}`}</span>
    </div>
  )
}
