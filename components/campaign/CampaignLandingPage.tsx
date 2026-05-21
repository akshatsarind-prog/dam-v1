'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useEffect } from 'react'
import DamMarketingHeader from '@/components/navigation/DamMarketingHeader'
import {
  getDamSessionSignalMetadata,
  getOrCreateDamSessionId,
  sendDamTrackEvent,
  type DamTrackEventName,
} from '@/lib/analytics'
import { analyzerEntryHref } from '@/components/navigation/useCaseLinks'

type CampaignLandingPageProps = {
  activeHref: string
  pageKey: string
  telemetryEventName: DamTrackEventName
  eyebrow: string
  title: string
  subtitle: string
  ctaLabel: string
  heroPanelTitle: string
  heroPanelItems: string[]
  commonPatternsTitle: string
  commonPatterns: string[]
  riskTitle: string
  riskBody: string
  checksTitle: string
  checks: string[]
  ctaTitle: string
  ctaBody: string
}

export default function CampaignLandingPage({
  activeHref,
  pageKey,
  telemetryEventName,
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  heroPanelTitle,
  heroPanelItems,
  commonPatternsTitle,
  commonPatterns,
  riskTitle,
  riskBody,
  checksTitle,
  checks,
  ctaTitle,
  ctaBody,
}: CampaignLandingPageProps) {
  const router = useRouter()

  function handleAnalyzerRoute(buttonLabel: string) {
    const sessionId = getOrCreateDamSessionId()

    sendDamTrackEvent({
      event_name: telemetryEventName,
      session_id: sessionId,
      metadata: getDamSessionSignalMetadata(sessionId, {
        button_label: buttonLabel,
        page: pageKey,
      }),
    })

    startTransition(() => {
      router.push(analyzerEntryHref)
    })
  }

  useEffect(() => {
    const sessionId = getOrCreateDamSessionId()
    const searchParams = new URLSearchParams(window.location.search)

    sendDamTrackEvent({
      event_name: 'campaign_page_view',
      session_id: sessionId,
      metadata: getDamSessionSignalMetadata(sessionId, {
        page: pageKey,
        utm_source: searchParams.get('utm_source') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
        gclid_present: searchParams.has('gclid'),
      }),
    })
  }, [pageKey])

  return (
    <main className="dam-shell campaign-page">
      <DamMarketingHeader activeHref={activeHref} />

      <section className="section-frame campaign-hero" aria-labelledby="campaign-title">
        <div className="campaign-copy">
          <p className="system-label">
            <span aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="campaign-title">{title}</h1>
          <p className="campaign-subtitle">{subtitle}</p>
          <div className="campaign-actions">
            <button
              type="button"
              className="primary-link"
              onClick={() => handleAnalyzerRoute(ctaLabel)}
            >
              {ctaLabel}
            </button>
            <p>Routes into the live DAM analyzer and focuses the existing claim input.</p>
          </div>
        </div>

        <aside className="campaign-panel" aria-label={heroPanelTitle}>
          <div className="panel-topline">
            <p>{heroPanelTitle}</p>
            <span className="live-dot active" aria-hidden="true" />
          </div>
          <div className="campaign-list-panel">
            {heroPanelItems.map((item) => (
              <div className="campaign-list-row" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-frame campaign-section">
        <div className="section-heading wide restrained">
          <p className="system-label">
            <span aria-hidden="true" />
            What DAM can check
          </p>
          <h2>{commonPatternsTitle}</h2>
        </div>
        <div className="campaign-card-grid">
          {commonPatterns.map((item) => (
            <article className="campaign-card" key={item}>
              <span>Pattern</span>
              <h3>{item}</h3>
              <p>Paste the exact wording so DAM can review urgency, instructions, and credibility cues.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-frame campaign-section">
        <div className="campaign-single-card">
          <p className="system-label">
            <span aria-hidden="true" />
            Risk pattern
          </p>
          <h2>{riskTitle}</h2>
          <p>{riskBody}</p>
        </div>
      </section>

      <section className="section-frame campaign-section">
        <div className="section-heading wide restrained">
          <p className="system-label">
            <span aria-hidden="true" />
            How DAM works
          </p>
          <h2>{checksTitle}</h2>
        </div>
        <div className="campaign-check-grid">
          {checks.map((item, index) => (
            <article className="campaign-card" key={item}>
              <span>Check {index + 1}</span>
              <h3>{item}</h3>
              <p>DAM routes the message into the existing analyzer flow and returns the same live verdict system.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-frame campaign-section">
        <div className="campaign-cta-card">
          <div>
            <p className="system-label">
              <span aria-hidden="true" />
              Verification desk
            </p>
            <h2>{ctaTitle}</h2>
            <p>{ctaBody}</p>
          </div>
          <button
            type="button"
            className="primary-link"
            onClick={() => handleAnalyzerRoute(`${ctaLabel} footer`)}
          >
            {ctaLabel}
          </button>
        </div>
      </section>
    </main>
  )
}
