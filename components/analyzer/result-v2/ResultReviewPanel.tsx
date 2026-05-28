'use client'

import { useState } from 'react'
import type { ResultV2Review } from './resultV2Types'

type ResultReviewPanelProps = {
  review: ResultV2Review
}

export default function ResultReviewPanel({ review }: ResultReviewPanelProps) {
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')

  return (
    <article className="result-v2-secondary-card">
      <p className="result-v2-body">Tell us if this helped you decide what not to trust or do next.</p>
      <div className="result-v2-rating-row" aria-label="Review rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={value <= rating ? 'result-v2-star is-active' : 'result-v2-star'}
            onClick={() => setRating(value)}
            aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
          >
            {'★'}
          </button>
        ))}
      </div>
      <textarea
        className="result-v2-textarea"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder={review.placeholder}
        aria-label="Written review"
      />
      <div className="result-v2-button-row">
        <button type="button" className="report-action-button" disabled title={review.submitDisabledReason}>
          {review.submitLabel}
        </button>
        <span className="result-v2-muted-note">{review.submitDisabledReason}</span>
      </div>
    </article>
  )
}
