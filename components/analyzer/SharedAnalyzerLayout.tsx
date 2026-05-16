import { useEffect, useId, useRef, useState } from 'react'
import {
  exampleClaimDomains,
  flowSteps,
  getRandomExampleClaimForSession,
  getOperationalHeadline,
  productSignals,
  useCases,
} from './analyzerData'
import type { AnalyzeClaimViewModel } from './useAnalyzeClaim'
import SharedAnalyzeInput from './SharedAnalyzeInput'
import SharedResultView from './SharedResultView'

type SharedAnalyzerLayoutProps = AnalyzeClaimViewModel & {
  isMobile?: boolean
}

const sectionNavItems = [
  { href: '#verify', label: 'Verify' },
  { href: '#flow', label: 'Flow' },
  { href: '#system', label: 'System' },
]

const mobileNavButtonStyle = {
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 12px',
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
} as const

const mobileNavMenuStyle = {
  position: 'absolute',
  top: 'calc(100% + 10px)',
  right: 0,
  width: 'min(220px, calc(100vw - 32px))',
  padding: 8,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.98)',
  boxShadow: 'var(--shadow)',
  zIndex: 20,
} as const

const mobileNavMenuLinkStyle = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  padding: '12px 14px',
  color: 'var(--text)',
  textDecoration: 'none',
} as const

const mobileNavMenuActionStyle = {
  minHeight: 44,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '12px 14px',
  border: 0,
  background: 'transparent',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
} as const

const examplePanelCloseButtonStyle = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  border: '1px solid var(--line)',
  background: '#080809',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
} as const

const examplePanelStyle = {
  marginBottom: 16,
  padding: 16,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  boxShadow: 'var(--shadow)',
} as const

const exampleDomainGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10,
  marginTop: 14,
} as const

const exampleDomainButtonStyle = {
  minHeight: 44,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  border: '1px solid var(--line)',
  background: '#080809',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
} as const

export default function SharedAnalyzerLayout({
  claim,
  analysis,
  error,
  loading,
  loadingStage,
  reportMeta,
  remainingCharacters,
  activeAnalysis,
  confidence,
  confidenceLabel,
  displayScope,
  indicators,
  claimTraits,
  contradictionCount,
  resetReportOnEdit,
  runExampleClaim,
  handleSubmit,
  handleKeyDown,
  trackLandingCtaClick,
  isMobile = false,
}: SharedAnalyzerLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isExamplePanelOpen, setIsExamplePanelOpen] = useState(false)
  const mobileMenuId = useId()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const verifySectionRef = useRef<HTMLElement | null>(null)

  async function handleExampleDomainSelect(domainId: string) {
    const exampleClaim = getRandomExampleClaimForSession(domainId)

    if (!exampleClaim) {
      return
    }

    setIsExamplePanelOpen(false)
    verifySectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    await runExampleClaim(exampleClaim)
  }

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileMenuOpen])

  return (
    <main className="dam-shell">
      <header className="dam-header">
        <a className="dam-mark" href="#top" aria-label="DAM V1 home">
          DAM
        </a>
        {isMobile ? (
          <div ref={mobileMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls={mobileMenuId}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              style={mobileNavButtonStyle}
            >
              <span aria-hidden="true">Menu</span>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-grid',
                  gap: 3,
                  width: 14,
                }}
              >
                <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
                <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
                <span style={{ display: 'block', height: 2, background: 'currentColor' }} />
              </span>
            </button>
            {isMobileMenuOpen ? (
              <nav id={mobileMenuId} style={mobileNavMenuStyle} aria-label="Product sections">
                {sectionNavItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={mobileNavMenuLinkStyle}
                  >
                    {item.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setIsExamplePanelOpen(true)
                    verifySectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }}
                  style={mobileNavMenuActionStyle}
                >
                  Try Example Claims
                </button>
              </nav>
            ) : null}
          </div>
        ) : (
          <nav className="dam-nav" aria-label="Product sections">
            {sectionNavItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <section id="top" className="dam-hero section-frame" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="system-label">
            <span aria-hidden="true" />
            DAM V1 / Evidence intelligence layer
          </p>
          <h1 id="hero-title">Information should pass through evidence.</h1>
          <p className="hero-text">
            Retrieval-first operational analysis for claims that need source-backed
            corroboration, contradiction review, and calibrated distribution control.
          </p>
          <div className="hero-actions">
            <a
              className="primary-link"
              href="#verify"
              onClick={() => trackLandingCtaClick('Open verification desk')}
            >
              Open verification desk
            </a>
            <p>Enter submits. Shift + Enter creates a new line.</p>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Live operational preview">
          <div className="panel-topline">
            <p>Operational telemetry</p>
            <span className={loading ? 'live-dot active' : 'live-dot'} aria-hidden="true" />
          </div>
          <div className="signal-stack compact">
            <div className="signal-row">
              <span>Trace ID</span>
              <strong>{reportMeta?.traceId ?? 'DAM-STANDBY'}</strong>
            </div>
            <div className="signal-row">
              <span>Evidence Scope</span>
              <strong>{displayScope}</strong>
            </div>
            <div className="signal-row">
              <span>Confidence Signal</span>
              <strong>{confidenceLabel}</strong>
            </div>
            <div className="signal-row">
              <span>Escalation Flag</span>
              <strong>{analysis ? activeAnalysis.operationalGuidance.escalation : 'Not assigned'}</strong>
            </div>
          </div>
          <div className="preview-brief">
            <p className="preview-label">System readout</p>
            <p>
              {analysis
                ? getOperationalHeadline(activeAnalysis)
                : 'Claim intake has not entered retrieval.'}
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Sources</span>
              <strong>{analysis ? activeAnalysis.corroborationLevel.sourceCount : 0}</strong>
            </div>
            <div>
              <span>Contradictions</span>
              <strong>{contradictionCount}</strong>
            </div>
            <div>
              <span>Credibility</span>
              <strong>{analysis ? activeAnalysis.sourceCredibility.weightedScore : 0}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section
        id="verify"
        ref={verifySectionRef}
        className="verification-section section-frame"
      >
        <div className="section-heading">
          <p className="system-label">
            <span aria-hidden="true" />
            Verification desk
          </p>
          <h2>Run the claim through retrieval-backed intelligence.</h2>
          <p>
            The report is driven by retrieved sources, source credibility, corroboration
            density, contradictions, and evidence-calibrated confidence.
          </p>
        </div>

        <div className="console-grid">
          {isMobile && isExamplePanelOpen ? (
            <section style={examplePanelStyle} aria-label="Try example claims">
              <div className="panel-topline">
                <p>Try it yourself</p>
                <button
                  type="button"
                  onClick={() => setIsExamplePanelOpen(false)}
                  style={examplePanelCloseButtonStyle}
                >
                  Close
                </button>
              </div>
              <p>
                Choose a domain to auto-fill a believable claim and run a live analysis
                through the existing evidence pipeline.
              </p>
              <div style={exampleDomainGridStyle}>
                {exampleClaimDomains.map((domain) => (
                  <button
                    key={domain.id}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      void handleExampleDomainSelect(domain.id)
                    }}
                    style={exampleDomainButtonStyle}
                  >
                    <span>{domain.label}</span>
                    <span aria-hidden="true">10</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <SharedAnalyzeInput
            claim={claim}
            analysis={analysis}
            activeAnalysis={activeAnalysis}
            error={error}
            loading={loading}
            remainingCharacters={remainingCharacters}
            displayScope={displayScope}
            onChange={resetReportOnEdit}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            belowTextareaContent={
              isMobile && loading ? (
                <SharedResultView
                  loading={loading}
                  loadingStage={loadingStage}
                  reportMeta={reportMeta}
                  analysis={analysis}
                  activeAnalysis={activeAnalysis}
                  displayScope={displayScope}
                  confidence={confidence}
                  confidenceLabel={confidenceLabel}
                  indicators={indicators}
                  claimTraits={claimTraits}
                  mode="mobile"
                  chrome="inline"
                />
              ) : null
            }
          />
          <SharedResultView
            loading={loading}
            loadingStage={loadingStage}
            reportMeta={reportMeta}
            analysis={analysis}
            activeAnalysis={activeAnalysis}
            displayScope={displayScope}
            confidence={confidence}
            confidenceLabel={confidenceLabel}
            indicators={indicators}
            claimTraits={claimTraits}
            mode={isMobile ? 'mobile' : 'desktop'}
            suppressLoadingState={isMobile}
          />
        </div>
      </section>

      <section id="flow" className="flow-section section-frame">
        <div className="section-heading wide restrained">
          <p className="system-label">
            <span aria-hidden="true" />
            Product flow
          </p>
          <h2>From claim intake to evidence-backed control.</h2>
        </div>
        <div className="flow-grid">
          {flowSteps.map((step) => (
            <article className="flow-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="system" className="system-section section-frame">
        <div className="system-column">
          <p className="system-label">
            <span aria-hidden="true" />
            Use cases
          </p>
          <div className="list-panel">
            {useCases.map((item) => (
              <div className="list-row" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="system-column">
          <p className="system-label">
            <span aria-hidden="true" />
            System outputs
          </p>
          <div className="list-panel">
            {productSignals.map((item) => (
              <div className="list-row" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <article className="why-card">
          <p className="system-label">
            <span aria-hidden="true" />
            Why DAM
          </p>
          <h2>Mission on the landing page. Evidence in the product.</h2>
          <p>
            DAM V1 turns tense information moments into a repeatable operational routine:
            retrieve sources, rank credibility, inspect contradictions, and decide what
            should not be amplified.
          </p>
        </article>
      </section>
    </main>
  )
}
