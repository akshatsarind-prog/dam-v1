'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import DamBrandMark from '@/components/brand/DamBrandMark'
import type {
  AdminClaimCategory,
  AdminClaimRecord,
  AdminMetricsResponse,
  AdminTrafficSourceRecord,
  CategoryIntelligence,
  EmailCaptureIntelligence,
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

const shellStyle = {
  paddingBottom: 48,
} as const

const headerWrapStyle = {
  width: 'min(1180px, calc(100% - 48px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  paddingTop: 26,
} as const

const contentWrapStyle = {
  width: 'min(1180px, calc(100% - 48px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  display: 'grid',
  gap: 16,
  paddingTop: 20,
} as const

const jumpNavStyle = {
  position: 'sticky',
  top: 10,
  zIndex: 10,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  padding: 10,
  border: '1px solid var(--line)',
  background: 'rgba(10, 10, 12, 0.92)',
  boxShadow: 'var(--shadow)',
  backdropFilter: 'blur(10px)',
} as const

const anchorLinkStyle = {
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  border: '1px solid var(--line)',
  background: 'rgba(255, 255, 255, 0.03)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 780,
} as const

const claimTextStyle = {
  maxWidth: '36ch',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
} as const

const collapsibleButtonStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left' as const,
} as const

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not enough data yet'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Not enough data yet'
  }

  return parsed.toLocaleString()
}

function formatCount(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
  }

  return new Intl.NumberFormat('en-US').format(value)
}

function formatLatency(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
  }

  return `${Math.round(value)} ms`
}

function formatRate(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function formatDecimal(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
  }

  return value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

function formatSessionDuration(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
  }

  const totalSeconds = Math.max(Math.round(value / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  return `${seconds}s`
}

function formatDurationCompact(value: number | null) {
  if (value === null) {
    return 'Not enough data yet'
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
      return 'Social rumor'
    default:
      return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  }
}

function shortenId(value: string | null) {
  if (!value) {
    return '—'
  }

  return value.length <= 14 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
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

function getRecommendationBadgeClass(priority: OperatorRecommendation['priority']) {
  switch (priority) {
    case 'high':
      return 'dam-admin-badge dam-admin-badge--danger'
    case 'medium':
      return 'dam-admin-badge dam-admin-badge--warning'
    default:
      return 'dam-admin-badge'
  }
}

function getConfidenceBadgeStyle(confidence: number) {
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

function getRiskBadgeStyle(riskLabel: string) {
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

function getClaimRowStyle(claim: AdminClaimRecord) {
  const highRisk = claim.riskLabel.toLowerCase().includes('high') || claim.riskLabel.toLowerCase().includes('severe')
  const lowConfidence = claim.confidence < 60
  const highLatency = claim.latencyMs >= 8000

  if (highRisk) {
    return {
      background: 'rgba(214, 38, 38, 0.09)',
    } satisfies CSSProperties
  }

  if (lowConfidence) {
    return {
      background: 'rgba(214, 38, 38, 0.05)',
    } satisfies CSSProperties
  }

  if (highLatency) {
    return {
      background: 'rgba(214, 38, 38, 0.035)',
    } satisfies CSSProperties
  }

  if (claim.attributed) {
    return {
      background: 'rgba(255, 255, 255, 0.02)',
    } satisfies CSSProperties
  }

  return undefined
}

function SectionHeading({
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
  badge?: string
}) {
  return (
    <div className="dam-admin-section-heading" id={id}>
      <p className="system-label" style={{ marginBottom: 10 }}>
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <div className="dam-admin-section-heading__title-row">
        <h2>{title}</h2>
        {badge ? <span className="dam-admin-badge">{badge}</span> : null}
      </div>
      <p>{description}</p>
    </div>
  )
}

function MetricCard({
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

function RecommendationCard({
  recommendation,
  compact = false,
}: {
  recommendation: OperatorRecommendation
  compact?: boolean
}) {
  return (
    <article
      className="dam-admin-subcard"
      style={{
        padding: compact ? 14 : 16,
        borderColor:
          recommendation.priority === 'high'
            ? 'rgba(214, 38, 38, 0.38)'
            : recommendation.priority === 'medium'
              ? 'rgba(214, 38, 38, 0.2)'
              : undefined,
      }}
    >
      <div className="dam-admin-inline-meta" style={{ marginBottom: 12 }}>
        <span className={getRecommendationBadgeClass(recommendation.priority)}>
          {recommendation.priority}
        </span>
      </div>
      <h3>{recommendation.title}</h3>
      <p>{recommendation.detail}</p>
    </article>
  )
}

function CollapsibleSection({
  title,
  description,
  rowCount,
  defaultExpanded = false,
  children,
}: {
  title: string
  description: string
  rowCount?: number
  defaultExpanded?: boolean
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className="dam-admin-subcard">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        style={collapsibleButtonStyle}
      >
        <div className="dam-admin-collapsible__copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="dam-admin-inline-meta" style={{ justifyContent: 'flex-end', flexShrink: 0 }}>
          {typeof rowCount === 'number' ? (
            <span className="dam-admin-header-pill">{formatCount(rowCount)} rows</span>
          ) : null}
          <span className="dam-admin-icon-button" aria-hidden="true">
            {expanded ? '-' : '+'}
          </span>
        </div>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 180ms ease',
          marginTop: expanded ? 14 : 0,
        }}
      >
        <div style={{ overflow: 'hidden' }}>{children}</div>
      </div>
    </section>
  )
}

function ClaimFlags({ claim }: { claim: AdminClaimRecord }) {
  const flags: Array<{ label: string; style?: CSSProperties }> = []

  if (claim.attributed) {
    flags.push({ label: 'Attributed' })
  }

  if (claim.confidence < 60) {
    flags.push({ label: 'Low confidence', style: getConfidenceBadgeStyle(claim.confidence) })
  }

  if (claim.latencyMs >= 8000) {
    flags.push({
      label: 'Slow',
      style: {
        borderColor: 'rgba(214, 38, 38, 0.32)',
        background: 'rgba(214, 38, 38, 0.07)',
        color: '#e7bcbc',
      },
    })
  }

  if (claim.riskLabel.toLowerCase().includes('high') || claim.riskLabel.toLowerCase().includes('severe')) {
    flags.push({ label: 'High risk', style: getRiskBadgeStyle(claim.riskLabel) })
  }

  if (!flags.length) {
    return null
  }

  return (
    <div className="dam-admin-inline-meta" style={{ marginTop: 8 }}>
      {flags.map((flag) => (
        <span key={flag.label} className="dam-admin-row-badge" style={flag.style}>
          {flag.label}
        </span>
      ))}
    </div>
  )
}

function ClaimsTable({
  claims,
}: {
  claims: AdminClaimRecord[]
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            {[
              'Created',
              'Claim',
              'Verdict',
              'Confidence',
              'Risk',
              'Category',
              'Latency',
              'Sources',
              'Evidence quality',
              'UTM source',
              'UTM campaign',
              'Session',
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {claims.length ? (
            claims.map((claim, index) => (
              <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${index}`} style={getClaimRowStyle(claim)}>
                <td>{formatDateTime(claim.createdAt)}</td>
                <td>
                  <div style={claimTextStyle}>{claim.claimText || 'No claim text logged.'}</div>
                  <ClaimFlags claim={claim} />
                </td>
                <td>
                  <span className="dam-admin-row-badge">{claim.verdict}</span>
                </td>
                <td>
                  <span className="dam-admin-row-badge" style={getConfidenceBadgeStyle(claim.confidence)}>
                    {claim.confidence}
                  </span>
                </td>
                <td>
                  <span className="dam-admin-row-badge" style={getRiskBadgeStyle(claim.riskLabel)}>
                    {claim.riskLabel}
                  </span>
                </td>
                <td>{formatCategoryLabel(claim.category)}</td>
                <td>{formatLatency(claim.latencyMs)}</td>
                <td>{formatCount(claim.sourceCount)}</td>
                <td>{claim.evidenceQuality ?? 'unknown'}</td>
                <td>{claim.utmSource ?? (claim.attributed ? 'direct / tracked' : 'No attributed claims yet')}</td>
                <td>{claim.utmCampaign ?? (claim.attributed ? 'not set' : '—')}</td>
                <td>{shortenId(claim.sessionId)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={12} className="dam-admin-table__empty">
                Not enough data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function TrafficSourceTable({
  rows,
}: {
  rows: AdminTrafficSourceRecord[]
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            {[
              'Source',
              'Medium',
              'Campaign',
              'Claim submissions',
              'Unique sessions',
              'Unique visitors',
              'Tracked events',
              'CTA clicks',
              'Email captures',
              'Claims / session',
              'Latest claim',
              'Interpretation',
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                <td>{row.source}</td>
                <td>{row.medium}</td>
                <td>{row.campaign}</td>
                <td>{formatCount(row.claimSubmissions)}</td>
                <td>{formatCount(row.uniqueSessions)}</td>
                <td>{formatCount(row.uniqueVisitors)}</td>
                <td>{formatCount(row.eventCount)}</td>
                <td>{formatCount(row.ctaClicks)}</td>
                <td>{formatCount(row.emailCaptures)}</td>
                <td>{formatDecimal(row.claimsPerSession)}</td>
                <td>{formatDateTime(row.latestClaimAt)}</td>
                <td>{row.interpretation}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={12} className="dam-admin-table__empty">
                No attributed claims yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function HighIntentSessionsTable({
  retention,
}: {
  retention: RetentionIntelligence
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            {[
              'Session',
              'Visitor',
              'Claims',
              'Source',
              'Campaign',
              'First seen',
              'Last seen',
              'Returning',
              'Email captured',
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {retention.highIntentSessions.length ? (
            retention.highIntentSessions.map((session) => (
              <tr key={session.sessionId}>
                <td>{shortenId(session.sessionId)}</td>
                <td>{shortenId(session.visitorId)}</td>
                <td>{formatCount(session.claimCount)}</td>
                <td>{session.source ?? 'Not enough data yet'}</td>
                <td>{session.campaign ?? 'Not enough data yet'}</td>
                <td>{formatDateTime(session.firstSeenAt)}</td>
                <td>{formatDateTime(session.lastSeenAt)}</td>
                <td>{session.isReturning ? 'Yes' : 'No'}</td>
                <td>{session.emailCaptured ? 'Yes' : 'Not linkable yet'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="dam-admin-table__empty">
                No repeat sessions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CategoryTable({
  categoryIntelligence,
}: {
  categoryIntelligence: CategoryIntelligence
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            {[
              'Category',
              'Count',
              'Share',
              'Avg confidence',
              'Avg latency',
              'Avg source count',
              'Top source',
              'Top campaign',
              'Latest claim',
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categoryIntelligence.categoryBreakdown.length ? (
            categoryIntelligence.categoryBreakdown.map((row) => (
              <tr key={row.category}>
                <td>
                  <span className="dam-admin-row-badge">{formatCategoryLabel(row.category)}</span>
                </td>
                <td>{formatCount(row.count)}</td>
                <td>{formatRate(row.percentage)}</td>
                <td>{row.averageConfidence.toFixed(1)}</td>
                <td>{formatLatency(row.averageLatencyMs)}</td>
                <td>{formatDecimal(row.averageSourceCount)}</td>
                <td>{row.topSource ?? 'Not enough data yet'}</td>
                <td>{row.topCampaign ?? 'Not enough data yet'}</td>
                <td>
                  <div style={claimTextStyle}>{row.latestClaimText ?? 'Not enough data yet'}</div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="dam-admin-table__empty">
                No category data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EmailSourceTable({
  emailCaptureIntelligence,
}: {
  emailCaptureIntelligence: EmailCaptureIntelligence
}) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table dam-admin-table--compact">
        <thead>
          <tr>
            {['Source', 'Medium', 'Campaign', 'Email captures'].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {emailCaptureIntelligence.sourceBreakdown.length ? (
            emailCaptureIntelligence.sourceBreakdown.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                <td>{row.source}</td>
                <td>{row.medium}</td>
                <td>{row.campaign}</td>
                <td>{formatCount(row.emailCaptures)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="dam-admin-table__empty">
                {emailCaptureIntelligence.note}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CompactList({
  title,
  description,
  rows,
  emptyMessage,
}: {
  title: string
  description: string
  rows: Array<{ key: string; title: string; meta?: string; trailing?: string }>
  emptyMessage: string
}) {
  return (
    <article className="dam-admin-subcard">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="dam-admin-mini-claims" style={{ marginTop: 16 }}>
        {rows.length ? (
          rows.map((row) => (
            <div key={row.key} className="dam-admin-mini-claims__row">
              <strong>{row.title}</strong>
              {row.meta ? <span>{row.meta}</span> : null}
              {row.trailing ? (
                <div className="dam-admin-mini-claims__footer">
                  <span>{row.trailing}</span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="dam-admin-placeholder">{emptyMessage}</div>
        )}
      </div>
    </article>
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
      options?: { persist?: boolean; showLoadingState?: boolean }
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
  const metrics = state.metrics

  if (!showDashboard || !metrics) {
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
                  Founder dashboard
                </p>
                <h1>Private DAM analytics</h1>
                <p>
                  This command center stays read-only. Enter the admin password to load live
                  traffic, retention, category, and operational health signals from the existing
                  admin API.
                </p>
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

  const executive = metrics.executiveSnapshot
  const sources = metrics.trafficSourceIntelligence
  const funnel = metrics.funnelIntelligence
  const retention = metrics.retentionIntelligence
  const categories = metrics.categoryIntelligence
  const health = metrics.operationalHealth
  const emails = metrics.emailCaptureIntelligence
  const recommendations = metrics.operatorRecommendations
  const lastUpdatedLabel = formatDateTime(metrics.generatedAt)
  const topRecommendations = recommendations.slice(0, 3)

  const executiveCards = [
    {
      label: 'Total claims',
      value: formatCount(executive.totalClaims),
      note: 'All logged analyzer responses',
      emphasize: false,
    },
    {
      label: 'Claims today',
      value: formatCount(executive.claimsToday),
      note: 'Rows created since local midnight',
      emphasize: executive.claimsToday === 0,
    },
    {
      label: 'Unique sessions',
      value: formatCount(executive.uniqueSessions),
      note: 'Sessions seen across claims and events',
      emphasize: false,
    },
    {
      label: 'Returning session rate',
      value: formatRate(executive.returningSessionRate),
      note: 'Best quick retention read',
      emphasize:
        executive.returningSessionRate !== null && executive.returningSessionRate < 0.15,
    },
    {
      label: 'Repeat-claim sessions',
      value: formatCount(executive.repeatClaimSessions),
      note: 'Sessions with repeated claims across visits',
      emphasize: false,
    },
    {
      label: 'Email captures',
      value: formatCount(executive.emailCaptures),
      note: 'Tracked beta signups',
      emphasize: false,
    },
    {
      label: 'Claim -> Email',
      value: formatRate(executive.claimToEmailConversionRate),
      note: 'Email captures divided by total claims',
      emphasize:
        executive.claimToEmailConversionRate !== null &&
        executive.totalClaims >= 5 &&
        executive.claimToEmailConversionRate < 0.15,
    },
    {
      label: 'Avg latency',
      value: formatLatency(executive.averageLatencyMs),
      note: 'Mean backend response latency',
      emphasize: executive.averageLatencyMs >= 7000,
    },
    {
      label: 'P95 latency',
      value: formatLatency(executive.p95LatencyMs),
      note: 'Tail latency if enough data exists',
      emphasize: (executive.p95LatencyMs ?? 0) >= 10000,
    },
    {
      label: 'Attributed claims',
      value: formatCount(executive.attributedClaims),
      note: 'Claims with traffic context logged',
      emphasize: false,
    },
    {
      label: 'Unattributed claims',
      value: formatCount(executive.unattributedClaims),
      note: 'Old NULL rows are included here',
      emphasize: executive.totalClaims > 0 && executive.unattributedClaims > 0,
    },
  ]

  const sourceCards = [
    {
      label: 'Best source by claims',
      value: sources.bestSourceByClaims?.label ?? 'No attributed claims yet',
      note: sources.bestSourceByClaims
        ? `${formatCount(sources.bestSourceByClaims.claimSubmissions)} claim submissions`
        : 'Not enough data yet',
    },
    {
      label: 'Best source by claims / session',
      value: sources.bestSourceByClaimsPerSession?.label ?? 'Not enough data yet',
      note: sources.bestSourceByClaimsPerSession
        ? `${formatDecimal(sources.bestSourceByClaimsPerSession.claimsPerSession)} claims per session`
        : 'Not enough data yet',
    },
    {
      label: 'Best campaign by claims',
      value: sources.bestCampaignByClaimSubmissions?.campaign ?? 'Not enough data yet',
      note: sources.bestCampaignByClaimSubmissions
        ? `${formatCount(sources.bestCampaignByClaimSubmissions.claimSubmissions)} claim submissions`
        : 'Not enough data yet',
    },
    {
      label: 'Unattributed claims',
      value: formatCount(sources.unattributedClaims),
      note: 'Use tracked links consistently to shrink this',
    },
  ]

  const retentionCards = [
    { label: 'Unique sessions', value: formatCount(retention.uniqueSessions), note: 'All known sessions' },
    { label: 'First-time sessions', value: formatCount(retention.firstTimeSessions), note: 'No clear return signal yet' },
    { label: 'Returning sessions', value: formatCount(retention.returningSessions), note: 'Sessions with a return signal' },
    { label: 'Returning rate', value: formatRate(retention.returningSessionRate), note: 'Returning sessions / unique sessions' },
    { label: 'Repeat-claim sessions', value: formatCount(retention.repeatClaimSessions), note: 'Repeated claims across visits' },
    { label: 'Sessions with 2+ claims', value: formatCount(retention.sessionsWithTwoPlusClaims), note: 'Raw depth inside the session' },
    { label: 'Sessions with 3+ claims', value: formatCount(retention.sessionsWithThreePlusClaims), note: 'Higher-intent session depth' },
    { label: 'Multi-day users', value: formatCount(retention.multiDayUsers), note: 'Activity spanning multiple dates' },
    { label: 'Avg claims / session', value: formatDecimal(retention.averageClaimsPerSession), note: 'Total claims / unique sessions' },
    { label: 'Avg time / session', value: formatSessionDuration(retention.averageTimePerSessionMs), note: 'Active duration estimate' },
    { label: 'Avg time between sessions', value: formatDurationCompact(retention.averageTimeBetweenSessionsMs), note: 'Gap between return visits' },
  ]

  const healthCards = [
    { label: 'Avg latency', value: formatLatency(health.averageLatencyMs), note: 'Mean response time', emphasize: health.averageLatencyMs >= 7000 },
    { label: 'Median latency', value: formatLatency(health.medianLatencyMs), note: 'Typical latency' },
    { label: 'P95 latency', value: formatLatency(health.p95LatencyMs), note: 'Tail latency', emphasize: (health.p95LatencyMs ?? 0) >= 10000 },
    { label: 'Max latency', value: formatLatency(health.maxLatencyMs), note: 'Worst recent latency', emphasize: (health.maxLatencyMs ?? 0) >= 12000 },
    { label: 'Claims over 8s', value: formatCount(health.claimsOver8s), note: 'Slow claims needing review' },
    { label: 'Claims over 12s', value: formatCount(health.claimsOver12s), note: 'Very slow claims' },
    { label: 'Avg source count', value: formatDecimal(health.averageSourceCount), note: 'Average retrieved evidence count' },
    { label: 'Claims with zero sources', value: formatCount(health.claimsWithZeroSources), note: 'Evidence retrieval failed or empty' },
    { label: 'Low-confidence claims', value: formatCount(health.lowConfidenceClaimsCount), note: 'Confidence under 60' },
    { label: 'Last claim timestamp', value: formatDateTime(health.lastClaimAt), note: 'Latest logged claim' },
    { label: 'Last event timestamp', value: formatDateTime(health.lastEventAt), note: 'Latest telemetry event' },
  ]

  const categoryCards = [
    {
      label: 'Most tested category',
      value: categories.mostTestedCategory ? formatCategoryLabel(categories.mostTestedCategory.category) : 'Not enough data yet',
      note: categories.mostTestedCategory ? `${formatRate(categories.mostTestedCategory.percentage)} of all claims` : 'Not enough data yet',
    },
    {
      label: 'Highest latency category',
      value: categories.highestLatencyCategory ? formatCategoryLabel(categories.highestLatencyCategory.category) : 'Not enough data yet',
      note: categories.highestLatencyCategory ? formatLatency(categories.highestLatencyCategory.averageLatencyMs) : 'Not enough data yet',
    },
    {
      label: 'Lowest confidence category',
      value: categories.lowestConfidenceCategory ? formatCategoryLabel(categories.lowestConfidenceCategory.category) : 'Not enough data yet',
      note: categories.lowestConfidenceCategory ? categories.lowestConfidenceCategory.averageConfidence.toFixed(1) : 'Not enough data yet',
    },
    {
      label: 'Strongest attributed category',
      value: categories.highestSourceCampaignCategory ? formatCategoryLabel(categories.highestSourceCampaignCategory.category) : 'Not enough data yet',
      note: categories.highestSourceCampaignCategory && categories.highestSourceCampaignCategory.topSource
        ? `${categories.highestSourceCampaignCategory.topSource} / ${categories.highestSourceCampaignCategory.topCampaign ?? 'not set'}`
        : 'Not enough data yet',
    },
  ]

  const sourceRowsForList = sources.topReferrers.map((row) => ({
    key: row.referrer,
    title: row.referrer,
    trailing: `${formatCount(row.sessionCount)} sessions`,
  }))

  const maskedEmailRows = emails.latestMaskedEmails.map((row) => ({
    key: `${row.maskedEmail}-${row.createdAt ?? 'unknown'}`,
    title: row.maskedEmail,
    meta: row.source && row.campaign ? `${row.source} / ${row.campaign}` : emails.note,
    trailing: formatDateTime(row.createdAt),
  }))

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
        <nav style={jumpNavStyle} aria-label="Admin sections">
          {[
            ['overview', 'Overview'],
            ['sources', 'Sources'],
            ['funnel', 'Funnel'],
            ['retention', 'Retention'],
            ['categories', 'Categories'],
            ['health', 'Health'],
            ['claims', 'Claims'],
            ['recommendations', 'Recommendations'],
          ].map(([href, label]) => (
            <a key={href} href={`#${href}`} style={anchorLinkStyle}>
              {label}
            </a>
          ))}
        </nav>

        <section className="dam-admin-header-card">
          <div className="dam-admin-header-card__copy">
            <p className="system-label" style={{ marginBottom: 10 }}>
              <span aria-hidden="true" />
              Admin telemetry
            </p>
            <h1>DAM founder command center</h1>
            <p>
              Read-only visibility into acquisition, funnel health, retention, category patterns,
              and backend reliability using the existing Supabase logs only.
            </p>
          </div>
          <div className="dam-admin-header-card__actions">
            <div className="dam-admin-inline-meta">
              <span className={getStatusBadgeClass(executive.status)}>
                {getStatusLabel(executive.status)}
              </span>
              <span className="dam-admin-header-pill">Updated {lastUpdatedLabel}</span>
              {state.status === 'loading' ? (
                <span className="dam-admin-header-pill">Refreshing live metrics</span>
              ) : null}
            </div>
          </div>
        </section>

        {metrics.error?.code === 'misconfigured' ? (
          <div className="dam-admin-alert dam-admin-alert--warning">
            Admin metrics are not configured. Check the Supabase admin environment variables
            before trusting any summary on this page.
          </div>
        ) : null}

        {state.errorMessage ? <div className="dam-admin-alert">{state.errorMessage}</div> : null}

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="overview"
            eyebrow="Executive command strip"
            title="Executive command strip"
            description="This is the compact operator layer: what is growing, what is stuck, and whether the backend is healthy enough to act on growth signals."
            badge={getStatusLabel(executive.status)}
          />
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
            }}
          >
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
          <div className="dam-admin-section-stack">
            <div className="dam-admin-section-heading__title-row">
              <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.18 }}>Operator recommendations</h3>
              <span className="dam-admin-badge">Top 3</span>
            </div>
            <div className="dam-admin-detail-grid">
              {topRecommendations.map((recommendation) => (
                <RecommendationCard
                  key={`${recommendation.priority}-${recommendation.title}`}
                  recommendation={recommendation}
                  compact
                />
              ))}
            </div>
          </div>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="sources"
            eyebrow="Acquisition / source intelligence"
            title="Traffic Source Intelligence"
            description="Use this section to decide where quality traffic is actually coming from. Event counts here are tracked events, not exact visits."
            badge={`${formatCount(sources.rows.length)} source rows`}
          />

          <section className="dam-admin-mini-grid">
            {sourceCards.map((card) => (
              <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
            ))}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.9fr)', gap: 16 }}>
            <article className="dam-admin-subcard">
              <h3>Source / campaign performance</h3>
              <p>{sources.note}</p>
              <div style={{ marginTop: 16 }}>
                <TrafficSourceTable rows={sources.rows} />
              </div>
            </article>

            <div className="dam-admin-section-stack">
              <article className="dam-admin-subcard">
                <h3>Email capture intelligence</h3>
                <p>{emails.note}</p>
                <section className="dam-admin-mini-grid" style={{ marginTop: 16 }}>
                  <MetricCard label="Total emails" value={formatCount(emails.totalEmails)} note="All captured beta signups" />
                  <MetricCard label="Emails today" value={formatCount(emails.emailsToday)} note="Captured since local midnight" />
                  <MetricCard label="Emails last 7 days" value={formatCount(emails.emailsLast7Days)} note="Recent capture momentum" />
                  <MetricCard label="Claim -> Email" value={formatRate(emails.claimToEmailConversionRate)} note="Do not fake source linkage here" />
                </section>
                <div style={{ marginTop: 16 }}>
                  <EmailSourceTable emailCaptureIntelligence={emails} />
                </div>
              </article>

              <CompactList
                title="Latest captured emails"
                description="Emails are masked by default."
                rows={maskedEmailRows}
                emptyMessage="Not enough data yet."
              />

              <CompactList
                title="Top referrers"
                description="A quick read on referral surfaces outside explicit UTM sources."
                rows={sourceRowsForList}
                emptyMessage="Not enough data yet."
              />
            </div>
          </div>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="funnel"
            eyebrow="Funnel intelligence"
            title="Funnel Intelligence"
            description="Manual baseline support stays intact, but tracked sessions now surface higher in the dashboard."
            badge={`${formatCount(funnel.stages.length)} stages`}
          />

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {funnel.stages.map((stage) => (
              <article key={stage.key} className="dam-admin-subcard" style={{ padding: 14 }}>
                <div className="dam-admin-inline-meta" style={{ justifyContent: 'space-between' }}>
                  <span className="dam-admin-badge">{stage.status === 'manual' ? 'Manual baseline' : stage.status === 'tracked' ? 'Tracked' : 'Not tracked yet'}</span>
                  {stage.conversionFromPrevious !== null ? (
                    <span className="dam-admin-header-pill">{formatRate(stage.conversionFromPrevious)}</span>
                  ) : null}
                </div>
                <h3 style={{ marginTop: 12 }}>{stage.label}</h3>
                <strong className="dam-admin-subcard__value">{formatCount(stage.count)}</strong>
                <p>{stage.sourceLabel}</p>
                <p style={{ marginTop: 10 }}>
                  {stage.conversionFromPrevious !== null
                    ? `Conversion from previous stage: ${formatRate(stage.conversionFromPrevious)}`
                    : 'First stage or not enough data yet.'}
                </p>
              </article>
            ))}
          </section>

          <section className="dam-admin-mini-grid">
            <MetricCard
              label="Biggest drop-off"
              value={funnel.biggestDropOff?.label ?? 'Not enough data yet'}
              note={funnel.biggestDropOff ? formatRate(funnel.biggestDropOff.conversion) : 'Not enough data yet'}
            />
            <MetricCard
              label="Strongest retained stage"
              value={funnel.strongestRetainedStage?.label ?? 'Not enough data yet'}
              note={funnel.strongestRetainedStage ? formatRate(funnel.strongestRetainedStage.conversion) : 'Not enough data yet'}
            />
            <MetricCard
              label="Best source"
              value={funnel.bestSource?.label ?? 'Not enough data yet'}
              note={funnel.bestSource ? `${formatCount(funnel.bestSource.claimSubmissions)} claim submissions` : 'Not enough data yet'}
            />
            <MetricCard
              label="Next recommended action"
              value={funnel.nextRecommendedAction}
              note="Automatic operator guidance from the current funnel shape"
            />
          </section>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="retention"
            eyebrow="Retention intelligence"
            title="Retention Intelligence"
            description="This merges returning-user and retention signals into one operational section."
            badge={`${formatCount(retention.highIntentSessions.length)} high-intent sessions`}
          />

          <section className="dam-admin-mini-grid">
            {retentionCards.map((card) => (
              <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
            ))}
          </section>

          <article className="dam-admin-subcard">
            <h3>Automatic interpretation</h3>
            <div className="dam-admin-analysis-list" style={{ marginTop: 14 }}>
              {retention.interpretation.map((line) => (
                <div key={line} className="dam-admin-placeholder">
                  {line}
                </div>
              ))}
            </div>
          </article>

          <article className="dam-admin-subcard">
            <h3>High-intent sessions</h3>
            <p>These are the most useful sessions to inspect when you want to understand repeat behavior and source quality.</p>
            <div style={{ marginTop: 16 }}>
              <HighIntentSessionsTable retention={retention} />
            </div>
          </article>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="categories"
            eyebrow="Claim category intelligence"
            title="Claim Category Intelligence"
            description="Category derivation stays analytics-only. Nothing here feeds back into DAM claim analysis behavior."
            badge={`${formatCount(categories.categoryBreakdown.length)} categories`}
          />

          <section className="dam-admin-mini-grid">
            {categoryCards.map((card) => (
              <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
            ))}
          </section>

          <article className="dam-admin-subcard">
            <h3>Automatic interpretation</h3>
            <div className="dam-admin-analysis-list" style={{ marginTop: 14 }}>
              {categories.interpretation.map((line) => (
                <div key={line} className="dam-admin-placeholder">
                  {line}
                </div>
              ))}
            </div>
          </article>

          <article className="dam-admin-subcard">
            <h3>Category breakdown</h3>
            <p>Use this to decide whether demand is scam-heavy, curiosity-heavy, or skewing into lower-confidence claim classes.</p>
            <div style={{ marginTop: 16 }}>
              <CategoryTable categoryIntelligence={categories} />
            </div>
          </article>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="health"
            eyebrow="Reliability / backend health"
            title="Operational Health"
            description="Use this to judge whether latency, evidence retrieval quality, or low-confidence output is the main reliability problem."
            badge={`${formatCount(health.slowestClaims.length)} slow-claim rows`}
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

          <div className="dam-admin-section-stack">
            <CollapsibleSection
              title="Slowest claims"
              description="Inspect tail latency first when the command strip shows backend pressure."
              rowCount={health.slowestClaims.length}
              defaultExpanded
            >
              <ClaimsTable claims={health.slowestClaims} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Low-confidence claims"
              description="Use this when quality looks weaker than growth."
              rowCount={health.lowConfidenceClaims.length}
            >
              <ClaimsTable claims={health.lowConfidenceClaims} />
            </CollapsibleSection>

            <CollapsibleSection
              title="High-risk claims"
              description="Recent claims with high or severe risk labels."
              rowCount={health.highRiskClaims.length}
            >
              <ClaimsTable claims={health.highRiskClaims} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Claims with zero / low sources"
              description="Evidence-sparse claims usually need retrieval or query-quality inspection."
              rowCount={health.claimsWithLowSources.length}
            >
              <ClaimsTable claims={health.claimsWithLowSources} />
            </CollapsibleSection>
          </div>
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="claims"
            eyebrow="Recent claims / debug tables"
            title="Recent Claims"
            description="The latest claim rows stay near the bottom so they support decisions instead of leading the page."
            badge={`${formatCount(metrics.recentClaims.length)} recent rows`}
          />
          <ClaimsTable claims={metrics.recentClaims} />
        </section>

        <section className="dam-admin-card dam-admin-section">
          <SectionHeading
            id="recommendations"
            eyebrow="Operator recommendations"
            title="Operator Recommendations"
            description="These are the current suggested next moves based on the metrics above. They are derived reads, not hard-coded playbooks."
            badge={`${formatCount(recommendations.length)} actions`}
          />
          <div className="dam-admin-detail-grid">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={`${recommendation.priority}-${recommendation.title}`}
                recommendation={recommendation}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
