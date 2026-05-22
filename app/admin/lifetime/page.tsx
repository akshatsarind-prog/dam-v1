'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import DamBrandMark from '@/components/brand/DamBrandMark'
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

const SESSION_STORAGE_KEY = 'dam_admin_password'

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

const shellStyle = {
  minHeight: '100vh',
  paddingBottom: 64,
  background:
    'radial-gradient(circle at top left, rgba(54, 82, 140, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(17, 179, 120, 0.12), transparent 24%), #06080c',
} as const

const wrapStyle = {
  width: 'min(1320px, calc(100% - 40px))',
  margin: '0 auto',
} as const

const contentStyle = {
  ...wrapStyle,
  display: 'grid',
  gap: 18,
} as const

function formatDateTime(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString()
}

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

function formatCount(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return new Intl.NumberFormat('en-US').format(value)
}

function formatRate(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function formatDecimal(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

function formatLatency(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s` : `${Math.round(value)} ms`
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

function formatText(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

function formatCategoryLabel(category: AdminClaimCategory | null | undefined) {
  if (!category) {
    return 'No data yet'
  }

  if (category === 'social_rumor') {
    return 'Social rumor'
  }

  return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function shortenId(value: string | null | undefined) {
  if (!value) {
    return 'No data yet'
  }

  return value.length <= 14 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
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
    <DataTable
      headers={['Created', 'Claim', 'Category', 'Confidence', 'Latency', 'Source']}
    >
      {claims.length ? (
        claims.map((claim, index) => (
          <tr key={`${claim.createdAt ?? 'no-time'}-${index}`}>
            <td>{formatDateTime(claim.createdAt)}</td>
            <td className="dam-life-claim">{formatText(claim.claimText)}</td>
            <td>{formatCategoryLabel(claim.category)}</td>
            <td>{`${claim.confidence.toFixed(1)} / 100`}</td>
            <td>{formatLatency(claim.latencyMs)}</td>
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

export default function AdminLifetimePage() {
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
          | { error?: { message?: string | null } | null }
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

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
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

  const showDashboard =
    state.status === 'ready' || (state.status === 'loading' && Boolean(state.metrics))

  if (!showDashboard || !state.metrics) {
    return (
      <main style={shellStyle}>
        <div style={{ ...wrapStyle, paddingTop: 28 }}>
          <header className="dam-life-topbar">
            <Link className="dam-mark" href="/" aria-label="Return to DAM home">
              <DamBrandMark collapseTextOnNarrow />
            </Link>
            <span className="dam-life-pill">Private admin</span>
          </header>
        </div>

        <div style={{ ...contentStyle, paddingTop: 18 }}>
          <section className="dam-life-auth">
            <div className="dam-life-auth__card">
              <div className="dam-life-stack">
                <p className="dam-life-eyebrow">Founder summary system</p>
                <h1>DAM lifetime intelligence</h1>
                <p>
                  One founder command center for product demand, growth quality, retention,
                  reliability, and telemetry health. This page reads only from the existing admin
                  metrics pipeline.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="dam-life-auth__form">
                <label htmlFor="dam-lifetime-password">Admin password</label>
                <input
                  id="dam-lifetime-password"
                  type="password"
                  value={state.password}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      password: event.target.value,
                      errorMessage: '',
                    }))
                  }
                  autoComplete="current-password"
                />
                <button type="submit" disabled={state.status === 'loading'}>
                  {state.status === 'loading' ? 'Checking access...' : 'Open dashboard'}
                </button>
              </form>

              <div className="dam-life-inline">
                <Link href="/admin" className="dam-life-link">
                  Open current admin
                </Link>
              </div>

              {state.errorMessage ? <p className="form-error">{state.errorMessage}</p> : null}
            </div>
          </section>
        </div>
        <LifetimeStyles />
      </main>
    )
  }

  const metrics = state.metrics
  const lifetime = metrics.lifetimeIntelligence
  const updatedAt = formatDateTime(metrics.generatedAt)
  const summaryCards = [
    {
      label: 'Total sessions',
      value: formatCount(lifetime.snapshot.totalSessions),
      note: `${formatCount(lifetime.snapshot.totalVisitors, 'Tracked visitors unavailable')} tracked visitors`,
      alert: false,
    },
    {
      label: 'Total claim submissions',
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
      value: formatLatency(lifetime.snapshot.averageLatencyMs),
      note: `Median ${formatLatency(lifetime.snapshot.medianLatencyMs)}`,
      alert: lifetime.snapshot.averageLatencyMs >= 8000,
    },
    {
      label: 'Highest latency ever',
      value: formatLatency(lifetime.snapshot.highestLatencyEverMs),
      note: `${formatCount(lifetime.reliability.claimsOver8Seconds)} claims over 8s`,
      alert: (lifetime.snapshot.highestLatencyEverMs ?? 0) >= 12_000,
    },
    {
      label: 'Most active source',
      value: formatText(lifetime.snapshot.mostActiveSource),
      note: `Most tested category: ${formatCategoryLabel(lifetime.snapshot.mostTestedCategory)}`,
      alert: false,
    },
    {
      label: 'Operational days',
      value: formatCount(lifetime.snapshot.totalOperationalDays),
      note: `Most active day: ${lifetime.snapshot.mostActiveDay ? formatDay(lifetime.snapshot.mostActiveDay.day) : 'No data yet'}`,
      alert: false,
    },
  ]

  return (
    <main style={shellStyle}>
      <div style={{ ...wrapStyle, paddingTop: 26 }}>
        <header className="dam-life-topbar">
          <Link className="dam-mark" href="/" aria-label="Return to DAM home">
            <DamBrandMark collapseTextOnNarrow />
          </Link>
          <div className="dam-life-topbar__actions">
            <Link href="/admin" className="dam-life-action">
              Current admin
            </Link>
            <button type="button" className="dam-life-action" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>
      </div>

      <div style={{ ...contentStyle, paddingTop: 16 }}>
        <section className="dam-life-hero">
          <div className="dam-life-hero__copy">
            <p className="dam-life-eyebrow">Lifetime founder command center</p>
            <h1>DAM operating system</h1>
            <p>
              Read the business, product, and telemetry stack from one surface. This route
              preserves the existing admin auth flow and consumes only the current admin metrics
              API.
            </p>
          </div>

          <div className="dam-life-hero__signals">
            <div className="dam-life-inline dam-life-inline--wrap">
              <span className="dam-life-pill">{lifetime.snapshot.currentDamStage}</span>
              <span className="dam-life-pill">{lifetime.reliability.currentReliabilityStatus}</span>
              <span className="dam-life-pill">{lifetime.trustProduct.currentUserIntent}</span>
              <span className="dam-life-pill">Updated {updatedAt}</span>
            </div>
            <div className="dam-life-notes">
              <article className="dam-life-subpanel">
                <h3>Biggest growth bottleneck</h3>
                <p>{lifetime.growth.biggestGrowthBottleneck}</p>
              </article>
              <article className="dam-life-subpanel">
                <h3>Most valuable behavioral signal</h3>
                <p>{lifetime.behavior.mostValuableBehavioralSignal}</p>
              </article>
              <article className="dam-life-subpanel">
                <h3>Strongest current signal</h3>
                <p>{lifetime.strategy.strongestCurrentSignal}</p>
              </article>
            </div>
          </div>
        </section>

        {metrics.error ? <div className="dam-life-banner">{metrics.error.message}</div> : null}
        {state.errorMessage ? <div className="dam-life-banner">{state.errorMessage}</div> : null}

        <Section
          eyebrow="Section 1"
          title="Company Lifetime Snapshot"
          badge={<span className="dam-life-badge dam-life-badge--neutral">{lifetime.snapshot.currentDamStage}</span>}
        >
          <div className="dam-life-grid dam-life-grid--metrics">
            {summaryCards.map((card) => (
              <MetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                note={card.note}
                alert={card.alert}
              />
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

        <Section
          eyebrow="Section 2"
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
                <p>
                  Unattributed traffic: {formatRate(lifetime.growth.unattributedTrafficPercentage, 'No data yet')}.
                </p>
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
          <DataTable
            headers={['Source', 'Sessions', 'Claims', 'Claims / session', 'Emails', 'Read']}
          >
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

        <Section
          eyebrow="Section 3"
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
                  First-time vs repeat: {formatCount(lifetime.behavior.firstTimeSessions)} first-time /
                  {' '}
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
                {lifetime.behavior.highIntentSessionPatterns.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
            <article className="dam-life-subpanel">
              <h3>Repeat-user patterns</h3>
              <div className="dam-life-bullet-block">
                {lifetime.behavior.repeatUserPatterns.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
          </div>
          <div className="dam-life-grid dam-life-grid--two">
            <SessionTable title="Longest sessions" rows={lifetime.behavior.longestSessions} />
            <SessionTable title="Highest claim-depth sessions" rows={lifetime.behavior.highestClaimDepthSessions} />
          </div>
        </Section>

        <Section
          eyebrow="Section 4"
          title="Trust & Product Intelligence"
          badge={<span className="dam-life-badge dam-life-badge--neutral">{lifetime.trustProduct.currentUserIntent}</span>}
        >
          <div className="dam-life-grid dam-life-grid--two">
            <article className="dam-life-subpanel">
              <h3>Category and evidence mix</h3>
              <DataTable
                headers={['Category', 'Count', 'Share', 'Avg confidence', 'Avg latency']}
              >
                {lifetime.trustProduct.topClaimCategories.length ? (
                  lifetime.trustProduct.topClaimCategories.map((row) => (
                    <tr key={row.category}>
                      <td>{formatCategoryLabel(row.category)}</td>
                      <td>{formatCount(row.count)}</td>
                      <td>{formatRate(row.percentage)}</td>
                      <td>{row.averageConfidence.toFixed(1)}</td>
                      <td>{formatLatency(row.averageLatencyMs)}</td>
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
                <p>
                  Current user intent: {lifetime.trustProduct.currentUserIntent}.
                </p>
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

        <Section
          eyebrow="Section 5"
          title="Infrastructure & Reliability"
          badge={<span className="dam-life-badge dam-life-badge--warning">{lifetime.reliability.currentReliabilityStatus}</span>}
        >
          <div className="dam-life-grid dam-life-grid--three">
            <MetricCard
              label="Average latency"
              value={formatLatency(lifetime.reliability.averageLatencyMs)}
              note={`Median ${formatLatency(lifetime.reliability.medianLatencyMs)}`}
              alert={lifetime.reliability.averageLatencyMs >= 8000}
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

        <Section
          eyebrow="Section 6"
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

        <Section
          eyebrow="Section 7"
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
      </div>
      <LifetimeStyles />
    </main>
  )
}

function LifetimeStyles() {
  return (
    <style jsx global>{`
      .dam-life-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 0;
      }

      .dam-life-topbar__actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .dam-life-action,
      .dam-life-auth__form button {
        height: 42px;
        padding: 0 16px;
        border: 1px solid rgba(174, 196, 238, 0.18);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        color: #f4f8ff;
        font-size: 14px;
        font-weight: 700;
      }

      .dam-life-link {
        color: #a8d8ff;
        font-size: 14px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .dam-life-pill,
      .dam-life-badge {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(174, 196, 238, 0.16);
        background: rgba(255, 255, 255, 0.05);
        color: #d8e7ff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .dam-life-badge--good {
        border-color: rgba(17, 179, 120, 0.32);
        color: #7fe3b8;
      }

      .dam-life-badge--bad,
      .dam-life-badge--high {
        border-color: rgba(255, 126, 126, 0.32);
        color: #ffb0b0;
      }

      .dam-life-badge--warning,
      .dam-life-badge--medium {
        border-color: rgba(255, 190, 110, 0.3);
        color: #ffd396;
      }

      .dam-life-badge--neutral,
      .dam-life-badge--low,
      .dam-life-badge--flat {
        color: #d8e7ff;
      }

      .dam-life-badge--muted,
      .dam-life-badge--no {
        color: rgba(216, 231, 255, 0.72);
      }

      .dam-life-hero,
      .dam-life-section,
      .dam-life-auth__card {
        border: 1px solid rgba(174, 196, 238, 0.12);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(11, 14, 20, 0.96), rgba(7, 10, 14, 0.98));
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
      }

      .dam-life-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 20px;
        padding: 24px;
      }

      .dam-life-hero h1,
      .dam-life-section h2,
      .dam-life-subpanel h3,
      .dam-life-auth__card h1 {
        margin: 0;
        color: #f4f8ff;
      }

      .dam-life-hero h1,
      .dam-life-auth__card h1 {
        font-size: clamp(2rem, 3vw, 3.2rem);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      .dam-life-hero p,
      .dam-life-subpanel p,
      .dam-life-auth__card p,
      .dam-life-metric p,
      .dam-life-statements p {
        margin: 0;
        color: rgba(216, 231, 255, 0.75);
        line-height: 1.6;
      }

      .dam-life-stack {
        display: grid;
        gap: 12px;
      }

      .dam-life-eyebrow {
        margin: 0 0 10px;
        color: #9cc7ff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .dam-life-inline {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .dam-life-inline--wrap {
        flex-wrap: wrap;
      }

      .dam-life-notes,
      .dam-life-recommendations {
        display: grid;
        gap: 12px;
      }

      .dam-life-grid {
        display: grid;
        gap: 14px;
      }

      .dam-life-grid--metrics {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .dam-life-grid--four {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .dam-life-grid--three {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .dam-life-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dam-life-section {
        display: grid;
        gap: 18px;
        padding: 22px;
      }

      .dam-life-section__head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .dam-life-section h2 {
        font-size: clamp(1.4rem, 2vw, 2rem);
        letter-spacing: -0.04em;
      }

      .dam-life-subpanel,
      .dam-life-metric {
        display: grid;
        gap: 10px;
        padding: 16px;
        border: 1px solid rgba(174, 196, 238, 0.1);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
      }

      .dam-life-metric span {
        color: rgba(216, 231, 255, 0.72);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-life-metric strong,
      .dam-life-big {
        color: #f4f8ff;
        font-size: clamp(1.45rem, 2vw, 2.2rem);
        line-height: 1;
        letter-spacing: -0.05em;
      }

      .dam-life-metric--alert {
        border-color: rgba(255, 126, 126, 0.2);
        background: linear-gradient(180deg, rgba(83, 18, 18, 0.22), rgba(255, 255, 255, 0.02));
      }

      .dam-life-chart {
        display: grid;
        gap: 10px;
      }

      .dam-life-chart__row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 140px;
        gap: 12px;
        align-items: center;
      }

      .dam-life-chart__row > span {
        color: rgba(216, 231, 255, 0.72);
        font-size: 12px;
      }

      .dam-life-chart__tracks {
        display: grid;
        gap: 6px;
      }

      .dam-life-chart__track {
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        overflow: hidden;
      }

      .dam-life-chart__fill {
        height: 100%;
        border-radius: 999px;
      }

      .dam-life-chart__fill--claims {
        background: linear-gradient(90deg, #79b8ff, #c5ddff);
      }

      .dam-life-chart__fill--sessions {
        background: linear-gradient(90deg, #6ce0ab, #c1ffe4);
      }

      .dam-life-chart__meta {
        display: grid;
        gap: 4px;
        justify-items: end;
        color: rgba(216, 231, 255, 0.72);
        font-size: 12px;
      }

      .dam-life-list,
      .dam-life-bullet-block,
      .dam-life-statements {
        display: grid;
        gap: 10px;
      }

      .dam-life-list__row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(174, 196, 238, 0.08);
      }

      .dam-life-list__row:last-child {
        border-bottom: 0;
      }

      .dam-life-list__row div {
        display: grid;
        gap: 4px;
      }

      .dam-life-list__row strong {
        color: #f4f8ff;
        font-size: 14px;
      }

      .dam-life-list__row span {
        color: rgba(216, 231, 255, 0.72);
        font-size: 13px;
      }

      .dam-life-table-shell {
        overflow-x: auto;
        border: 1px solid rgba(174, 196, 238, 0.1);
        border-radius: 18px;
      }

      .dam-life-table {
        width: 100%;
        border-collapse: collapse;
      }

      .dam-life-table th,
      .dam-life-table td {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(174, 196, 238, 0.08);
        color: rgba(216, 231, 255, 0.86);
        font-size: 13px;
        text-align: left;
        vertical-align: top;
      }

      .dam-life-table th {
        color: rgba(216, 231, 255, 0.62);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: rgba(255, 255, 255, 0.03);
      }

      .dam-life-table tr:last-child td {
        border-bottom: 0;
      }

      .dam-life-empty,
      .dam-life-empty-block {
        color: rgba(216, 231, 255, 0.62);
        font-size: 14px;
      }

      .dam-life-empty-block {
        padding: 12px 0;
      }

      .dam-life-claim {
        max-width: 40ch;
      }

      .dam-life-banner {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(255, 190, 110, 0.22);
        background: rgba(116, 74, 10, 0.16);
        color: #ffd396;
      }

      .dam-life-auth {
        display: grid;
        place-items: center;
        min-height: calc(100vh - 180px);
      }

      .dam-life-auth__card {
        width: min(560px, 100%);
        display: grid;
        gap: 18px;
        padding: 24px;
      }

      .dam-life-auth__form {
        display: grid;
        gap: 12px;
      }

      .dam-life-auth__form label {
        color: rgba(216, 231, 255, 0.72);
        font-size: 13px;
        font-weight: 700;
      }

      .dam-life-auth__form input {
        width: 100%;
        height: 44px;
        padding: 0 14px;
        border: 1px solid rgba(174, 196, 238, 0.14);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        color: #f4f8ff;
      }

      @media (max-width: 960px) {
        .dam-life-hero,
        .dam-life-grid--two {
          grid-template-columns: 1fr;
        }

        .dam-life-chart__row {
          grid-template-columns: 64px minmax(0, 1fr);
        }

        .dam-life-chart__meta {
          grid-column: 2;
          justify-items: start;
        }
      }

      @media (max-width: 720px) {
        .dam-life-topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .dam-life-hero,
        .dam-life-section,
        .dam-life-auth__card {
          padding: 18px;
          border-radius: 20px;
        }

        .dam-life-grid--metrics,
        .dam-life-grid--three,
        .dam-life-grid--four {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  )
}
