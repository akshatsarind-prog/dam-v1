import { useState, type ReactNode } from 'react'
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

type SharedResultViewProps = {
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
}

type MobileAccordionKey = 'sources' | 'evidence' | 'details' | 'signals'

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
} as const

const mobileAccordionPanelStyle = {
  marginTop: 10,
} as const

export default function SharedResultView({
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
}: SharedResultViewProps) {
  const isMobile = mode === 'mobile'
  const [mobileAccordions, setMobileAccordions] = useState<Record<MobileAccordionKey, boolean>>({
    sources: false,
    evidence: false,
    details: false,
    signals: false,
  })

  function toggleMobileAccordion(key: MobileAccordionKey) {
    setMobileAccordions((current) => ({
      ...current,
      [key]: !current[key],
    }))
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
        {isOpen ? (
          <div id={`mobile-accordion-${key}`} style={mobileAccordionPanelStyle}>
            {content}
          </div>
        ) : null}
      </div>
    )
  }

  let content: ReactNode = null

  if (loading && !suppressLoadingState) {
    content = (
      <section className="report-card loading-card" aria-label="Analysis in progress">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className="status-badge">
            <span className="badge-spinner" aria-hidden="true" />
            Processing
          </span>
        </div>
        <div className="report-meta-strip">
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
        <div className="loading-stage-list">
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
      </section>
    )
  } else if (analysis) {
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

    content = (
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
  } else if (!loading) {
    content = (
      <section className="report-card empty-report">
        <div className="panel-topline">
          <p>Intelligence Briefing</p>
          <span className="status-badge muted">Awaiting claim</span>
        </div>
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
    </aside>
  )
}
