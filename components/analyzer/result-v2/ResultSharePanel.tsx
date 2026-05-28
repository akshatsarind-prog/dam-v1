type ResultSharePanelProps = {
  fullSummary: string
  shortSummary: string
  onCopyShort: () => void
  onCopyFull: () => void
  onShare: () => void
}

export default function ResultSharePanel({
  fullSummary,
  shortSummary,
  onCopyShort,
  onCopyFull,
  onShare,
}: ResultSharePanelProps) {
  return (
    <article className="result-v2-secondary-card">
      <p className="result-v2-body">
        Copy a quick verdict or the full result before forwarding, escalating, or saving it.
      </p>
      <textarea
        className="result-v2-textarea"
        readOnly
        value={fullSummary}
        aria-label="Copyable DAM result summary"
      />
      <div className="result-v2-button-row">
        <button type="button" className="report-action-button" onClick={onCopyShort}>
          Copy short summary
        </button>
        <button type="button" className="report-action-button" onClick={onCopyFull}>
          Copy full result
        </button>
        <button type="button" className="report-action-button" onClick={onShare}>
          Share summary
        </button>
      </div>
      <div className="result-v2-quote result-v2-quote--compact">
        <p>{shortSummary}</p>
      </div>
    </article>
  )
}
