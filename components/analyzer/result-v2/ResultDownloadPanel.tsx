type ResultDownloadPanelProps = {
  exportText: string
  onDownload: () => void
}

export default function ResultDownloadPanel({
  exportText,
  onDownload,
}: ResultDownloadPanelProps) {
  return (
    <article className="result-v2-secondary-card">
      <p className="result-v2-body">Save a plain-text version of this result for later.</p>
      <textarea
        className="result-v2-textarea"
        readOnly
        value={exportText}
        aria-label="Plain text result export"
      />
      <div className="result-v2-button-row">
        <button type="button" className="report-action-button" onClick={onDownload}>
          Download .txt summary
        </button>
      </div>
    </article>
  )
}
