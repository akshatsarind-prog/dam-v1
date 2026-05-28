import type { ResultV2Evidence } from './resultV2Types'

type ResultEvidencePanelProps = {
  evidence: ResultV2Evidence
}

export default function ResultEvidencePanel({ evidence }: ResultEvidencePanelProps) {
  return (
    <article className="result-v2-secondary-card">
      <div className="result-v2-secondary-summary-row">
        <div>
          <strong>{evidence.compactSummary}</strong>
          <p>{evidence.evidenceQuality}</p>
        </div>
      </div>
      {evidence.sourceSummaries.length ? (
        <div className="result-v2-source-list">
          {evidence.sourceSummaries.map((source) => (
            <section key={source.id} className="result-v2-source-card">
              <div className="result-v2-source-topline">
                <strong>{source.domain}</strong>
                <span>{source.credibility ?? 'Unknown credibility'}</span>
              </div>
              <p className="result-v2-source-title">{source.title}</p>
              <p className="result-v2-body">{source.summary}</p>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="result-v2-link">
                  Open source
                </a>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <p className="result-v2-body">{evidence.fallbackMessage}</p>
      )}
    </article>
  )
}
