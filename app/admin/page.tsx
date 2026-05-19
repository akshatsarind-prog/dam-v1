'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type {
  AdminApiError,
  AdminCategorizedClaimRecord,
  AdminCategoryIntelligence,
  AdminClaimCategory,
  AdminClaimRecord,
  AdminFunnelMetrics,
  AdminFunnelStage,
  AdminMetricsResponse,
  AdminRetentionMetrics,
} from '@/lib/admin/adminMetricsTypes'

const SESSION_STORAGE_KEY = 'dam_admin_password'

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

type ClaimPanelKey = 'recent' | 'lowConfidence' | 'slowest'

type ClaimPanelState = Record<ClaimPanelKey, boolean>

type NavItem = {
  href: string
  label: string
  isNew?: boolean
}

const navItems: NavItem[] = [
  { href: '#overview', label: 'Overview' },
  { href: '#funnel', label: 'Funnel' },
  { href: '#retention', label: 'Retention' },
  { href: '#categories', label: 'Categories', isNew: true },
  { href: '#claims', label: 'Claims' },
  { href: '#users-emails', label: 'Users / Emails' },
  { href: '#events', label: 'Events' },
  { href: '#settings', label: 'Settings' },
]

const defaultClaimPanelState: ClaimPanelState = {
  recent: true,
  lowConfidence: false,
  slowest: false,
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatNullableCount(value: number | null) {
  return value === null ? 'Not tracked yet' : formatCount(value)
}

function formatLatency(value: number) {
  return `${Math.round(value)} ms`
}

function formatRate(value: number | null) {
  if (value === null) {
    return 'Not tracked yet'
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  return parsed.toLocaleString()
}

function formatDurationCompact(value: number | null) {
  if (value === null) {
    return 'Not enough repeat data'
  }

  const totalMinutes = Math.round(value / 60000)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function formatCategoryLabel(category: AdminClaimCategory) {
  switch (category) {
    case 'social_rumor':
      return 'Social Rumor'
    default:
      return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  }
}

function calculateRate(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null
  }

  return numerator / denominator
}

function getConfidenceTone(confidence: number) {
  if (confidence < 60) {
    return 'danger'
  }

  if (confidence < 80) {
    return 'warning'
  }

  return 'neutral'
}

function getRiskTone(riskLabel: string) {
  const normalized = riskLabel.toLowerCase()

  if (normalized.includes('high') || normalized.includes('severe')) {
    return 'danger'
  }

  if (normalized.includes('medium')) {
    return 'warning'
  }

  return 'neutral'
}

function getStageBadgeLabel(stage: AdminFunnelStage) {
  if (stage.status === 'manual') {
    return 'Manual baseline'
  }

  if (stage.status === 'tracked') {
    return 'Tracked'
  }

  return 'Not tracked yet'
}

function buildAutomaticAnalysis(metrics: AdminMetricsResponse) {
  const lines: string[] = []
  const topCategory = metrics.categoryIntelligence.mostTestedCategory
  const slowCategory = metrics.categoryIntelligence.highestLatencyCategory
  const lowConfidenceCategory = metrics.categoryIntelligence.lowestConfidenceCategory
  const dominantCategory = topCategory?.category ?? null

  if (topCategory) {
    lines.push(
      `Users are mostly testing ${formatCategoryLabel(topCategory.category)} claims (${formatRate(topCategory.percentage)} of logged tests).`
    )
  }

  if (slowCategory) {
    lines.push(
      `${formatCategoryLabel(slowCategory.category)} has the highest average latency at ${formatLatency(slowCategory.averageLatencyMs)}.`
    )
  }

  if (lowConfidenceCategory) {
    lines.push(
      `${formatCategoryLabel(lowConfidenceCategory.category)} shows the weakest average confidence at ${lowConfidenceCategory.averageConfidence.toFixed(1)}.`
    )
  }

  if (!metrics.categoryIntelligence.emailConversionByCategory.available) {
    lines.push('Email capture from claims is currently not linkable to categories.')
  }

  if (dominantCategory === 'scam' || dominantCategory === 'crypto') {
    lines.push('Current usage pattern looks scam-heavy rather than general exploration.')
  } else if (
    dominantCategory &&
    ['health', 'political', 'government', 'statistics', 'social_rumor'].includes(dominantCategory)
  ) {
    lines.push('Current usage pattern looks misinformation-heavy across high-risk public narratives.')
  } else {
    lines.push('Current usage pattern still looks general-curiosity-heavy.')
  }

  if (metrics.retention.returningSessions > 0) {
    lines.push(
      `Repeat usage exists: ${formatCount(metrics.retention.returningSessions)} returning sessions are already visible.`
    )
  } else {
    lines.push('Repeat usage has not clearly emerged yet.')
  }

  return lines
}

function Sidebar() {
  return (
    <>
      <aside className="dam-admin-sidebar">
        <div className="dam-admin-sidebar__brand">
          <Link href="/" className="dam-admin-sidebar__logo" aria-label="Return to DAM home">
            <span className="dam-admin-sidebar__logo-mark" />
            <span>DAM V1</span>
          </Link>
          <p className="dam-admin-sidebar__tagline">Private ops dashboard</p>
        </div>
        <nav className="dam-admin-sidebar__nav" aria-label="Admin sections">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="dam-admin-sidebar__link">
              <span>{item.label}</span>
              {item.isNew ? <span className="dam-admin-badge dam-admin-badge--new">NEW</span> : null}
            </a>
          ))}
        </nav>
      </aside>
      <nav className="dam-admin-mobile-nav" aria-label="Admin sections">
        {navItems.map((item) => (
          <a key={item.href} href={item.href} className="dam-admin-mobile-nav__link">
            <span>{item.label}</span>
            {item.isNew ? <span className="dam-admin-badge dam-admin-badge--new">NEW</span> : null}
          </a>
        ))}
      </nav>
    </>
  )
}

function SummaryMetricCard({
  label,
  value,
  note,
  accent = 'default',
}: {
  label: string
  value: string
  note: string
  accent?: 'default' | 'red'
}) {
  return (
    <article className={`dam-admin-metric-card dam-admin-metric-card--${accent}`}>
      <span className="dam-admin-metric-card__label">{label}</span>
      <strong className="dam-admin-metric-card__value">{value}</strong>
      <p className="dam-admin-metric-card__note">{note}</p>
    </article>
  )
}

function InlineBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  return <span className={`dam-admin-badge dam-admin-badge--${tone}`}>{children}</span>
}

function SectionHeading({
  eyebrow,
  title,
  description,
  isNew = false,
}: {
  eyebrow: string
  title: string
  description: string
  isNew?: boolean
}) {
  return (
    <div className="dam-admin-section-heading">
      <p className="system-label">
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <div className="dam-admin-section-heading__title-row">
        <h2>{title}</h2>
        {isNew ? <span className="dam-admin-badge dam-admin-badge--new">NEW</span> : null}
      </div>
      <p>{description}</p>
    </div>
  )
}

function DesktopRightRail({ metrics }: { metrics: AdminMetricsResponse }) {
  const automaticAnalysisLines = buildAutomaticAnalysis(metrics)
  const topCategories = metrics.categoryIntelligence.categoryBreakdown.slice(0, 6)
  const recentCategorizedClaims = metrics.categoryIntelligence.topCategoryClaims.slice(0, 5)

  return (
    <aside className="dam-admin-rail">
      <section className="dam-admin-card dam-admin-rail-card">
        <SectionHeading
          eyebrow="Intelligence"
          title="Automatic Analysis"
          description="System-generated operational readouts from current dashboard telemetry."
        />
        <div className="dam-admin-analysis-list">
          {automaticAnalysisLines.map((line) => (
            <div key={line} className="dam-admin-analysis-item">
              {line}
            </div>
          ))}
        </div>
      </section>

      <section className="dam-admin-card dam-admin-rail-card">
        <SectionHeading
          eyebrow="Categories"
          title="Top Categories by Claims"
          description="Fast scan of what claim types dominate current testing."
        />
        <div className="dam-admin-progress-list">
          {topCategories.length ? (
            topCategories.map((item) => (
              <div key={item.category} className="dam-admin-progress-item">
                <div className="dam-admin-progress-item__topline">
                  <strong>{formatCategoryLabel(item.category)}</strong>
                  <span>
                    {formatCount(item.count)} ({formatRate(item.percentage)})
                  </span>
                </div>
                <div className="dam-admin-progress-item__track">
                  <span
                    style={{
                      width: `${Math.max(item.percentage * 100, 4)}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="dam-admin-empty-copy">No category data yet.</p>
          )}
        </div>
      </section>

      <section className="dam-admin-card dam-admin-rail-card">
        <SectionHeading
          eyebrow="Claims"
          title="Recent Categorized Claims"
          description="Latest tagged claims from the analytics-only category layer."
        />
        <div className="dam-admin-mini-claims">
          {recentCategorizedClaims.length ? (
            recentCategorizedClaims.map((claim, index) => (
              <div
                key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${claim.category}-${index}`}
                className="dam-admin-mini-claims__row"
              >
                <div className="dam-admin-mini-claims__meta">
                  <InlineBadge tone="warning">{formatCategoryLabel(claim.category)}</InlineBadge>
                  <span>{claim.verdict}</span>
                </div>
                <strong className="dam-admin-text-clamp">{claim.claimText || 'No claim text logged.'}</strong>
                <div className="dam-admin-mini-claims__footer">
                  <span>{formatDateTime(claim.createdAt)}</span>
                  <span>{formatLatency(claim.latencyMs)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="dam-admin-empty-copy">No categorized claims yet.</p>
          )}
        </div>
      </section>
    </aside>
  )
}

function CollapsibleClaimsPanel({
  title,
  description,
  rowCount,
  expanded,
  onToggle,
  children,
}: {
  title: string
  description: string
  rowCount: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="dam-admin-card dam-admin-collapsible">
      <div className="dam-admin-collapsible__header">
        <div className="dam-admin-collapsible__copy">
          <div className="dam-admin-collapsible__title-row">
            <span className="dam-admin-dot" aria-hidden="true" />
            <h3>{title}</h3>
            <span className="dam-admin-row-badge">{formatCount(rowCount)} rows</span>
          </div>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="dam-admin-icon-button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>
      </div>
      {expanded ? <div className="dam-admin-collapsible__body">{children}</div> : null}
    </section>
  )
}

function ClaimsTable({
  claims,
  includeCategory = false,
}: {
  claims: AdminClaimRecord[] | AdminCategorizedClaimRecord[]
  includeCategory?: boolean
}) {
  const headers = includeCategory
    ? ['Created', 'Category', 'Verdict', 'Confidence', 'Risk', 'Latency', 'Claim']
    : ['Created', 'Verdict', 'Confidence', 'Risk', 'Latency', 'Claim']

  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {claims.length ? (
            claims.map((claim, index) => {
              const categorizedClaim = claim as AdminCategorizedClaimRecord
              return (
                <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${index}`}>
                  <td>{formatDateTime(claim.createdAt)}</td>
                  {includeCategory ? (
                    <td>
                      <InlineBadge tone="warning">{formatCategoryLabel(categorizedClaim.category)}</InlineBadge>
                    </td>
                  ) : null}
                  <td>
                    <InlineBadge>{claim.verdict}</InlineBadge>
                  </td>
                  <td>
                    <InlineBadge tone={getConfidenceTone(claim.confidence)}>{claim.confidence}</InlineBadge>
                  </td>
                  <td>
                    <InlineBadge tone={getRiskTone(claim.riskLabel)}>{claim.riskLabel}</InlineBadge>
                  </td>
                  <td>{formatLatency(claim.latencyMs)}</td>
                  <td>
                    <div className="dam-admin-claim-text">{claim.claimText || 'No claim text logged.'}</div>
                  </td>
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={includeCategory ? 7 : 6} className="dam-admin-table__empty">
                No claims available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FunnelSection({ funnel }: { funnel: AdminFunnelMetrics }) {
  const stageList = [
    funnel.distributed,
    funnel.landingVisitors,
    funnel.appVisitors,
    funnel.claimSubmissions,
    funnel.emailCaptures,
  ]

  const conversionCards = [
    {
      label: 'Reach -> Landing',
      rate: calculateRate(funnel.landingVisitors.count, funnel.distributed.count),
    },
    {
      label: 'Landing -> App',
      rate: calculateRate(funnel.appVisitors.count, funnel.landingVisitors.count),
    },
    {
      label: 'App -> Claim',
      rate: calculateRate(funnel.claimSubmissions.count, funnel.appVisitors.count),
    },
    {
      label: 'Claim -> Email',
      rate: calculateRate(funnel.emailCaptures.count, funnel.claimSubmissions.count),
    },
    {
      label: 'Reach -> Claim',
      rate: calculateRate(funnel.claimSubmissions.count, funnel.distributed.count),
    },
    {
      label: 'Reach -> App',
      rate: calculateRate(funnel.appVisitors.count, funnel.distributed.count),
    },
  ]

  return (
    <section id="funnel" className="dam-admin-card dam-admin-section">
      <SectionHeading
        eyebrow="Funnel"
        title="Funnel Intelligence"
        description="Manual baselines plus tracked stage counts for an operational conversion read."
      />
      <div className="dam-admin-two-column">
        <div className="dam-admin-funnel-stack">
          {stageList.map((stage, index) => (
            <div key={`${stage.label}-${index}`} className="dam-admin-funnel-stage">
              <div className="dam-admin-funnel-stage__header">
                <div>
                  <span className="dam-admin-overline">Stage {index + 1}</span>
                  <h3>{stage.label}</h3>
                </div>
                <InlineBadge tone={stage.status === 'manual' ? 'warning' : stage.status === 'tracked' ? 'neutral' : 'danger'}>
                  {getStageBadgeLabel(stage)}
                </InlineBadge>
              </div>
              <div className="dam-admin-funnel-stage__footer">
                <strong>{formatNullableCount(stage.count)}</strong>
                <span>{stage.manualBaseline ? 'manualBaseline: true' : 'Read-only metric'}</span>
              </div>
              {index < stageList.length - 1 ? <div className="dam-admin-funnel-arrow">↓</div> : null}
            </div>
          ))}
        </div>
        <div className="dam-admin-conversion-grid">
          {conversionCards.map((item) => (
            <article key={item.label} className="dam-admin-mini-card">
              <span className="dam-admin-overline">{item.label}</span>
              <strong>{formatRate(item.rate)}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function RetentionSection({ retention }: { retention: AdminRetentionMetrics }) {
  const repeatUsageExists = retention.returningSessions > 0
  const onboardingConversion = retention.exampleToRealConversionRate
  const habitFormationMessage =
    retention.returnRate !== null && retention.returnRate >= 0.25 && retention.multiDayUsers > 0
      ? 'Early habit formation is visible.'
      : repeatUsageExists
        ? 'Some repeat usage exists, but habit formation is still early.'
        : 'Usage still looks curiosity-driven.'

  return (
    <section id="retention" className="dam-admin-card dam-admin-section">
      <SectionHeading
        eyebrow="Retention"
        title="Retention Intelligence"
        description="Anonymous repeat usage, onboarding quality, and early habit signals from current telemetry."
      />
      <div className="dam-admin-mini-grid">
        <SummaryMetricCard
          label="Unique sessions"
          value={formatCount(retention.uniqueSessions)}
          note="Anonymous session ids observed"
        />
        <SummaryMetricCard
          label="Returning sessions"
          value={formatCount(retention.returningSessions)}
          note="Same session id back after 30+ minutes"
        />
        <SummaryMetricCard
          label="Return rate"
          value={formatRate(retention.returnRate)}
          note="Returning sessions / unique sessions"
        />
        <SummaryMetricCard
          label="Multi-day users"
          value={formatCount(retention.multiDayUsers)}
          note="Active on different UTC dates"
        />
        <SummaryMetricCard
          label="Avg claims per user"
          value={retention.averageClaimsPerUser.toFixed(retention.averageClaimsPerUser >= 10 ? 1 : 2)}
          note="Total claims / unique sessions"
        />
        <SummaryMetricCard
          label="Avg time between sessions"
          value={formatDurationCompact(retention.averageTimeBetweenSessionsMs)}
          note="Average returning visit gap"
        />
      </div>
      <div className="dam-admin-detail-grid">
        <article className="dam-admin-mini-card">
          <span className="dam-admin-overline">Onboarding quality</span>
          <strong>{formatRate(onboardingConversion)}</strong>
          <p>
            {onboardingConversion === null
              ? 'Not enough example-to-real usage yet.'
              : 'Sessions that used examples and later submitted real claims.'}
          </p>
        </article>
        <article className="dam-admin-mini-card">
          <span className="dam-admin-overline">Habit formation</span>
          <strong>{repeatUsageExists ? 'Emerging' : 'Early'}</strong>
          <p>{habitFormationMessage}</p>
        </article>
        <article className="dam-admin-mini-card">
          <span className="dam-admin-overline">Top referrers</span>
          {retention.topReferrers.length ? (
            <div className="dam-admin-inline-list">
              {retention.topReferrers.slice(0, 4).map((item) => (
                <span key={item.referrer}>
                  {item.referrer} ({formatCount(item.sessionCount)})
                </span>
              ))}
            </div>
          ) : (
            <p>Referrer telemetry has not accumulated yet.</p>
          )}
        </article>
      </div>
    </section>
  )
}

function CategorySection({ categoryIntelligence }: { categoryIntelligence: AdminCategoryIntelligence }) {
  const categoryBreakdown = categoryIntelligence.categoryBreakdown
  const topCategoryClaims = categoryIntelligence.topCategoryClaims
  const mostTested = categoryIntelligence.mostTestedCategory
  const highestLatency = categoryIntelligence.highestLatencyCategory
  const lowestConfidence = categoryIntelligence.lowestConfidenceCategory

  return (
    <section id="categories" className="dam-admin-card dam-admin-section">
      <SectionHeading
        eyebrow="Categories"
        title="Category Intelligence"
        description="Derived claim categories to show what users test most, where latency is highest, and where confidence trends weakest."
        isNew
      />
      <div className="dam-admin-detail-grid">
        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Most Tested Category</h3>
          <strong className="dam-admin-subcard__value">
            {mostTested ? formatCategoryLabel(mostTested.category) : 'No data'}
          </strong>
          <p>{mostTested ? `${formatCount(mostTested.count)} claims (${formatRate(mostTested.percentage)})` : 'No categorized claims yet.'}</p>
        </article>
        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Highest Latency Category</h3>
          <strong className="dam-admin-subcard__value">
            {highestLatency ? formatCategoryLabel(highestLatency.category) : 'No data'}
          </strong>
          <p>{highestLatency ? `${formatLatency(highestLatency.averageLatencyMs)} average latency` : 'No categorized claims yet.'}</p>
        </article>
        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Lowest Confidence Category</h3>
          <strong className="dam-admin-subcard__value">
            {lowestConfidence ? formatCategoryLabel(lowestConfidence.category) : 'No data'}
          </strong>
          <p>{lowestConfidence ? `${lowestConfidence.averageConfidence.toFixed(1)} average confidence` : 'No categorized claims yet.'}</p>
        </article>
        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Email Conversion by Category</h3>
          <strong className="dam-admin-subcard__value">
            {categoryIntelligence.emailConversionByCategory.available ? 'Available' : 'Not linkable yet'}
          </strong>
          <p>{categoryIntelligence.emailConversionByCategory.message}</p>
        </article>
      </div>

      <div className="dam-admin-two-column">
        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Category Breakdown</h3>
          <div className="dam-admin-table-shell">
            <table className="dam-admin-table dam-admin-table--compact">
              <thead>
                <tr>
                  {['Category', 'Claims', '%', 'Avg latency', 'Avg confidence'].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.length ? (
                  categoryBreakdown.map((row) => (
                    <tr key={row.category}>
                      <td>
                        <InlineBadge tone="warning">{formatCategoryLabel(row.category)}</InlineBadge>
                      </td>
                      <td>{formatCount(row.count)}</td>
                      <td>{formatRate(row.percentage)}</td>
                      <td>{formatLatency(row.averageLatencyMs)}</td>
                      <td>{row.averageConfidence.toFixed(1)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="dam-admin-table__empty">
                      No categorized claims yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dam-admin-card dam-admin-subcard">
          <h3 className="dam-admin-subcard__title">Recent Categorized Claims</h3>
          <ClaimsTable claims={topCategoryClaims.slice(0, 10)} includeCategory />
        </article>
      </div>
    </section>
  )
}

function UtilitySections({
  metrics,
}: {
  metrics: AdminMetricsResponse
}) {
  return (
    <div className="dam-admin-utility-grid">
      <section id="users-emails" className="dam-admin-card dam-admin-section">
        <SectionHeading
          eyebrow="Users / Emails"
          title="Users / Emails"
          description="Read-only snapshot of anonymous usage depth and email capture coverage."
        />
        <div className="dam-admin-detail-grid">
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Emails captured</span>
            <strong>{formatNullableCount(metrics.funnel.emailCaptures.count)}</strong>
            <p>{metrics.funnel.emailCaptures.status === 'tracked' ? 'Tracked from beta signups.' : 'Not tracked yet.'}</p>
          </article>
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Claims per user</span>
            <strong>{metrics.retention.averageClaimsPerUser.toFixed(metrics.retention.averageClaimsPerUser >= 10 ? 1 : 2)}</strong>
            <p>Trust depth proxy from total claims over unique sessions.</p>
          </article>
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Email conversion by category</span>
            <strong>{metrics.categoryIntelligence.emailConversionByCategory.available ? 'Available' : 'Not linkable yet'}</strong>
            <p>{metrics.categoryIntelligence.emailConversionByCategory.message}</p>
          </article>
        </div>
      </section>

      <section id="events" className="dam-admin-card dam-admin-section">
        <SectionHeading
          eyebrow="Events"
          title="Events"
          description="Operational telemetry health from the existing anonymous event stream."
        />
        <div className="dam-admin-detail-grid">
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Unique sessions</span>
            <strong>{formatCount(metrics.retention.uniqueSessions)}</strong>
            <p>Backed by current anonymous telemetry.</p>
          </article>
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Top referrers tracked</span>
            <strong>{formatCount(metrics.retention.topReferrers.length)}</strong>
            <p>Distinct referrer rows currently visible in the admin API.</p>
          </article>
          <article className="dam-admin-mini-card">
            <span className="dam-admin-overline">Last telemetry refresh</span>
            <strong>{formatDateTime(metrics.generatedAt)}</strong>
            <p>Admin data is read-only and fetched from the existing metrics route.</p>
          </article>
        </div>
      </section>

      <section id="settings" className="dam-admin-card dam-admin-section">
        <SectionHeading
          eyebrow="Settings"
          title="Settings"
          description="Read-only placeholder. No writable admin controls are exposed in this private dashboard."
        />
        <div className="dam-admin-placeholder">
          Analyzer behavior, prompts, ranking logic, and logging are intentionally not editable here.
        </div>
      </section>
    </div>
  )
}

function DashboardView({
  metrics,
  loading,
  errorMessage,
  password,
  onRefresh,
  onLogout,
  claimPanels,
  onToggleClaimPanel,
}: {
  metrics: AdminMetricsResponse
  loading: boolean
  errorMessage: string
  password: string
  onRefresh: (password: string) => void
  onLogout: () => void
  claimPanels: ClaimPanelState
  onToggleClaimPanel: (panel: ClaimPanelKey) => void
}) {
  const overviewCards = [
    {
      label: 'Total Reach',
      value: formatNullableCount(metrics.funnel.distributed.count),
      note: metrics.funnel.distributed.manualBaseline ? 'Manual distributed baseline' : 'Tracked reach',
      accent: 'red' as const,
    },
    {
      label: 'Landing Visitors',
      value: formatNullableCount(metrics.funnel.landingVisitors.count),
      note: metrics.funnel.landingVisitors.manualBaseline ? 'Manual landing baseline' : 'Tracked landing visitors',
    },
    {
      label: 'App Visitors',
      value: formatNullableCount(metrics.funnel.appVisitors.count),
      note: metrics.funnel.appVisitors.manualBaseline ? 'Manual app-visitor baseline' : 'Tracked app sessions',
    },
    {
      label: 'Claims Tested',
      value: formatNullableCount(metrics.funnel.claimSubmissions.count),
      note: 'Claim submissions from dam_claim_logs',
    },
    {
      label: 'Emails Captured',
      value: formatNullableCount(metrics.funnel.emailCaptures.count),
      note: metrics.funnel.emailCaptures.status === 'tracked' ? 'Tracked email captures' : 'Not tracked yet',
      accent: 'red' as const,
    },
    {
      label: 'Avg. Retention',
      value: formatDurationCompact(metrics.retention.averageTimeBetweenSessionsMs),
      note: 'Average time between returning visits',
    },
  ]

  return (
    <div className="dam-admin-shell">
      <Sidebar />
      <div className="dam-admin-content">
        <div className="dam-admin-main">
          <header id="overview" className="dam-admin-header-card dam-admin-card">
            <div className="dam-admin-header-card__copy">
              <p className="system-label">
                <span aria-hidden="true" />
                Admin Overview
              </p>
              <h1>Admin Overview</h1>
              <p>Real-time overview of DAM V1 performance and analytics.</p>
            </div>
            <div className="dam-admin-header-card__actions">
              <div className="dam-admin-inline-meta">
                <span className="dam-admin-header-pill">{formatDateTime(metrics.generatedAt)}</span>
              </div>
              <div className="dam-admin-inline-actions">
                <button
                  type="button"
                  className="dam-admin-action-button dam-admin-action-button--primary"
                  onClick={() => onRefresh(password)}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button type="button" className="dam-admin-action-button" onClick={onLogout}>
                  Logout
                </button>
              </div>
            </div>
          </header>

          {metrics.error?.code === 'misconfigured' ? (
            <div className="dam-admin-alert dam-admin-alert--warning">
              Admin metrics are not configured. Check Supabase env vars.
            </div>
          ) : null}

          {errorMessage ? <div className="dam-admin-alert dam-admin-alert--error">{errorMessage}</div> : null}

          <section className="dam-admin-summary-grid">
            {overviewCards.map((card) => (
              <SummaryMetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                note={card.note}
                accent={card.accent}
              />
            ))}
          </section>

          <FunnelSection funnel={metrics.funnel} />
          <RetentionSection retention={metrics.retention} />

          <section id="claims" className="dam-admin-section-stack">
            <CollapsibleClaimsPanel
              title="Recent claims"
              description="Latest 20 claim log rows from the admin metrics API."
              rowCount={metrics.recentClaims.length}
              expanded={claimPanels.recent}
              onToggle={() => onToggleClaimPanel('recent')}
            >
              <ClaimsTable claims={metrics.recentClaims} />
            </CollapsibleClaimsPanel>

            <CollapsibleClaimsPanel
              title="Low-confidence claims"
              description="Latest 20 claims where logged confidence is below 60."
              rowCount={metrics.lowConfidenceClaims.length}
              expanded={claimPanels.lowConfidence}
              onToggle={() => onToggleClaimPanel('lowConfidence')}
            >
              <ClaimsTable claims={metrics.lowConfidenceClaims} />
            </CollapsibleClaimsPanel>

            <CollapsibleClaimsPanel
              title="Slowest claims"
              description="Top 10 rows ordered by highest logged latency."
              rowCount={metrics.slowestClaims.length}
              expanded={claimPanels.slowest}
              onToggle={() => onToggleClaimPanel('slowest')}
            >
              <ClaimsTable claims={metrics.slowestClaims} />
            </CollapsibleClaimsPanel>
          </section>

          <CategorySection categoryIntelligence={metrics.categoryIntelligence} />
          <UtilitySections metrics={metrics} />
        </div>

        <DesktopRightRail metrics={metrics} />
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [state, setState] = useState<DashboardState>(() => {
    if (typeof window !== 'undefined') {
      const savedPassword = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

      if (savedPassword) {
        return {
          status: 'loading',
          password: savedPassword,
          metrics: null,
          errorMessage: '',
        }
      }
    }

    return {
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: '',
    }
  })
  const [claimPanels, setClaimPanels] = useState<ClaimPanelState>(defaultClaimPanelState)

  const handleUnauthorized = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setState({
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: 'Wrong password. Try again.',
    })
  }, [])

  const loadMetrics = useCallback(
    async (
      password: string,
      options?: {
        persist?: boolean
        showLoadingState?: boolean
      }
    ) => {
      if (options?.showLoadingState !== false) {
        setState((current) => ({
          ...current,
          status: 'loading',
          password,
          errorMessage: '',
        }))
      }

      try {
        const response = await fetch('/api/admin/metrics', {
          method: 'GET',
          headers: {
            'x-admin-password': password,
          },
          cache: 'no-store',
        })

        const payload = (await response.json().catch(() => null)) as
          | AdminMetricsResponse
          | { error?: AdminApiError | null }
          | null

        if (response.status === 401) {
          handleUnauthorized()
          return
        }

        if (!response.ok || !payload || !('generatedAt' in payload)) {
          throw new Error(payload?.error?.message || 'Admin metrics request failed.')
        }

        if (options?.persist !== false && typeof window !== 'undefined') {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, password)
        }

        setState({
          status: 'ready',
          password,
          metrics: payload,
          errorMessage: '',
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to load admin metrics right now.'

        setState((current) => ({
          ...current,
          status: current.metrics ? 'ready' : 'error',
          errorMessage: message,
        }))
      }
    },
    [handleUnauthorized]
  )

  useEffect(() => {
    if (state.status !== 'loading' || !state.password || state.metrics) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadMetrics(state.password, {
        persist: false,
        showLoadingState: false,
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadMetrics, state.metrics, state.password, state.status])

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!state.password.trim()) {
      setState((current) => ({
        ...current,
        errorMessage: 'Enter the admin password.',
      }))
      return
    }

    void loadMetrics(state.password.trim())
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setState({
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: '',
    })
  }

  function toggleClaimPanel(panel: ClaimPanelKey) {
    setClaimPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }))
  }

  if (!state.metrics) {
    return (
      <main className="dam-shell">
        <div className="dam-admin-auth-shell">
          <section className="dam-admin-auth-card">
            <p className="system-label">
              <span aria-hidden="true" />
              Founder dashboard
            </p>
            <h1>Private DAM analytics</h1>
            <p>
              Enter the admin password to open the read-only dashboard. No metrics are rendered
              before authentication succeeds.
            </p>
            <form className="dam-admin-auth-form" onSubmit={handlePasswordSubmit}>
              <label className="dam-admin-auth-form__label" htmlFor="dam-admin-password">
                Admin password
              </label>
              <input
                id="dam-admin-password"
                type="password"
                value={state.password}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    password: event.target.value,
                    errorMessage: '',
                  }))
                }
                className="dam-admin-auth-form__input"
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="dam-admin-action-button dam-admin-action-button--primary"
                disabled={state.status === 'loading'}
              >
                {state.status === 'loading' ? 'Checking access...' : 'Open dashboard'}
              </button>
            </form>
            {state.errorMessage ? <p className="form-error">{state.errorMessage}</p> : null}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="dam-shell">
      <DashboardView
        metrics={state.metrics}
        loading={state.status === 'loading'}
        errorMessage={state.errorMessage}
        password={state.password}
        onRefresh={(password) => {
          void loadMetrics(password, { persist: false })
        }}
        onLogout={handleLogout}
        claimPanels={claimPanels}
        onToggleClaimPanel={toggleClaimPanel}
      />
    </main>
  )
}
