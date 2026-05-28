import type { ResultV2InputRecap } from './resultV2Types'

type ResultInputRecapProps = {
  recap: ResultV2InputRecap
}

export default function ResultInputRecap({ recap }: ResultInputRecapProps) {
  const hasExpandedCopy =
    recap.originalTextFull &&
    recap.originalTextFull.trim() !== recap.originalTextPreview.trim()

  return (
    <section className="result-v2-card result-v2-card--subtle" aria-labelledby="result-v2-input-recap">
      <div className="result-v2-section-head">
        <p className="result-v2-eyebrow">Checked message</p>
        <div className="result-v2-meta-row">
          <span>{recap.characterCount} chars</span>
          {recap.detectedClaimType ? <span>{recap.detectedClaimType}</span> : null}
        </div>
      </div>
      <h2 id="result-v2-input-recap" className="result-v2-title-sm">
        Check before you act.
      </h2>
      <p className="result-v2-body">{recap.shortInputSummary}</p>
      <div className="result-v2-quote">
        <p>{recap.originalTextPreview}</p>
      </div>
      {hasExpandedCopy ? (
        <details className="result-v2-inline-details">
          <summary>Show full message</summary>
          <p className="result-v2-body">{recap.originalTextFull}</p>
        </details>
      ) : null}
    </section>
  )
}
