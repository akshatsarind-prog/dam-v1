'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import DamBrandMark from '@/components/brand/DamBrandMark'
import type {
  AdminClaimCategory,
  AdminClaimRecord,
  AdminFunnelStage,
  AdminMetricsResponse,
  AdminTrafficSourceRecord,
  CategoryIntelligence,
  ExecutiveSnapshot,
  OperatorRecommendation,
  RetentionIntelligence,
} from '@/lib/admin/adminMetricsTypes'

const SESSION_STORAGE_KEY = 'dam_admin_password'

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

type AdminMetricsGateRenderState = {
  isRefreshing: boolean
  errorMessage: string
  logout: () => void
  refresh: () => void
}

type AdminMetricsGateProps = {
  title: string
  description: string
  homeHref?: string
  showHomeLink?: boolean
  loginEyebrow?: string
  render: (metrics: AdminMetricsResponse, state: AdminMetricsGateRenderState) => ReactNode
}

export type AdminSectionLink = {
  href: string
  title: string
  eyebrow: string
  description: string
}

const shellStyle = {
  paddingBottom: 48,
} as const

const headerWrapStyle = {
  width: 'min(1200px, calc(100% - 40px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  paddingTop: 26,
} as const

const contentWrapStyle = {
  width: 'min(1200px, calc(100% - 40px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  display: 'grid',
  gap: 16,
  paddingTop: 20,
} as const

const compactGridStyle = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
} as const

const subtlePanelStyle = {
  display: 'grid',
  gap: 12,
} as const

const metricListStyle = {
  display: 'grid',
  gap: 8,
} as const

const helperCopyStyle = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 12,
  lineHeight: 1.55,
} as const

const claimTextClampStyle = {
  maxWidth: '38ch',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical' as const,
} as const

const recommendationListStyle = {
  display: 'grid',
  gap: 12,
} as const

const healthUnavailableListStyle = {
  margin: 0,
  paddingLeft: 18,
  color: 'var(--muted)',
  fontSize: 12,
  lineHeight: 1.6,
} as const

const adminHomeCardGridStyle = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} as const

export const adminSectionLinks: AdminSectionLink[] = [
  {
    href: '/admin/executive',
    title: 'Executive Snapshot',
    eyebrow: 'Core read',
    description: 'Top-line health, usage volume, repeat behavior, and current system state.',
  },
  {
    href: '/admin/daily',
    title: 'Daily Intelligence',
    eyebrow: 'Automation layer',
    description: 'Today-only operating read across growth, product, and reliability signals.',
  },
  {
    href: '/admin/funnel',
    title: 'Funnel',
    eyebrow: 'Acquisition path',
    description: 'Tracked and manual stages from distributed reach through claim and signup.',
  },
  {
    href: '/admin/sources',
    title: 'Traffic Sources',
    eyebrow: 'Attribution',
    description: 'Source, medium, campaign, session quality, and email capture linkage.',
  },
  {
    href: '/admin/retention',
    title: 'Retention',
    eyebrow: 'Repeat behavior',
    description: 'Returning sessions, claim depth, high-intent sessions, and repeat usage signals.',
  },
  {
    href: '/admin/categories',
    title: 'Claim Categories',
    eyebrow: 'Usage mix',
    description: 'What people are testing, confidence by category, and latest category examples.',
  },
  {
    href: '/admin/health',
    title: 'Operational Health',
    eyebrow: 'Reliability',
    description: 'Latency, evidence retrieval quality, low-confidence rows, and slowest claims.',
  },
  {
    href: '/admin/claims',
    title: 'Recent Claims',
    eyebrow: 'Latest rows',
    description: 'Newest claim logs with verdict, confidence, risk, latency, and attribution.',
  },
  {
    href: '/admin/recommendations',
    title: 'Recommendations',
    eyebrow: 'Operator guidance',
    description: 'Metrics-derived next actions from the current admin intelligence layer.',
  },
  {
    href: '/admin/lifetime',
    title: 'Lifetime Intelligence',
    eyebrow: 'Founder system',
    description: 'Company-wide lifetime view across growth, behavior, trust, reliability, and coverage.',
  },
]

export function formatDateTime(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed.toLocaleString()
}

export function formatCount(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return new Intl.NumberFormat('en-US').format(value)
}

export function formatLatency(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return `${Math.round(value)} ms`
}

export function formatRate(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

export function formatDecimal(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

export function formatCategoryLabel(category: AdminClaimCategory) {
  switch (category) {
    case 'social_rumor':
      return 'Social rumor'
    default:
      return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  }
}

export function formatText(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : fallback
}

export function shortenId(value: string | null | undefined) {
  if (!value) {
    return 'No data yet'
  }

  return value.length <= 14 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
}

function computeRateFromCounts(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator <= 0
  ) {
    return null
  }

  return numerator / denominator
}

function getStatusLabel(status: ExecutiveSnapshot['status']) {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'watch':
      return 'Watch'
    default:
      return 'Needs attention'
  }
}

function getStatusBadgeClass(status: ExecutiveSnapshot['status']) {
  switch (status) {
    case 'healthy':
      return 'dam-admin-badge'
    case 'watch':
      return 'dam-admin-badge dam-admin-badge--warning'
    default:
      return 'dam-admin-badge dam-admin-badge--danger'
  }
}

function getPriorityBadgeClass(priority: OperatorRecommendation['priority']) {
  switch (priority) {
    case 'high':
      return 'dam-admin-badge dam-admin-badge--danger'
    case 'medium':
      return 'dam-admin-badge dam-admin-badge--warning'
    default:
      return 'dam-admin-badge'
  }
}

function getTrackingBadgeClass(status: AdminFunnelStage['status']) {
  switch (status) {
    case 'tracked':
      return 'dam-admin-badge'
    case 'manual':
      return 'dam-admin-badge dam-admin-badge--warning'
    default:
      return 'dam-admin-badge dam-admin-badge--danger'
  }
}

function getTrackingLabel(stage: AdminFunnelStage) {
  switch (stage.status) {
    case 'tracked':
      return 'Tracked'
    case 'manual':
      return stage.manualBaseline ? 'Manual baseline' : 'Manual'
    default:
      return 'Not tracked yet'
  }
}

function getConfidenceBadgeStyle(confidence: number): CSSProperties {
  if (confidence < 60) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.58)',
      background: 'rgba(214, 38, 38, 0.15)',
      color: '#ffb1b1',
    }
  }

  if (confidence < 80) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.32)',
      background: 'rgba(214, 38, 38, 0.07)',
      color: '#e7bcbc',
    }
  }

  return {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
  }
}

function getRiskBadgeStyle(riskLabel: string): CSSProperties {
  const normalized = riskLabel.toLowerCase()

  if (normalized.includes('high') || normalized.includes('severe')) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.58)',
      background: 'rgba(214, 38, 38, 0.15)',
      color: '#ffb1b1',
    }
  }

  if (normalized.includes('medium')) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.32)',
      background: 'rgba(214, 38, 38, 0.07)',
      color: '#e7bcbc',
    }
  }

  return {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
  }
}

function getClaimRowStyle(claim: AdminClaimRecord): CSSProperties | undefined {
  const risk = claim.riskLabel.toLowerCase()

  if (risk.includes('high') || risk.includes('severe')) {
    return {
      background: 'rgba(214, 38, 38, 0.08)',
    }
  }

  if (claim.confidence < 60) {
    return {
      background: 'rgba(214, 38, 38, 0.04)',
    }
  }

  if (claim.latencyMs >= 8000) {
    return {
      background: 'rgba(255, 255, 255, 0.02)',
    }
  }

  return undefined
}

function getTrafficBucketLabel(value: string, fallback: string) {
  if (!value || value === 'unattributed') {
    return fallback
  }

  if (value === 'not set') {
    return 'Not set'
  }

  return value
}

function renderAttribution(claim: AdminClaimRecord) {
  if (!claim.attributed) {
    return 'Unattributed'
  }

  const source = claim.utmSource ?? claim.referrer ?? 'Direct / tracked'
  const campaign = claim.utmCampaign ?? 'Not set'
  return `${source} / ${campaign}`
}

export function AdminMetricsGate({
  title,
  description,
  homeHref = '/admin',
  showHomeLink = true,
  loginEyebrow = 'Founder dashboard',
  render,
}: AdminMetricsGateProps) {
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
      <main className="dam-shell" style={shellStyle}>
        <div style={headerWrapStyle}>
          <header
            className="dam-header"
            style={{
              height: 'auto',
              minHeight: 72,
              padding: '14px 0',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <Link className="dam-mark" href="/" aria-label="Return to DAM home">
              <DamBrandMark collapseTextOnNarrow />
            </Link>
            <span className="dam-admin-header-pill">Private admin</span>
          </header>
        </div>

        <div style={contentWrapStyle}>
          <section className="dam-admin-auth-shell" style={{ minHeight: 'auto', padding: 0 }}>
            <div className="dam-admin-auth-card">
              <div>
                <p className="system-label" style={{ marginBottom: 12 }}>
                  <span aria-hidden="true" />
                  {loginEyebrow}
                </p>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="dam-admin-auth-form">
                <label className="dam-admin-auth-form__label" htmlFor="admin-password">
                  Admin password
                </label>
                <input
                  id="admin-password"
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
            </div>
          </section>
        </div>
      </main>
    )
  }

  const metrics = state.metrics

  return (
    <main className="dam-shell" style={shellStyle}>
      <div style={headerWrapStyle}>
        <header
          className="dam-header"
          style={{
            height: 'auto',
            minHeight: 72,
            padding: '14px 0',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Link className="dam-mark" href="/" aria-label="Return to DAM home">
            <DamBrandMark collapseTextOnNarrow />
          </Link>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span className="dam-admin-header-pill">Private admin</span>
            {showHomeLink ? (
              <Link href={homeHref} className="dam-admin-action-button">
                Admin Home
              </Link>
            ) : null}
            <Link href="/admin/lifetime" className="dam-admin-action-button">
              Lifetime
            </Link>
            <button
              type="button"
              onClick={() =>
                void loadMetrics(state.password, {
                  persist: false,
                })
              }
              className="dam-admin-action-button"
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" onClick={handleLogout} className="dam-admin-action-button">
              Logout
            </button>
          </div>
        </header>
      </div>

      <div style={contentWrapStyle}>
        {metrics.error?.code === 'misconfigured' ? (
          <div className="dam-admin-alert dam-admin-alert--warning">
            Admin metrics are not configured. Check the existing Supabase admin environment
            variables before trusting this dashboard.
          </div>
        ) : null}

        {metrics.error && metrics.error.code !== 'misconfigured' ? (
          <div className="dam-admin-alert">{metrics.error.message}</div>
        ) : null}

        {state.errorMessage ? <div className="dam-admin-alert">{state.errorMessage}</div> : null}

        {render(metrics, {
          isRefreshing: state.status === 'loading',
          errorMessage: state.errorMessage,
          logout: handleLogout,
          refresh: () =>
            void loadMetrics(state.password, {
              persist: false,
            }),
        })}
      </div>
    </main>
  )
}

export function AdminHomeCardGrid({ generatedAt }: { generatedAt: string }) {
  return (
    <>
      <section className="dam-admin-header-card">
        <div className="dam-admin-header-card__copy">
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Private admin
          </p>
          <h1>DAM admin home</h1>
          <p>
            Minimal navigation hub for the DAM admin surfaces. Choose a section to inspect its own
            metrics page.
          </p>
        </div>
        <div className="dam-admin-header-card__actions">
          <div className="dam-admin-inline-meta">
            <span className="dam-admin-header-pill">Updated {formatDateTime(generatedAt)}</span>
          </div>
        </div>
      </section>

      <section className="dam-admin-card dam-admin-section">
        <SectionHeading
          id="hub"
          eyebrow="Section navigation"
          title="Admin Sections"
          description="Each route loads its own slice of the existing admin metrics response. No long-scrolling all-in-one dashboard remains on this page."
        />
        <div style={adminHomeCardGridStyle}>
          {adminSectionLinks.map((section) => (
            <Link key={section.href} href={section.href} className="dam-admin-subcard">
              <p className="system-label" style={{ marginBottom: 10 }}>
                <span aria-hidden="true" />
                {section.eyebrow}
              </p>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  badge,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  badge?: ReactNode
}) {
  return (
    <div className="dam-admin-section-heading" id={id}>
      <p className="system-label" style={{ marginBottom: 10 }}>
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <div className="dam-admin-section-heading__title-row">
        <h2>{title}</h2>
        {badge ? badge : null}
      </div>
      <p>{description}</p>
    </div>
  )
}

export function MetricCard({
  label,
  value,
  note,
  emphasize = false,
}: {
  label: string
  value: string
  note: string
  emphasize?: boolean
}) {
  return (
    <article className={`dam-admin-metric-card${emphasize ? ' dam-admin-metric-card--red' : ''}`}>
      <span className="dam-admin-metric-card__label">{label}</span>
      <strong className="dam-admin-metric-card__value">{value}</strong>
      <p className="dam-admin-metric-card__note">{note}</p>
    </article>
  )
}

export function SummaryList({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <article className="dam-admin-subcard" style={subtlePanelStyle}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </article>
  )
}

function EmptyTableRow({ colSpan, copy }: { colSpan: number; copy: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="dam-admin-table__empty">
        {copy}
      </td>
    </tr>
  )
}

function FunnelTable({ stages }: { stages: AdminFunnelStage[] }) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Count</th>
            <th>Tracking</th>
            <th>Source</th>
            <th>Conversion From Previous</th>
          </tr>
        </thead>
        <tbody>
          {stages.length ? (
            stages.map((stage) => (
              <tr key={stage.key}>
                <td>{stage.label}</td>
                <td>{formatCount(stage.count, 'Not tracked yet')}</td>
                <td>
                  <span className={getTrackingBadgeClass(stage.status)}>{getTrackingLabel(stage)}</span>
                </td>
                <td>{stage.sourceLabel}</td>
                <td>{formatRate(stage.conversionFromPrevious, 'Not tracked yet')}</td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={5} copy="No data yet." />
          )}
        </tbody>
      </table>
    </div>
  )
}

function TrafficSourcesTable({ rows }: { rows: AdminTrafficSourceRecord[] }) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Medium</th>
            <th>Campaign</th>
            <th>Sessions</th>
            <th>Claims</th>
            <th>Claims / Session</th>
            <th>Email Captures</th>
            <th>Emails / Claim</th>
            <th>Latest Claim</th>
            <th>Read</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                <td>{getTrafficBucketLabel(row.source, 'Unattributed')}</td>
                <td>{row.source === 'unattributed' ? 'Unattributed' : getTrafficBucketLabel(row.medium, 'None')}</td>
                <td>{row.source === 'unattributed' ? 'Unattributed bucket' : getTrafficBucketLabel(row.campaign, 'Not set')}</td>
                <td>{formatCount(row.uniqueSessions)}</td>
                <td>{formatCount(row.claimSubmissions)}</td>
                <td>{formatDecimal(row.claimsPerSession)}</td>
                <td>{formatCount(row.emailCaptures)}</td>
                <td>{formatRate(computeRateFromCounts(row.emailCaptures, row.claimSubmissions), 'Not tracked yet')}</td>
                <td>{formatDateTime(row.latestClaimAt)}</td>
                <td>{row.interpretation}</td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={10} copy="No data yet." />
          )}
        </tbody>
      </table>
    </div>
  )
}

function HighIntentSessionsTable({ retention }: { retention: RetentionIntelligence }) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            <th>Session</th>
            <th>Visitor</th>
            <th>Claims</th>
            <th>Source</th>
            <th>Campaign</th>
            <th>First Seen</th>
            <th>Last Seen</th>
            <th>Returning</th>
            <th>Email Captured</th>
          </tr>
        </thead>
        <tbody>
          {retention.highIntentSessions.length ? (
            retention.highIntentSessions.map((session) => (
              <tr key={session.sessionId}>
                <td>{shortenId(session.sessionId)}</td>
                <td>{shortenId(session.visitorId)}</td>
                <td>{formatCount(session.claimCount)}</td>
                <td>{formatText(session.source, 'Unattributed')}</td>
                <td>{formatText(session.campaign, 'Not set')}</td>
                <td>{formatDateTime(session.firstSeenAt)}</td>
                <td>{formatDateTime(session.lastSeenAt)}</td>
                <td>{session.isReturning ? 'Yes' : 'No'}</td>
                <td>{session.emailCaptured ? 'Yes' : 'No'}</td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={9} copy="No data yet." />
          )}
        </tbody>
      </table>
    </div>
  )
}

function CategoriesTable({ categoryIntelligence }: { categoryIntelligence: CategoryIntelligence }) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
            <th>Share</th>
            <th>Avg Confidence</th>
            <th>Avg Latency</th>
            <th>Avg Sources</th>
            <th>Top Source / Campaign</th>
            <th>Latest Example</th>
          </tr>
        </thead>
        <tbody>
          {categoryIntelligence.categoryBreakdown.length ? (
            categoryIntelligence.categoryBreakdown.map((row) => (
              <tr key={row.category}>
                <td>{formatCategoryLabel(row.category)}</td>
                <td>{formatCount(row.count)}</td>
                <td>{formatRate(row.percentage)}</td>
                <td>{row.averageConfidence.toFixed(1)}</td>
                <td>{formatLatency(row.averageLatencyMs)}</td>
                <td>{formatDecimal(row.averageSourceCount)}</td>
                <td>
                  {row.topSource || row.topCampaign
                    ? `${formatText(row.topSource, 'Unattributed')} / ${formatText(row.topCampaign, 'Not set')}`
                    : 'Unattributed'}
                </td>
                <td>
                  <div style={metricListStyle}>
                    <div style={claimTextClampStyle}>{formatText(row.latestClaimText)}</div>
                    <span>{formatDateTime(row.latestClaimAt)}</span>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={8} copy="No data yet." />
          )}
        </tbody>
      </table>
    </div>
  )
}

function ClaimsTable({
  claims,
  includeSession = false,
}: {
  claims: AdminClaimRecord[]
  includeSession?: boolean
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Claim</th>
            <th>Verdict</th>
            <th>Confidence</th>
            <th>Risk / Category</th>
            <th>Latency</th>
            <th>Sources</th>
            <th>Attribution</th>
            {includeSession ? <th>Session</th> : null}
          </tr>
        </thead>
        <tbody>
          {claims.length ? (
            claims.map((claim, index) => (
              <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${index}`} style={getClaimRowStyle(claim)}>
                <td>{formatDateTime(claim.createdAt)}</td>
                <td>
                  <div style={claimTextClampStyle}>{formatText(claim.claimText, 'No claim text logged.')}</div>
                </td>
                <td>
                  <span className="dam-admin-row-badge">{formatText(claim.verdict, 'Unknown')}</span>
                </td>
                <td>
                  <span className="dam-admin-row-badge" style={getConfidenceBadgeStyle(claim.confidence)}>
                    {claim.confidence}
                  </span>
                </td>
                <td>
                  <div style={metricListStyle}>
                    <span className="dam-admin-row-badge" style={getRiskBadgeStyle(claim.riskLabel)}>
                      {claim.riskLabel}
                    </span>
                    <span>{formatCategoryLabel(claim.category)}</span>
                  </div>
                </td>
                <td>{formatLatency(claim.latencyMs)}</td>
                <td>{formatCount(claim.sourceCount, 'No data yet')}</td>
                <td>{renderAttribution(claim)}</td>
                {includeSession ? <td>{shortenId(claim.sessionId)}</td> : null}
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={includeSession ? 9 : 8} copy="No data yet." />
          )}
        </tbody>
      </table>
    </div>
  )
}

function RecommendationList({ recommendations }: { recommendations: OperatorRecommendation[] }) {
  if (!recommendations.length) {
    return <div className="dam-admin-placeholder">No data yet.</div>
  }

  return (
    <div style={recommendationListStyle}>
      {recommendations.map((recommendation) => (
        <article key={`${recommendation.priority}-${recommendation.title}`} className="dam-admin-subcard">
          <div className="dam-admin-inline-meta" style={{ marginBottom: 12 }}>
            <span className={getPriorityBadgeClass(recommendation.priority)}>{recommendation.priority}</span>
          </div>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.detail}</p>
        </article>
      ))}
    </div>
  )
}

export function ExecutiveSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const executive = metrics.executiveSnapshot
  const retention = metrics.retentionIntelligence
  const health = metrics.operationalHealth
  const emails = metrics.emailCaptureIntelligence
  const lastUpdatedLabel = formatDateTime(metrics.generatedAt)

  const executiveCards = [
    {
      label: 'Total claims',
      value: formatCount(executive.totalClaims),
      note: 'All logged analyzer claim rows',
      emphasize: false,
    },
    {
      label: 'Total sessions',
      value: formatCount(retention.uniqueSessions),
      note: 'Unique sessions seen across logs',
      emphasize: false,
    },
    {
      label: 'Returning sessions',
      value: formatCount(retention.returningSessions),
      note: formatRate(retention.returningSessionRate, 'No data yet'),
      emphasize: retention.returningSessionRate !== null && retention.returningSessionRate < 0.15,
    },
    {
      label: 'Email captures',
      value: formatCount(executive.emailCaptures),
      note: emails.linkable ? emails.note : 'Tracked beta signups',
      emphasize: false,
    },
    {
      label: 'Average latency',
      value: formatLatency(health.averageLatencyMs),
      note: `P95 ${formatLatency(health.p95LatencyMs)}`,
      emphasize: health.averageLatencyMs >= 7000,
    },
    {
      label: 'Latest claim time',
      value: formatDateTime(executive.lastClaimAt),
      note: 'Most recent claim log timestamp',
      emphasize: false,
    },
    {
      label: 'System status',
      value: getStatusLabel(executive.status),
      note: `Updated ${lastUpdatedLabel}`,
      emphasize: executive.status !== 'healthy',
    },
  ]

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="executive"
        eyebrow="Executive snapshot"
        title="Executive Snapshot"
        description="The fastest read on usage volume, system state, and whether the product is creating repeat behavior."
        badge={<span className={getStatusBadgeClass(executive.status)}>{getStatusLabel(executive.status)}</span>}
      />
      <section className="dam-admin-summary-grid">
        {executiveCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            note={card.note}
            emphasize={card.emphasize}
          />
        ))}
      </section>
    </section>
  )
}

export function DailySection({ metrics }: { metrics: AdminMetricsResponse }) {
  const automation = metrics.automationIntelligence

  const automationSnapshotCards = [
    {
      label: 'Claims today',
      value: formatCount(automation.dailySnapshot.claimsToday),
      note: 'Claim rows created since local midnight',
      emphasize: automation.dailySnapshot.claimsToday === 0,
    },
    {
      label: 'Sessions today',
      value: formatCount(automation.dailySnapshot.sessionsToday),
      note: 'Sessions active since local midnight',
      emphasize: false,
    },
    {
      label: 'Emails today',
      value: formatCount(automation.dailySnapshot.emailsToday),
      note: 'Captured beta signups today',
      emphasize: false,
    },
    {
      label: 'Returning sessions today',
      value: formatCount(automation.dailySnapshot.returningSessionsToday),
      note: 'Returning-session activity today',
      emphasize: false,
    },
    {
      label: 'Average latency today',
      value: formatLatency(automation.dailySnapshot.averageLatencyMs),
      note: 'Mean latency for today only',
      emphasize: (automation.dailySnapshot.averageLatencyMs ?? 0) >= 7000,
    },
    {
      label: 'Top source today',
      value: formatText(automation.dailySnapshot.topSourceToday, 'No data yet'),
      note: 'Highest claim volume source today',
      emphasize: false,
    },
    {
      label: 'Top category today',
      value: automation.dailySnapshot.topCategoryToday
        ? formatCategoryLabel(automation.dailySnapshot.topCategoryToday)
        : 'No data yet',
      note: 'Most tested category today',
      emphasize: false,
    },
  ]

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="automation"
        eyebrow="Derived daily operator layer"
        title="Automation / Daily Intelligence"
        description="A compact daily read built from the existing Supabase claim, event, and beta-user tables only."
        badge={<span className="dam-admin-badge">Derived from existing data</span>}
      />
      <section className="dam-admin-summary-grid">
        {automationSnapshotCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            note={card.note}
            emphasize={card.emphasize}
          />
        ))}
      </section>
      <section style={compactGridStyle}>
        <SummaryList
          title="Growth signal"
          description="Traffic quality, attribution health, and short-window momentum."
        >
          <div style={metricListStyle}>
            <p style={helperCopyStyle}>
              Best source by claims: {automation.growthSignals.bestTrafficSourceByClaims?.label ?? 'No data yet'}
            </p>
            <p style={helperCopyStyle}>
              Best source by emails:{' '}
              {automation.growthSignals.bestTrafficSourceByEmails
                ? `${automation.growthSignals.bestTrafficSourceByEmails.source} / ${automation.growthSignals.bestTrafficSourceByEmails.campaign}`
                : 'No data yet'}
            </p>
            <p style={helperCopyStyle}>
              Unattributed traffic: {formatRate(automation.growthSignals.unattributedTrafficPercentage)}
            </p>
            <p style={helperCopyStyle}>
              Repeat-session trend: {automation.growthSignals.repeatSessionTrend.summary}
            </p>
            <p style={helperCopyStyle}>
              Claim-submission trend: {automation.growthSignals.claimSubmissionsTrend.summary}
            </p>
          </div>
        </SummaryList>
        <SummaryList
          title="Product signal"
          description="What people are testing, where confidence is weakest, and which sessions look intent-heavy."
        >
          <div style={metricListStyle}>
            <p style={helperCopyStyle}>
              Most tested category:{' '}
              {automation.productSignals.mostTestedCategory
                ? formatCategoryLabel(automation.productSignals.mostTestedCategory.category)
                : 'No data yet'}
            </p>
            <p style={helperCopyStyle}>
              Lowest-confidence category:{' '}
              {automation.productSignals.lowestConfidenceCategory
                ? formatCategoryLabel(automation.productSignals.lowestConfidenceCategory.category)
                : 'No data yet'}
            </p>
            <p style={helperCopyStyle}>
              Slowest category:{' '}
              {automation.productSignals.slowestCategory
                ? formatCategoryLabel(automation.productSignals.slowestCategory.category)
                : 'No data yet'}
            </p>
            <p style={helperCopyStyle}>
              Sessions with multiple claims: {formatCount(automation.productSignals.sessionsWithMultipleClaims)}
            </p>
            <div className="dam-admin-analysis-list">
              {automation.productSignals.recentHighIntentSessions.length ? (
                automation.productSignals.recentHighIntentSessions.map((session) => (
                  <div key={session.sessionId} className="dam-admin-placeholder">
                    {`${shortenId(session.sessionId)} • ${formatCount(session.claimCount)} claims • ${formatText(session.source, 'Unattributed')}`}
                  </div>
                ))
              ) : (
                <div className="dam-admin-placeholder">No data yet.</div>
              )}
            </div>
          </div>
        </SummaryList>
        <SummaryList
          title="Reliability signal"
          description="Operational quality checks from the currently exposed admin metrics only."
        >
          <div style={metricListStyle}>
            <p style={helperCopyStyle}>
              Claims over 8 seconds: {formatCount(automation.reliabilitySignals.claimsOver8Seconds)}
            </p>
            <p style={helperCopyStyle}>
              Missing attribution rows: {formatCount(automation.reliabilitySignals.missingAttributionRows)}
            </p>
            <p style={helperCopyStyle}>
              Unknown verdict rows: {formatCount(automation.reliabilitySignals.unknownVerdictRows)}
            </p>
            <p style={helperCopyStyle}>
              Unknown risk rows: {formatCount(automation.reliabilitySignals.unknownRiskRows)}
            </p>
            <p style={helperCopyStyle}>
              Empty claim text rows: {formatCount(automation.reliabilitySignals.emptyClaimTextRows)}
            </p>
            <div className="dam-admin-analysis-list">
              {automation.reliabilitySignals.lowConfidenceClusters.length ? (
                automation.reliabilitySignals.lowConfidenceClusters.map((cluster) => (
                  <div key={cluster.category} className="dam-admin-placeholder">
                    {`${formatCategoryLabel(cluster.category)} • ${formatCount(cluster.count)} low-confidence claims • avg ${cluster.averageConfidence.toFixed(1)}`}
                  </div>
                ))
              ) : (
                <div className="dam-admin-placeholder">No low-confidence clusters yet.</div>
              )}
            </div>
          </div>
        </SummaryList>
        <SummaryList
          title="Recommended next action"
          description="Derived from the daily automation layer only."
        >
          {automation.recommendedNextAction ? (
            <div style={metricListStyle}>
              <div className="dam-admin-inline-meta">
                <span className={getPriorityBadgeClass(automation.recommendedNextAction.priority)}>
                  {automation.recommendedNextAction.priority}
                </span>
              </div>
              <h3 style={{ margin: 0 }}>{automation.recommendedNextAction.title}</h3>
              <p style={helperCopyStyle}>{automation.recommendedNextAction.detail}</p>
              {automation.recommendations.length > 1 ? (
                <div className="dam-admin-analysis-list">
                  {automation.recommendations.slice(1, 4).map((recommendation) => (
                    <div
                      key={`${recommendation.priority}-${recommendation.title}`}
                      className="dam-admin-placeholder"
                    >
                      {recommendation.title}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="dam-admin-placeholder">No data yet.</div>
          )}
        </SummaryList>
      </section>
    </section>
  )
}

export function FunnelSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const funnel = metrics.funnelIntelligence

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="funnel"
        eyebrow="Acquisition to signup"
        title="Funnel"
        description="Manual reach baselines remain visible where tracking is not available, while tracked stages stay clearly labeled."
        badge={<span className="dam-admin-badge">{formatCount(funnel.stages.length)} stages</span>}
      />
      <section className="dam-admin-mini-grid">
        <MetricCard
          label="Biggest drop-off"
          value={funnel.biggestDropOff?.label ?? 'No data yet'}
          note={formatRate(funnel.biggestDropOff?.conversion, 'No data yet')}
        />
        <MetricCard
          label="Strongest retained stage"
          value={funnel.strongestRetainedStage?.label ?? 'No data yet'}
          note={formatRate(funnel.strongestRetainedStage?.conversion, 'No data yet')}
        />
        <MetricCard
          label="Best source"
          value={funnel.bestSource?.label ?? 'No data yet'}
          note={
            funnel.bestSource
              ? `${formatCount(funnel.bestSource.claimSubmissions)} claim submissions`
              : 'No source winner yet'
          }
        />
      </section>
      <FunnelTable stages={funnel.stages} />
      <SummaryList
        title="Funnel read"
        description="This recommendation comes directly from the current funnel shape, not a hard-coded playbook."
      >
        <p style={helperCopyStyle}>{funnel.nextRecommendedAction}</p>
      </SummaryList>
    </section>
  )
}

export function SourcesSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const sources = metrics.trafficSourceIntelligence
  const emails = metrics.emailCaptureIntelligence

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="sources"
        eyebrow="Attribution and traffic quality"
        title="Traffic Sources"
        description="Source rows merge claim, event, and signup context where it exists. Old null-attribution rows stay visible as unattributed."
        badge={<span className="dam-admin-badge">{formatCount(sources.rows.length)} rows</span>}
      />
      <section className="dam-admin-mini-grid">
        <MetricCard
          label="Best source by claims"
          value={sources.bestSourceByClaims?.label ?? 'No data yet'}
          note={
            sources.bestSourceByClaims
              ? `${formatCount(sources.bestSourceByClaims.claimSubmissions)} claims`
              : sources.note
          }
        />
        <MetricCard
          label="Best source by claims / session"
          value={sources.bestSourceByClaimsPerSession?.label ?? 'No data yet'}
          note={
            sources.bestSourceByClaimsPerSession
              ? `${formatDecimal(sources.bestSourceByClaimsPerSession.claimsPerSession)} claims per session`
              : sources.note
          }
        />
        <MetricCard
          label="Unattributed claims"
          value={formatCount(sources.unattributedClaims)}
          note="Rows without source context stay in the unattributed bucket"
          emphasize={sources.unattributedClaims > 0}
        />
        <MetricCard
          label="Email linkage"
          value={emails.linkable ? 'Linked' : 'Not linked yet'}
          note={emails.note}
        />
      </section>
      <TrafficSourcesTable rows={sources.rows} />
    </section>
  )
}

export function RetentionSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const retention = metrics.retentionIntelligence

  const retentionCards = [
    {
      label: 'First-time sessions',
      value: formatCount(retention.firstTimeSessions),
      note: 'Sessions without a return signal yet',
    },
    {
      label: 'Returning sessions',
      value: formatCount(retention.returningSessions),
      note: 'Sessions with repeat-use evidence',
    },
    {
      label: 'Returning session rate',
      value: formatRate(retention.returningSessionRate),
      note: 'Returning sessions divided by total sessions',
    },
    {
      label: 'Repeat-claim sessions',
      value: formatCount(retention.repeatClaimSessions),
      note: 'Sessions with repeat claims across visits',
    },
    {
      label: 'Claims per session',
      value: formatDecimal(retention.averageClaimsPerSession),
      note: 'Average claim depth per session',
    },
  ]

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="retention"
        eyebrow="Repeat behavior"
        title="Retention"
        description="These metrics show whether sessions are coming back and whether repeat claim behavior is emerging."
        badge={<span className="dam-admin-badge">{formatCount(retention.highIntentSessions.length)} high-intent sessions</span>}
      />
      <section className="dam-admin-mini-grid">
        {retentionCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
        ))}
      </section>
      <section style={compactGridStyle}>
        <SummaryList
          title="Automatic interpretation"
          description="These lines come from current metrics only."
        >
          <div className="dam-admin-analysis-list">
            {retention.interpretation.length ? (
              retention.interpretation.map((line) => (
                <div key={line} className="dam-admin-placeholder">
                  {line}
                </div>
              ))
            ) : (
              <div className="dam-admin-placeholder">No data yet.</div>
            )}
          </div>
        </SummaryList>
        <SummaryList
          title="Supporting metrics"
          description="Additional depth behind the top-line retention read."
        >
          <div style={metricListStyle}>
            <p style={helperCopyStyle}>
              Sessions with 2+ claims: {formatCount(retention.sessionsWithTwoPlusClaims)}
            </p>
            <p style={helperCopyStyle}>
              Sessions with 3+ claims: {formatCount(retention.sessionsWithThreePlusClaims)}
            </p>
            <p style={helperCopyStyle}>
              Multi-day users: {formatCount(retention.multiDayUsers)}
            </p>
            <p style={helperCopyStyle}>
              Avg time per session: {formatLatency(retention.averageTimePerSessionMs, 'No data yet')}
            </p>
            <p style={helperCopyStyle}>
              Avg gap between sessions:{' '}
              {retention.averageTimeBetweenSessionsMs !== null
                ? formatLatency(retention.averageTimeBetweenSessionsMs)
                : 'No data yet'}
            </p>
          </div>
        </SummaryList>
      </section>
      <SummaryList
        title="High-intent sessions"
        description="Useful sessions to inspect when you want to understand repeat behavior, source quality, and whether signups come from high-intent traffic."
      >
        <HighIntentSessionsTable retention={retention} />
      </SummaryList>
    </section>
  )
}

export function CategoriesSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const categories = metrics.categoryIntelligence

  const categoryCards = [
    {
      label: 'Most tested category',
      value: categories.mostTestedCategory
        ? formatCategoryLabel(categories.mostTestedCategory.category)
        : 'No data yet',
      note: categories.mostTestedCategory
        ? `${formatRate(categories.mostTestedCategory.percentage)} of claims`
        : 'No category rows yet',
    },
    {
      label: 'Lowest confidence category',
      value: categories.lowestConfidenceCategory
        ? formatCategoryLabel(categories.lowestConfidenceCategory.category)
        : 'No data yet',
      note: categories.lowestConfidenceCategory
        ? categories.lowestConfidenceCategory.averageConfidence.toFixed(1)
        : 'No category rows yet',
    },
    {
      label: 'Highest latency category',
      value: categories.highestLatencyCategory
        ? formatCategoryLabel(categories.highestLatencyCategory.category)
        : 'No data yet',
      note: categories.highestLatencyCategory
        ? formatLatency(categories.highestLatencyCategory.averageLatencyMs)
        : 'No category rows yet',
    },
  ]

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="categories"
        eyebrow="Usage mix"
        title="Claim Categories"
        description="Category derivation remains analytics-only. Nothing in this section changes analyzer behavior."
        badge={<span className="dam-admin-badge">{formatCount(categories.categoryBreakdown.length)} categories</span>}
      />
      <section className="dam-admin-mini-grid">
        {categoryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
        ))}
      </section>
      <CategoriesTable categoryIntelligence={categories} />
    </section>
  )
}

export function HealthSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const health = metrics.operationalHealth

  const healthCards = [
    {
      label: 'Average latency',
      value: formatLatency(health.averageLatencyMs),
      note: 'Mean claim latency',
      emphasize: health.averageLatencyMs >= 7000,
    },
    {
      label: 'Median latency',
      value: formatLatency(health.medianLatencyMs),
      note: 'Typical claim latency',
      emphasize: false,
    },
    {
      label: 'P95 latency',
      value: formatLatency(health.p95LatencyMs),
      note: 'Tail latency',
      emphasize: (health.p95LatencyMs ?? 0) >= 10000,
    },
    {
      label: 'Average source count',
      value: formatDecimal(health.averageSourceCount),
      note: 'Average evidence count per claim',
      emphasize: false,
    },
    {
      label: 'Claims with zero sources',
      value: formatCount(health.claimsWithZeroSources),
      note: 'Evidence retrieval returned nothing',
      emphasize: health.claimsWithZeroSources > 0,
    },
    {
      label: 'Low-confidence claims',
      value: formatCount(health.lowConfidenceClaimsCount),
      note: 'Confidence under 60',
      emphasize: health.lowConfidenceClaimsCount > 0,
    },
  ]

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="health"
        eyebrow="Reliability and evidence quality"
        title="Operational Health"
        description="Use this section to judge whether latency, evidence coverage, or weak claim quality is the main operational problem."
        badge={<span className="dam-admin-badge">{formatCount(health.slowestClaims.length)} slowest claims</span>}
      />
      <section className="dam-admin-mini-grid">
        {healthCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            note={card.note}
            emphasize={card.emphasize}
          />
        ))}
      </section>
      <section style={compactGridStyle}>
        <SummaryList
          title="Health diagnostics"
          description="Counts that already exist in the current metrics response."
        >
          <div style={metricListStyle}>
            <p style={helperCopyStyle}>Claims over 8s: {formatCount(health.claimsOver8s)}</p>
            <p style={helperCopyStyle}>Claims over 12s: {formatCount(health.claimsOver12s)}</p>
            <p style={helperCopyStyle}>Latest claim: {formatDateTime(health.lastClaimAt)}</p>
            <p style={helperCopyStyle}>Latest event: {formatDateTime(health.lastEventAt)}</p>
          </div>
        </SummaryList>
        <SummaryList
          title="Unavailable diagnostics"
          description="These counts are not exposed by the current metrics API, so the UI does not invent them."
        >
          <ul style={healthUnavailableListStyle}>
            <li>Error counts: Not tracked yet</li>
            <li>Fallback counts: Not tracked yet</li>
            <li>Malformed output counts: Not tracked yet</li>
          </ul>
        </SummaryList>
      </section>
      <SummaryList
        title="Slowest claims"
        description="Tail latency first. These rows show the slowest claim requests currently visible to the metrics service."
      >
        <ClaimsTable claims={health.slowestClaims} includeSession />
      </SummaryList>
    </section>
  )
}

export function ClaimsSection({ metrics }: { metrics: AdminMetricsResponse }) {
  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="claims"
        eyebrow="Recent claim logs"
        title="Recent Claims"
        description="The latest claim rows, with attribution and session context where available."
        badge={<span className="dam-admin-badge">{formatCount(metrics.recentClaims.length)} rows</span>}
      />
      <ClaimsTable claims={metrics.recentClaims} includeSession />
    </section>
  )
}

export function RecommendationsSection({ metrics }: { metrics: AdminMetricsResponse }) {
  const recommendations = metrics.operatorRecommendations

  return (
    <section className="dam-admin-card dam-admin-section">
      <SectionHeading
        id="recommendations"
        eyebrow="Operator guidance"
        title="Operator Recommendations"
        description="Concise next actions derived from the current metrics only."
        badge={<span className="dam-admin-badge">{formatCount(recommendations.length)} actions</span>}
      />
      <RecommendationList recommendations={recommendations} />
    </section>
  )
}
