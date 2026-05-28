import { useState, type ReactNode } from 'react'
import BetaSignupCard from './BetaSignupCard'
import {
  type Analysis,
  type Indicator,
  type ReportMeta,
  getCredibilityClass,
  getIndicatorStateForContradiction,
  getIndicatorStateForRisk,
  getOperationalHeadline,
  getStanceClass,
  getVerdictBadgeClass,
  processingStages,
  riskStyles,
} from './analyzerData'
import ResultCommandCenter from './result-v2/ResultCommandCenter'
import { adaptResultToV2ViewModel } from './result-v2/resultV2Adapter'

type SharedResultViewProps = {
  claim: string
  error: string
  loading: boolean
  loadingStage: number
  reportMeta: ReportMeta | null
  analysis: Analysis | null
  activeAnalysis: Analysis
  displayScope: string
  confidence: number
  confidenceLabel: string
  indicators: Indicator[]
  claimTraits: string[]
  mode?: 'desktop' | 'mobile'
  chrome?: 'panel' | 'inline'
  suppressLoadingState?: boolean
  loadingLayout?: 'full' | 'pipeline' | 'meta'
}

type MobileAccordionKey = 'sources' | 'evidence' | 'details' | 'signals'

const ENABLE_RESULT_V2 = true

const mobileAccordionButtonStyle = {
  width: '100%',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 16px',
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  color: 'var(--text)',
  textAlign: 'left',
  font: 'inherit',
  cursor: 'pointer',
  borderRadius: 10,
  transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease',
} as const

const mobileAccordionShellStyle = {
  overflow: 'hidden',
  transformOrigin: 'top center',
  willChange: 'max-height, opacity, margin-top',
  transition:
    'max-height 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out, margin-top 240ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const

const mobileAccordionPanelStyle = {
  transformOrigin: 'top center',
  willChange: 'transform, opacity, padding',
  transition:
    'opacity 180ms ease-out, transform 240ms cubic-bezier(0.22, 1, 0.36, 1), padding 240ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const

function formatSummarySection(title: string, items: string[]) {
  if (!items.length) {
    return ''
  }

  return `${title}:\n${items.map((item) => `- ${item}`).join('\n')}`
}

function buildResultSummary({
  claim,
  analysis,
  reportMeta,
  displayScope,
}: {
  claim: string
  analysis: Analysis
  reportMeta: ReportMeta | null
  displayScope: string
}) {
  const headerLines = [
    'DAM Result Summary',
    '',
    `Claim: ${claim || 'Not captured'}`,
    `Verdict: ${analysis.verdict}`,
    `Operational headline: ${getOperationalHeadline(analysis)}`,
    `Distribution risk: ${analysis.risk}`,
    `Confidence: ${analysis.confidence.score}% (${analysis.confidence.label})`,
    `Evidence scope: ${displayScope}`,
    `Sources reviewed: ${analysis.corroborationLevel.sourceCount}`,
    `High-credibility sources: ${analysis.corroborationLevel.highCredibilityCount}`,
    `Contradiction level: ${analysis.contradictions.level}`,
    `Trace ID: ${reportMeta?.traceId ?? 'Unavailable'}`,
    `Retrieved: ${reportMeta?.timestamp ?? analysis.retrievedAt ?? 'Unavailable'}`,
    '',
    `Recommended action: ${analysis.operationalGuidance.action}`,
    `Distribution guidance: ${analysis.operationalGuidance.distribution}`,
    `Escalation: ${analysis.operationalGuidance.escalation}`,
    '',
    `Reasoning: ${analysis.reasoning}`,
  ]

  return [
    ...headerLines,
    formatSummarySection('Confidence drivers', analysis.confidence.drivers),
    formatSummarySection(
      'Corroboration indicators',
      analysis.corroborationLevel.indicators
    ),
    formatSummarySection('Next steps', analysis.operationalGuidance.nextSteps),
    formatSummarySection(
      'Evidence citations',
      analysis.evidence.map(
        (item) => `[${item.id}] ${item.domain} | ${item.title} | ${item.url || 'No URL provided'}`
      )
    ),
  ]
    .filter(Boolean)
    .join('\n')
}

function buildSummaryFilename(traceId: string | undefined) {
  const safeTraceId = (traceId || 'summary').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()
  return `dam-result-${safeTraceId}.txt`
}

export default function SharedResultView({
  claim,
  error,
  loading,
  loadingStage,
  reportMeta,
  analysis,
  activeAnalysis,
  displayScope,
  confidence,
  confidenceLabel,
  indicators,
  claimTraits,
  mode = 'desktop',
  chrome = 'panel',
  suppressLoadingState = false,
  loadingLayout = 'full',
}: SharedResultViewProps) {
  const isMobile = mode === 'mobile'
  const [mobileAccordions, setMobileAccordions] = useState<Record<MobileAccordionKey, boolean>>({
    sources: false,
    evidence: false,
    details: false,
    signals: false,
  })
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionScope, setActionScope] = useState('')
  const currentActionScope = analysis ? `${reportMeta?.traceId ?? 'no-trace'}:${claim.trim()}` : ''

  function toggleMobileAccordion(key: MobileAccordionKey) {
    setMobileAccordions((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  function fallbackCopySummary(summary: string) {
    const textarea = document.createElement('textarea')
    textarea.value = summary
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    const copied = document.execCommand('copy')
    textarea.remove()

    if (!copied) {
      throw new Error('Copy failed')
    }
  }

  async function copySummary(summary: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary)
      } else {
        fallbackCopySummary(summary)
      }

      setActionScope(currentActionScope)
      setActionError('')
      setActionMessage('Summary copied.')
    } catch {
      setActionScope(currentActionScope)
      setActionMessage('')
      setActionError('Copy failed. Try the TXT download instead.')
    }
  }

  async function handleShare(summary: string) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'DAM result summary',
          text: summary,
        })
        setActionScope(currentActionScope)
        setActionError('')
        setActionMessage('Summary shared.')
        return
      }

      await copySummary(summary)
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        return
      }

      setActionScope(currentActionScope)
      setActionMessage('')
      setActionError('Share failed. Copy the summary instead.')
    }
  }

  function handleDownload(summary: string, traceId?: string) {
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = downloadUrl
    anchor.download = buildSummaryFilename(traceId)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(downloadUrl)

    setActionScope(currentActionScope)
    setActionError('')
    setActionMessage('TXT summary downloaded.')
  }

  function renderSummaryActions(stateLabel: string, summary?: string) {
    const controlsDisabled = !summary
    const shouldShowActionFeedback = currentActionScope !== '' && actionScope === currentActionScope
    const statusMessage = shouldShowActionFeedback
      ? actionError || actionMessage || stateLabel
      : stateLabel

    return (
      <div className="report-share-panel" aria-label="Share and download result">
        <div className="report-share-panel__copy">
          <h3>Share or Save</h3>
          <p>
            Copy, share, or download a plain-text summary with the claim, verdict,
            confidence, trace metadata, guidance, and evidence citations.
          </p>
        </div>
        <div className="report-share-panel__actions">
          <button
            type="button"
            className="report-action-button"
            disabled={controlsDisabled}
            onClick={() => {
              if (!summary) {
                return
              }

              void copySummary(summary)
            }}
          >
            Copy summary
          </button>
          <button
            type="button"
            className="report-action-button"
            disabled={controlsDisabled}
            onClick={() => {
              if (!summary) {
                return
              }

              void handleShare(summary)
            }}
          >
            Share summary
          </button>
          <button
            type="button"
            className="report-action-button"
            disabled={controlsDisabled}
            onClick={() => {
              if (!summary) {
                return
              }

              handleDownload(summary, reportMeta?.traceId)
            }}
          >
            Download TXT
          </button>
        </div>
        <p
          className={
            shouldShowActionFeedback && actionError
              ? 'report-share-panel__status is-error'
              : 'report-share-panel__status'
          }
        >
          {statusMessage}
        </p>
      </div>
    )
  }

  function renderMobileAccordion(
    key: MobileAccordionKey,
    label: string,
    content: ReactNode,
    count?: number
  ) {
    const isOpen = mobileAccordions[key]
    const heading = typeof count === 'number' ? `${label} (${count})` : label

    return (
      <div className="report-section">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`mobile-accordion-${key}`}
          onClick={() => toggleMobileAccordion(key)}
          style={mobileAccordionButtonStyle}
        >
          <span>{heading}</span>
          <span aria-hidden="true">{isOpen ? '-' : '+'}</span>
        </button>
        <div
          aria-hidden={!isOpen}
          inert={!isOpen}
          style={{
            ...mobileAccordionShellStyle,
            maxHeight: isOpen ? 2400 : 0,
            opacity: isOpen ? 1 : 0,
            marginTop: isOpen ? 10 : 0,
          }}
        >
          <div
            id={`mobile-accordion-${key}`}
            style={{
              ...mobileAccordionPanelStyle,
              opacity: isOpen ? 1 : 0,
              transform: isOpen
                ? 'translateY(0) scaleY(1)'
                : 'translateY(-14px) scaleY(0.94)',
              paddingTop: isOpen ? 2 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
            }}
          >
            {content}
          </div>
        </div>
      </div>
    )
  }

  let content: ReactNode = null

  if (loading && !suppressLoadingState) {
    const loadingMetaContent = (
      <div className="report-meta-strip report-meta-strip--loading" aria-label="Analysis trace metadata">
        <div>
          <span>Trace ID</span>
          <strong>{reportMeta?.traceId ?? 'DAM-PENDING'}</strong>
        </div>
        <div>
          <span>Opened</span>
          <strong>{reportMeta?.timestamp ?? 'Pending'}</strong>
        </div>
        <div>
          <span>Pipeline</span>
          <strong>Retrieval first</strong>
        </div>
      </div>
    )

    const loadingStageContent = (
      <div className="loading-stage-list" aria-label="Analysis pipeline">
        {processingStages.map((stage, index) => (
          <div
            className={
              index < loadingStage
                ? 'stage-row complete'
                : index === loadingStage
                  ? 'stage-row active'
                  : 'stage-row'
            }
            key={stage}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{stage}</p>
          </div>
        ))}
      </div>
    )

    if (loadingLayout === 'pipeline') {
      content = loadingStageContent
    } else if (loadingLayout === 'meta') {
      content = loadingMetaContent
    } else {
      content = (
        <section className="report-card loading-card" aria-label="Analysis in progress">
          <div className="panel-topline">
            <p>Intelligence Briefing</p>
            <span className="status-badge status-badge-processing">
              <span className="badge-spinner" aria-hidden="true" />
              Processing
            </span>
          </div>
          {renderSummaryActions('Summary actions unlock after the analysis finishes.')}
          {loadingMetaContent}
          {loadingStageContent}
        </section>
      )
    }
  } else if (analysis) {
    const resultSummary = buildResultSummary({
      claim: claim.trim(),
      analysis: activeAnalysis,
      reportMeta,
      displayScope,
    })
    const resultV2ViewModel = adaptResultToV2ViewModel({
      claim,
      analysis: activeAnalysis,
      reportMeta,
      displayScope,
    })
    const signalsSection = (
      <div className="report-section">
        <h3>Evidence Signals</h3>
        <div className="indicator-grid">
          {indicators.map((indicator) => (
            <div className={`indicator indicator-${indicator.state}`} key={indicator.label}>
              <span>{indicator.label}</span>
              <strong>{indicator.value}</strong>
            </div>
          ))}
        </div>
      </div>
    )

    const sourcesSection = (
      <div className="report-section">
        <h3>Evidence Citations</h3>
        <div className="evidence-card-grid">
          {activeAnalysis.evidence.length ? (
            activeAnalysis.evidence.map((item) => (
              <article className="evidence-card" key={`${item.id}-${item.url}`}>
                <div className="evidence-card-header">
                  <span>{item.id}</span>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.domain}
                  </a>
                </div>
                <h4>{item.title}</h4>
                <div className="evidence-badges">
                  <span className={getCredibilityClass(item.credibility)}>
                    {item.credibility} credibility
                  </span>
                  <span className={getStanceClass(item.stance)}>{item.stance}</span>
                </div>
                <p>{item.excerpt}</p>
                <strong>{item.assessment}</strong>
              </article>
            ))
          ) : (
            <div className="consistency-box consistency-watch">
              <strong>No retrieved evidence cards returned.</strong>
              <p>Hold amplification until source material is available.</p>
            </div>
          )}
        </div>
      </div>
    )

    const evidenceSection = (
      <div>
        <div className="report-section split-section">
          <div>
            <h3>Corroboration Indicators</h3>
            <ul className="compact-list">
              {activeAnalysis.corroborationLevel.indicators.map((indicator) => (
                <li key={indicator}>{indicator}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Confidence Drivers</h3>
            <ul className="compact-list">
              {activeAnalysis.confidence.drivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )

    const reasoningSection = (
      <div className="report-section compact-section">
        <h3>Reasoning</h3>
        <p>{activeAnalysis.reasoning}</p>
      </div>
    )

    const contradictionsSection = (
      <div className="report-section split-section">
        <div>
          <h3>Contradiction Summary</h3>
          <div
            className={`consistency-box consistency-${getIndicatorStateForContradiction(activeAnalysis.contradictions.level)}`}
          >
            <strong>{activeAnalysis.contradictions.summary}</strong>
            {activeAnalysis.contradictions.items.length ? (
              <ul className="compact-list nested-list">
                {activeAnalysis.contradictions.items.map((item) => (
                  <li key={`${item.severity}-${item.summary}`}>
                    {item.severity}: {item.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No source-level contradiction items were returned.</p>
            )}
          </div>
        </div>
        <div>
          <h3>Claim Decomposition</h3>
          <div className="trait-list">
            {claimTraits.length ? (
              claimTraits.map((trait) => <span key={trait}>{trait}</span>)
            ) : (
              <span>No extracted entities</span>
            )}
          </div>
        </div>
      </div>
    )

    const operationalGuidanceSection = (
      <div className="report-section">
        <h3>Operational Guidance</h3>
        <div className={`consistency-box consistency-${getIndicatorStateForRisk(activeAnalysis.risk)}`}>
          <strong>{activeAnalysis.operationalGuidance.action}</strong>
          <p>{activeAnalysis.operationalGuidance.distribution}</p>
          <p>{activeAnalysis.operationalGuidance.escalation}</p>
        </div>
      </div>
    )

    const nextStepsCredibilitySection = (
      <div className="report-section split-section">
        <div>
          <h3>Next Steps</h3>
          <ul className="compact-list">
            {activeAnalysis.operationalGuidance.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Source Credibility</h3>
          <div className="source-count-grid">
            <div>
              <span>High</span>
              <strong>{activeAnalysis.sourceCredibility.highTrustSources}</strong>
            </div>
            <div>
              <span>Moderate</span>
              <strong>{activeAnalysis.sourceCredibility.moderateTrustSources}</strong>
            </div>
            <div>
              <span>Low</span>
              <strong>{activeAnalysis.sourceCredibility.lowTrustSources}</strong>
            </div>
            <div>
              <span>Unknown</span>
              <strong>{activeAnalysis.sourceCredibility.unknownTrustSources}</strong>
            </div>
          </div>
        </div>
      </div>
    )

    const detailsSection = (
      <div>
        <div className="report-meta-strip">
          <div>
            <span>Trace ID</span>
            <strong>{reportMeta?.traceId ?? 'DAM-CLOSED'}</strong>
          </div>
          <div>
            <span>Retrieved</span>
            <strong>{reportMeta?.timestamp ?? 'Just now'}</strong>
          </div>
          <div>
            <span>Evidence Scope</span>
            <strong>{displayScope}</strong>
          </div>
          <div>
            <span>Escalation Flag</span>
            <strong>{activeAnalysis.operationalGuidance.escalation}</strong>
          </div>
        </div>
        {reasoningSection}
        {contradictionsSection}
        {nextStepsCredibilitySection}
      </div>
    )

    content = ENABLE_RESULT_V2 ? (
      <section className="report-card report-ready">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className={`badge ${getVerdictBadgeClass(activeAnalysis.verdict)}`}>
            {activeAnalysis.verdict}
          </span>
        </div>
        <ResultCommandCenter
          claim={claim}
          analysis={activeAnalysis}
          mode={mode}
          viewModel={resultV2ViewModel}
          actionStatus={currentActionScope !== '' && actionScope === currentActionScope ? actionMessage : ''}
          actionError={currentActionScope !== '' && actionScope === currentActionScope ? actionError : ''}
          onCopySummary={(summary) => {
            void copySummary(summary)
          }}
          onShareSummary={(summary) => {
            void handleShare(summary)
          }}
          onDownloadSummary={(summary) => {
            handleDownload(summary, reportMeta?.traceId)
          }}
        />
      </section>
    ) : (
      <section className="report-card report-ready">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className={`badge ${getVerdictBadgeClass(activeAnalysis.verdict)}`}>
            {activeAnalysis.verdict}
          </span>
        </div>
        {isMobile ? (
          <>
            <div className="verdict-block">
              <div>
                <p>Operational Verdict</p>
                <h3>{getOperationalHeadline(activeAnalysis)}</h3>
              </div>
              <span className={`risk-pill ${riskStyles[activeAnalysis.risk]}`}>
                {activeAnalysis.risk} distribution risk
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="report-meta-strip">
              <div>
                <span>Trace ID</span>
                <strong>{reportMeta?.traceId ?? 'DAM-CLOSED'}</strong>
              </div>
              <div>
                <span>Retrieved</span>
                <strong>{reportMeta?.timestamp ?? 'Just now'}</strong>
              </div>
              <div>
                <span>Evidence Scope</span>
                <strong>{displayScope}</strong>
              </div>
              <div>
                <span>Escalation Flag</span>
                <strong>{activeAnalysis.operationalGuidance.escalation}</strong>
              </div>
            </div>
            <div className="verdict-block">
              <div>
                <p>Operational Verdict</p>
                <h3>{getOperationalHeadline(activeAnalysis)}</h3>
              </div>
              <span className={`risk-pill ${riskStyles[activeAnalysis.risk]}`}>
                {activeAnalysis.risk} distribution risk
              </span>
            </div>
          </>
        )}

        <div className="brief-grid dense">
          <div className="brief-card">
            <span>Confidence Signal</span>
            <strong>{confidenceLabel}</strong>
            <div className="confidence-track" aria-hidden="true">
              <span style={{ width: `${confidence}%` }} />
            </div>
            <p>{confidence}% evidence-calibrated confidence</p>
          </div>
          <div className="brief-card">
            <span>Source Credibility</span>
            <strong>{activeAnalysis.sourceCredibility.label}</strong>
            <p>{activeAnalysis.sourceCredibility.rationale}</p>
          </div>
          <div className="brief-card">
            <span>Corroboration Level</span>
            <strong>{activeAnalysis.corroborationLevel.sourceCount}</strong>
            <p>{activeAnalysis.corroborationLevel.label}</p>
          </div>
          <div className="brief-card">
            <span>Contradictions</span>
            <strong>{activeAnalysis.contradictions.level}</strong>
            <p>{activeAnalysis.contradictions.summary}</p>
          </div>
        </div>

        {renderSummaryActions('Summary ready to copy, share, or download.', resultSummary)}

        {!isMobile ? (
          <>
            {reasoningSection}
            {signalsSection}
            {sourcesSection}
          </>
        ) : null}

        {operationalGuidanceSection}

        {isMobile ? (
          <>
            {renderMobileAccordion('signals', 'System signals', signalsSection, indicators.length)}
            {renderMobileAccordion(
              'evidence',
              'Evidence',
              evidenceSection,
              activeAnalysis.corroborationLevel.indicators.length +
                activeAnalysis.confidence.drivers.length
            )}
            {renderMobileAccordion('details', 'Details', detailsSection)}
            {renderMobileAccordion(
              'sources',
              'Sources',
              sourcesSection,
              activeAnalysis.evidence.length
            )}
          </>
        ) : null}
        {!isMobile ? evidenceSection : null}
        {!isMobile ? contradictionsSection : null}
        {!isMobile ? nextStepsCredibilitySection : null}
      </section>
    )
  } else if (error) {
    content = (
      <section className="report-card empty-report">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className="status-badge muted">Analysis error</span>
        </div>
        {renderSummaryActions('No summary available because the analysis did not complete.')}
        <div className="empty-state">
          <span aria-hidden="true" />
          <h3>Briefing unavailable.</h3>
          <p>{error}</p>
        </div>
      </section>
    )
  } else if (!loading) {
    content = (
      <section className="report-card empty-report">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className="status-badge muted">Awaiting claim</span>
        </div>
        {renderSummaryActions('Run a claim to enable copy, share, and TXT download.')}
        <div className="empty-system-grid">
          <div>
            <span>Trace ID</span>
            <strong>DAM-STANDBY</strong>
          </div>
          <div>
            <span>Source Corroboration</span>
            <strong>Pending</strong>
          </div>
          <div>
            <span>Distribution Risk</span>
            <strong>Unassigned</strong>
          </div>
        </div>
        <div className="empty-state">
          <span aria-hidden="true" />
          <h3>No briefing generated.</h3>
          <p>
            Submit a claim to generate operational verdict, confidence, source
            credibility, contradiction summary, evidence citations, and guidance.
          </p>
        </div>
      </section>
    )
  }

  if (!content) {
    return null
  }

  if (chrome === 'inline') {
    return content
  }

  return (
    <aside className="report-panel" aria-live="polite" aria-busy={loading}>
      {content}
      {analysis && !ENABLE_RESULT_V2 ? <BetaSignupCard /> : null}
    </aside>
  )
}
