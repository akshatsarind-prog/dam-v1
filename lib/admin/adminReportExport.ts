import 'server-only'

import {
  adminBranchDefinitions,
  buildAdminBranchReport,
  buildLifetimeBranchReport,
  lifetimeBranchDefinitions,
  type BranchReport,
} from '@/lib/admin/adminReportModel'
import type { AdminMetricsResponse, AdminClaimRecord, AdminTimelinePoint } from '@/lib/admin/adminMetricsTypes'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString()
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

function truncateText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}…`
}

function renderPill(label: string) {
  return `<span class="pill">${escapeHtml(label)}</span>`
}

function renderMetric(metric: BranchReport['keyMetrics'][number]) {
  const toneClass = metric.tone ? ` metric--${metric.tone}` : ''
  const note = metric.note ? `<div class="metric__note">${escapeHtml(metric.note)}</div>` : ''

  return `<article class="metric${toneClass}">
    <div class="metric__label">${escapeHtml(metric.label)}</div>
    <div class="metric__value">${escapeHtml(metric.value)}</div>
    ${note}
  </article>`
}

function renderPanel(title: string, items: string[]) {
  return `<section class="panel">
    <h3>${escapeHtml(title)}</h3>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </section>`
}

function renderTable(title: string, columns: string[], rows: string[][], emptyCopy: string, options?: { claimTextColumns?: number[] }) {
  const claimTextColumns = new Set(options?.claimTextColumns ?? [])

  const body =
    rows.length > 0
      ? rows
          .map(
            (row) => `<tr>${row
              .map((cell, index) => {
                const value = claimTextColumns.has(index) ? truncateText(cell, 160) : truncateText(cell, 240)
                return `<td>${escapeHtml(value)}</td>`
              })
              .join('')}</tr>`
          )
          .join('')
      : `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(emptyCopy)}</td></tr>`

  return `<section class="table-section">
    <h3>${escapeHtml(title)}</h3>
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`
}

function renderBranch(report: BranchReport) {
  const badges = report.dataSourceBadges.map(renderPill).join('')
  const metrics = report.keyMetrics.map(renderMetric).join('')
  const notes = [
    renderPanel('Interpretation', report.interpretation),
    renderPanel('Data quality', report.dataQuality),
    renderPanel('Current risk', report.currentRisk),
    renderPanel('Recommended action', report.recommendedAction),
  ].join('')
  const supplemental = report.supplementalPanels?.length
    ? `<div class="panel-grid">${report.supplementalPanels
        .map((panel) => renderPanel(panel.title, panel.items))
        .join('')}</div>`
    : ''

  const funnelOverview = report.funnelOverview
    ? `<section class="subgrid">
        <article class="mini-card">
          <h4>External traffic reference</h4>
          <p>${escapeHtml(report.funnelOverview.externalTrafficNote)}</p>
          <div class="mini-list">
            ${report.funnelOverview.externalTrafficRows
              .map(
                (row) => `<div class="mini-row">
                  <div>
                    <strong>${escapeHtml(row.label)}</strong>
                    ${row.note ? `<span>${escapeHtml(row.note)}</span>` : ''}
                  </div>
                  <em>${escapeHtml(row.value)}</em>
                </div>`
              )
              .join('')}
          </div>
        </article>
        <article class="mini-card">
          <h4>Product funnel</h4>
          <p>${escapeHtml(report.funnelOverview.productFunnelNote)}</p>
          <div class="mini-list">
            ${report.funnelOverview.productFunnelRows
              .map(
                (row) => `<div class="mini-row">
                  <div>
                    <strong>${escapeHtml(row.label)}</strong>
                    ${row.note ? `<span>${escapeHtml(row.note)}</span>` : ''}
                  </div>
                  <em>${escapeHtml(row.value)}</em>
                </div>`
              )
              .join('')}
          </div>
        </article>
      </section>`
    : ''

  const diagnostics = report.diagnostics
    ? `<section class="subgrid">
        <article class="mini-card mini-card--wide">
          <h4>Diagnostic result</h4>
          <div class="mini-list">
            ${report.diagnostics.analyticsEndpointAttempts
              .map(
                (attempt) => `<div class="mini-row">
                  <div>
                    <strong>${escapeHtml(attempt.label)}</strong>
                    <span>${escapeHtml(attempt.endpoint)}</span>
                  </div>
                  <em>${escapeHtml(attempt.httpStatus === null ? 'n/a' : String(attempt.httpStatus))} - ${escapeHtml(attempt.safeErrorMessage)}</em>
                </div>`
              )
              .join('')}
          </div>
          <p class="copy">${escapeHtml(report.diagnostics.finalConclusion)}</p>
        </article>
      </section>`
    : ''

  return `<section class="branch">
    <header class="branch__head">
      <div>
        <div class="eyebrow">${escapeHtml(report.family === 'admin' ? 'Admin branch' : 'Lifetime branch')}</div>
        <h2>${escapeHtml(report.title)}</h2>
        <p>${escapeHtml(report.definition)}</p>
      </div>
      <div class="branch__meta">
        <div class="status status--${escapeHtml(report.statusTone)}">${escapeHtml(report.statusLabel)}</div>
        <div class="muted">Last updated ${escapeHtml(report.lastUpdated)}</div>
      </div>
    </header>
    <div class="badges">${badges}</div>
    ${funnelOverview}
    <div class="metrics">${metrics}</div>
    <div class="panel-grid">${notes}</div>
    ${supplemental}
    ${diagnostics}
    <div class="tables">${report.tables
      .map((table) => renderTable(table.title, table.columns, table.rows, table.emptyCopy, table.title === 'Recent Claims' ? { claimTextColumns: [6] } : undefined))
      .join('')}</div>
  </section>`
}

function renderRecentClaimsSection(metrics: AdminMetricsResponse) {
  const rows = metrics.recentClaims.map((claim: AdminClaimRecord) => [
    formatDateTime(claim.createdAt),
    claim.category.replace(/_/g, ' '),
    claim.verdict,
    `${claim.confidence.toFixed(1)} / 100`,
    formatDecimal(claim.latencyMs),
    claim.attributed ? claim.utmSource ?? claim.referrer ?? 'Tracked' : 'Unattributed',
    truncateText(claim.claimText, 140),
  ])

  return renderTable(
    'Recent Claims',
    ['At', 'Category', 'Verdict', 'Confidence', 'Latency', 'Source', 'Claim text'],
    rows,
    'No recent claims yet.',
    { claimTextColumns: [6] }
  )
}

function renderSlowestClaimsSection(metrics: AdminMetricsResponse) {
  const rows = metrics.operationalHealth.slowestClaims.map((claim) => [
    formatDateTime(claim.createdAt),
    claim.category.replace(/_/g, ' '),
    formatDecimal(claim.latencyMs),
    claim.verdict,
    claim.riskLabel,
    truncateText(claim.claimText, 140),
  ])

  return renderTable(
    'Slowest Claims',
    ['At', 'Category', 'Latency', 'Verdict', 'Risk', 'Claim text'],
    rows,
    'No slow claims yet.',
    { claimTextColumns: [5] }
  )
}

function renderCategoryBreakdownSection(metrics: AdminMetricsResponse) {
  const rows = metrics.categoryIntelligence.categoryBreakdown.map((item) => [
    item.category.replace(/_/g, ' '),
    formatCount(item.count),
    formatRate(item.percentage / 100),
    formatDecimal(item.averageConfidence),
    formatDecimal(item.averageLatencyMs),
    item.topSource ?? 'No data yet',
  ])

  return renderTable(
    'Category Breakdown',
    ['Category', 'Count', 'Share', 'Avg confidence', 'Avg latency', 'Top source'],
    rows,
    'No category breakdown yet.'
  )
}

function renderSourceAttributionSection(metrics: AdminMetricsResponse) {
  const sources = metrics.trafficSourceIntelligence.rows.map((row) => [
    `${row.source} / ${row.medium}`,
    row.campaign,
    formatCount(row.claimSubmissions),
    formatCount(row.uniqueSessions),
    formatCount(row.emailCaptures),
    row.interpretation,
  ])

  return renderTable(
    'Source Attribution',
    ['Source / medium', 'Campaign', 'Claims', 'Sessions', 'Emails', 'Interpretation'],
    sources,
    'No attributed source rows yet.'
  )
}

function renderFunnelAppendix(metrics: AdminMetricsResponse) {
  const rows = metrics.funnelIntelligence.stages.map((stage) => [
    stage.label,
    formatCount(stage.count),
    stage.status === 'manual' ? 'Manual' : stage.status === 'tracked' ? 'Tracked' : 'Not tracked yet',
    stage.sourceLabel,
    stage.comparabilityReason ? `${stage.comparabilityLabel}: ${stage.comparabilityReason}` : stage.comparabilityLabel,
    stage.conversionFromPrevious === null ? 'Not comparable' : formatRate(stage.conversionFromPrevious),
  ])

  return renderTable(
    'Funnel',
    ['Stage', 'Count', 'Status', 'Source', 'Comparability', 'Conversion'],
    rows,
    'No funnel rows yet.'
  )
}

function renderRecommendationsSection(metrics: AdminMetricsResponse) {
  const rows = metrics.operatorRecommendations.map((item) => [
    item.priority,
    item.title,
    item.detail,
  ])

  return renderTable(
    'Recommendations',
    ['Priority', 'Title', 'Detail'],
    rows,
    'No recommendations yet.'
  )
}

function renderExecutiveRead(metrics: AdminMetricsResponse) {
  const executive = metrics.executiveSnapshot
  const lifetime = metrics.lifetimeIntelligence
  const strongestSignal = lifetime.strategy.strongestCurrentSignal
  const biggestRisk = lifetime.strategy.biggestOperationalRisk
  const nextAction = lifetime.strategy.topNextActions[0]?.detail ?? metrics.operatorRecommendations[0]?.detail ?? 'No action available yet.'

  const rows = [
    ['Total claims', formatCount(executive.totalClaims)],
    ['Claims today', formatCount(executive.claimsToday)],
    ['Tracked sessions', formatCount(lifetime.snapshot.totalSessions)],
    ['Returning session rate', formatRate(lifetime.snapshot.returningSessionRate)],
    ['Average latency', `${Math.round(executive.averageLatencyMs)} ms`],
    ['Email captures', formatCount(executive.emailCaptures, 'Not tracked yet')],
  ]

  return `<section class="section">
    <div class="section__head">
      <div>
        <div class="eyebrow">Executive read</div>
        <h2>Founder operating summary</h2>
      </div>
      <div class="muted">Generated ${escapeHtml(formatDateTime(metrics.generatedAt))}</div>
    </div>
    <div class="metrics metrics--compact">
      ${rows
        .map(
          ([label, value]) => `<article class="metric">
            <div class="metric__label">${escapeHtml(label)}</div>
            <div class="metric__value">${escapeHtml(value)}</div>
          </article>`
        )
        .join('')}
    </div>
    <div class="panel-grid">
      ${renderPanel('Strongest signal', [strongestSignal])}
      ${renderPanel('Biggest current risk', [biggestRisk])}
      ${renderPanel('Recommended next action', [nextAction])}
    </div>
  </section>`
}

function renderVerclSupabaseTruth(metrics: AdminMetricsResponse) {
  const vercel = metrics.vercelAnalytics
  const coverage = metrics.lifetimeIntelligence.dataCoverage
  const rows = [
    ['Vercel project linked', vercel.projectLinked ? 'Yes' : 'No'],
    ['Vercel aggregate metrics', vercel.connected ? 'Connected' : 'Unavailable'],
    ['Vercel page views', vercel.pageViews === null ? 'Unavailable' : formatCount(vercel.pageViews)],
    ['Supabase page_view events', formatCount(coverage.trackedPageViewEvents)],
    ['Tracked sessions', formatCount(coverage.trackedSessions)],
    ['Attribution coverage', formatRate(coverage.attributionCoverageRate)],
    ['Visitor/device coverage', `${formatCount(coverage.eventRowsWithVisitorId)} visitor_id rows / ${formatCount(coverage.eventRowsWithDeviceType)} device rows`],
  ]
  const unavailableReason = vercel.connected
    ? 'Vercel aggregate metrics are connected through the server-side integration.'
    : vercel.diagnostics.finalConclusion

  return `<section class="section">
    <div class="section__head">
      <div>
        <div class="eyebrow">Vercel / Supabase truth</div>
        <h2>Two measurement systems</h2>
      </div>
    </div>
    <p class="copy">Vercel measures aggregate traffic in the Vercel dashboard. DAM admin measures Supabase-tracked product telemetry. These numbers are expected to differ.</p>
    <div class="table-wrap">
      <table>
        <tbody>
          ${rows
            .map(
              ([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="copy">${escapeHtml(unavailableReason)}</p>
    <p class="copy">Supabase page_view events are included as product telemetry only, never as a substitute for Vercel traffic truth.</p>
  </section>`
}

function renderDataCoverage(metrics: AdminMetricsResponse) {
  const coverage = metrics.lifetimeIntelligence.dataCoverage
  const rows = [
    ['Vercel project linked', coverage.vercelConnected ? 'Yes' : 'No'],
    ['Vercel aggregate metrics available', metrics.vercelAnalytics.connected ? 'Yes' : 'No'],
    ['Vercel visitors', metrics.vercelAnalytics.visitors === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.visitors)],
    ['Vercel page views', metrics.vercelAnalytics.pageViews === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.pageViews)],
    ['Supabase page_view events', formatCount(coverage.trackedPageViewEvents)],
    ['Tracked sessions', formatCount(coverage.trackedSessions)],
    ['Claim rows', formatCount(coverage.claimRowsTotal)],
    ['Attribution coverage', formatRate(coverage.attributionCoverageRate)],
    ['Visitor coverage', `${formatCount(coverage.eventRowsWithVisitorId)} / ${formatCount(coverage.eventRowsTotal)}`],
    ['Device coverage', `${formatCount(coverage.eventRowsWithDeviceType)} / ${formatCount(coverage.eventRowsTotal)}`],
  ]

  return `<section class="section">
    <div class="section__head">
      <div>
        <div class="eyebrow">Data coverage</div>
        <h2>Tracking completeness</h2>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${rows
            .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </div>
  </section>`
}

function renderTimeline(metrics: AdminMetricsResponse) {
  const rows = metrics.lifetimeIntelligence.timeline.milestones.map((milestone) => [
    milestone.label,
    formatDateTime(milestone.at),
    milestone.detail,
  ])

  const timelinePoints = metrics.lifetimeIntelligence.growth.timeline.map((point: AdminTimelinePoint) => [
    point.day,
    formatCount(point.visitors),
    formatCount(point.sessions),
    formatCount(point.claims),
    formatCount(point.emails),
  ])

  return `<section class="section">
    <div class="section__head">
      <div>
        <div class="eyebrow">Timeline</div>
        <h2>Historical milestones</h2>
      </div>
    </div>
    ${renderTable('Milestones', ['Milestone', 'At', 'Detail'], rows, 'No milestones yet.')}
    ${renderTable('Growth timeline', ['Day', 'Visitors', 'Sessions', 'Claims', 'Emails'], timelinePoints, 'No growth timeline yet.')}
  </section>`
}

export function renderFullAdminReportHtml(metrics: AdminMetricsResponse) {
  const adminReports = adminBranchDefinitions.map((branch) => buildAdminBranchReport(branch.slug, metrics))
  const lifetimeReports = lifetimeBranchDefinitions.map((branch) => buildLifetimeBranchReport(branch.slug, metrics))
  const dateStamp = new Date(metrics.generatedAt || Date.now()).toLocaleString()
  const fileDate = new Date(metrics.generatedAt || Date.now()).toISOString().slice(0, 10)

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>DAM Full Admin Report</title>
      <style>
        :root { --bg: #f7f8fb; --panel: #ffffff; --ink: #101522; --muted: #5c6678; --line: #dde3ee; --accent: #c21f27; }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; }
        .page { max-width: 1120px; margin: 0 auto; padding: 32px 24px 56px; }
        .cover { padding: 28px; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(180deg, #fff, #fafbfe); }
        .logo { display: inline-grid; gap: 4px; margin-bottom: 12px; }
        .logo strong { font-size: 40px; letter-spacing: 0.08em; color: var(--accent); }
        .logo span { color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; }
        h1, h2, h3, h4 { margin: 0; line-height: 1.15; }
        h1 { font-size: 32px; margin-bottom: 8px; }
        h2 { font-size: 24px; }
        h3 { font-size: 18px; }
        h4 { font-size: 15px; }
        p { margin: 0; }
        .muted { color: var(--muted); }
        .eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: var(--muted); margin-bottom: 8px; }
        .section { margin-top: 28px; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--panel); break-inside: avoid; page-break-inside: avoid; }
        .section__head, .branch__head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
        .branch { margin-top: 28px; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--panel); break-inside: avoid; page-break-inside: avoid; }
        .branch__meta { text-align: right; display: grid; gap: 8px; justify-items: end; }
        .status { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--line); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
        .status--good { border-color: #bde5c4; background: #edf9f0; color: #20743b; }
        .status--warning { border-color: #f2d7a4; background: #fff8ea; color: #8a5a10; }
        .status--danger { border-color: #f0b0b4; background: #fff0f1; color: #a9242c; }
        .status--muted, .status--neutral { background: #f7f8fb; color: var(--muted); }
        .pill { display: inline-flex; min-height: 24px; align-items: center; padding: 0 9px; border: 1px solid var(--line); border-radius: 999px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 6px 6px 0; }
        .badges { margin-bottom: 14px; }
        .metrics { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 16px; }
        .metrics--compact { margin-bottom: 0; }
        .metric { padding: 14px; border: 1px solid var(--line); border-radius: 16px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
        .metric__label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .metric__value { font-size: 20px; font-weight: 700; }
        .metric__note { margin-top: 8px; color: var(--muted); font-size: 12px; }
        .metric--warning { border-color: #f2d7a4; }
        .metric--danger { border-color: #f0b0b4; }
        .panel-grid, .subgrid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 14px; }
        .panel, .mini-card { padding: 14px; border: 1px solid var(--line); border-radius: 16px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
        .mini-card--wide { grid-column: 1 / -1; }
        .panel ul { margin: 10px 0 0; padding-left: 18px; color: var(--ink); }
        .panel li + li { margin-top: 6px; }
        .mini-list { display: grid; gap: 8px; margin-top: 10px; }
        .mini-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: #fbfcfe; }
        .mini-row strong { display: block; font-size: 13px; }
        .mini-row span { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }
        .mini-row em { font-style: normal; color: var(--ink); text-align: right; }
        .copy { margin-top: 10px; color: var(--muted); }
        .table-section { margin-top: 16px; }
        .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 16px; background: #fff; }
        table { width: 100%; border-collapse: collapse; min-width: 720px; }
        th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
        th { background: #fbfcfe; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        td { font-size: 13px; }
        .empty { color: var(--muted); }
        .footer { margin-top: 24px; color: var(--muted); font-size: 12px; }
        @media print {
          body { background: #fff; }
          .page { max-width: none; padding: 0; }
          .section, .branch, .cover { break-inside: avoid; page-break-inside: avoid; border-radius: 0; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <section class="cover">
          <div class="logo">
            <strong>DAM</strong>
            <span>Defence Against Misinformation</span>
          </div>
          <h1>Full Admin Report</h1>
          <p class="muted">Private founder operating system</p>
          <p class="muted">Generated ${escapeHtml(dateStamp)}</p>
          <p class="muted">Scope: all admin branches, all lifetime branches, data coverage, Vercel / Supabase truth, and appendix tables.</p>
        </section>

        ${renderExecutiveRead(metrics)}

        <section class="section">
          <div class="section__head">
            <div>
              <div class="eyebrow">Admin branches</div>
              <h2>All branch reports</h2>
            </div>
          </div>
          ${adminReports.map(renderBranch).join('')}
        </section>

        <section class="section">
          <div class="section__head">
            <div>
              <div class="eyebrow">Lifetime report</div>
              <h2>All lifetime branches</h2>
            </div>
          </div>
          ${lifetimeReports
            .map((report) =>
              renderBranch({
                ...report,
                title: report.title === 'Lifetime Intelligence' ? 'Lifetime Overview' : report.title,
              })
            )
            .join('')}
        </section>

        ${renderVerclSupabaseTruth(metrics)}
        ${renderDataCoverage(metrics)}
        ${renderTimeline(metrics)}

        <section class="section">
          <div class="section__head">
            <div>
              <div class="eyebrow">Appendix</div>
              <h2>Reference tables</h2>
            </div>
          </div>
          ${renderRecentClaimsSection(metrics)}
          ${renderSlowestClaimsSection(metrics)}
          ${renderCategoryBreakdownSection(metrics)}
          ${renderSourceAttributionSection(metrics)}
          ${renderFunnelAppendix(metrics)}
          ${renderRecommendationsSection(metrics)}
        </section>

        <div class="footer">
          Filename: dam-full-admin-report-${escapeHtml(fileDate)}.html
        </div>
      </div>
    </body>
  </html>`
}
