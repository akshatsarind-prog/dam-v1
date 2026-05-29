'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import AdminBrand from './AdminBrand'
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
  password: string
  logout: () => void
  refresh: () => void
}

type AdminMetricsGateProps = {
  title: string
  description: string
  homeHref?: string
  showHomeLink?: boolean
  showPageIntro?: boolean
  loginEyebrow?: string
  render: (metrics: AdminMetricsResponse, state: AdminMetricsGateRenderState) => ReactNode
}

export type AdminSectionLink = {
  href: string
  group: 'Core' | 'Growth' | 'Product' | 'System'
  title: string
  eyebrow: string
  description: string
}

const ADMIN_NAV_GROUP_ORDER: AdminSectionLink['group'][] = ['Core', 'Growth', 'Product', 'System']

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

export const adminSectionLinks: AdminSectionLink[] = [
  {
    href: '/admin/executive',
    group: 'Core',
    title: 'Executive Snapshot',
    eyebrow: 'Core read',
    description: 'Top-line health, usage volume, repeat behavior, and current system state.',
  },
  {
    href: '/admin/daily',
    group: 'Core',
    title: 'Daily Intelligence',
    eyebrow: 'Automation layer',
    description: 'Today-only operating read across growth, product, and reliability signals.',
  },
  {
    href: '/admin/ai-hq',
    group: 'Core',
    title: 'DAM-AI-HQ',
    eyebrow: 'Daily operating intelligence',
    description: 'Daily operating intelligence / task command center',
  },
  {
    href: '/admin/scam-of-the-day',
    group: 'Core',
    title: 'Scam of the Day',
    eyebrow: 'Daily editorial workflow',
    description: 'Draft, review, approve, and publish daily scam item',
  },
  {
    href: '/admin/funnel',
    group: 'Growth',
    title: 'Funnel',
    eyebrow: 'Acquisition path',
    description: 'Tracked and manual stages from distributed reach through claim and signup.',
  },
  {
    href: '/admin/sources',
    group: 'Growth',
    title: 'Traffic Sources',
    eyebrow: 'Attribution',
    description: 'Source, medium, campaign, session quality, and email capture linkage.',
  },
  {
    href: '/admin/retention',
    group: 'Growth',
    title: 'Retention',
    eyebrow: 'Repeat behavior',
    description: 'Returning sessions, claim depth, high-intent sessions, and repeat usage signals.',
  },
  {
    href: '/admin/categories',
    group: 'Product',
    title: 'Claim Categories',
    eyebrow: 'Usage mix',
    description: 'What people are testing, confidence by category, and latest category examples.',
  },
  {
    href: '/admin/claims',
    group: 'Product',
    title: 'Recent Claims',
    eyebrow: 'Latest rows',
    description: 'Newest claim logs with verdict, confidence, risk, latency, and attribution.',
  },
  {
    href: '/admin/health',
    group: 'System',
    title: 'Operational Health',
    eyebrow: 'Reliability',
    description: 'Latency, evidence retrieval quality, low-confidence rows, and slowest claims.',
  },
  {
    href: '/admin/recommendations',
    group: 'System',
    title: 'Recommendations',
    eyebrow: 'Operator guidance',
    description: 'Metrics-derived next actions from the current admin intelligence layer.',
  },
  {
    href: '/admin/lifetime',
    group: 'System',
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

function formatCategorySourceLabel(value: string | null | undefined) {
  if (!value) {
    return 'No data yet'
  }

  return value.replace(/_/g, ' ')
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
  showPageIntro = false,
  loginEyebrow = 'Founder dashboard',
  render,
}: AdminMetricsGateProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [state, setState] = useState<DashboardState>({
    status: 'locked',
    password: '',
    metrics: null,
    errorMessage: '',
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
    const savedPassword = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

    if (!savedPassword) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setState((current) => {
        if (current.status !== 'locked' || current.password || current.metrics) {
          return current
        }

        return {
          status: 'loading',
          password: savedPassword,
          metrics: null,
          errorMessage: '',
        }
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

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

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isMenuOpen])

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
        <AdminShellStyles />
        <div style={headerWrapStyle}>
          <header className="dam-admin-shell-header dam-admin-shell-header--locked">
            <div className="dam-admin-shell-header__spacer" />
            <Link className="dam-admin-shell-brand" href="/" aria-label="Return to DAM home">
              <span className="dam-admin-shell-brand__halo" />
              <span className="dam-admin-shell-brand__icon">
                <AdminBrand variant="icon" sizes="28px" />
              </span>
              <div className="dam-admin-shell-brand__copy">
                <span className="dam-admin-shell-brand__wordmark">
                  <AdminBrand variant="wordmark" sizes="120px" />
                </span>
                <span>Private admin</span>
              </div>
            </Link>
            <span className="dam-admin-shell-status">Private admin</span>
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
      <AdminShellStyles />
      <div style={headerWrapStyle}>
        <header className="dam-admin-shell-header">
          <button
            type="button"
            className="dam-admin-menu-trigger"
            aria-label={isMenuOpen ? 'Close admin navigation' : 'Open admin navigation'}
            aria-expanded={isMenuOpen}
            aria-controls="dam-admin-navigation"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>

          <Link className="dam-admin-shell-brand" href={homeHref} aria-label="Open DAM admin home">
            <span className="dam-admin-shell-brand__halo" />
            <span className="dam-admin-shell-brand__icon">
              <AdminBrand variant="icon" sizes="28px" />
            </span>
            <div className="dam-admin-shell-brand__copy">
              <span className="dam-admin-shell-brand__wordmark">
                <AdminBrand variant="wordmark" sizes="140px" />
              </span>
              <span>Private founder operating system</span>
            </div>
          </Link>

          <span className="dam-admin-shell-status">Private admin</span>
        </header>
      </div>

      <AdminNavigationDrawer
        isOpen={isMenuOpen}
        pathname={pathname}
        homeHref={homeHref}
        showHomeLink={showHomeLink}
        generatedAt={metrics.generatedAt}
        isRefreshing={state.status === 'loading'}
        onClose={() => setIsMenuOpen(false)}
        onRefresh={() =>
          void loadMetrics(state.password, {
            persist: false,
          })
        }
        onLogout={() => {
          setIsMenuOpen(false)
          handleLogout()
        }}
      />

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

        {showPageIntro ? (
          <section className="dam-admin-page-intro">
            <p className="dam-admin-page-intro__eyebrow">Private founder operating system</p>
            <h1>{title}</h1>
            <p>{description}</p>
            <span className="dam-admin-page-intro__meta">
              Private admin · Updated {formatDateTime(metrics.generatedAt)}
            </span>
          </section>
        ) : null}

        {render(metrics, {
          isRefreshing: state.status === 'loading',
          errorMessage: state.errorMessage,
          password: state.password,
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
    <section className="dam-admin-lobby" aria-label="DAM admin home">
      <div className="dam-admin-lobby__brand">
        <AdminBrand variant="lockup" priority sizes="(max-width: 768px) 240px, 340px" />
      </div>
      <p className="dam-admin-lobby__eyebrow">Defence Against Misinformation</p>
      <h1>Private founder operating system</h1>
      <p className="dam-admin-lobby__description">Private founder operating system</p>
      <span className="dam-admin-lobby__meta">Private admin · Updated {formatDateTime(generatedAt)}</span>
    </section>
  )
}

function AdminNavigationDrawer({
  isOpen,
  pathname,
  homeHref,
  showHomeLink,
  generatedAt,
  isRefreshing,
  onClose,
  onRefresh,
  onLogout,
}: {
  isOpen: boolean
  pathname: string
  homeHref: string
  showHomeLink: boolean
  generatedAt: string
  isRefreshing: boolean
  onClose: () => void
  onRefresh: () => void
  onLogout: () => void
}) {
  return (
    <>
      <div
        className={`dam-admin-menu-overlay${isOpen ? ' dam-admin-menu-overlay--open' : ''}`}
        aria-hidden={isOpen ? 'false' : 'true'}
        onClick={onClose}
      />
      <aside
        id="dam-admin-navigation"
        className={`dam-admin-menu-drawer${isOpen ? ' dam-admin-menu-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="dam-admin-menu-drawer__header">
          <div className="dam-admin-menu-drawer__brand">
            <span className="dam-admin-menu-drawer__brand-mark">
              <AdminBrand variant="icon" sizes="44px" />
            </span>
            <div>
              <span className="dam-admin-menu-drawer__brand-wordmark">
                <AdminBrand variant="wordmark" sizes="150px" />
              </span>
              <p className="dam-admin-menu-drawer__eyebrow">Navigation</p>
            </div>
          </div>
          <button
            type="button"
            className="dam-admin-menu-close"
            onClick={onClose}
            aria-label="Close admin navigation"
          >
            <span />
            <span />
          </button>
        </div>

        <div className="dam-admin-menu-body">
          <div className="dam-admin-menu-drawer__meta">
            <span>Private admin</span>
            <span>Updated {formatDateTime(generatedAt)}</span>
          </div>

          <nav className="dam-admin-menu-nav" aria-label="Admin sections">
            {showHomeLink ? (
              <Link
                href={homeHref}
                onClick={onClose}
                className="dam-admin-menu-link"
                data-active={pathname === homeHref}
              >
                <div>
                  <strong>Admin Home</strong>
                  <span>Centered control lobby</span>
                </div>
              </Link>
            ) : null}

            {ADMIN_NAV_GROUP_ORDER.map((group) => {
              const sections = adminSectionLinks.filter((section) => section.group === group)

              if (!sections.length) {
                return null
              }

              return (
                <div key={group} className="dam-admin-menu-group">
                  <p className="dam-admin-menu-group__title">{group}</p>
                  <div className="dam-admin-menu-group__links">
                    {sections.map((section) => {
                      const isActive =
                        pathname === section.href ||
                        (section.href === '/admin/lifetime' && pathname.startsWith('/admin/lifetime'))

                      return (
                        <Link
                          key={section.href}
                          href={section.href}
                          onClick={onClose}
                          className="dam-admin-menu-link"
                          data-active={isActive}
                        >
                          <div>
                            <strong>{section.title}</strong>
                            <span>{section.description}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="dam-admin-menu-actions">
            <p className="dam-admin-menu-group__title">Actions</p>
            <button type="button" className="dam-admin-menu-action" onClick={onRefresh}>
              {isRefreshing ? 'Refreshing metrics...' : 'Refresh metrics'}
            </button>
            <button type="button" className="dam-admin-menu-action dam-admin-menu-action--danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function AdminShellStyles() {
  return (
    <style jsx global>{`
      .dam-admin-shell-header {
        display: grid;
        grid-template-columns: minmax(72px, 1fr) auto minmax(72px, 1fr);
        align-items: center;
        min-height: 82px;
        padding: 8px 0;
        gap: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .dam-admin-shell-header--locked {
        grid-template-columns: minmax(32px, 1fr) auto minmax(32px, 1fr);
      }

      .dam-admin-shell-header__spacer {
        min-height: 44px;
      }

      .dam-admin-shell-brand {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-self: center;
        gap: 14px;
        padding: 14px 20px;
        border: 1px solid rgba(165, 188, 230, 0.18);
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
          rgba(5, 9, 15, 0.86);
        box-shadow:
          0 18px 60px rgba(0, 0, 0, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }

      .dam-admin-shell-brand__halo {
        position: absolute;
        inset: 1px;
        border-radius: inherit;
        background: radial-gradient(circle at top, rgba(126, 156, 234, 0.18), transparent 56%);
        pointer-events: none;
      }

      .dam-admin-shell-brand__icon {
        position: relative;
        width: 28px;
        flex: 0 0 28px;
      }

      .dam-admin-shell-brand__copy {
        position: relative;
        display: grid;
        gap: 3px;
      }

      .dam-admin-shell-brand__wordmark {
        display: block;
        width: clamp(88px, 12vw, 128px);
      }

      .dam-admin-shell-brand__copy span:last-child {
        color: rgba(226, 234, 250, 0.66);
        font-size: 11px;
        letter-spacing: 0.08em;
        line-height: 1.3;
        text-transform: uppercase;
      }

      .dam-admin-menu-trigger,
      .dam-admin-shell-status,
      .dam-admin-menu-close,
      .dam-admin-menu-action {
        border: 1px solid rgba(165, 188, 230, 0.16);
        background: rgba(8, 12, 19, 0.82);
        color: #f4f8ff;
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
      }

      .dam-admin-menu-trigger,
      .dam-admin-menu-close {
        width: 48px;
        height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 16px;
        justify-self: start;
        cursor: pointer;
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          background-color 180ms ease;
      }

      .dam-admin-menu-trigger:hover,
      .dam-admin-menu-close:hover,
      .dam-admin-menu-action:hover,
      .dam-admin-menu-link:hover {
        border-color: rgba(206, 221, 255, 0.26);
        background: rgba(14, 21, 34, 0.96);
      }

      .dam-admin-menu-trigger span {
        position: absolute;
        width: 18px;
        height: 1.5px;
        background: currentColor;
        border-radius: 999px;
      }

      .dam-admin-menu-trigger span:nth-child(1) {
        transform: translateY(-6px);
      }

      .dam-admin-menu-trigger span:nth-child(2) {
        transform: translateY(0);
      }

      .dam-admin-menu-trigger span:nth-child(3) {
        transform: translateY(6px);
      }

      .dam-admin-menu-close {
        justify-self: end;
        position: relative;
      }

      .dam-admin-menu-close span {
        position: absolute;
        width: 18px;
        height: 1.5px;
        background: currentColor;
        border-radius: 999px;
      }

      .dam-admin-menu-close span:first-child {
        transform: rotate(45deg);
      }

      .dam-admin-menu-close span:last-child {
        transform: rotate(-45deg);
      }

      .dam-admin-shell-status {
        justify-self: end;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(231, 238, 252, 0.78);
      }

      .dam-admin-menu-overlay {
        position: fixed;
        inset: 0;
        z-index: 1200;
        background: rgba(2, 4, 8, 0.24);
        backdrop-filter: blur(16px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 220ms ease;
      }

      .dam-admin-menu-overlay--open {
        opacity: 1;
        pointer-events: auto;
      }

      .dam-admin-menu-drawer {
        position: fixed;
        top: 18px;
        left: 18px;
        bottom: 18px;
        z-index: 1201;
        width: min(420px, calc(100vw - 36px));
        max-height: calc(100svh - 36px);
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 22px;
        border: 1px solid rgba(165, 188, 230, 0.18);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(15, 24, 36, 0.97), rgba(7, 11, 17, 0.98)),
          rgba(6, 10, 15, 0.98);
        box-shadow: 0 36px 120px rgba(0, 0, 0, 0.42);
        transform: translateX(-108%);
        opacity: 0;
        transition:
          transform 240ms ease,
          opacity 240ms ease;
        overflow: hidden;
      }

      .dam-admin-menu-drawer--open {
        transform: translateX(0);
        opacity: 1;
      }

      .dam-admin-menu-body {
        min-height: 0;
        flex: 1 1 auto;
        display: grid;
        align-content: start;
        gap: 18px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(165, 188, 230, 0.28) transparent;
      }

      .dam-admin-menu-body::-webkit-scrollbar {
        width: 8px;
      }

      .dam-admin-menu-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .dam-admin-menu-body::-webkit-scrollbar-thumb {
        background: rgba(165, 188, 230, 0.24);
        border-radius: 999px;
      }

      .dam-admin-menu-drawer__header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 12px;
        flex: 0 0 auto;
      }

      .dam-admin-menu-drawer__brand {
        display: inline-flex;
        align-items: center;
        gap: 14px;
      }

      .dam-admin-menu-drawer__brand-mark {
        width: 44px;
        flex: 0 0 44px;
      }

      .dam-admin-menu-drawer__brand-wordmark {
        display: block;
        width: 148px;
        margin-bottom: 8px;
      }

      .dam-admin-menu-drawer__eyebrow {
        margin: 0;
        color: rgba(165, 182, 214, 0.72);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .dam-admin-menu-drawer__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: rgba(221, 230, 246, 0.64);
        font-size: 12px;
        line-height: 1.5;
      }

      .dam-admin-menu-nav {
        display: grid;
        gap: 14px;
      }

      .dam-admin-menu-group {
        display: grid;
        gap: 8px;
      }

      .dam-admin-menu-group__title {
        margin: 0;
        color: rgba(184, 198, 228, 0.56);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .dam-admin-menu-group__links {
        display: grid;
        gap: 8px;
      }

      .dam-admin-menu-link {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
        border: 1px solid rgba(165, 188, 230, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          background-color 180ms ease;
      }

      .dam-admin-menu-link[data-active='true'] {
        border-color: rgba(216, 228, 255, 0.28);
        background:
          linear-gradient(180deg, rgba(124, 152, 214, 0.16), rgba(124, 152, 214, 0.04)),
          rgba(255, 255, 255, 0.04);
      }

      .dam-admin-menu-link strong {
        display: block;
        margin: 0 0 4px;
        font-size: 14px;
        letter-spacing: 0.02em;
      }

      .dam-admin-menu-link span {
        color: rgba(221, 230, 246, 0.64);
        font-size: 12px;
        line-height: 1.55;
      }

      .dam-admin-menu-actions {
        display: grid;
        gap: 10px;
        margin-top: 6px;
      }

      .dam-admin-menu-action {
        min-height: 48px;
        padding: 0 16px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          background-color 180ms ease;
      }

      .dam-admin-menu-action--danger {
        color: #ffd4d4;
        border-color: rgba(190, 92, 92, 0.24);
      }

      .dam-admin-page-intro,
      .dam-admin-lobby {
        display: grid;
        justify-items: center;
        text-align: center;
        gap: 14px;
        padding: 38px min(8vw, 68px);
        border: 1px solid rgba(165, 188, 230, 0.14);
        border-radius: 28px;
        background:
          radial-gradient(circle at top, rgba(115, 141, 206, 0.14), transparent 44%),
          linear-gradient(180deg, rgba(16, 24, 36, 0.88), rgba(8, 12, 18, 0.94));
        box-shadow: 0 28px 100px rgba(0, 0, 0, 0.3);
      }

      .dam-admin-page-intro {
        justify-items: start;
        text-align: left;
        gap: 10px;
      }

      .dam-admin-page-intro__eyebrow,
      .dam-admin-lobby__eyebrow {
        margin: 0;
        color: rgba(184, 198, 228, 0.72);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .dam-admin-page-intro h1,
      .dam-admin-lobby h1 {
        margin: 0;
        font-size: clamp(40px, 6vw, 66px);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      .dam-admin-page-intro p,
      .dam-admin-lobby__description {
        margin: 0;
        max-width: 48rem;
        color: rgba(224, 232, 246, 0.72);
        font-size: 15px;
        line-height: 1.65;
      }

      .dam-admin-page-intro__meta,
      .dam-admin-lobby__meta {
        color: rgba(189, 200, 224, 0.58);
        font-size: 12px;
        letter-spacing: 0.04em;
      }

      .dam-admin-lobby {
        min-height: min(58svh, 620px);
        align-content: center;
      }

      .dam-admin-lobby__brand {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: min(340px, 82vw);
        border: 1px solid rgba(165, 188, 230, 0.18);
        border-radius: 30px;
        background:
          radial-gradient(circle at top, rgba(133, 160, 226, 0.28), transparent 55%),
          rgba(8, 12, 18, 0.92);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.08),
          0 28px 80px rgba(0, 0, 0, 0.34);
        padding: 24px;
      }

      @media (max-width: 960px) {
        .dam-admin-shell-header,
        .dam-admin-shell-header--locked {
          grid-template-columns: auto 1fr auto;
        }

        .dam-admin-shell-brand {
          gap: 12px;
          padding: 12px 16px;
          justify-self: center;
        }

        .dam-admin-shell-brand__copy span:last-child {
          display: none;
        }
      }

      @media (max-width: 720px) {
        .dam-admin-shell-header {
          gap: 12px;
        }

        .dam-admin-shell-brand {
          padding: 12px 14px;
        }

        .dam-admin-shell-brand__wordmark {
          width: 96px;
        }

        .dam-admin-shell-status {
          min-height: 40px;
          padding: 0 10px;
          font-size: 10px;
          letter-spacing: 0.12em;
        }

        .dam-admin-menu-drawer {
          top: 12px;
          left: 12px;
          right: 12px;
          bottom: 12px;
          width: auto;
          padding: 18px;
          border-radius: 24px;
        }

        .dam-admin-page-intro,
        .dam-admin-lobby {
          padding: 30px 20px;
        }

        .dam-admin-page-intro {
          justify-items: center;
          text-align: center;
        }
      }
    `}</style>
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
            <th>Top Source</th>
            <th>Category Source Quality</th>
            <th>Top Source / Campaign</th>
            <th>Recent Examples</th>
          </tr>
        </thead>
        <tbody>
          {categoryIntelligence.categoryBreakdown.length ? (
            categoryIntelligence.categoryBreakdown.map((row) => (
              <tr key={row.category}>
                <td>{formatCategoryLabel(row.category)}</td>
                <td>{formatCount(row.count)}</td>
                <td>{formatRate(row.percentage)}</td>
                <td>
                  <div style={metricListStyle}>
                    <span>{`${row.averageCategoryConfidenceLabel} (${row.averageCategoryConfidenceScore})`}</span>
                    <span>{`Analyzer avg ${row.averageConfidence.toFixed(1)} / 100`}</span>
                  </div>
                </td>
                <td>{formatLatency(row.averageLatencyMs)}</td>
                <td>{formatDecimal(row.averageSourceCount)}</td>
                <td>
                  <div style={metricListStyle}>
                    <span>{formatCategorySourceLabel(row.topCategorySource)}</span>
                    <span>{row.categorySourceQuality}</span>
                  </div>
                </td>
                <td>
                  {row.topSource || row.topCampaign
                    ? `${formatText(row.topSource, 'Unattributed')} / ${formatText(row.topCampaign, 'Not set')}`
                    : 'Unattributed'}
                </td>
                <td>
                  {row.recentExamples.length ? (
                    <div className="dam-admin-analysis-list">
                      {row.recentExamples.map((example) => (
                        <div
                          key={`${row.category}-${example.createdAt ?? 'unknown'}-${example.claimText}`}
                          className="dam-admin-placeholder"
                        >
                          <div style={claimTextClampStyle}>{formatText(example.claimText)}</div>
                          <span>{`${formatDateTime(example.createdAt)} • ${formatCategorySourceLabel(example.categorySource)} • ${example.categoryConfidence}`}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={metricListStyle}>
                      <div style={claimTextClampStyle}>{formatText(row.latestClaimText)}</div>
                      <span>{formatDateTime(row.latestClaimAt)}</span>
                    </div>
                  )}
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

function OtherClaimsTable({ claims }: { claims: AdminClaimRecord[] }) {
  return (
    <div className="dam-admin-table-shell">
      <table className="dam-admin-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Claim Preview</th>
            <th>Verdict</th>
            <th>Confidence</th>
            <th>Latency</th>
            <th>Suggested Category</th>
            <th>Why It Stayed Other</th>
          </tr>
        </thead>
        <tbody>
          {claims.length ? (
            claims.map((claim, index) => (
              <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${index}`}>
                <td>{formatDateTime(claim.createdAt)}</td>
                <td>
                  <div style={claimTextClampStyle}>{formatText(claim.claimText, 'No claim text logged.')}</div>
                </td>
                <td>{formatText(claim.verdict, 'Unknown')}</td>
                <td>{claim.categoryConfidence}</td>
                <td>{formatLatency(claim.latencyMs)}</td>
                <td>{claim.suggestedCategory ? formatCategoryLabel(claim.suggestedCategory) : 'No weak match'}</td>
                <td>{formatText(claim.categoryReason)}</td>
              </tr>
            ))
          ) : (
            <EmptyTableRow colSpan={7} copy="No Other-claims review rows yet." />
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
                    <span>{`${formatCategorySourceLabel(claim.categorySource)} • ${claim.categoryConfidence}`}</span>
                    <span>{claim.categoryReason}</span>
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
    {
      label: 'Other pressure',
      value: formatCount(categories.otherPressure.count),
      note: `${formatRate(categories.otherPressure.share)} of claims`,
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
      {categories.otherPressure.warning ? (
        <div className="dam-admin-subcard" style={{ borderColor: 'rgba(214, 38, 38, 0.48)' }}>
          <h3 style={{ margin: 0 }}>Unclassified pressure</h3>
          <p style={helperCopyStyle}>
            {`${categories.otherPressure.warning} Other share is ${formatRate(categories.otherPressure.share)} across ${formatCount(categories.otherPressure.count)} claims.`}
          </p>
        </div>
      ) : null}
      <SummaryList
        title="Category source notes"
        description="These notes explain how category provenance is currently being assigned."
      >
        <div className="dam-admin-analysis-list">
          {categories.categorySourceNotes.map((note) => (
            <div key={note} className="dam-admin-placeholder">
              {note}
            </div>
          ))}
        </div>
      </SummaryList>
      <CategoriesTable categoryIntelligence={categories} />
      <SummaryList
        title="Claims Currently Classified As Other"
        description="Latest review queue for uncategorized claims. Use this table to tighten deterministic rules without touching analyzer behavior."
      >
        <OtherClaimsTable claims={categories.otherClaims} />
      </SummaryList>
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
