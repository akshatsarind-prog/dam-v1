import type { ResultV2SimpleVerdict } from './resultV2Types'

type ResultSimpleVerdictProps = {
  verdict: ResultV2SimpleVerdict
}

export default function ResultSimpleVerdict({ verdict }: ResultSimpleVerdictProps) {
  return (
    <section
      className={`result-v2-card result-v2-card--verdict result-v2-tone-${verdict.tone}`}
      aria-labelledby="result-v2-verdict"
    >
      <div className="result-v2-section-head">
        <p className="result-v2-eyebrow">DAM verdict</p>
        <div className="result-v2-meta-row">
          <span className={`result-v2-pill result-v2-pill--tone result-v2-pill--${verdict.tone}`}>
            {verdict.toneLabel}
          </span>
          {typeof verdict.confidence === 'number' ? (
            <span className="result-v2-pill">{verdict.confidence}% confidence</span>
          ) : null}
        </div>
      </div>
      <h2 id="result-v2-verdict" className="result-v2-title-lg">
        {verdict.label}
      </h2>
      <p className="result-v2-body">{verdict.shortReason}</p>
    </section>
  )
}
