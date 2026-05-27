'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useDeferredValue,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import AdminBrand from './AdminBrand'
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
  isExporting,
  onClose,
  onRefresh,
  onDownloadFullReport,
  onLogout,
}: {
  pathname: string
  isOpen: boolean
  isRefreshing: boolean
  isExporting: boolean
  onClose: () => void
  onRefresh: () => void
  onDownloadFullReport: () => void
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
          <div className="dam-report-menu__brand">
            <span className="dam-report-menu__brand-icon">
              <AdminBrand variant="icon" sizes="40px" />
            </span>
            <div>
              <span className="dam-report-menu__brand-wordmark">
                <AdminBrand variant="wordmark" sizes="140px" />
              </span>
              <p>Private founder operating system</p>
            </div>
          </div>
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
              onDownloadFullReport()
            }}
          >
            {isExporting ? 'Generating report...' : 'Download Full Report'}
          </button>
          <button
            type="button"
            className="dam-report-menu__link dam-report-menu__link--button"
            onClick={() => {
              onClose()
              onRefresh()
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
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
  const rows = items.map((item) => item.trim()).filter((item) => item.length > 0)

  return (
    <article className="dam-report-summary-block">
      <h4>{title}</h4>
      <ul>
        {rows.length > 0 ? (
          rows.map((item) => <li key={`${title}-${item}`}>{item}</li>)
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

      {report.supplementalPanels?.length ? (
        <section className="dam-report-detail-grid">
          {report.supplementalPanels.map((panel) => (
            <NarrativeBlock key={panel.title} title={panel.title} items={panel.items} />
          ))}
        </section>
      ) : null}

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

function DiagnosticTrafficPanel({ report }: { report: BranchReport }) {
  const rowMap = new Map(report.keyMetrics.map((metric) => [metric.label, metric]))
  const projectLinked = rowMap.get('Project linked')
  const metadataStatus = rowMap.get('Project metadata')
  const analyticsStatus = rowMap.get('Vercel API status')
  const supabasePageViews = rowMap.get('Supabase page_view events')
  const trafficTruth = rowMap.get('Traffic truth status')
  const explanation =
    report.interpretation[0] ??
    'Vercel Web Analytics is enabled, but dashboard-style aggregate metrics are not available through the verified public server-side API. Supabase page_view events remain available as product telemetry, not traffic truth.'
  const action =
    report.recommendedAction[0] ??
    'Use Vercel dashboard for aggregate traffic. Use DAM admin for product behavior.'

  return (
    <section className="dam-report-diagnostic-panel">
      <div className="dam-report-section-head">
        <div>
          <p className="dam-report-overline">Connection diagnostic</p>
          <h2>Vercel traffic connection</h2>
        </div>
      </div>

      <div className="dam-report-diagnostic-panel__rows">
        <div className="dam-report-diagnostic-panel__row">
          <span>Project linked</span>
          <strong>{projectLinked?.value ?? 'Unavailable'}</strong>
        </div>
        <div className="dam-report-diagnostic-panel__row">
          <span>Project metadata</span>
          <strong>{metadataStatus?.value ?? 'Unavailable'}</strong>
        </div>
        <div className="dam-report-diagnostic-panel__row">
          <span>Aggregate analytics</span>
          <strong>{analyticsStatus?.value ?? 'Unavailable'}</strong>
        </div>
        <div className="dam-report-diagnostic-panel__row">
          <span>Supabase page_view events</span>
          <strong>{supabasePageViews?.value ?? 'Unavailable'}</strong>
        </div>
        <div className="dam-report-diagnostic-panel__row">
          <span>Traffic truth</span>
          <strong>{trafficTruth?.value ?? 'Partial coverage'}</strong>
        </div>
      </div>

      <p className="dam-report-diagnostic-panel__copy">{explanation}</p>
      <p className="dam-report-diagnostic-panel__action">{action}</p>
    </section>
  )
}

function FunnelSplitBody({ report }: { report: BranchReport }) {
  const overview = report.funnelOverview
  const productTable = report.tables[0]

  if (!overview) {
    return <ReportBody report={report} />
  }

  return (
    <section className="dam-report-funnel">
      <div className="dam-report-funnel__grid">
        <article className="dam-report-funnel__panel">
          <div className="dam-report-section-head dam-report-section-head--compact">
            <div>
              <p className="dam-report-overline">External traffic reference</p>
              <h3>Vercel dashboard</h3>
            </div>
          </div>
          <p className="dam-report-funnel__copy">{overview.externalTrafficNote}</p>
          <div className="dam-report-funnel__rows">
            {overview.externalTrafficRows.map((row) => (
              <div key={row.label} className="dam-report-funnel__row">
                <div>
                  <span>{row.label}</span>
                  {row.note ? <p>{row.note}</p> : null}
                </div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="dam-report-funnel__panel">
          <div className="dam-report-section-head dam-report-section-head--compact">
            <div>
              <p className="dam-report-overline">Product funnel</p>
              <h3>Supabase-tracked behavior</h3>
            </div>
          </div>
          <p className="dam-report-funnel__copy">{overview.productFunnelNote}</p>
          <div className="dam-report-funnel__rows">
            {overview.productFunnelRows.map((row) => (
              <div key={row.label} className="dam-report-funnel__row">
                <div>
                  <span>{row.label}</span>
                  {row.note ? <p>{row.note}</p> : null}
                </div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      {productTable ? (
        <section className="dam-report-data-section">
          <div className="dam-report-section-head">
            <div>
              <p className="dam-report-overline">Product funnel table</p>
              <h3>{productTable.title}</h3>
            </div>
          </div>
          <div className="dam-report-table-shell">
            <table className="dam-report-table dam-report-table--detail">
              <thead>
                <tr>
                  {productTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productTable.rows.length > 0 ? (
                  productTable.rows.map((row, rowIndex) => (
                    <tr key={`${productTable.title}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${productTable.title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={productTable.columns.length} className="dam-report-table__empty">
                      {productTable.emptyCopy}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}

function NarrativeBlock({ title, items }: { title: string; items: string[] }) {
  const rows = items.map((item) => item.trim()).filter((item) => item.length > 0)

  return (
    <article className="dam-report-panel">
      <p className="dam-report-overline">{title}</p>
      <ul className="dam-report-bullet-list">
        {rows.length > 0 ? rows.map((item) => <li key={`${title}-${item}`}>{item}</li>) : <li>No data yet.</li>}
      </ul>
    </article>
  )
}

function LandingPage({ metrics }: { metrics: AdminMetricsResponse }) {
  const rows = buildAdminReportIndexRows(metrics)

  return (
    <div className="dam-report-stack">
      <section className="dam-report-hero">
        <span className="dam-report-hero__wordmark">
          <AdminBrand variant="wordmark" priority sizes="(max-width: 768px) 220px, 280px" />
        </span>
        <p className="dam-report-overline dam-report-overline--hero">Internal console</p>
        <h1 className="dam-report-hero__title">DAM Admin</h1>
        <p className="dam-report-hero__secondary">Private founder operating system</p>
        <div className="dam-report-hero__actions">
          <Link href="/admin/report" className="dam-report-button dam-report-button--primary">
            Open Admin Report
          </Link>
          <Link href="/admin/lifetime" className="dam-report-button">
            Open Lifetime Report
          </Link>
        </div>
        <div className="dam-report-footnote dam-report-footnote--hero">
          <span>Updated {formatDateTime(metrics.generatedAt)}.</span>
          <span>Protected internal dashboard.</span>
        </div>
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
        <span className="dam-report-page-head__brand">
          <AdminBrand variant="wordmark" priority sizes="(max-width: 768px) 240px, 320px" />
        </span>
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
        <span className="dam-report-page-head__brand">
          <AdminBrand variant="wordmark" priority sizes="(max-width: 768px) 240px, 320px" />
        </span>
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
  const isDiagnostic = report.layoutVariant === 'diagnostic'

  return (
    <div className={`dam-report-stack${isDiagnostic ? ' dam-report-stack--diagnostic' : ''}`}>
      <section
        className={`dam-report-page-head dam-report-page-head--branch${isDiagnostic ? ' dam-report-page-head--diagnostic' : ''}`}
      >
        <span
          className={`dam-report-page-head__brand dam-report-page-head__brand--branch${isDiagnostic ? ' dam-report-page-head__brand--diagnostic' : ''}`}
        >
          <AdminBrand variant="wordmark" sizes="(max-width: 768px) 220px, 280px" />
        </span>
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
      {report.layoutVariant === 'diagnostic' ? (
        <DiagnosticTrafficPanel report={report} />
      ) : report.layoutVariant === 'funnel-split' ? (
        <FunnelSplitBody report={report} />
      ) : (
        <ReportBody report={report} />
      )}
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
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [exportErrorMessage, setExportErrorMessage] = useState('')
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

  async function handleDownloadFullReport() {
    setIsExportingReport(true)
    setExportErrorMessage('')

    try {
      const response = await fetch('/api/admin/report-export', {
        method: 'GET',
        headers: {
          'x-admin-password': state.password,
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string | null } | null }
          | null
        throw new Error(payload?.error?.message || 'Unable to generate full report.')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1] ?? 'dam-full-admin-report.html'

      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (error) {
      setExportErrorMessage(
        error instanceof Error ? error.message : 'Unable to generate full report.'
      )
    } finally {
      setIsExportingReport(false)
    }
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

      {!showWorkspace || !state.metrics ? (
        <section className="dam-report-auth">
          <div className="dam-report-auth__card">
            <div className="dam-report-auth__brand">
              <span className="dam-report-auth__lockup">
                <AdminBrand variant="lockup" priority sizes="(max-width: 768px) 220px, 260px" />
              </span>
              <h1>Admin access</h1>
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
                {state.status === 'loading' ? 'Checking access...' : 'Open admin'}
              </button>
            </form>

            <p className="dam-report-auth__note">Protected internal dashboard</p>
            {state.errorMessage ? <p className="dam-report-error">{state.errorMessage}</p> : null}
          </div>
        </section>
      ) : (
        <>
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
                <AdminBrand variant="icon" sizes="28px" />
              </span>
              <div>
                <span className="dam-report-brand__wordmark">
                  <AdminBrand variant="wordmark" sizes="136px" />
                </span>
                <span>Private founder operating system</span>
              </div>
            </Link>

            <div className="dam-report-chrome__meta">Private admin</div>
          </header>

          <Menu
            pathname={pathname}
            isOpen={isMenuOpen}
            isRefreshing={state.status === 'loading'}
            isExporting={isExportingReport}
            onClose={() => setIsMenuOpen(false)}
            onDownloadFullReport={() => void handleDownloadFullReport()}
            onRefresh={() =>
              void loadMetrics(state.password, {
                persist: false,
              })
            }
            onLogout={handleLogout}
          />

          <section className="dam-report-frame">
            {state.metrics.error ? (
              <div className="dam-report-error-banner">{state.metrics.error.message}</div>
            ) : null}
            {state.errorMessage ? <div className="dam-report-error-banner">{state.errorMessage}</div> : null}
            {exportErrorMessage ? <div className="dam-report-error-banner">{exportErrorMessage}</div> : null}
            <WorkspaceView mode={mode} password={state.password} metrics={state.metrics} />
          </section>
        </>
      )}
    </main>
  )
}

function ReportSystemStyles() {
  return (
    <style jsx global>{`
      .dam-report-shell {
        min-height: 100svh;
        padding: 16px 0 40px;
        background:
          radial-gradient(circle at top, rgba(37, 52, 78, 0.18), transparent 26%),
          linear-gradient(180deg, #0a0d12 0%, #0b0f15 100%);
        color: #edf2f8;
      }

      .dam-report-shell,
      .dam-report-shell * {
        font-family:
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          system-ui,
          sans-serif;
      }

      .dam-report-shell h1,
      .dam-report-shell h2,
      .dam-report-shell h3,
      .dam-report-shell h4 {
        font-family: inherit;
        letter-spacing: -0.03em;
        font-weight: 600;
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
        width: min(1160px, calc(100% - 32px));
        position: relative;
        z-index: 1;
        margin: 0 auto;
      }

      .dam-report-chrome {
        min-height: 72px;
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr) 132px;
        align-items: center;
        gap: 14px;
        padding: 0 4px;
      }

      .dam-report-burger,
      .dam-report-button,
      .dam-report-menu__link--button {
        cursor: pointer;
        transition:
          background-color 160ms ease,
          border-color 160ms ease,
          transform 160ms ease;
      }

      .dam-report-burger {
        width: 42px;
        height: 42px;
        display: inline-grid;
        align-content: center;
        gap: 5px;
        border: 1px solid rgba(140, 157, 185, 0.18);
        border-radius: 12px;
        background: rgba(17, 23, 32, 0.9);
      }

      .dam-report-burger span,
      .dam-report-menu__close span {
        display: block;
        width: 18px;
        height: 1.5px;
        margin: 0 auto;
        background: rgba(236, 242, 248, 0.9);
      }

      .dam-report-burger:hover,
      .dam-report-button:hover,
      .dam-report-menu__link:hover,
      .dam-report-menu__close:hover {
        border-color: rgba(170, 186, 214, 0.28);
        background: rgba(24, 31, 43, 0.98);
      }

      .dam-report-brand {
        display: inline-flex;
        align-items: center;
        justify-self: center;
        gap: 12px;
        min-height: 52px;
        padding: 10px 16px;
        border: 1px solid rgba(140, 157, 185, 0.16);
        border-radius: 16px;
        background: rgba(16, 22, 31, 0.88);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
      }

      .dam-report-brand__icon {
        width: 26px;
        flex: 0 0 26px;
      }

      .dam-report-brand div {
        display: grid;
        gap: 3px;
      }

      .dam-report-brand__wordmark {
        display: block;
        width: clamp(94px, 13vw, 128px);
      }

      .dam-report-brand div > span:last-child {
        color: rgba(190, 202, 220, 0.68);
        font-size: 11px;
        line-height: 1.3;
      }

      .dam-report-chrome__meta {
        justify-self: end;
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        border: 1px solid rgba(140, 157, 185, 0.14);
        border-radius: 999px;
        background: rgba(17, 23, 32, 0.86);
        color: rgba(200, 212, 228, 0.72);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-report-menu-overlay {
        position: fixed;
        inset: 0;
        background: rgba(4, 7, 11, 0.42);
        backdrop-filter: blur(8px);
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
        top: 16px;
        left: 16px;
        width: min(300px, calc(100vw - 32px));
        display: grid;
        gap: 16px;
        padding: 14px;
        border: 1px solid rgba(140, 157, 185, 0.18);
        border-radius: 18px;
        background: rgba(15, 20, 28, 0.98);
        box-shadow: 0 26px 80px rgba(0, 0, 0, 0.34);
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
        gap: 12px;
      }

      .dam-report-menu__brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }

      .dam-report-menu__brand-icon {
        width: 40px;
        flex: 0 0 40px;
      }

      .dam-report-menu__brand-wordmark {
        display: block;
        width: 122px;
        margin-bottom: 6px;
      }

      .dam-report-menu__head p {
        margin: 0;
        color: rgba(188, 200, 217, 0.64);
        font-size: 11px;
        line-height: 1.45;
      }

      .dam-report-menu__close {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(140, 157, 185, 0.16);
        border-radius: 10px;
        background: rgba(22, 28, 38, 0.9);
      }

      .dam-report-menu__close span:first-child {
        transform: rotate(45deg) translate(1px, 1px);
      }

      .dam-report-menu__close span:last-child {
        transform: rotate(-45deg);
      }

      .dam-report-menu__nav {
        display: grid;
        gap: 6px;
      }

      .dam-report-menu__link {
        min-height: 40px;
        display: flex;
        align-items: center;
        border: 1px solid rgba(140, 157, 185, 0.12);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
        color: rgba(240, 245, 250, 0.9);
        padding: 0 12px;
        font-size: 13px;
        text-decoration: none;
      }

      .dam-report-menu__link[data-active='true'] {
        border-color: rgba(148, 164, 191, 0.32);
        background: rgba(92, 113, 148, 0.16);
      }

      .dam-report-menu__link--button {
        width: 100%;
        text-align: left;
      }

      .dam-report-auth {
        width: min(100% - 24px, 520px);
        min-height: calc(100svh - 32px);
        display: grid;
        place-items: center;
        padding: 24px 0;
      }

      .dam-report-auth__card,
      .dam-report-page-head,
      .dam-report-summary-panel,
      .dam-report-panel,
      .dam-report-metric,
      .dam-report-table-section,
      .dam-report-data-section {
        border: 1px solid rgba(128, 146, 176, 0.14);
        border-radius: 20px;
        background: rgba(16, 22, 31, 0.92);
        box-shadow:
          0 18px 60px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .dam-report-auth__card {
        width: min(480px, 100%);
        display: grid;
        gap: 18px;
        padding: 28px 28px 24px;
      }

      .dam-report-auth__brand {
        display: grid;
        gap: 8px;
        justify-items: center;
        text-align: center;
      }

      .dam-report-auth__lockup {
        width: min(220px, 66vw);
      }

      .dam-report-auth__brand h1,
      .dam-report-page-head h1 {
        margin: 0;
        font-size: clamp(30px, 4.6vw, 40px);
        line-height: 1.02;
      }

      .dam-report-auth__brand h1 {
        font-size: clamp(28px, 5vw, 34px);
      }

      .dam-report-page-head--branch h1 {
        font-size: clamp(32px, 4.2vw, 42px);
      }

      .dam-report-page-head--diagnostic h1 {
        font-size: clamp(28px, 3.4vw, 34px);
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
        color: rgba(188, 200, 217, 0.74);
        font-size: 14px;
        line-height: 1.58;
      }

      .dam-report-auth__note {
        margin: -4px 0 0;
        color: rgba(155, 171, 194, 0.64);
        font-size: 12px;
        text-align: center;
      }

      .dam-report-auth__form {
        display: grid;
        gap: 10px;
      }

      .dam-report-auth__form label,
      .dam-report-search span {
        color: rgba(166, 181, 204, 0.68);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .dam-report-auth__form input,
      .dam-report-search input {
        min-height: 46px;
        border: 1px solid rgba(128, 146, 176, 0.18);
        border-radius: 12px;
        background: rgba(8, 12, 18, 0.88);
        color: #f4f7fb;
        padding: 0 14px;
        font: inherit;
        outline: none;
      }

      .dam-report-auth__form input:focus,
      .dam-report-search input:focus {
        border-color: rgba(165, 182, 214, 0.44);
        box-shadow: 0 0 0 3px rgba(92, 113, 148, 0.18);
      }

      .dam-report-button {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid rgba(128, 146, 176, 0.18);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.03);
        color: #edf2f8;
        padding: 0 16px;
        font-size: 13px;
        text-decoration: none;
      }

      .dam-report-button--primary {
        border-color: rgba(214, 77, 77, 0.34);
        background: linear-gradient(180deg, rgba(176, 51, 51, 0.96), rgba(150, 38, 38, 0.96));
      }

      .dam-report-frame,
      .dam-report-stack,
      .dam-report-body,
      .dam-report-detail-grid,
      .dam-report-summary-grid {
        display: grid;
        gap: 16px;
      }

      .dam-report-stack--diagnostic {
        width: min(920px, 100%);
        justify-self: center;
      }

      .dam-report-frame {
        padding-top: 10px;
      }

      .dam-report-hero,
      .dam-report-page-head,
      .dam-report-summary-panel,
      .dam-report-table-section,
      .dam-report-data-section {
        padding: 22px;
      }

      .dam-report-hero {
        min-height: 0;
        display: grid;
        justify-items: start;
        text-align: left;
        gap: 12px;
      }

      .dam-report-hero__wordmark {
        width: clamp(168px, 22vw, 252px);
      }

      .dam-report-page-head__brand {
        display: block;
        width: clamp(150px, 18vw, 220px);
      }

      .dam-report-page-head__brand--branch {
        width: clamp(138px, 16vw, 198px);
      }

      .dam-report-page-head__brand--diagnostic {
        width: clamp(122px, 14vw, 170px);
      }

      .dam-report-overline {
        color: rgba(155, 171, 194, 0.62);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .dam-report-overline--hero {
        margin-top: 0;
      }

      .dam-report-hero__title {
        margin: 0;
        color: #f1f5fa;
        font-size: clamp(30px, 5vw, 36px);
        line-height: 1.06;
      }

      .dam-report-hero__secondary {
        font-size: 15px;
      }

      .dam-report-hero__actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .dam-report-footnote--hero {
        gap: 10px;
        color: rgba(155, 171, 194, 0.64);
        font-size: 12px;
      }

      .dam-report-anchor-link,
      .dam-report-open-link {
        color: #f0f4fa;
        text-decoration: none;
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

      .dam-report-page-head--diagnostic {
        padding: 18px 20px;
      }

      .dam-report-page-head h1,
      .dam-report-section-head h2,
      .dam-report-section-head h3,
      .dam-report-summary-panel h3 {
        margin: 0;
        font-size: clamp(22px, 3vw, 32px);
        line-height: 1.08;
      }

      .dam-report-page-head__copy,
      .dam-report-search {
        display: grid;
        gap: 8px;
      }

      .dam-report-head-meta,
      .dam-report-badge-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .dam-report-head-meta span {
        color: rgba(162, 177, 199, 0.68);
        font-size: 11px;
      }

      .dam-report-badge,
      .dam-report-chip {
        min-height: 24px;
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(128, 146, 176, 0.18);
        border-radius: 999px;
        padding: 0 9px;
        color: #edf2f8;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .dam-report-badge--muted,
      .dam-report-chip--muted {
        color: rgba(180, 193, 210, 0.68);
      }

      .dam-report-badge--warning,
      .dam-report-chip--warning {
        border-color: rgba(214, 151, 38, 0.28);
        background: rgba(214, 151, 38, 0.12);
      }

      .dam-report-chip--good {
        border-color: rgba(88, 182, 112, 0.24);
        background: rgba(88, 182, 112, 0.12);
      }

      .dam-report-chip--danger {
        border-color: rgba(214, 77, 77, 0.28);
        background: rgba(214, 38, 38, 0.14);
      }

      .dam-report-metric-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .dam-report-metric {
        display: grid;
        gap: 8px;
        padding: 16px;
      }

      .dam-report-metric span {
        color: rgba(162, 177, 199, 0.62);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .dam-report-metric strong {
        font-size: clamp(24px, 3vw, 32px);
        line-height: 1.08;
      }

      .dam-report-detail-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .dam-report-panel {
        padding: 16px;
      }

      .dam-report-funnel {
        display: grid;
        gap: 16px;
      }

      .dam-report-funnel__grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dam-report-funnel__panel {
        display: grid;
        gap: 12px;
        padding: 18px;
        border: 1px solid rgba(128, 146, 176, 0.14);
        border-radius: 18px;
        background: rgba(9, 14, 21, 0.72);
        box-shadow:
          0 18px 60px rgba(0, 0, 0, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      .dam-report-section-head--compact {
        gap: 0;
      }

      .dam-report-funnel__copy {
        margin: 0;
        color: rgba(188, 200, 217, 0.74);
        font-size: 14px;
        line-height: 1.55;
      }

      .dam-report-funnel__rows {
        display: grid;
        gap: 8px;
      }

      .dam-report-funnel__row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 12px;
        border: 1px solid rgba(128, 146, 176, 0.12);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
      }

      .dam-report-funnel__row span {
        display: block;
        color: rgba(162, 177, 199, 0.68);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-report-funnel__row p {
        margin: 4px 0 0;
        color: rgba(188, 200, 217, 0.72);
        font-size: 13px;
        line-height: 1.5;
      }

      .dam-report-funnel__row strong {
        color: #edf2f8;
        font-size: 14px;
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
      }

      .dam-report-diagnostic-panel {
        display: grid;
        gap: 14px;
        padding: 18px;
        border: 1px solid rgba(128, 146, 176, 0.14);
        border-radius: 18px;
        background: rgba(9, 14, 21, 0.72);
        box-shadow:
          0 18px 60px rgba(0, 0, 0, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      .dam-report-diagnostic-panel__rows {
        display: grid;
        gap: 8px;
      }

      .dam-report-diagnostic-panel__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid rgba(128, 146, 176, 0.12);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
      }

      .dam-report-diagnostic-panel__row span {
        color: rgba(162, 177, 199, 0.68);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-report-diagnostic-panel__row strong {
        color: #edf2f8;
        font-size: 14px;
        font-weight: 600;
        text-align: right;
      }

      .dam-report-diagnostic-panel__copy,
      .dam-report-diagnostic-panel__action {
        margin: 0;
        color: rgba(188, 200, 217, 0.76);
        font-size: 14px;
        line-height: 1.58;
      }

      .dam-report-diagnostic-panel__action {
        color: #edf2f8;
      }

      .dam-report-bullet-list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding-left: 18px;
      }

      .dam-report-table-shell {
        overflow-x: auto;
        border: 1px solid rgba(128, 146, 176, 0.14);
        border-radius: 16px;
        background: rgba(10, 15, 22, 0.76);
      }

      .dam-report-table {
        width: 100%;
        min-width: 700px;
        border-collapse: collapse;
      }

      .dam-report-table--detail {
        min-width: 820px;
      }

      .dam-report-table th,
      .dam-report-table td {
        padding: 13px 14px;
        border-bottom: 1px solid rgba(128, 146, 176, 0.1);
        text-align: left;
        vertical-align: top;
      }

      .dam-report-table th {
        color: rgba(155, 171, 194, 0.66);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .dam-report-table td {
        color: rgba(232, 238, 245, 0.86);
        font-size: 14px;
        line-height: 1.52;
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
        border: 1px solid rgba(128, 146, 176, 0.14);
        border-radius: 16px;
        background: rgba(9, 14, 21, 0.6);
        display: grid;
        gap: 8px;
      }

      .dam-report-summary-block h4 {
        margin: 0;
        font-size: 16px;
        line-height: 1.2;
      }

      .dam-report-summary-block ul {
        display: grid;
        gap: 10px;
        margin: 0;
        padding-left: 18px;
      }

      .dam-report-summary-block li {
        color: rgba(226, 233, 241, 0.82);
        font-size: 13px;
        line-height: 1.58;
      }

      .dam-report-footnote {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        color: rgba(155, 171, 194, 0.66);
        font-size: 12px;
      }

      .dam-report-error,
      .dam-report-error-banner {
        color: #ffbcbc;
        font-size: 13px;
        line-height: 1.55;
      }

      .dam-report-error-banner {
        padding: 14px 16px;
        border: 1px solid rgba(214, 77, 77, 0.24);
        border-radius: 14px;
        background: rgba(124, 32, 32, 0.16);
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

        .dam-report-hero__actions,
        .dam-report-footnote--hero {
          width: 100%;
        }

        .dam-report-hero__actions .dam-report-button {
          flex: 1 1 100%;
        }

        .dam-report-page-head__actions {
          width: 100%;
        }

        .dam-report-page-head__actions .dam-report-button {
          width: 100%;
        }

        .dam-report-funnel__grid {
          grid-template-columns: 1fr;
        }

        .dam-report-funnel__row {
          flex-direction: column;
        }

        .dam-report-funnel__row strong {
          text-align: left;
          white-space: normal;
        }
      }
    `}</style>
  )
}
