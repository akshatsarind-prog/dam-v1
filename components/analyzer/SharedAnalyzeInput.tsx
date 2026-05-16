import type { ReactNode } from 'react'
import { MAX_CLAIM_LENGTH, type Analysis } from './analyzerData'

type SharedAnalyzeInputProps = {
  claim: string
  analysis: Analysis | null
  activeAnalysis: Analysis
  error: string
  loading: boolean
  remainingCharacters: number
  displayScope: string
  onChange: (value: string) => void
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
  belowTextareaContent?: ReactNode
}

export default function SharedAnalyzeInput({
  claim,
  analysis,
  activeAnalysis,
  error,
  loading,
  remainingCharacters,
  displayScope,
  onChange,
  onSubmit,
  onKeyDown,
  belowTextareaContent,
}: SharedAnalyzeInputProps) {
  return (
    <form className="claim-panel" onSubmit={onSubmit}>
      <div className="panel-topline">
        <p>Claim Intake</p>
        <span
          id="claim-counter"
          className={remainingCharacters <= 120 ? 'counter counter-warning' : 'counter'}
        >
          {claim.length}/{MAX_CLAIM_LENGTH}
        </span>
      </div>

      <div className="intake-status-grid" aria-label="Evidence diagnostics">
        <div>
          <span>Evidence Scope</span>
          <strong>{analysis ? displayScope : 'Pending'}</strong>
        </div>
        <div>
          <span>Source Credibility</span>
          <strong>{analysis ? activeAnalysis.sourceCredibility.label : 'Pending'}</strong>
        </div>
        <div>
          <span>Corroboration</span>
          <strong>{analysis ? activeAnalysis.corroborationLevel.label : 'Pending'}</strong>
        </div>
      </div>

      <label className="sr-only" htmlFor="claim-input">
        Claim
      </label>
      <textarea
        id="claim-input"
        value={claim}
        disabled={loading}
        maxLength={MAX_CLAIM_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Paste the claim exactly as it appears. Preserve source references, dates, figures, media context, and quoted language."
        className="claim-input"
        aria-describedby={error ? 'claim-error claim-counter' : 'claim-counter'}
        aria-invalid={error === 'Claim intake is empty.'}
      />
      {belowTextareaContent ? <div style={{ marginTop: 14 }}>{belowTextareaContent}</div> : null}

      <div className="intake-footer">
        {error ? (
          <p id="claim-error" className="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p>Exact wording improves retrieval, evidence extraction, and contradiction review.</p>
        )}
        <button type="submit" className="check-button" disabled={loading}>
          {loading ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Processing
            </>
          ) : (
            'Analyze claim'
          )}
        </button>
      </div>

      <div className="intake-metadata" aria-label="Input diagnostics">
        <div>
          <span>Characters</span>
          <strong>{claim.length}</strong>
        </div>
        <div>
          <span>Evidence Cards</span>
          <strong>{analysis ? activeAnalysis.evidence.length : 0}</strong>
        </div>
        <div>
          <span>Runtime</span>
          <strong>Retrieval</strong>
        </div>
      </div>
    </form>
  )
}
