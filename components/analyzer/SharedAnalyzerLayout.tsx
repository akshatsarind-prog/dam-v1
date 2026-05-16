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
  borderRadius: 999,
  transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease',
} as const

const mobileDrawerShellStyle = {
  width: 'min(100% - 32px, 1180px)',
  margin: '0 auto',
  overflow: 'hidden',
  transformOrigin: 'top center',
  transition: 'max-height 180ms ease, opacity 160ms ease, transform 160ms ease, margin-top 160ms ease',
} as const

const mobileDrawerPanelStyle = {
  padding: 10,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.98)',
  boxShadow: 'var(--shadow)',
  borderRadius: 24,
  backdropFilter: 'blur(12px)',
} as const

const mobileNavMenuItemStyle = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 14px',
  border: 0,
  background: 'transparent',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: 16,
  transition: 'background 140ms ease, opacity 140ms ease',
} as const

const examplePanelStyle = {
  marginBottom: 12,
  padding: 12,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  boxShadow: 'var(--shadow)',
  borderRadius: 24,
} as const

const exampleDomainGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8,
  marginTop: 10,
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
  borderRadius: 18,
  transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease',
} as const

const examplePanelToggleStyle = {
  minHeight: 44,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 14px',
  border: '1px solid var(--line)',
  background: '#080809',
  color: 'var(--text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: 18,
  transition: 'background 140ms ease, border-color 140ms ease',
} as const

const examplePanelBodyStyle = {
  marginTop: 10,
} as const

const mobileHeaderScrollOffset = 88

const mobileConsoleGridStyle = {
  display: 'grid',
  gap: 12,
  alignItems: 'start',
} as const

const mobileInputWrapStyle = {
  minWidth: 0,
} as const

const mobileResultWrapStyle = {
  minWidth: 0,
  marginTop: 2,
} as const

function scrollToElement(
  target: HTMLElement | null,
  isMobile: boolean,
  block: ScrollLogicalPosition = 'start'
) {
  if (!target) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  if (!isMobile) {
    target.scrollIntoView({
      behavior: 'smooth',
      block,
    })
    return
  }

  const top = Math.max(
    window.scrollY + target.getBoundingClientRect().top - mobileHeaderScrollOffset,
    0
  )

  window.scrollTo({
    behavior: 'smooth',
    top,
  })
}

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
  const examplePanelRef = useRef<HTMLElement | null>(null)
  const claimPanelRef = useRef<HTMLDivElement | null>(null)
  const resultPanelRef = useRef<HTMLDivElement | null>(null)
  const previousAnalysisRef = useRef<AnalyzeClaimViewModel['analysis']>(null)

  function scrollToVerificationArea() {
    scrollToElement(claimPanelRef.current ?? verifySectionRef.current, isMobile, 'start')
  }

  function openExamplePanel() {
    setIsMobileMenuOpen(false)
    setIsExamplePanelOpen(true)
    requestAnimationFrame(() => {
      scrollToElement(examplePanelRef.current ?? verifySectionRef.current, isMobile, 'start')
    })
  }

  function handleMobileSectionNavigation(targetId: string) {
    setIsMobileMenuOpen(false)

    if (targetId === 'verify') {
      requestAnimationFrame(() => {
        scrollToVerificationArea()
      })
      return
    }

    const target = document.getElementById(targetId)
    requestAnimationFrame(() => {
      scrollToElement(target, isMobile)
    })
  }

  async function handleExampleDomainSelect(domainId: string) {
    const exampleClaim = getRandomExampleClaimForSession(domainId)

    if (!exampleClaim) {
      return
    }

    setIsExamplePanelOpen(false)
    scrollToVerificationArea()
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

  useEffect(() => {
    if (!isMobile) {
      previousAnalysisRef.current = analysis
      return
    }

    if (loading) {
      scrollToElement(claimPanelRef.current ?? verifySectionRef.current, isMobile, 'start')
    }
  }, [isMobile, loading, analysis])

  useEffect(() => {
    if (!isMobile) {
      previousAnalysisRef.current = analysis
      return
    }

    if (!previousAnalysisRef.current && analysis) {
      scrollToElement(resultPanelRef.current ?? claimPanelRef.current, isMobile, 'start')
    }

    previousAnalysisRef.current = analysis
  }, [isMobile, analysis])

  return (
    <main className="dam-shell">
      <div ref={mobileMenuRef}>
        <header className="dam-header">
          <a className="dam-mark" href="#top" aria-label="DAM V1 home">
            DAM
          </a>
          {isMobile ? (
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
        {isMobile ? (
          <section style={mobileDrawerShellStyle}>
            <nav
              id={mobileMenuId}
              aria-label="Product sections"
              aria-hidden={!isMobileMenuOpen}
              style={{
                ...mobileDrawerPanelStyle,
                overflow: 'hidden',
                opacity: isMobileMenuOpen ? 1 : 0,
                transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
                pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
                maxHeight: isMobileMenuOpen ? 320 : 0,
                marginTop: isMobileMenuOpen ? 10 : 0,
                padding: isMobileMenuOpen ? 10 : 0,
                borderWidth: isMobileMenuOpen ? 1 : 0,
                boxShadow: isMobileMenuOpen ? 'var(--shadow)' : 'none',
              }}
            >
              {sectionNavItems.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleMobileSectionNavigation(item.href.slice(1))}
                  style={mobileNavMenuItemStyle}
                >
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={openExamplePanel}
                style={mobileNavMenuItemStyle}
              >
                <span>Try Example Claims</span>
              </button>
            </nav>
          </section>
        ) : null}
      </div>

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
              onClick={(event) => {
                trackLandingCtaClick('Open verification desk')

                if (!isMobile) {
                  return
                }

                event.preventDefault()
                scrollToVerificationArea()
              }}
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

        <div className="console-grid" style={isMobile ? mobileConsoleGridStyle : undefined}>
          {isMobile ? (
            <section ref={examplePanelRef} style={examplePanelStyle} aria-label="Try example claims">
              <button
                type="button"
                aria-expanded={isExamplePanelOpen}
                aria-controls="mobile-example-claims"
                onClick={() => setIsExamplePanelOpen((open) => !open)}
                style={examplePanelToggleStyle}
              >
                <span>Try Example Claims</span>
                <span aria-hidden="true">{isExamplePanelOpen ? '-' : '+'}</span>
              </button>
              {isExamplePanelOpen ? (
                <div id="mobile-example-claims" style={examplePanelBodyStyle}>
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
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
          <div ref={claimPanelRef} style={isMobile ? mobileInputWrapStyle : undefined}>
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
          </div>
          <div ref={resultPanelRef} style={isMobile ? mobileResultWrapStyle : undefined}>
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
