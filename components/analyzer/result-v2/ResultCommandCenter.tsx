import { useState } from 'react'
import type { Analysis } from '../analyzerData'
import type { ResultV2ViewModel } from './resultV2Types'
import ResultDownloadPanel from './ResultDownloadPanel'
import ResultEmailCapturePanel from './ResultEmailCapturePanel'
import ResultEvidencePanel from './ResultEvidencePanel'
import ResultInputRecap from './ResultInputRecap'
import ResultMainProblems from './ResultMainProblems'
import ResultNextSteps from './ResultNextSteps'
import ResultReviewPanel from './ResultReviewPanel'
import ResultSharePanel from './ResultSharePanel'
import ResultSimpleVerdict from './ResultSimpleVerdict'
import ResultTechnicalPanel from './ResultTechnicalPanel'

type ResultCommandCenterProps = {
  claim?: string
  analysis: Analysis
  mode?: 'mobile' | 'desktop'
  resultIdentity: string
  viewModel: ResultV2ViewModel
  actionStatus?: string
  actionError?: string
  onCopySummary: (summary: string) => void
  onShareSummary: (summary: string) => void
  onDownloadSummary: (summary: string) => void
}

function SecondaryPanel({
  title,
  summary,
  defaultOpen = false,
  open,
  onToggle,
  children,
}: {
  title: string
  summary?: string
  defaultOpen?: boolean
  open?: boolean
  onToggle?: React.ReactEventHandler<HTMLDetailsElement>
  children: React.ReactNode
}) {
  const detailsProps =
    typeof open === 'boolean'
      ? {
          open,
          onToggle,
        }
      : defaultOpen
        ? { open: true }
        : {}

  return (
    <details className="result-v2-secondary" {...detailsProps}>
      <summary>
        <span className="result-v2-secondary__copy">
          <span className="result-v2-secondary__title">{title}</span>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span className="result-v2-secondary__state">
          <span className="result-v2-secondary__verb result-v2-secondary__verb--closed">Show</span>
          <span className="result-v2-secondary__verb result-v2-secondary__verb--open">Hide</span>
          <span className="result-v2-secondary__chevron" aria-hidden="true">
            {'▼'}
          </span>
        </span>
      </summary>
      <div className="result-v2-secondary-body">{children}</div>
    </details>
  )
}

function AlertsPanel({ emailCapture }: { emailCapture: ResultV2ViewModel['emailCapture'] }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <SecondaryPanel
      title="Alerts"
      summary={emailCapture.summary}
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open)
      }}
    >
      <ResultEmailCapturePanel emailCapture={emailCapture} />
    </SecondaryPanel>
  )
}

export default function ResultCommandCenter({
  mode = 'desktop',
  resultIdentity,
  viewModel,
  actionStatus,
  actionError,
  onCopySummary,
  onShareSummary,
  onDownloadSummary,
}: ResultCommandCenterProps) {
  const isMobile = mode === 'mobile'

  return (
    <section className="result-v2-shell" aria-label="DAM result command center">
      <div className="result-v2-stack">
        {isMobile ? <ResultInputRecap recap={viewModel.inputRecap} /> : null}
        <ResultSimpleVerdict verdict={viewModel.simpleVerdict} />
        <ResultMainProblems items={viewModel.mainProblems} />
        <ResultNextSteps items={viewModel.recommendedNextSteps} />
      </div>

      <div className="result-v2-secondary-stack">
        <SecondaryPanel title="Evidence" summary="Sources reviewed" defaultOpen={false}>
          <ResultEvidencePanel evidence={viewModel.evidence} />
        </SecondaryPanel>
        <SecondaryPanel title="Technical" summary="Confidence and contradiction">
          <ResultTechnicalPanel technicalDetails={viewModel.technicalDetails} />
        </SecondaryPanel>
        <SecondaryPanel title="Share" summary="Copy or share result">
          <ResultSharePanel
            fullSummary={viewModel.share.fullSummary}
            shortSummary={viewModel.share.shortSummary}
            onCopyShort={() => onCopySummary(viewModel.share.shortSummary)}
            onCopyFull={() => onCopySummary(viewModel.share.fullSummary)}
            onShare={() => onShareSummary(viewModel.share.fullSummary)}
          />
        </SecondaryPanel>
        <SecondaryPanel title="Save" summary="Download .txt">
          <ResultDownloadPanel
            exportText={viewModel.download.plainTextExport}
            onDownload={() => onDownloadSummary(viewModel.download.plainTextExport)}
          />
        </SecondaryPanel>
        <SecondaryPanel title="Review" summary="Feedback coming soon">
          <ResultReviewPanel review={viewModel.review} />
        </SecondaryPanel>
        <AlertsPanel key={resultIdentity} emailCapture={viewModel.emailCapture} />
      </div>

      {actionStatus || actionError ? (
        <p className={actionError ? 'report-share-panel__status is-error' : 'report-share-panel__status'}>
          {actionError || actionStatus}
        </p>
      ) : null}
    </section>
  )
}
