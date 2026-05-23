'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useDeferredValue,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import DamBrandMark from '@/components/brand/DamBrandMark'
import type { AdminMetricsResponse } from '@/lib/admin/adminMetricsTypes'
import {
  buildAdminBranchReport,
  buildAdminReportIndexRows,
  buildLifetimeBranchReport,
  buildLifetimeReportIndexRows,
  type AdminBranchSlug,
  type BranchReport,
  type BranchTableRow,
  type BranchTone,
  type LifetimeBranchSlug,
} from '@/lib/admin/adminReportModel'

const SESSION_STORAGE_KEY = 'dam_admin_password'

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

type SummaryResponse = {
  summary: {
    goodStuff: string[]
    badStuff: string[]
    improvementsNeeded: string[]
    ignore: string[]
    nextSteps: string[]
  }
}

type WorkspaceMode =
  | { kind: 'landing' }
  | { kind: 'admin-index' }
  | { kind: 'admin-branch'; slug: AdminBranchSlug }
  | { kind: 'lifetime-index' }
  | { kind: 'lifetime-branch'; slug: LifetimeBranchSlug }

function formatDateTime(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString()
}

function getToneClassName(tone: BranchTone) {
  switch (tone) {
    case 'good':
      return 'dam-report-chip dam-report-chip--good'
    case 'warning':
      return 'dam-report-chip dam-report-chip--warning'
    case 'danger':
      return 'dam-report-chip dam-report-chip--danger'
    case 'muted':
      return 'dam-report-chip dam-report-chip--muted'
    default:
      return 'dam-report-chip'
  }
}

function getBadgeToneClassName(label: string) {
  const normalized = label.toLowerCase()

  if (normalized.includes('partial')) {
    return 'dam-report-badge dam-report-badge--warning'
  }

  if (normalized.includes('manual')) {
    return 'dam-report-badge dam-report-badge--warning'
  }

  if (normalized.includes('vercel')) {
    return 'dam-report-badge'
  }

  if (normalized.includes('derived')) {
    return 'dam-report-badge dam-report-badge--muted'
  }

  return 'dam-report-badge'
}

function Menu({
  pathname,
  isOpen,
  isRefreshing,
  onClose,
  onRefresh,
  onLogout,
}: {
  pathname: string
  isOpen: boolean
  isRefreshing: boolean
  onClose: () => void
  onRefresh: () => void
  onLogout: () => void
}) {
  const linkMeta = [
    {
      href: '/admin/report',
      label: 'Admin Report',
      active: pathname.startsWith('/admin/report'),
    },
    {
      href: '/admin/lifetime',
      label: 'Lifetime Report',
      active: pathname.startsWith('/admin/lifetime'),
    },
  ]

  return (
    <>
      <div
        className={`dam-report-menu-overlay${isOpen ? ' dam-report-menu-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden={isOpen ? 'false' : 'true'}
      />
      <aside
        className={`dam-report-menu${isOpen ? ' dam-report-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="dam-report-menu__head">
          <p>Private founder operating system</p>
          <button
            type="button"
            className="dam-report-menu__close"
            onClick={onClose}
            aria-label="Close admin navigation"
          >
            <span />
            <span />
          </button>
        </div>

        <nav className="dam-report-menu__nav" aria-label="Admin menu">
          {linkMeta.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dam-report-menu__link"
              data-active={item.active}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="dam-report-menu__link dam-report-menu__link--button"
            onClick={() => {
              onClose()
              onRefresh()
            }}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="dam-report-menu__link dam-report-menu__link--button"
            onClick={() => {
              onClose()
              onLogout()
            }}
          >
            Logout
          </button>
        </nav>
      </aside>
    </>
  )
}

function BranchTable({
  title,
  description,
  rows,
  showSearch = false,
}: {
  title: string
  description: string
  rows: BranchTableRow[]
  showSearch?: boolean
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const query = deferredSearch.trim().toLowerCase()
  const filteredRows = !query
    ? rows
    : rows.filter((row) =>
        `${row.title} ${row.definition} ${row.statusLabel}`.toLowerCase().includes(query)
      )

  return (
    <section className="dam-report-table-section">
      <div className="dam-report-section-head">
        <div>
          <p className="dam-report-overline">Branch register</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {showSearch ? (
          <label className="dam-report-search">
            <span>Search branches</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search report branches"
            />
          </label>
        ) : null}
      </div>

      <div className="dam-report-table-shell">
        <table className="dam-report-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Branch</th>
              <th>Definition</th>
              <th>Open</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.number}-${row.href}`}>
                <td>{row.number}</td>
                <td>{row.title}</td>
                <td>{row.definition}</td>
                <td>
                  <Link href={row.href} className="dam-report-open-link">
                    Open
                  </Link>
                </td>
                <td>
                  <span className={getToneClassName(row.statusTone)}>{row.statusLabel}</span>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="dam-report-table__empty">
                  No matching branches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReportSummary({
  password,
  report,
}: {
  password: string
  report: BranchReport
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<SummaryResponse['summary'] | null>(null)

  async function handleSummaryClick() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          branch: report.slug,
          reportData: report.summaryData,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | SummaryResponse
        | { error?: { message?: string | null } | null }
        | null

      if (!response.ok || !payload || !('summary' in payload)) {
        const message =
          payload && 'error' in payload ? payload.error?.message : 'Unable to generate founder summary.'
        throw new Error(message || 'Unable to generate founder summary.')
      }

      setSummary(payload.summary)
    } catch (summaryError) {
      setError(
        summaryError instanceof Error
          ? summaryError.message
          : 'Unable to generate founder summary.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="dam-report-summary-panel">
      <div className="dam-report-summary-panel__head">
        <div>
          <p className="dam-report-overline">Founder summary</p>
          <h3>Summary</h3>
        </div>
        <button
          type="button"
          className="dam-report-button dam-report-button--primary"
          onClick={handleSummaryClick}
          disabled={isLoading}
        >
          {isLoading ? 'Analyzing…' : 'Summary'}
        </button>
      </div>

      {!summary && !error ? (
        <p className="dam-report-summary-panel__copy">
          Use OpenAI to condense this branch into a founder-readable readout of what is good, bad,
          worth fixing, safe to ignore, and what to do next.
        </p>
      ) : null}

      {error ? <p className="dam-report-error">{error}</p> : null}

      {summary ? (
        <div className="dam-report-summary-grid">
          <SummaryBlock title="Good stuff" items={summary.goodStuff} />
          <SummaryBlock title="Bad stuff" items={summary.badStuff} />
          <SummaryBlock title="Improvements needed" items={summary.improvementsNeeded} />
          <SummaryBlock title="What to ignore" items={summary.ignore} />
          <SummaryBlock title="What to do next" items={summary.nextSteps} />
        </div>
      ) : null}
    </section>
  )
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="dam-report-summary-block">
      <h4>{title}</h4>
      <ul>
        {items.length > 0 ? (
          items.map((item) => <li key={`${title}-${item}`}>{item}</li>)
        ) : (
          <li>No strong signal.</li>
        )}
      </ul>
    </article>
  )
}

function ReportBody({ report }: { report: BranchReport }) {
  return (
    <section className="dam-report-body">
      <section className="dam-report-metric-grid">
        {report.keyMetrics.map((metric) => (
          <article key={metric.label} className="dam-report-metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.note ? <p>{metric.note}</p> : null}
          </article>
        ))}
      </section>

      <section className="dam-report-detail-grid">
        <NarrativeBlock title="Interpretation" items={report.interpretation} />
        <NarrativeBlock title="Data quality" items={report.dataQuality} />
        <NarrativeBlock title="Current risk" items={report.currentRisk} />
        <NarrativeBlock title="Recommended action" items={report.recommendedAction} />
      </section>

      {report.tables.map((table) => (
        <section key={table.title} className="dam-report-data-section">
          <div className="dam-report-section-head">
            <div>
              <p className="dam-report-overline">Detailed report</p>
              <h3>{table.title}</h3>
            </div>
          </div>
          <div className="dam-report-table-shell">
            <table className="dam-report-table dam-report-table--detail">
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.length > 0 ? (
                  table.rows.map((row, rowIndex) => (
                    <tr key={`${table.title}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${table.title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={table.columns.length} className="dam-report-table__empty">
                      {table.emptyCopy}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  )
}

function NarrativeBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="dam-report-panel">
      <p className="dam-report-overline">{title}</p>
      <ul className="dam-report-bullet-list">
        {items.length > 0 ? items.map((item) => <li key={`${title}-${item}`}>{item}</li>) : <li>No data yet.</li>}
      </ul>
    </article>
  )
}

function LandingPage({ metrics }: { metrics: AdminMetricsResponse }) {
  const rows = buildAdminReportIndexRows(metrics)

  return (
    <div className="dam-report-stack">
      <section className="dam-report-hero">
        <div className="dam-report-hero__brand-mark">
          <DamBrandMark label="" />
        </div>
        <p className="dam-report-overline dam-report-overline--hero">Defence Against Misinformation</p>
        <h1>DAM</h1>
        <p className="dam-report-hero__subtitle">Defence Against Misinformation</p>
        <p className="dam-report-hero__secondary">Private founder operating system</p>
        <Link href="/admin/report" className="dam-report-anchor-link">
          Open admin report
        </Link>
      </section>

      <BranchTable
        title="Admin report branches"
        description="Scroll the operating system by branch, not by scattered dashboard cards."
        rows={rows}
      />

      <div className="dam-report-footnote">
        <span>Last updated {formatDateTime(metrics.generatedAt)}.</span>
        <span>Source: `/api/admin/metrics`, existing Supabase tables, and derived report logic only.</span>
      </div>
    </div>
  )
}

function AdminIndexPage({ metrics }: { metrics: AdminMetricsResponse }) {
  return (
    <div className="dam-report-stack">
      <section className="dam-report-page-head">
        <p className="dam-report-overline">Admin Report</p>
        <h1>DAM admin report</h1>
        <p>Serious internal reporting across execution, demand, growth quality, and system health.</p>
        <div className="dam-report-head-meta">
          <span>Last updated {formatDateTime(metrics.generatedAt)}</span>
          <span>Source: `/api/admin/metrics` and current Supabase admin telemetry.</span>
        </div>
      </section>

      <BranchTable
        title="Admin report index"
        description="Each branch opens a focused report page instead of another dashboard surface."
        rows={buildAdminReportIndexRows(metrics)}
        showSearch
      />
    </div>
  )
}

function LifetimeIndexPage({ metrics }: { metrics: AdminMetricsResponse }) {
  return (
    <div className="dam-report-stack">
      <section className="dam-report-page-head">
        <p className="dam-report-overline">Lifetime Report</p>
        <h1>DAM lifetime report</h1>
        <p>Lifetime founder intelligence across growth, behavior, product trust, coverage, and operating history.</p>
        <div className="dam-report-head-meta">
          <span>Last updated {formatDateTime(metrics.generatedAt)}</span>
          <span>Source: Supabase-tracked telemetry and derived lifetime metrics. Vercel aggregate traffic is still partial.</span>
        </div>
      </section>

      <BranchTable
        title="Lifetime report index"
        description="Open the lifetime branch you need instead of scanning a single oversized report."
        rows={buildLifetimeReportIndexRows(metrics)}
        showSearch
      />
    </div>
  )
}

function BranchPage({
  family,
  password,
  report,
}: {
  family: 'admin' | 'lifetime'
  password: string
  report: BranchReport
}) {
  const indexHref = family === 'admin' ? '/admin/report' : '/admin/lifetime'

  return (
    <div className="dam-report-stack">
      <section className="dam-report-page-head dam-report-page-head--branch">
        <div className="dam-report-page-head__copy">
          <p className="dam-report-overline">{family === 'admin' ? 'Admin branch' : 'Lifetime branch'}</p>
          <h1>{report.title}</h1>
          <p>{report.definition}</p>
          <div className="dam-report-head-meta">
            <span>Last updated {report.lastUpdated}</span>
            <span className={getToneClassName(report.statusTone)}>{report.statusLabel}</span>
          </div>
          <div className="dam-report-badge-row">
            {report.dataSourceBadges.map((badge) => (
              <span key={badge} className={getBadgeToneClassName(badge)}>
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="dam-report-page-head__actions">
          <Link href={indexHref} className="dam-report-button">
            Back to index
          </Link>
        </div>
      </section>

      <ReportSummary password={password} report={report} />
      <ReportBody report={report} />
    </div>
  )
}

function WorkspaceView({
  mode,
  password,
  metrics,
}: {
  mode: WorkspaceMode
  password: string
  metrics: AdminMetricsResponse
}) {
  switch (mode.kind) {
    case 'landing':
      return <LandingPage metrics={metrics} />
    case 'admin-index':
      return <AdminIndexPage metrics={metrics} />
    case 'admin-branch':
      return (
        <BranchPage
          family="admin"
          password={password}
          report={buildAdminBranchReport(mode.slug, metrics)}
        />
      )
    case 'lifetime-index':
      return <LifetimeIndexPage metrics={metrics} />
    case 'lifetime-branch':
      return (
        <BranchPage
          family="lifetime"
          password={password}
          report={buildLifetimeBranchReport(mode.slug, metrics)}
        />
      )
  }
}

export function AdminReportWorkspace({ mode }: { mode: WorkspaceMode }) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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

  async function loadMetrics(password: string, options?: { persist?: boolean; silent?: boolean }) {
    if (!options?.silent) {
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
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
        }

        setState({
          status: 'locked',
          password: '',
          metrics: null,
          errorMessage: 'Wrong password. Try again.',
        })
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
  }

  useEffect(() => {
    if (state.status !== 'loading' || !state.password || state.metrics) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadMetrics(state.password, {
        persist: false,
        silent: true,
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [state.metrics, state.password, state.status])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

  const showWorkspace =
    state.status === 'ready' || (state.status === 'loading' && Boolean(state.metrics))

  return (
    <main className="dam-shell dam-report-shell">
      <ReportSystemStyles />

      <header className="dam-report-chrome">
        <button
          type="button"
          className="dam-report-burger"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close admin navigation' : 'Open admin navigation'}
        >
          <span />
          <span />
          <span />
        </button>

        <Link href="/admin" className="dam-report-brand" aria-label="Open DAM admin home">
          <span className="dam-report-brand__icon">
            <DamBrandMark label="" />
          </span>
          <div>
            <strong>DAM</strong>
            <span>Private founder operating system</span>
          </div>
        </Link>

        <div className="dam-report-chrome__meta">Private admin</div>
      </header>

      <Menu
        pathname={pathname}
        isOpen={isMenuOpen}
        isRefreshing={state.status === 'loading'}
        onClose={() => setIsMenuOpen(false)}
        onRefresh={() =>
          void loadMetrics(state.password, {
            persist: false,
          })
        }
        onLogout={handleLogout}
      />

      {!showWorkspace || !state.metrics ? (
        <section className="dam-report-auth">
          <div className="dam-report-auth__card">
            <div className="dam-report-auth__brand">
              <span className="dam-report-auth__icon">
                <DamBrandMark label="" />
              </span>
              <h1>DAM</h1>
              <p>Private founder operating system</p>
            </div>

            <form className="dam-report-auth__form" onSubmit={handleSubmit}>
              <label htmlFor="admin-password">Admin password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={state.password}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    password: event.target.value,
                    errorMessage: '',
                  }))
                }
              />
              <button
                type="submit"
                className="dam-report-button dam-report-button--primary"
                disabled={state.status === 'loading'}
              >
                {state.status === 'loading' ? 'Checking access…' : 'Open admin'}
              </button>
            </form>

            {state.errorMessage ? <p className="dam-report-error">{state.errorMessage}</p> : null}
          </div>
        </section>
      ) : (
        <section className="dam-report-frame">
          {state.metrics.error ? (
            <div className="dam-report-error-banner">{state.metrics.error.message}</div>
          ) : null}
          {state.errorMessage ? <div className="dam-report-error-banner">{state.errorMessage}</div> : null}
          <WorkspaceView mode={mode} password={state.password} metrics={state.metrics} />
        </section>
      )}
    </main>
  )
}

function ReportSystemStyles() {
  return (
    <style jsx global>{`
      .dam-report-shell {
        min-height: 100svh;
        padding-bottom: 52px;
      }

      .dam-report-shell,
      .dam-report-shell * {
        font-family:
          "SF Pro Text",
          "Segoe UI",
          system-ui,
          sans-serif;
      }

      .dam-report-shell h1,
      .dam-report-shell h2,
      .dam-report-shell h3,
      .dam-report-shell h4,
      .dam-report-brand strong {
        font-family:
          "Iowan Old Style",
          "Palatino Linotype",
          "Book Antiqua",
          Georgia,
          serif;
        letter-spacing: -0.03em;
      }

      .dam-report-overline,
      .dam-report-table th,
      .dam-report-metric span,
      .dam-report-auth__form label,
      .dam-report-head-meta span,
      .dam-report-badge,
      .dam-report-chip {
        font-family:
          "IBM Plex Mono",
          "SFMono-Regular",
          "JetBrains Mono",
          Consolas,
          monospace;
      }

      .dam-report-chrome,
      .dam-report-frame,
      .dam-report-auth {
        width: min(1220px, calc(100% - 36px));
        position: relative;
        z-index: 1;
        margin: 0 auto;
      }

      .dam-report-chrome {
        min-height: 86px;
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 180px;
        align-items: center;
        gap: 16px;
      }

      .dam-report-burger,
      .dam-report-button,
      .dam-report-menu__link--button {
        cursor: pointer;
      }

      .dam-report-burger {
        width: 48px;
        height: 48px;
        display: inline-grid;
        align-content: center;
        gap: 5px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(12, 12, 14, 0.88);
      }

      .dam-report-burger span,
      .dam-report-menu__close span {
        display: block;
        width: 18px;
        height: 1px;
        margin: 0 auto;
        background: rgba(246, 246, 244, 0.92);
      }

      .dam-report-brand {
        display: inline-flex;
        align-items: center;
        justify-self: center;
        gap: 14px;
        padding: 14px 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
          rgba(9, 9, 11, 0.92);
        box-shadow:
          0 24px 80px rgba(0, 0, 0, 0.24),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .dam-report-brand .dam-brand-mark__icon-shell {
        width: 22px;
        height: 22px;
      }

      .dam-report-brand div {
        display: grid;
        gap: 4px;
      }

      .dam-report-brand strong {
        font-size: 26px;
        line-height: 0.95;
      }

      .dam-report-brand span {
        color: rgba(240, 240, 236, 0.62);
        font-size: 12px;
      }

      .dam-report-chrome__meta {
        justify-self: end;
        color: rgba(240, 240, 236, 0.5);
        font-size: 12px;
      }

      .dam-report-menu-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.48);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 60;
      }

      .dam-report-menu-overlay--open {
        opacity: 1;
        pointer-events: auto;
      }

      .dam-report-menu {
        position: fixed;
        top: 22px;
        left: 22px;
        width: min(320px, calc(100vw - 44px));
        display: grid;
        gap: 20px;
        padding: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(180deg, rgba(20, 22, 25, 0.98), rgba(9, 10, 12, 0.98)),
          rgba(9, 10, 12, 0.98);
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.42);
        transform: translateY(-10px) scale(0.98);
        opacity: 0;
        pointer-events: none;
        transition:
          transform 180ms ease,
          opacity 180ms ease;
        z-index: 70;
      }

      .dam-report-menu--open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }

      .dam-report-menu__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .dam-report-menu__head p {
        margin: 0;
        color: rgba(240, 240, 236, 0.58);
        font-size: 12px;
        line-height: 1.55;
      }

      .dam-report-menu__close {
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: transparent;
      }

      .dam-report-menu__close span:first-child {
        transform: rotate(45deg) translate(1px, 1px);
      }

      .dam-report-menu__close span:last-child {
        transform: rotate(-45deg);
      }

      .dam-report-menu__nav {
        display: grid;
        gap: 8px;
      }

      .dam-report-menu__link {
        min-height: 42px;
        display: flex;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.02);
        color: rgba(248, 248, 245, 0.88);
        padding: 0 14px;
        font-size: 13px;
      }

      .dam-report-menu__link[data-active='true'] {
        border-color: rgba(214, 38, 38, 0.36);
        background: rgba(214, 38, 38, 0.09);
      }

      .dam-report-menu__link--button {
        width: 100%;
        text-align: left;
      }

      .dam-report-auth {
        min-height: calc(100svh - 86px);
        display: grid;
        place-items: center;
      }

      .dam-report-auth__card,
      .dam-report-page-head,
      .dam-report-summary-panel,
      .dam-report-panel,
      .dam-report-metric,
      .dam-report-table-section,
      .dam-report-data-section {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(180deg, rgba(16, 16, 18, 0.94), rgba(8, 8, 10, 0.98)),
          rgba(10, 10, 12, 0.96);
        box-shadow:
          0 24px 90px rgba(0, 0, 0, 0.26),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .dam-report-auth__card {
        width: min(420px, 100%);
        display: grid;
        gap: 22px;
        padding: 28px;
      }

      .dam-report-auth__brand {
        display: grid;
        gap: 10px;
        justify-items: center;
        text-align: center;
      }

      .dam-report-auth__brand .dam-brand-mark__icon-shell,
      .dam-report-hero__brand-mark .dam-brand-mark__icon-shell {
        width: 28px;
        height: 28px;
      }

      .dam-report-auth__brand h1,
      .dam-report-hero h1,
      .dam-report-page-head h1 {
        margin: 0;
        font-size: clamp(40px, 6vw, 70px);
        line-height: 0.92;
      }

      .dam-report-auth__brand p,
      .dam-report-page-head p,
      .dam-report-section-head p,
      .dam-report-hero__secondary,
      .dam-report-summary-panel__copy,
      .dam-report-metric p,
      .dam-report-footnote,
      .dam-report-bullet-list li {
        margin: 0;
        color: rgba(235, 235, 231, 0.68);
        font-size: 14px;
        line-height: 1.62;
      }

      .dam-report-auth__form {
        display: grid;
        gap: 12px;
      }

      .dam-report-auth__form label,
      .dam-report-search span {
        color: rgba(240, 240, 236, 0.58);
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .dam-report-auth__form input,
      .dam-report-search input {
        min-height: 44px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #0a0a0c;
        color: #f8f8f5;
        padding: 0 14px;
        font: inherit;
      }

      .dam-report-button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: #f8f8f5;
        padding: 0 16px;
        font-size: 13px;
      }

      .dam-report-button--primary {
        border-color: rgba(214, 38, 38, 0.42);
        background: rgba(214, 38, 38, 0.88);
      }

      .dam-report-frame,
      .dam-report-stack,
      .dam-report-body,
      .dam-report-detail-grid,
      .dam-report-summary-grid {
        display: grid;
        gap: 18px;
      }

      .dam-report-frame {
        padding-top: 12px;
      }

      .dam-report-hero,
      .dam-report-page-head,
      .dam-report-summary-panel,
      .dam-report-table-section,
      .dam-report-data-section {
        padding: 24px;
      }

      .dam-report-hero {
        min-height: calc(100svh - 168px);
        display: grid;
        align-content: center;
        justify-items: center;
        text-align: center;
        gap: 10px;
      }

      .dam-report-overline {
        color: rgba(240, 240, 236, 0.52);
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .dam-report-overline--hero {
        margin-top: 18px;
      }

      .dam-report-hero__subtitle {
        margin: 0;
        color: rgba(248, 248, 245, 0.94);
        font-size: 22px;
        line-height: 1.3;
      }

      .dam-report-hero__secondary {
        font-size: 16px;
      }

      .dam-report-anchor-link,
      .dam-report-open-link {
        color: #f8f8f5;
        text-decoration: underline;
        text-decoration-color: rgba(214, 38, 38, 0.42);
        text-underline-offset: 4px;
      }

      .dam-report-section-head,
      .dam-report-page-head--branch,
      .dam-report-summary-panel__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
      }

      .dam-report-page-head h1,
      .dam-report-section-head h2,
      .dam-report-section-head h3,
      .dam-report-summary-panel h3 {
        margin: 0;
      }

      .dam-report-page-head__copy,
      .dam-report-search {
        display: grid;
        gap: 10px;
      }

      .dam-report-head-meta,
      .dam-report-badge-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .dam-report-head-meta span {
        color: rgba(240, 240, 236, 0.54);
        font-size: 11px;
      }

      .dam-report-badge,
      .dam-report-chip {
        min-height: 26px;
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 0 8px;
        color: #f8f8f5;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-report-badge--muted,
      .dam-report-chip--muted {
        color: rgba(240, 240, 236, 0.58);
      }

      .dam-report-badge--warning,
      .dam-report-chip--warning {
        border-color: rgba(214, 151, 38, 0.34);
        background: rgba(214, 151, 38, 0.12);
      }

      .dam-report-chip--good {
        border-color: rgba(88, 182, 112, 0.28);
        background: rgba(88, 182, 112, 0.12);
      }

      .dam-report-chip--danger {
        border-color: rgba(214, 38, 38, 0.38);
        background: rgba(214, 38, 38, 0.14);
      }

      .dam-report-metric-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }

      .dam-report-metric {
        display: grid;
        gap: 10px;
        padding: 16px;
      }

      .dam-report-metric span {
        color: rgba(240, 240, 236, 0.5);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .dam-report-metric strong {
        font-size: clamp(22px, 2.7vw, 30px);
        line-height: 1.04;
      }

      .dam-report-detail-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .dam-report-panel {
        padding: 16px;
      }

      .dam-report-bullet-list {
        display: grid;
        gap: 10px;
        margin: 0;
        padding-left: 18px;
      }

      .dam-report-table-shell {
        overflow-x: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .dam-report-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
      }

      .dam-report-table--detail {
        min-width: 820px;
      }

      .dam-report-table th,
      .dam-report-table td {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
        vertical-align: top;
      }

      .dam-report-table th {
        color: rgba(240, 240, 236, 0.52);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .dam-report-table td {
        color: rgba(245, 245, 241, 0.82);
        font-size: 13px;
        line-height: 1.5;
      }

      .dam-report-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .dam-report-table__empty {
        color: rgba(240, 240, 236, 0.58);
      }

      .dam-report-summary-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .dam-report-summary-block {
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        display: grid;
        gap: 10px;
      }

      .dam-report-summary-block h4 {
        margin: 0;
        font-size: 18px;
        line-height: 1.12;
      }

      .dam-report-summary-block ul {
        display: grid;
        gap: 10px;
        margin: 0;
        padding-left: 18px;
      }

      .dam-report-summary-block li {
        color: rgba(235, 235, 231, 0.8);
        font-size: 13px;
        line-height: 1.58;
      }

      .dam-report-footnote {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }

      .dam-report-error,
      .dam-report-error-banner {
        color: #ffbcbc;
        font-size: 13px;
        line-height: 1.55;
      }

      .dam-report-error-banner {
        padding: 14px 16px;
        border: 1px solid rgba(214, 38, 38, 0.34);
        background: rgba(214, 38, 38, 0.1);
      }

      @media (max-width: 900px) {
        .dam-report-chrome {
          grid-template-columns: 52px minmax(0, 1fr);
        }

        .dam-report-chrome__meta {
          display: none;
        }
      }

      @media (max-width: 760px) {
        .dam-report-chrome,
        .dam-report-frame,
        .dam-report-auth {
          width: min(100% - 24px, 1220px);
        }

        .dam-report-hero,
        .dam-report-page-head,
        .dam-report-summary-panel,
        .dam-report-table-section,
        .dam-report-data-section {
          padding: 18px;
        }

        .dam-report-table {
          min-width: 640px;
        }

        .dam-report-page-head__actions {
          width: 100%;
        }

        .dam-report-page-head__actions .dam-report-button {
          width: 100%;
        }
      }
    `}</style>
  )
}
