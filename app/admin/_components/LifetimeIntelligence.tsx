'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type {
  AdminClaimCategory,
  AdminClaimRecord,
  AdminLifetimeIntelligence,
  AdminMetricsResponse,
  AdminTimelinePoint,
  AdminTrafficSourceRecord,
  AdminValueShare,
  OperatorRecommendation,
} from '@/lib/admin/adminMetricsTypes'
import {
  formatCategoryLabel,
  formatCount,
  formatDateTime,
  formatDecimal,
  formatRate,
  formatText,
  shortenId,
} from './AdminShell'

type LifetimeRouteLink = {
  href: string
  title: string
  description: string
}

export const lifetimeSectionLinks: LifetimeRouteLink[] = [
  {
    href: '/admin/lifetime',
    title: 'Overview',
    description: 'Stage, strongest signals, and data coverage warning.',
  },
  {
    href: '/admin/lifetime/snapshot',
    title: 'Company Snapshot',
    description: 'Lifetime scale, usage mix, and operating footprint.',
  },
  {
    href: '/admin/lifetime/growth',
    title: 'Growth Intelligence',
    description: 'Channel quality, conversion, and growth bottlenecks.',
  },
  {
    href: '/admin/lifetime/behavior',
    title: 'User Behavior',
    description: 'Session depth, flows, and high-intent patterns.',
  },
  {
    href: '/admin/lifetime/trust',
    title: 'Trust & Product',
    description: 'Category mix, confidence, themes, and user intent.',
  },
  {
    href: '/admin/lifetime/reliability',
    title: 'Reliability',
    description: 'Latency, bad rows, infrastructure, and tail risk.',
  },
  {
    href: '/admin/lifetime/recommendations',
    title: 'Strategic Recommendations',
    description: 'Metrics-derived next actions only.',
  },
  {
    href: '/admin/lifetime/timeline',
    title: 'Timeline',
    description: 'Historical milestones across product and growth.',
  },
  {
    href: '/admin/lifetime/coverage',
    title: 'Data Coverage',
    description: 'Telemetry scope and the Vercel coverage gap.',
  },
]

function formatDay(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? fallback
    : parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
}

function formatDuration(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  if (value < 60_000) {
    return `${Math.round(value / 1000)} s`
  }

  const minutes = Math.floor(value / 60_000)
  const seconds = Math.round((value % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatLifetimeLatency(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s` : `${Math.round(value)} ms`
}

function formatLifetimeCategory(category: AdminClaimCategory | null | undefined) {
  if (!category) {
    return 'No data yet'
  }

  return formatCategoryLabel(category)
}

function sourceLabel(row: Pick<AdminTrafficSourceRecord, 'source' | 'medium' | 'campaign'>) {
  return `${row.source} / ${row.medium} / ${row.campaign}`
}

function claimSourceLabel(claim: AdminClaimRecord) {
  if (!claim.attributed) {
    return 'Unattributed'
  }

  return claim.utmSource ?? claim.referrer ?? 'Tracked'
}

function trendTone(direction: 'up' | 'down' | 'flat' | 'no_data') {
  switch (direction) {
    case 'up':
      return 'good'
    case 'down':
      return 'bad'
    case 'flat':
      return 'neutral'
    default:
      return 'muted'
  }
}

function Section({
  title,
  eyebrow,
  badge,
  children,
}: {
  title: string
  eyebrow: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="dam-life-section">
      <div className="dam-life-section__head">
        <div>
          <p className="dam-life-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {badge ? <div className="dam-life-section__badge">{badge}</div> : null}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  note,
  alert = false,
}: {
  label: string
  value: string
  note: string
  alert?: boolean
}) {
  return (
    <article className={`dam-life-metric${alert ? ' dam-life-metric--alert' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function TrendCard({
  label,
  value,
  summary,
  direction,
}: {
  label: string
  value: string
  summary: string
  direction: 'up' | 'down' | 'flat' | 'no_data'
}) {
  return (
    <article className="dam-life-subpanel">
      <div className="dam-life-inline">
        <span className={`dam-life-badge dam-life-badge--${trendTone(direction)}`}>{direction.replace('_', ' ')}</span>
      </div>
      <h3>{label}</h3>
      <strong className="dam-life-big">{value}</strong>
      <p>{summary}</p>
    </article>
  )
}

function DataTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="dam-life-table-shell">
      <table className="dam-life-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function EmptyRow({ colSpan, copy }: { colSpan: number; copy: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="dam-life-empty">
        {copy}
      </td>
    </tr>
  )
}

function ValueShareList({
  items,
  emptyCopy = 'No data yet.',
}: {
  items: AdminValueShare[]
  emptyCopy?: string
}) {
  if (!items.length) {
    return <div className="dam-life-empty-block">{emptyCopy}</div>
  }

  return (
    <div className="dam-life-list">
      {items.map((item) => (
        <div key={item.label} className="dam-life-list__row">
          <div>
            <strong>{item.label}</strong>
            <span>{formatCount(item.count)}</span>
          </div>
          <span>{formatRate(item.percentage)}</span>
        </div>
      ))}
    </div>
  )
}

function TimelineChart({ points }: { points: AdminTimelinePoint[] }) {
  if (!points.length) {
    return <div className="dam-life-empty-block">Not enough historical data yet.</div>
  }

  const maxClaims = Math.max(...points.map((point) => point.claims), 1)
  const maxSessions = Math.max(...points.map((point) => point.sessions), 1)

  return (
    <div className="dam-life-chart">
      {points.map((point) => (
        <div key={point.day} className="dam-life-chart__row">
          <span>{formatDay(point.day)}</span>
          <div className="dam-life-chart__tracks">
            <div className="dam-life-chart__track">
              <div
                className="dam-life-chart__fill dam-life-chart__fill--claims"
                style={{ width: `${Math.max(8, (point.claims / maxClaims) * 100)}%` }}
              />
            </div>
            <div className="dam-life-chart__track">
              <div
                className="dam-life-chart__fill dam-life-chart__fill--sessions"
                style={{ width: `${Math.max(8, (point.sessions / maxSessions) * 100)}%` }}
              />
            </div>
          </div>
          <div className="dam-life-chart__meta">
            <span>{formatCount(point.claims)} claims</span>
            <span>{formatCount(point.sessions)} sessions</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RecommendationList({ items }: { items: OperatorRecommendation[] }) {
  if (!items.length) {
    return <div className="dam-life-empty-block">No recommendations yet.</div>
  }

  return (
    <div className="dam-life-recommendations">
      {items.map((item) => (
        <article key={`${item.priority}-${item.title}`} className="dam-life-subpanel">
          <div className="dam-life-inline">
            <span className={`dam-life-badge dam-life-badge--${item.priority}`}>{item.priority}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  )
}

function ClaimTable({ claims }: { claims: AdminClaimRecord[] }) {
  return (
    <DataTable headers={['Created', 'Claim', 'Category', 'Confidence', 'Latency', 'Source']}>
      {claims.length ? (
        claims.map((claim, index) => (
          <tr key={`${claim.createdAt ?? 'no-time'}-${index}`}>
            <td>{formatDateTime(claim.createdAt)}</td>
            <td className="dam-life-claim">{formatText(claim.claimText)}</td>
            <td>{formatCategoryLabel(claim.category)}</td>
            <td>{`${claim.confidence.toFixed(1)} / 100`}</td>
            <td>{formatLifetimeLatency(claim.latencyMs)}</td>
            <td>{claimSourceLabel(claim)}</td>
          </tr>
        ))
      ) : (
        <EmptyRow colSpan={6} copy="No data yet." />
      )}
    </DataTable>
  )
}

function SessionTable({
  title,
  rows,
}: {
  title: string
  rows: AdminLifetimeIntelligence['behavior']['longestSessions']
}) {
  return (
    <div className="dam-life-stack">
      <h3>{title}</h3>
      <DataTable headers={['Session', 'Source', 'Device', 'Claims', 'Duration', 'Email']}>
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.sessionId}>
              <td>{shortenId(row.sessionId)}</td>
              <td>{formatText(row.source, 'Unattributed')}</td>
              <td>{row.deviceType}</td>
              <td>{formatCount(row.claimCount)}</td>
              <td>{formatDuration(row.durationMs)}</td>
              <td>{row.emailCaptured ? 'Captured' : 'No'}</td>
            </tr>
          ))
        ) : (
          <EmptyRow colSpan={6} copy="No data yet." />
        )}
      </DataTable>
    </div>
  )
}

function LifetimeSectionNav({ activeHref }: { activeHref: string }) {
  return (
    <nav className="dam-life-route-nav" aria-label="Lifetime intelligence sections">
      {lifetimeSectionLinks.map((link) => (
        <Link key={link.href} href={link.href} className="dam-life-route-nav__link" data-active={link.href === activeHref}>
          <strong>{link.title}</strong>
          <span>{link.description}</span>
        </Link>
      ))}
    </nav>
  )
}

function LifetimeCoverageBanner() {
  return (
    <div className="dam-life-banner">
      Visitor, session, device, and attribution counts on this page come from Supabase-tracked telemetry only. Vercel Web Analytics is installed in the app, but Vercel aggregate visitors and page views are not connected to this dashboard yet.
    </div>
  )
}

function LifetimePageShell({
  activeHref,
  title,
  description,
  children,
}: {
  activeHref: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <>
      <LifetimeStyles />
      <section className="dam-life-route-shell">
        <div className="dam-life-route-shell__copy">
          <p className="dam-life-eyebrow">Lifetime founder system</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <LifetimeSectionNav activeHref={activeHref} />
      </section>
      {children}
    </>
  )
}

function buildSnapshotCards(lifetime: AdminLifetimeIntelligence) {
  return [
    {
      label: 'Tracked visitors',
      value: formatCount(lifetime.dataCoverage.trackedVisitors, 'Unavailable'),
      note: 'Distinct visitor_id values present in Supabase claim and event logs only',
      alert: false,
    },
    {
      label: 'Supabase-tracked sessions',
      value: formatCount(lifetime.dataCoverage.trackedSessions),
      note: 'Distinct session_id values seen in logged claim and event rows',
      alert: false,
    },
    {
      label: 'Claim submissions',
      value: formatCount(lifetime.snapshot.totalClaimSubmissions),
      note: `${formatDecimal(lifetime.snapshot.averageClaimsPerSession)} claims per session`,
      alert: false,
    },
    {
      label: 'Repeat sessions',
      value: formatCount(lifetime.snapshot.totalRepeatSessions),
      note: formatRate(lifetime.snapshot.returningSessionRate),
      alert: (lifetime.snapshot.returningSessionRate ?? 0) < 0.15,
    },
    {
      label: 'Email captures',
      value: formatCount(lifetime.snapshot.totalEmailCaptures, 'Not tracked yet'),
      note: `${formatCount(lifetime.snapshot.totalAttributedCampaigns)} attributed campaigns`,
      alert: false,
    },
    {
      label: 'Average latency',
      value: formatLifetimeLatency(lifetime.snapshot.averageLatencyMs),
      note: `Median ${formatLifetimeLatency(lifetime.snapshot.medianLatencyMs)}`,
      alert: (lifetime.snapshot.averageLatencyMs ?? 0) >= 8000,
    },
    {
      label: 'Highest latency ever',
      value: formatLifetimeLatency(lifetime.snapshot.highestLatencyEverMs),
      note: `${formatCount(lifetime.reliability.claimsOver8Seconds)} claims over 8s`,
      alert: (lifetime.snapshot.highestLatencyEverMs ?? 0) >= 12_000,
    },
    {
      label: 'Most active source',
      value: formatText(lifetime.snapshot.mostActiveSource),
      note: `Most tested category: ${formatLifetimeCategory(lifetime.snapshot.mostTestedCategory)}`,
      alert: false,
    },
    {
      label: 'Operational days',
      value: formatCount(lifetime.snapshot.totalOperationalDays),
      note: `Most active day: ${lifetime.snapshot.mostActiveDay ? formatDay(lifetime.snapshot.mostActiveDay.day) : 'No data yet'}`,
      alert: false,
    },
  ]
}

export function LifetimeOverviewSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence
  const strongestSignals = [
    {
      title: 'Current DAM stage',
      value: lifetime.snapshot.currentDamStage,
      note: `Most active source: ${formatText(lifetime.snapshot.mostActiveSource)}`,
    },
    {
      title: 'Strongest current signal',
      value: lifetime.strategy.strongestCurrentSignal,
      note: 'Directly derived from the existing lifetime metrics layer.',
    },
    {
      title: 'Biggest growth bottleneck',
      value: lifetime.growth.biggestGrowthBottleneck,
      note: `Unattributed traffic ${formatRate(lifetime.growth.unattributedTrafficPercentage, 'No data yet')}.`,
    },
    {
      title: 'Most valuable behavioral signal',
      value: lifetime.behavior.mostValuableBehavioralSignal,
      note: `Average time before first claim ${formatDuration(lifetime.behavior.averageTimeBeforeFirstClaimMs)}.`,
    },
    {
      title: 'Reliability status',
      value: lifetime.reliability.currentReliabilityStatus,
      note: `${formatCount(lifetime.reliability.claimsOver8Seconds)} claims over 8 seconds.`,
    },
  ]

  return (
    <>
      <LifetimeStyles />
      <section className="dam-life-overview-hero">
        <div className="dam-life-overview-hero__copy">
          <p className="dam-life-eyebrow">Lifetime founder command center</p>
          <h1>DAM operating system</h1>
          <p>
            One operating surface for growth quality, user behavior, product intent, reliability,
            and telemetry coverage. Open a focused lifetime section instead of scrolling through a
            stacked report.
          </p>
          <div className="dam-life-inline dam-life-inline--wrap">
            <span className="dam-life-pill">{lifetime.snapshot.currentDamStage}</span>
            <span className="dam-life-pill">{lifetime.reliability.currentReliabilityStatus}</span>
            <span className="dam-life-pill">{lifetime.trustProduct.currentUserIntent}</span>
            <span className="dam-life-pill">Updated {formatDateTime(metrics.generatedAt)}</span>
          </div>
        </div>
      </section>

      <LifetimeCoverageBanner />

      <section className="dam-life-overview-signals">
        {strongestSignals.map((signal) => (
          <article key={signal.title} className="dam-life-subpanel">
            <h3>{signal.title}</h3>
            <strong className="dam-life-big">{signal.value}</strong>
            <p>{signal.note}</p>
          </article>
        ))}
      </section>

      <LifetimeSectionNav activeHref="/admin/lifetime" />
    </>
  )
}

export function LifetimeSnapshotSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence
  const summaryCards = buildSnapshotCards(lifetime)

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/snapshot"
      title="Company Snapshot"
      description="Lifetime scale, usage footprint, and current operating context from the existing telemetry pipeline."
    >
      <Section
        eyebrow="Company lifetime snapshot"
        title="Company Snapshot"
        badge={<span className="dam-life-badge dam-life-badge--neutral">{lifetime.snapshot.currentDamStage}</span>}
      >
        <div className="dam-life-grid dam-life-grid--metrics">
          {summaryCards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} alert={card.alert} />
          ))}
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Device split</h3>
            <ValueShareList
              items={
                lifetime.snapshot.mobileVsDesktopSplit
                  ? [
                      {
                        label: 'Mobile',
                        count: lifetime.snapshot.mobileVsDesktopSplit.mobile,
                        percentage:
                          lifetime.snapshot.totalSessions > 0
                            ? lifetime.snapshot.mobileVsDesktopSplit.mobile / lifetime.snapshot.totalSessions
                            : null,
                      },
                      {
                        label: 'Desktop',
                        count: lifetime.snapshot.mobileVsDesktopSplit.desktop,
                        percentage:
                          lifetime.snapshot.totalSessions > 0
                            ? lifetime.snapshot.mobileVsDesktopSplit.desktop / lifetime.snapshot.totalSessions
                            : null,
                      },
                      {
                        label: 'Tablet',
                        count: lifetime.snapshot.mobileVsDesktopSplit.tablet,
                        percentage:
                          lifetime.snapshot.totalSessions > 0
                            ? lifetime.snapshot.mobileVsDesktopSplit.tablet / lifetime.snapshot.totalSessions
                            : null,
                      },
                      {
                        label: 'Unknown',
                        count: lifetime.snapshot.mobileVsDesktopSplit.unknown,
                        percentage:
                          lifetime.snapshot.totalSessions > 0
                            ? lifetime.snapshot.mobileVsDesktopSplit.unknown / lifetime.snapshot.totalSessions
                            : null,
                      },
                    ].filter((item) => item.count > 0)
                  : []
              }
              emptyCopy="Not tracked yet."
            />
            <p>Source: {lifetime.dataCoverage.deviceSplitSource}.</p>
          </article>

          <article className="dam-life-subpanel">
            <h3>Operational read</h3>
            <div className="dam-life-statements">
              <p>Current DAM stage: {lifetime.snapshot.currentDamStage}.</p>
              <p>Current reliability status: {lifetime.reliability.currentReliabilityStatus}.</p>
              <p>Current user intent: {lifetime.trustProduct.currentUserIntent}.</p>
              <p>Total countries reached: {formatCount(lifetime.snapshot.totalCountriesReached, 'Not tracked yet')}.</p>
            </div>
          </article>
        </div>
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeGrowthSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/growth"
      title="Growth Intelligence"
      description="Traffic quality, conversion, and the actual bottleneck constraining growth right now."
    >
      <Section
        eyebrow="Growth intelligence"
        title="Growth Intelligence"
        badge={<span className="dam-life-badge dam-life-badge--warning">Bottleneck mapped</span>}
      >
        <div className="dam-life-grid dam-life-grid--four">
          <TrendCard
            label="Visitor growth"
            value={formatCount(lifetime.growth.visitorGrowthTrend.currentCount)}
            summary={lifetime.growth.visitorGrowthTrend.summary}
            direction={lifetime.growth.visitorGrowthTrend.direction}
          />
          <TrendCard
            label="Claim growth"
            value={formatCount(lifetime.growth.claimGrowthTrend.currentCount)}
            summary={lifetime.growth.claimGrowthTrend.summary}
            direction={lifetime.growth.claimGrowthTrend.direction}
          />
          <TrendCard
            label="Repeat-session growth"
            value={formatCount(lifetime.growth.repeatSessionTrend.currentCount)}
            summary={lifetime.growth.repeatSessionTrend.summary}
            direction={lifetime.growth.repeatSessionTrend.direction}
          />
          <TrendCard
            label="Email capture growth"
            value={formatCount(lifetime.growth.emailCaptureTrend.currentCount)}
            summary={lifetime.growth.emailCaptureTrend.summary}
            direction={lifetime.growth.emailCaptureTrend.direction}
          />
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Timeline</h3>
            <TimelineChart points={lifetime.growth.timeline} />
          </article>
          <article className="dam-life-subpanel">
            <h3>Growth signal</h3>
            <div className="dam-life-statements">
              <p>{lifetime.growth.biggestGrowthBottleneck}</p>
              <p>Unattributed traffic: {formatRate(lifetime.growth.unattributedTrafficPercentage, 'No data yet')}.</p>
              <p>
                Best converting source:{' '}
                {lifetime.growth.bestConvertingSources[0]
                  ? sourceLabel(lifetime.growth.bestConvertingSources[0])
                  : 'No data yet'}
                .
              </p>
              <p>
                Worst converting source:{' '}
                {lifetime.growth.worstConvertingSources[0]
                  ? sourceLabel(lifetime.growth.worstConvertingSources[0])
                  : 'No data yet'}
                .
              </p>
            </div>
          </article>
        </div>

        <DataTable headers={['Source', 'Sessions', 'Claims', 'Claims / session', 'Emails', 'Read']}>
          {lifetime.growth.topAcquisitionChannels.length ? (
            lifetime.growth.topAcquisitionChannels.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                <td>{sourceLabel(row)}</td>
                <td>{formatCount(row.uniqueSessions)}</td>
                <td>{formatCount(row.claimSubmissions)}</td>
                <td>{formatDecimal(row.claimsPerSession)}</td>
                <td>{formatCount(row.emailCaptures)}</td>
                <td>{row.interpretation}</td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6} copy="No data yet." />
          )}
        </DataTable>
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeBehaviorSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/behavior"
      title="User Behavior"
      description="Session depth, claim timing, and the repeat patterns that matter most."
    >
      <Section
        eyebrow="User behavior intelligence"
        title="User Behavior Intelligence"
        badge={<span className="dam-life-badge dam-life-badge--good">Depth signal</span>}
      >
        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Claims per session</h3>
            <ValueShareList items={lifetime.behavior.claimsPerSessionDistribution} />
          </article>
          <article className="dam-life-subpanel">
            <h3>Behavior interpretation</h3>
            <div className="dam-life-statements">
              <p>
                First-time vs repeat: {formatCount(lifetime.behavior.firstTimeSessions)} first-time /{' '}
                {formatCount(lifetime.behavior.repeatSessions)} repeat.
              </p>
              <p>Average time before first claim: {formatDuration(lifetime.behavior.averageTimeBeforeFirstClaimMs)}.</p>
              <p>
                Most common flow:{' '}
                {lifetime.behavior.mostCommonUserFlow
                  ? `${lifetime.behavior.mostCommonUserFlow.label} (${formatCount(lifetime.behavior.mostCommonUserFlow.count)} sessions)`
                  : 'No data yet'}
                .
              </p>
              <p>Example-claim usage rate: {formatRate(lifetime.behavior.exampleClaimUsageRate)}.</p>
            </div>
          </article>
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>High-intent session patterns</h3>
            <div className="dam-life-bullet-block">
              {lifetime.behavior.highIntentSessionPatterns.length ? (
                lifetime.behavior.highIntentSessionPatterns.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p>No data yet.</p>
              )}
            </div>
          </article>
          <article className="dam-life-subpanel">
            <h3>Repeat-user patterns</h3>
            <div className="dam-life-bullet-block">
              {lifetime.behavior.repeatUserPatterns.length ? (
                lifetime.behavior.repeatUserPatterns.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p>No data yet.</p>
              )}
            </div>
          </article>
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <SessionTable title="Longest sessions" rows={lifetime.behavior.longestSessions} />
          <SessionTable title="Highest claim-depth sessions" rows={lifetime.behavior.highestClaimDepthSessions} />
        </div>
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeTrustSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/trust"
      title="Trust & Product"
      description="What users are testing, where confidence weakens, and what the current intent mix implies."
    >
      <Section
        eyebrow="Trust and product intelligence"
        title="Trust & Product Intelligence"
        badge={<span className="dam-life-badge dam-life-badge--neutral">{lifetime.trustProduct.currentUserIntent}</span>}
      >
        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Category and evidence mix</h3>
            <DataTable headers={['Category', 'Count', 'Share', 'Avg confidence', 'Avg latency']}>
              {lifetime.trustProduct.topClaimCategories.length ? (
                lifetime.trustProduct.topClaimCategories.map((row) => (
                  <tr key={row.category}>
                    <td>{formatCategoryLabel(row.category)}</td>
                    <td>{formatCount(row.count)}</td>
                    <td>{formatRate(row.percentage)}</td>
                    <td>{row.averageConfidence.toFixed(1)}</td>
                    <td>{formatLifetimeLatency(row.averageLatencyMs)}</td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={5} copy="No data yet." />
              )}
            </DataTable>
          </article>

          <article className="dam-life-subpanel">
            <h3>Interpretation</h3>
            <div className="dam-life-statements">
              <p>
                Lowest confidence category:{' '}
                {lifetime.trustProduct.lowestConfidenceCategory
                  ? formatCategoryLabel(lifetime.trustProduct.lowestConfidenceCategory.category)
                  : 'No data yet'}
                .
              </p>
              <p>
                Highest latency category:{' '}
                {lifetime.trustProduct.highestLatencyCategory
                  ? formatCategoryLabel(lifetime.trustProduct.highestLatencyCategory.category)
                  : 'No data yet'}
                .
              </p>
              <p>Current user intent: {lifetime.trustProduct.currentUserIntent}.</p>
              <p>{lifetime.trustProduct.lowConfidenceTrend.summary}</p>
            </div>
          </article>
        </div>

        <div className="dam-life-grid dam-life-grid--three">
          <article className="dam-life-subpanel">
            <h3>Scam vs misinformation</h3>
            <ValueShareList items={lifetime.trustProduct.scamVsMisinformationDistribution} />
          </article>
          <article className="dam-life-subpanel">
            <h3>Evidence distribution</h3>
            <ValueShareList items={lifetime.trustProduct.sourceEvidenceDistribution} />
          </article>
          <article className="dam-life-subpanel">
            <h3>Suspicious keywords</h3>
            <ValueShareList
              items={lifetime.trustProduct.mostCommonSuspiciousKeywords.map((item) => ({
                label: item.label,
                count: item.count,
                percentage: null,
              }))}
            />
          </article>
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Recurring misinformation themes</h3>
            <ValueShareList
              items={lifetime.trustProduct.recurringMisinformationThemes.map((item) => ({
                label: item.label,
                count: item.count,
                percentage: null,
              }))}
            />
          </article>
          <article className="dam-life-subpanel">
            <h3>Recurring scam themes</h3>
            <ValueShareList
              items={lifetime.trustProduct.recurringScamThemes.map((item) => ({
                label: item.label,
                count: item.count,
                percentage: null,
              }))}
            />
          </article>
        </div>
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeReliabilitySection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/reliability"
      title="Reliability"
      description="Latency distribution, bad rows, and operational pressure visible in the current admin telemetry."
    >
      <Section
        eyebrow="Infrastructure and reliability"
        title="Infrastructure & Reliability"
        badge={<span className="dam-life-badge dam-life-badge--warning">{lifetime.reliability.currentReliabilityStatus}</span>}
      >
        <div className="dam-life-grid dam-life-grid--three">
          <MetricCard
            label="Average latency"
            value={formatLifetimeLatency(lifetime.reliability.averageLatencyMs)}
            note={`Median ${formatLifetimeLatency(lifetime.reliability.medianLatencyMs)}`}
            alert={(lifetime.reliability.averageLatencyMs ?? 0) >= 8000}
          />
          <MetricCard
            label="Attribution failures"
            value={formatCount(lifetime.reliability.attributionFailures)}
            note="Claims with unattributed source rows"
            alert={lifetime.reliability.attributionFailures > 0}
          />
          <MetricCard
            label="Unknown / empty rows"
            value={formatCount(
              lifetime.reliability.unknownVerdictRows +
                lifetime.reliability.unknownRiskRows +
                lifetime.reliability.emptyClaimRows
            )}
            note="Unknown verdict, unknown risk, or empty claim text"
            alert={
              lifetime.reliability.unknownVerdictRows +
                lifetime.reliability.unknownRiskRows +
                lifetime.reliability.emptyClaimRows >
              0
            }
          />
        </div>

        <div className="dam-life-grid dam-life-grid--two">
          <article className="dam-life-subpanel">
            <h3>Latency distribution</h3>
            <ValueShareList items={lifetime.reliability.latencyDistribution} />
          </article>
          <article className="dam-life-subpanel">
            <h3>Infrastructure read</h3>
            <div className="dam-life-statements">
              <p>Claims over 8 seconds: {formatCount(lifetime.reliability.claimsOver8Seconds)}.</p>
              <p>{formatText(lifetime.reliability.operationalUptimeIndicator, 'No uptime indicator yet.')}</p>
              <p>Vercel function health: {formatText(lifetime.reliability.vercelFunctionHealth, 'Not connected yet')}.</p>
              <p>Deployment count: {formatCount(lifetime.reliability.deploymentCount, 'Not connected yet')}.</p>
            </div>
          </article>
        </div>

        <ClaimTable claims={lifetime.reliability.slowestClaimsEver} />
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeStrategySection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/recommendations"
      title="Strategic Recommendations"
      description="Action ranking from the actual lifetime telemetry, without invented advice."
    >
      <Section
        eyebrow="Strategic recommendations"
        title="Strategic Recommendations"
        badge={<span className="dam-life-badge dam-life-badge--good">Metrics-derived</span>}
      >
        <RecommendationList items={lifetime.strategy.topNextActions} />
        <div className="dam-life-grid dam-life-grid--three">
          <article className="dam-life-subpanel">
            <h3>Highest leverage product fix</h3>
            <p>{lifetime.strategy.highestLeverageProductFix}</p>
          </article>
          <article className="dam-life-subpanel">
            <h3>Highest leverage growth action</h3>
            <p>{lifetime.strategy.highestLeverageGrowthAction}</p>
          </article>
          <article className="dam-life-subpanel">
            <h3>Highest leverage retention action</h3>
            <p>{lifetime.strategy.highestLeverageRetentionAction}</p>
          </article>
          <article className="dam-life-subpanel">
            <h3>Biggest analytics blind spot</h3>
            <p>{lifetime.strategy.biggestAnalyticsBlindSpot}</p>
          </article>
          <article className="dam-life-subpanel">
            <h3>Biggest operational risk</h3>
            <p>{lifetime.strategy.biggestOperationalRisk}</p>
          </article>
          <article className="dam-life-subpanel">
            <h3>Strongest current signal</h3>
            <p>{lifetime.strategy.strongestCurrentSignal}</p>
          </article>
        </div>
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeTimelineSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/timeline"
      title="Timeline"
      description="Historical milestones across product usage, traffic quality, and operating system development."
    >
      <Section
        eyebrow="DAM timeline"
        title="DAM Timeline"
        badge={
          <span className="dam-life-badge dam-life-badge--neutral">
            {lifetime.timeline.hasEnoughHistoricalData ? 'Historical signals present' : 'Sparse history'}
          </span>
        }
      >
        {lifetime.timeline.hasEnoughHistoricalData ? (
          <div className="dam-life-grid dam-life-grid--two">
            {lifetime.timeline.milestones.map((milestone) => (
              <article key={milestone.label} className="dam-life-subpanel">
                <h3>{milestone.label}</h3>
                <strong className="dam-life-big">{formatDateTime(milestone.at, 'Not enough historical data yet.')}</strong>
                <p>{milestone.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="dam-life-empty-block">Not enough historical data yet.</div>
        )}
      </Section>
    </LifetimePageShell>
  )
}

export function LifetimeCoverageSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const lifetime = metrics.lifetimeIntelligence

  return (
    <LifetimePageShell
      activeHref="/admin/lifetime/coverage"
      title="Data Coverage"
      description="What the lifetime dashboard can measure today, what is partial, and what still depends on a Vercel API connection."
    >
      <LifetimeCoverageBanner />
      <Section
        eyebrow="Telemetry coverage"
        title="Data Coverage"
        badge={<span className="dam-life-badge dam-life-badge--warning">Supabase-tracked only</span>}
      >
        <article className="dam-life-subpanel">
          <p>{lifetime.dataCoverage.mismatchSummary}</p>
          <DataTable headers={['Signal', 'Value', 'Coverage note']}>
            <tr>
              <td>Supabase tracked visitors</td>
              <td>{formatCount(lifetime.dataCoverage.trackedVisitors, 'Unavailable')}</td>
              <td>Distinct visitor_id values from logged claims and events only.</td>
            </tr>
            <tr>
              <td>Supabase tracked sessions</td>
              <td>{formatCount(lifetime.dataCoverage.trackedSessions)}</td>
              <td>Distinct session_id values from logged claims and event rows only.</td>
            </tr>
            <tr>
              <td>Vercel Analytics connected</td>
              <td>No</td>
              <td>Client analytics is installed, but the admin metrics API does not pull Vercel aggregate traffic yet.</td>
            </tr>
            <tr>
              <td>Vercel visitors</td>
              <td>Unavailable</td>
              <td>Requires a server-side Vercel API connection.</td>
            </tr>
            <tr>
              <td>Page views</td>
              <td>{formatCount(lifetime.dataCoverage.trackedPageViewEvents)}</td>
              <td>Supabase page_view and campaign_page_view events only. Vercel page views unavailable unless API connected.</td>
            </tr>
            <tr>
              <td>App opens</td>
              <td>{formatCount(lifetime.dataCoverage.trackedAppOpenEvents)}</td>
              <td>Supabase app_open_click events only.</td>
            </tr>
            <tr>
              <td>Countries</td>
              <td>Unavailable</td>
              <td>Country-level traffic is not available from current Supabase tables.</td>
            </tr>
            <tr>
              <td>Bounce rate</td>
              <td>Unavailable</td>
              <td>Not derivable from current Supabase tables alone.</td>
            </tr>
            <tr>
              <td>Device split source</td>
              <td>{lifetime.dataCoverage.deviceSplitSource}</td>
              <td>Computed only from event rows carrying device_type metadata.</td>
            </tr>
            <tr>
              <td>Event rows with visitor_id</td>
              <td>{formatCount(lifetime.dataCoverage.eventRowsWithVisitorId)}</td>
              <td>{`${formatCount(lifetime.dataCoverage.eventRowsWithDeviceType)} rows also carry device_type.`}</td>
            </tr>
            <tr>
              <td>Event rows with referrer / landing path</td>
              <td>{`${formatCount(lifetime.dataCoverage.eventRowsWithReferrer)} / ${formatCount(lifetime.dataCoverage.eventRowsWithLandingPath)}`}</td>
              <td>{`${formatCount(lifetime.dataCoverage.eventRowsWithAnyUtm)} event rows currently carry UTM metadata.`}</td>
            </tr>
            <tr>
              <td>Claim rows with attribution</td>
              <td>{formatCount(lifetime.dataCoverage.claimRowsWithAttribution)}</td>
              <td>{`${formatCount(lifetime.dataCoverage.claimRowsWithVisitorId)} claim rows currently include visitor_id.`}</td>
            </tr>
          </DataTable>
        </article>
      </Section>
    </LifetimePageShell>
  )
}

function LifetimeStyles() {
  return (
    <style jsx global>{`
      .dam-life-route-shell,
      .dam-life-overview-hero,
      .dam-life-overview-signals,
      .dam-life-section {
        display: grid;
        gap: 18px;
      }

      .dam-life-route-shell,
      .dam-life-overview-hero,
      .dam-life-section {
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 26px;
        background:
          linear-gradient(180deg, rgba(14, 21, 33, 0.94), rgba(8, 12, 18, 0.98)),
          rgba(7, 10, 15, 0.98);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.06),
          0 24px 90px rgba(0, 0, 0, 0.28);
      }

      .dam-life-route-shell__copy,
      .dam-life-overview-hero__copy,
      .dam-life-section__head > div,
      .dam-life-stack {
        display: grid;
        gap: 10px;
      }

      .dam-life-route-shell h1,
      .dam-life-overview-hero h1,
      .dam-life-section h2,
      .dam-life-subpanel h3 {
        margin: 0;
      }

      .dam-life-route-shell h1,
      .dam-life-overview-hero h1 {
        font-size: clamp(32px, 5vw, 54px);
        letter-spacing: -0.05em;
        line-height: 0.98;
      }

      .dam-life-route-shell p,
      .dam-life-overview-hero p,
      .dam-life-subpanel p,
      .dam-life-metric p,
      .dam-life-statements p {
        margin: 0;
        color: rgba(232, 238, 246, 0.72);
        line-height: 1.65;
      }

      .dam-life-eyebrow {
        margin: 0;
        color: rgba(165, 182, 214, 0.72);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .dam-life-inline {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .dam-life-inline--wrap {
        flex-wrap: wrap;
      }

      .dam-life-pill,
      .dam-life-badge {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(174, 196, 238, 0.16);
        background: rgba(255, 255, 255, 0.05);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .dam-life-badge--good {
        color: #d6ffe3;
        border-color: rgba(84, 172, 118, 0.28);
        background: rgba(50, 117, 72, 0.18);
      }

      .dam-life-badge--bad,
      .dam-life-badge--high {
        color: #ffd6d6;
        border-color: rgba(202, 98, 98, 0.28);
        background: rgba(128, 38, 44, 0.18);
      }

      .dam-life-badge--warning,
      .dam-life-badge--medium {
        color: #ffe7c2;
        border-color: rgba(208, 154, 74, 0.28);
        background: rgba(121, 80, 22, 0.18);
      }

      .dam-life-badge--neutral,
      .dam-life-badge--low,
      .dam-life-badge--flat {
        color: #d5e7ff;
        border-color: rgba(98, 132, 194, 0.28);
        background: rgba(44, 69, 117, 0.18);
      }

      .dam-life-badge--muted,
      .dam-life-badge--no {
        color: rgba(220, 228, 246, 0.62);
      }

      .dam-life-route-nav {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .dam-life-route-nav__link {
        display: grid;
        gap: 6px;
        padding: 16px 18px;
        border: 1px solid rgba(174, 196, 238, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          background-color 180ms ease;
      }

      .dam-life-route-nav__link:hover {
        transform: translateY(-1px);
        border-color: rgba(216, 228, 255, 0.26);
        background: rgba(255, 255, 255, 0.05);
      }

      .dam-life-route-nav__link[data-active='true'] {
        border-color: rgba(216, 228, 255, 0.28);
        background:
          linear-gradient(180deg, rgba(124, 152, 214, 0.16), rgba(124, 152, 214, 0.04)),
          rgba(255, 255, 255, 0.04);
      }

      .dam-life-route-nav__link strong {
        font-size: 14px;
        letter-spacing: 0.02em;
      }

      .dam-life-route-nav__link span {
        color: rgba(221, 230, 246, 0.62);
        font-size: 12px;
        line-height: 1.55;
      }

      .dam-life-overview-signals,
      .dam-life-recommendations,
      .dam-life-grid {
        display: grid;
        gap: 16px;
      }

      .dam-life-overview-signals,
      .dam-life-grid--metrics {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .dam-life-grid--four {
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      }

      .dam-life-grid--three {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .dam-life-grid--two {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .dam-life-section__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .dam-life-subpanel,
      .dam-life-metric {
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        display: grid;
        gap: 10px;
      }

      .dam-life-metric span {
        color: rgba(209, 220, 240, 0.62);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .dam-life-metric strong,
      .dam-life-big {
        font-size: clamp(24px, 3vw, 34px);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .dam-life-metric--alert {
        border-color: rgba(198, 92, 92, 0.3);
      }

      .dam-life-chart {
        display: grid;
        gap: 12px;
      }

      .dam-life-chart__row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 132px;
        gap: 12px;
        align-items: center;
      }

      .dam-life-chart__row > span,
      .dam-life-chart__meta,
      .dam-life-list__row span {
        color: rgba(221, 230, 246, 0.62);
        font-size: 12px;
      }

      .dam-life-chart__tracks {
        display: grid;
        gap: 8px;
      }

      .dam-life-chart__track {
        height: 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        overflow: hidden;
      }

      .dam-life-chart__fill {
        height: 100%;
        border-radius: inherit;
      }

      .dam-life-chart__fill--claims {
        background: linear-gradient(90deg, rgba(104, 138, 214, 0.95), rgba(170, 198, 255, 0.88));
      }

      .dam-life-chart__fill--sessions {
        background: linear-gradient(90deg, rgba(76, 178, 131, 0.95), rgba(171, 255, 212, 0.82));
      }

      .dam-life-chart__meta,
      .dam-life-list,
      .dam-life-bullet-block,
      .dam-life-statements {
        display: grid;
        gap: 10px;
      }

      .dam-life-list__row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .dam-life-list__row:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }

      .dam-life-list__row div {
        display: grid;
        gap: 4px;
      }

      .dam-life-list__row strong {
        font-size: 14px;
      }

      .dam-life-table-shell {
        overflow-x: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
      }

      .dam-life-table {
        width: 100%;
        border-collapse: collapse;
      }

      .dam-life-table th,
      .dam-life-table td {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }

      .dam-life-table th {
        color: rgba(203, 215, 238, 0.64);
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .dam-life-table tr:last-child td {
        border-bottom: 0;
      }

      .dam-life-empty,
      .dam-life-empty-block {
        color: rgba(203, 215, 238, 0.58);
      }

      .dam-life-empty-block {
        padding: 8px 0;
      }

      .dam-life-claim {
        min-width: 20rem;
      }

      .dam-life-banner {
        padding: 16px 18px;
        border: 1px solid rgba(214, 165, 91, 0.2);
        border-radius: 18px;
        background: rgba(117, 83, 36, 0.14);
        color: rgba(251, 232, 204, 0.9);
        line-height: 1.65;
      }

      @media (max-width: 760px) {
        .dam-life-route-shell,
        .dam-life-overview-hero,
        .dam-life-section {
          padding: 22px 18px;
        }

        .dam-life-chart__row {
          grid-template-columns: 1fr;
        }

        .dam-life-chart__meta {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .dam-life-route-nav {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  )
}
