import type { ResultV2TechnicalDetails } from './resultV2Types'

type ResultTechnicalPanelProps = {
  technicalDetails: ResultV2TechnicalDetails
}

export default function ResultTechnicalPanel({ technicalDetails }: ResultTechnicalPanelProps) {
  function getValueClass(label: string) {
    const normalized = label.toLowerCase()

    if (normalized === 'trace id') {
      return 'result-v2-meta-value result-v2-meta-value--trace'
    }

    if (normalized === 'claim preview') {
      return 'result-v2-meta-value result-v2-meta-value--text'
    }

    return 'result-v2-meta-value'
  }

  return (
    <article className="result-v2-secondary-card">
      <div className="result-v2-technical-intro">
        <p className="result-v2-muted-note result-v2-muted-note--inline">
          {technicalDetails.compactSummary}
        </p>
        <p className="result-v2-body result-v2-technical-line">{technicalDetails.verdictLine}</p>
        <p className="result-v2-body result-v2-technical-note">{technicalDetails.contradictionStatus}</p>
      </div>
      {technicalDetails.confidenceDrivers.length ? (
        <ul className="result-v2-list result-v2-list--compact result-v2-list--technical">
          {technicalDetails.confidenceDrivers.map((driver) => (
            <li key={driver}>{driver}</li>
          ))}
        </ul>
      ) : null}
      <div className="result-v2-metadata-grid">
        {technicalDetails.metadata.map((item) => (
          <div key={item.label} className="result-v2-meta-card">
            <span>{`${item.label}:`}</span>
            <strong className={getValueClass(item.label)}>{item.value}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}
