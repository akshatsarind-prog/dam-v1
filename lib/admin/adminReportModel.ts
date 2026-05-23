import type {
  AdminClaimRecord,
  AdminMetricsResponse,
  AdminVercelDiagnostics,
  AdminVercelEndpointAttempt,
  AdminTrafficSourceRecord,
  AdminValueShare,
  OperatorRecommendation,
} from '@/lib/admin/adminMetricsTypes'

export type BranchTone = 'neutral' | 'good' | 'warning' | 'danger' | 'muted'

export type ReportMetric = {
  label: string
  value: string
  note?: string
  tone?: BranchTone
}

export type ReportTable = {
  title: string
  columns: string[]
  rows: string[][]
  emptyCopy: string
}

export type ReportPanel = {
  title: string
  items: string[]
}

export type BranchReport = {
  slug: string
  href: string
  title: string
  definition: string
  layoutVariant?: 'default' | 'diagnostic' | 'funnel-split'
  family: 'admin' | 'lifetime'
  statusLabel: string
  statusTone: BranchTone
  lastUpdated: string
  dataSourceBadges: string[]
  keyMetrics: ReportMetric[]
  interpretation: string[]
  dataQuality: string[]
  currentRisk: string[]
  recommendedAction: string[]
  tables: ReportTable[]
  supplementalPanels?: ReportPanel[]
  funnelOverview?: {
    externalTrafficNote: string
    externalTrafficRows: ReportMetric[]
    productFunnelNote: string
    productFunnelRows: ReportMetric[]
  }
  diagnostics?: {
    projectApiStatus: AdminVercelDiagnostics['projectApiStatus']
    analyticsEndpointAttempts: AdminVercelEndpointAttempt[]
    finalConclusion: string
  }
  summaryData: {
    branch: string
    family: 'admin' | 'lifetime'
    definition: string
    layoutVariant?: 'default' | 'diagnostic' | 'funnel-split'
    status: string
    lastUpdated: string
    dataSourceBadges: string[]
    keyMetrics: ReportMetric[]
    interpretation: string[]
    dataQuality: string[]
    currentRisk: string[]
    recommendedAction: string[]
    tables: ReportTable[]
    supplementalPanels?: ReportPanel[]
    funnelOverview?: {
      externalTrafficNote: string
      externalTrafficRows: ReportMetric[]
      productFunnelNote: string
      productFunnelRows: ReportMetric[]
    }
    diagnostics?: {
      projectApiStatus: AdminVercelDiagnostics['projectApiStatus']
      analyticsEndpointAttempts: AdminVercelEndpointAttempt[]
      finalConclusion: string
    }
  }
}

export type BranchTableRow = {
  number: string
  title: string
  definition: string
  href: string
  statusLabel: string
  statusTone: BranchTone
}

type BranchDefinition<TSlug extends string> = {
  slug: TSlug
  title: string
  definition: string
}

export const adminBranchDefinitions = [
  {
    slug: 'executive-snapshot',
    title: 'Executive Snapshot',
    definition: 'Top-line business health across usage, repeat behavior, attribution, and latency.',
  },
  {
    slug: 'daily-intelligence',
    title: 'Daily Intelligence',
    definition: 'Today-only operating read across growth, product demand, and reliability.',
  },
  {
    slug: 'funnel',
    title: 'Funnel',
    definition: 'Progress from traffic to app opens, claim submissions, and email capture.',
  },
  {
    slug: 'traffic-sources',
    title: 'Traffic Sources',
    definition: 'Source quality, attribution trust, and email capture linkage by channel.',
  },
  {
    slug: 'retention',
    title: 'Retention',
    definition: 'Repeat behavior, session depth, and high-intent usage patterns.',
  },
  {
    slug: 'claim-categories',
    title: 'Claim Categories',
    definition: 'What users test most, where quality is weakest, and which themes dominate.',
  },
  {
    slug: 'operational-health',
    title: 'Operational Health',
    definition: 'Latency, evidence coverage, low-confidence pressure, and operational risk.',
  },
  {
    slug: 'recent-claims',
    title: 'Recent Claims',
    definition: 'The newest claims with verdict, confidence, risk, and attribution context.',
  },
  {
    slug: 'recommendations',
    title: 'Recommendations',
    definition: 'Metrics-derived operator actions ranked by urgency and leverage.',
  },
] as const satisfies readonly BranchDefinition<string>[]

export const lifetimeBranchDefinitions = [
  {
    slug: 'intelligence',
    title: 'Lifetime Intelligence',
    definition: 'Founder-level lifetime operating read across growth, behavior, trust, and reliability.',
  },
  {
    slug: 'company-snapshot',
    title: 'Company Snapshot',
    definition: 'Lifetime scale, operating footprint, and product stage from tracked telemetry.',
  },
  {
    slug: 'growth-intelligence',
    title: 'Growth Intelligence',
    definition: 'Traffic quality, channel conversion, bottlenecks, and growth trajectory.',
  },
  {
    slug: 'user-behavior',
    title: 'User Behavior',
    definition: 'Session depth, time to first claim, common flows, and repeat-use patterns.',
  },
  {
    slug: 'trust-product',
    title: 'Trust & Product',
    definition: 'Category demand, answer quality, suspicious themes, and user intent.',
  },
  {
    slug: 'reliability',
    title: 'Reliability',
    definition: 'Latency distribution, bad rows, attribution failures, and infrastructure pressure.',
  },
  {
    slug: 'strategic-recommendations',
    title: 'Strategic Recommendations',
    definition: 'Highest-leverage product, growth, retention, and risk actions from the lifetime record.',
  },
  {
    slug: 'timeline',
    title: 'Timeline',
    definition: 'Historical milestones across product usage, growth signals, and system evolution.',
  },
  {
    slug: 'data-coverage',
    title: 'Data Coverage',
    definition: 'What the telemetry stack measures today, what is partial, and what is missing.',
  },
  {
    slug: 'vercel-traffic',
    title: 'Vercel Traffic',
    definition: 'Aggregate Vercel traffic coverage status and the current server-side analytics gap.',
  },
] as const satisfies readonly BranchDefinition<string>[]

export type AdminBranchSlug = (typeof adminBranchDefinitions)[number]['slug']
export type LifetimeBranchSlug = (typeof lifetimeBranchDefinitions)[number]['slug']

export function isAdminBranchSlug(value: string): value is AdminBranchSlug {
  return adminBranchDefinitions.some((branch) => branch.slug === value)
}

export function isLifetimeBranchSlug(value: string): value is LifetimeBranchSlug {
  return lifetimeBranchDefinitions.some((branch) => branch.slug === value)
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

function formatLatency(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s` : `${Math.round(value)} ms`
}

function formatDecimal(value: number | null | undefined, fallback = 'No data yet') {
  if (value === null || value === undefined) {
    return fallback
  }

  return value >= 10 ? value.toFixed(1) : value.toFixed(2)
}

function formatText(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

function formatCategory(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  if (value === 'social_rumor') {
    return 'Social rumor'
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function shortenId(value: string | null | undefined, fallback = 'No data yet') {
  if (!value) {
    return fallback
  }

  return value.length <= 14 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`
}

function claimSourceLabel(claim: AdminClaimRecord) {
  if (!claim.attributed) {
    return 'Unattributed'
  }

  return claim.utmSource ?? claim.referrer ?? 'Tracked'
}

function recommendationTone(
  recommendations: OperatorRecommendation[]
): Pick<BranchReport, 'statusLabel' | 'statusTone'> {
  if (recommendations.some((recommendation) => recommendation.priority === 'high')) {
    return {
      statusLabel: 'Action needed',
      statusTone: 'danger',
    }
  }

  if (recommendations.some((recommendation) => recommendation.priority === 'medium')) {
    return {
      statusLabel: 'Watch',
      statusTone: 'warning',
    }
  }

  return {
    statusLabel: 'Stable',
    statusTone: 'good',
  }
}

function vercelApiStatusLabel(unavailableReason: string | null | undefined) {
  const message = unavailableReason?.toLowerCase() ?? ''

  if (message.includes('cannot access this project')) {
    return 'Forbidden'
  }

  if (message.includes('invalid')) {
    return 'Unauthorized'
  }

  if (message.includes('not found')) {
    return 'Project not found'
  }

  if (message.includes('missing')) {
    return 'Not configured'
  }

  if (message.includes('not enabled')) {
    return 'Web Analytics disabled'
  }

  if (message.includes('linked to vercel web analytics')) {
    return 'Aggregate metrics unavailable'
  }

  return 'Unavailable'
}

function buildTrafficRows(rows: AdminTrafficSourceRecord[]): string[][] {
  return rows.slice(0, 8).map((row) => [
    `${row.source} / ${row.medium}`,
    row.campaign,
    formatCount(row.claimSubmissions),
    formatCount(row.uniqueSessions),
    formatDecimal(row.claimsPerSession),
    row.interpretation,
  ])
}

function buildClaimRows(rows: AdminClaimRecord[]): string[][] {
  return rows.slice(0, 10).map((row) => [
    formatDateTime(row.createdAt),
    formatCategory(row.category),
    `${row.confidence.toFixed(1)} / 100`,
    formatLatency(row.latencyMs),
    claimSourceLabel(row),
    formatText(row.riskLabel),
    formatText(row.claimText),
  ])
}

function buildValueShareRows(rows: AdminValueShare[]): string[][] {
  return rows.map((row) => [row.label, formatCount(row.count), formatRate(row.percentage)])
}

function makeReport(input: Omit<BranchReport, 'summaryData'>): BranchReport {
  return {
    ...input,
    summaryData: {
      branch: input.title,
      family: input.family,
      definition: input.definition,
      layoutVariant: input.layoutVariant,
      status: input.statusLabel,
      lastUpdated: input.lastUpdated,
      dataSourceBadges: input.dataSourceBadges,
      keyMetrics: input.keyMetrics,
      interpretation: input.interpretation,
      dataQuality: input.dataQuality,
      currentRisk: input.currentRisk,
      recommendedAction: input.recommendedAction,
      tables: input.tables,
      supplementalPanels: input.supplementalPanels,
      funnelOverview: input.funnelOverview,
      diagnostics: input.diagnostics,
    },
  }
}

export function buildAdminBranchReport(
  slug: AdminBranchSlug,
  metrics: AdminMetricsResponse
): BranchReport {
  const lastUpdated = formatDateTime(metrics.generatedAt)

  switch (slug) {
    case 'executive-snapshot': {
      const executive = metrics.executiveSnapshot
      const status =
        executive.status === 'healthy'
          ? { statusLabel: 'Healthy', statusTone: 'good' as const }
          : executive.status === 'watch'
            ? { statusLabel: 'Watch', statusTone: 'warning' as const }
            : { statusLabel: 'Needs attention', statusTone: 'danger' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Executive Snapshot',
        definition: 'Top-line business health across usage, repeat behavior, attribution, and latency.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'Total claims', value: formatCount(executive.totalClaims) },
          { label: 'Claims today', value: formatCount(executive.claimsToday) },
          { label: 'Unique sessions', value: formatCount(executive.uniqueSessions) },
          {
            label: 'Returning session rate',
            value: formatRate(executive.returningSessionRate),
            tone: (executive.returningSessionRate ?? 0) < 0.15 ? 'warning' : 'good',
          },
          {
            label: 'Average latency',
            value: formatLatency(executive.averageLatencyMs),
            tone: executive.averageLatencyMs >= 8000 ? 'danger' : 'neutral',
          },
          { label: 'Email captures', value: formatCount(executive.emailCaptures, 'Not tracked yet') },
        ],
        interpretation: [
          `Executive status is ${status.statusLabel.toLowerCase()} based on the current usage, attribution, and latency profile.`,
          `Claim-to-email conversion is ${formatRate(executive.claimToEmailConversionRate, 'not measurable yet')}.`,
          `Latest claim seen: ${formatDateTime(executive.lastClaimAt)}. Latest event seen: ${formatDateTime(executive.lastEventAt)}.`,
        ],
        dataQuality: [
          'This branch is computed from the existing `/api/admin/metrics` response only.',
          `${formatCount(executive.unattributedClaims)} claim rows are unattributed and reduce channel trust.`,
          executive.emailCaptures === null
            ? 'Email capture totals are partial because beta-user linkage is not fully available.'
            : 'Email capture totals are sourced from the existing beta-user table only.',
        ],
        currentRisk: [
          executive.averageLatencyMs >= 8000
            ? 'Latency is high enough to damage trust in daily use.'
            : 'No major latency pressure dominates the executive read right now.',
          (executive.returningSessionRate ?? 0) < 0.15
            ? 'Repeat usage is still weak for a founder operating system.'
            : 'Repeat usage is showing enough signal to keep monitoring, not panic.',
          executive.unattributedClaims > Math.max(3, Math.floor(executive.totalClaims * 0.2))
            ? 'Attribution gaps are obscuring which channels are truly working.'
            : 'Attribution coverage is usable for top-line reading.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations.slice(0, 3).map((item) => item.title)
            : ['No operator recommendation is available yet.'],
        tables: [
          {
            title: 'Verdict Mix',
            columns: ['Verdict', 'Count'],
            rows: metrics.verdictBreakdown.map((row) => [row.verdict, formatCount(row.count)]),
            emptyCopy: 'No verdict rows yet.',
          },
          {
            title: 'Risk Label Mix',
            columns: ['Risk label', 'Count'],
            rows: metrics.riskLabelBreakdown.map((row) => [row.riskLabel, formatCount(row.count)]),
            emptyCopy: 'No risk rows yet.',
          },
        ],
      })
    }

    case 'daily-intelligence': {
      const daily = metrics.automationIntelligence
      const status = recommendationTone(daily.recommendations)

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Daily Intelligence',
        definition: 'Today-only operating read across growth, product demand, and reliability.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'Claims today', value: formatCount(daily.dailySnapshot.claimsToday) },
          { label: 'Sessions today', value: formatCount(daily.dailySnapshot.sessionsToday) },
          { label: 'Emails today', value: formatCount(daily.dailySnapshot.emailsToday) },
          {
            label: 'Average latency',
            value: formatLatency(daily.dailySnapshot.averageLatencyMs),
            tone: (daily.dailySnapshot.averageLatencyMs ?? 0) >= 8000 ? 'danger' : 'neutral',
          },
          { label: 'Top source today', value: formatText(daily.dailySnapshot.topSourceToday) },
          { label: 'Top category today', value: formatCategory(daily.dailySnapshot.topCategoryToday) },
        ],
        interpretation: [
          daily.growthSignals.claimSubmissionsTrend.summary,
          daily.growthSignals.repeatSessionTrend.summary,
          `Most tested category today: ${formatCategory(daily.productSignals.mostTestedCategory?.category)}.`,
        ],
        dataQuality: [
          'This branch is derived from the daily automation layer already returned by `/api/admin/metrics`.',
          `Missing attribution rows today are represented as ${formatCount(daily.reliabilitySignals.missingAttributionRows)} unattributed records.`,
          daily.dailySnapshot.claimsToday === 0
            ? 'A zero-claim day should be read cautiously because silence can reflect either low demand or limited data.'
            : 'Daily claim volume is present, so today-level interpretation is grounded in live rows.',
        ],
        currentRisk: [
          daily.recommendedNextAction ? daily.recommendedNextAction.detail : 'No daily action is available yet.',
          daily.reliabilitySignals.claimsOver8Seconds > 0
            ? `${formatCount(daily.reliabilitySignals.claimsOver8Seconds)} claims crossed 8 seconds today.`
            : 'No obvious 8-second latency spike is visible in today’s read.',
          daily.reliabilitySignals.lowConfidenceClusters.length > 0
            ? `${formatCategory(daily.reliabilitySignals.lowConfidenceClusters[0]?.category)} is the main low-confidence pressure point.`
            : 'No low-confidence cluster is standing out today.',
        ],
        recommendedAction:
          daily.recommendations.length > 0
            ? daily.recommendations.slice(0, 4).map((item) => item.title)
            : ['No daily recommendation is available yet.'],
        tables: [
          {
            title: 'Recent High-Intent Sessions',
            columns: ['Session', 'Claims', 'Source', 'Returning', 'Email'],
            rows: daily.productSignals.recentHighIntentSessions.slice(0, 8).map((session) => [
              shortenId(session.sessionId),
              formatCount(session.claimCount),
              formatText(session.source, 'Unattributed'),
              session.isReturning ? 'Yes' : 'No',
              session.emailCaptured ? 'Yes' : 'No',
            ]),
            emptyCopy: 'No high-intent sessions yet.',
          },
        ],
      })
    }

    case 'funnel': {
      const funnel = metrics.funnelIntelligence
      const trackedPageViews = metrics.lifetimeIntelligence.dataCoverage.trackedPageViewEvents
      const trackedSessions = metrics.lifetimeIntelligence.dataCoverage.trackedSessions
      const claimSubmissions = metrics.lifetimeIntelligence.snapshot.totalClaimSubmissions
      const repeatClaimSessions = metrics.lifetimeIntelligence.snapshot.totalRepeatSessions
      const emailCaptures = metrics.emailCaptureIntelligence.totalEmails
      const status =
        funnel.stages.length === 0
          ? { statusLabel: 'Partial', statusTone: 'muted' as const }
          : { statusLabel: 'Tracked', statusTone: 'good' as const }

      const claimsFromSessions =
        trackedSessions > 0 && claimSubmissions <= trackedSessions
          ? claimSubmissions / trackedSessions
          : null
      const repeatSessionsFromSessions =
        trackedSessions > 0 && repeatClaimSessions <= trackedSessions
          ? repeatClaimSessions / trackedSessions
          : null
      const emailsFromClaims =
        claimSubmissions > 0 && emailCaptures <= claimSubmissions
          ? emailCaptures / claimSubmissions
          : null
      const externalTrafficRows: ReportMetric[] = [
        {
          label: 'Vercel Analytics status',
          value: 'External dashboard only / API unavailable',
          note: 'Use the Vercel dashboard for total traffic reach.',
        },
        { label: 'Vercel visitors', value: 'View in Vercel', note: 'Dashboard-only traffic reference.' },
        { label: 'Vercel page views', value: 'View in Vercel', note: 'Dashboard-only traffic reference.' },
        { label: 'Vercel bounce rate', value: 'View in Vercel', note: 'Dashboard-only traffic reference.' },
      ]
      const productFunnelRows: ReportMetric[] = [
        {
          label: 'Supabase page_view events',
          value: formatCount(trackedPageViews),
          note: 'Supabase product telemetry, not Vercel traffic truth.',
        },
        {
          label: 'Tracked app sessions',
          value: formatCount(trackedSessions),
          note: 'Tracked inside DAM product telemetry.',
        },
        {
          label: 'Claim submissions',
          value: formatCount(claimSubmissions),
          note:
            claimsFromSessions === null
              ? 'Not comparable to the previous row in a traffic sense.'
              : `From tracked app sessions: ${formatRate(claimsFromSessions)}.`,
        },
        {
          label: 'Repeat claim sessions',
          value: formatCount(repeatClaimSessions),
          note:
            repeatSessionsFromSessions === null
              ? 'Not comparable to the previous row in a traffic sense.'
              : `From tracked app sessions: ${formatRate(repeatSessionsFromSessions)}.`,
        },
        {
          label: 'Email captures',
          value: formatCount(emailCaptures, 'Not tracked yet'),
          note:
            emailsFromClaims === null
              ? 'Not comparable to the previous row in a traffic sense.'
              : `From claim submissions: ${formatRate(emailsFromClaims)}.`,
        },
      ]

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Funnel',
        definition:
          'Supabase product funnel for tracked behavior, with Vercel traffic kept as an external dashboard reference.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Vercel dashboard reference', 'Supabase tracked', 'Derived'],
        keyMetrics: [...externalTrafficRows, ...productFunnelRows],
        interpretation: [
          'Vercel measures traffic reach. Supabase measures product behavior. This report uses Supabase for the product funnel and Vercel only as an external dashboard reference.',
          'Do not compare Supabase product telemetry directly to Vercel visitors, page views, or bounce rate.',
          funnel.bestAttributedSource
            ? `${funnel.bestAttributedSource.label} is the cleanest attributed source currently visible in product telemetry.`
            : 'No attributed source is strong enough to treat as a distribution winner yet.',
        ],
        dataQuality: [
          'Vercel traffic metrics are available in the Vercel dashboard but are not currently available inside DAM admin through a verified public server-side API.',
          'Supabase page_view events are product telemetry, not traffic truth.',
          'Only Supabase-compatible conversions are shown as rates; Vercel reference rows are intentionally non-comparable.',
        ],
        currentRisk: [
          'Do not use this branch to reason about total site traffic reach.',
          funnel.attributionCoverageRate !== null && funnel.attributionCoverageRate < 0.8
            ? 'Attribution coverage is still weak enough to distort channel decisions.'
            : 'Attribution coverage is usable for current product-telemetry interpretation.',
          funnel.bestAttributedSource === null
            ? 'There is no reliable attributed source winner yet.'
            : 'A best attributed source exists, but it still depends on current attribution coverage.',
        ],
        recommendedAction: [
          'Use the Vercel dashboard for aggregate traffic and use DAM admin for product conversion and attribution coverage.',
          funnel.attributionCoverageRate !== null && funnel.attributionCoverageRate < 0.8
            ? 'Improve tracked links before treating source conclusions as stable.'
            : 'Keep tightening attribution coverage before scaling channel decisions.',
        ],
        funnelOverview: {
          externalTrafficNote:
            'Vercel traffic metrics are available in the Vercel dashboard but are not currently available inside DAM admin through a verified public server-side API.',
          externalTrafficRows,
          productFunnelNote:
            'This is the DAM product funnel. It measures Supabase-tracked behavior inside the product, not total site traffic.',
          productFunnelRows,
        },
        supplementalPanels: [
          {
            title: 'What can be trusted',
            items: [
              'Supabase page_view events, tracked app sessions, claims, repeat sessions, and email captures measure product behavior.',
              'Attribution coverage and best attributed source remain valid inside current Supabase telemetry.',
            ],
          },
          {
            title: 'What cannot be trusted yet',
            items: [
              'Vercel visitors, page views, and bounce rate are not available in this admin through a verified public API.',
              'Manual reach is not treated as a normal funnel stage in this branch.',
            ],
          },
        ],
        tables: [
          {
            title: 'Product Funnel',
            columns: ['Stage', 'Count', 'Conversion', 'Scope'],
            rows: [
              [
                'Supabase page_view events',
                formatCount(trackedPageViews),
                'External reference only',
                'Supabase product telemetry',
              ],
              [
                'Tracked app sessions',
                formatCount(trackedSessions),
                'Starting point',
                'Supabase product telemetry',
              ],
              [
                'Claim submissions',
                formatCount(claimSubmissions),
                claimsFromSessions === null
                  ? 'Not comparable'
                  : `From tracked app sessions: ${formatRate(claimsFromSessions)}`,
                'Supabase product telemetry',
              ],
              [
                'Repeat claim sessions',
                formatCount(repeatClaimSessions),
                repeatSessionsFromSessions === null
                  ? 'Not comparable'
                  : `From tracked app sessions: ${formatRate(repeatSessionsFromSessions)}`,
                'Supabase product telemetry',
              ],
              [
                'Email captures',
                formatCount(emailCaptures, 'Not tracked yet'),
                emailsFromClaims === null
                  ? 'Not comparable'
                  : `From claim submissions: ${formatRate(emailsFromClaims)}`,
                'Supabase product telemetry',
              ],
            ],
            emptyCopy: 'No product funnel rows yet.',
          },
        ],
      })
    }

    case 'traffic-sources': {
      const sources = metrics.trafficSourceIntelligence
      const unattributedRate = sources.attributionCoverageRate !== null ? 1 - sources.attributionCoverageRate : null
      const status =
        !sources.available
          ? { statusLabel: 'Partial', statusTone: 'muted' as const }
          : (unattributedRate ?? 0) >= 0.2
            ? { statusLabel: 'Coverage gap', statusTone: 'warning' as const }
            : { statusLabel: 'Usable', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Traffic Sources',
        definition: 'Source quality, attribution trust, and email capture linkage by channel.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'Source rows', value: formatCount(sources.rows.length) },
          {
            label: 'Best attributed source by claims',
            value: sources.bestAttributedSourceByClaims?.label ?? 'Best attributed source unavailable',
            note: sources.bestAttributedSourceByClaims
              ? `${formatCount(sources.bestAttributedSourceByClaims.claimSubmissions)} attributed claims`
              : 'Attribution coverage gap',
          },
          {
            label: 'Best attributed source by claims/session',
            value:
              sources.bestAttributedSourceByClaimsPerSession?.label ??
              'Best attributed source unavailable',
            note: formatDecimal(sources.bestAttributedSourceByClaimsPerSession?.claimsPerSession),
          },
          {
            label: 'Attributed claims',
            value: formatCount(sources.attributedClaims),
            note: formatRate(sources.attributionCoverageRate),
          },
          {
            label: 'Unattributed claims',
            value: formatCount(sources.unattributedClaims),
            note: formatRate(unattributedRate),
            tone: (unattributedRate ?? 0) >= 0.2 ? 'warning' : 'neutral',
          },
        ],
        interpretation: [
          'Source attribution here is based on Supabase claim and session telemetry, not Vercel referrer totals.',
          sources.note,
          sources.bestAttributedSourceByClaims
            ? `${sources.bestAttributedSourceByClaims.label} is the cleanest attributed claim-volume source right now.`
            : 'No attributed source has enough clear signal to be called a winner.',
          sources.topReferrers.length > 0
            ? `${sources.topReferrers[0].referrer} is the top recorded referrer in the current telemetry.`
            : 'No referrer leadership is visible yet.',
        ],
        dataQuality: [
          `${formatCount(sources.attributedClaims)} attributed claims are currently usable for source analysis.`,
          `${formatCount(sources.unattributedClaims)} claims still sit in the unattributed bucket.`,
          'Traffic rows merge claim, event, and signup context only where the current telemetry exposes it.',
        ],
        currentRisk: [
          (unattributedRate ?? 0) >= 0.2
            ? 'Attribution loss is high enough to distort channel decisions.'
            : 'Attribution loss exists but is not overwhelming the whole branch.',
          sources.rows.length === 0
            ? 'There is not enough source data to trust traffic conclusions yet.'
            : 'Traffic source conclusions are usable but still constrained by tracking coverage.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations
                .filter((item) => /source|attribution|campaign|traffic/i.test(item.title + item.detail))
                .slice(0, 3)
                .map((item) => item.title)
            : ['No source-specific action is available yet.'],
        supplementalPanels: [
          {
            title: 'What can be trusted',
            items: [
              'Claim submissions, email captures, and returning sessions come from Supabase product telemetry.',
              'Attribution rows are based on logged claim/session data and are not equivalent to Vercel referrer totals.',
            ],
          },
          {
            title: 'What cannot be trusted yet',
            items: [
              'Unattributed claims are not a winning distribution channel.',
              'Low attribution coverage means traffic decisions should stay conservative until tracked links are used consistently.',
            ],
          },
        ],
        tables: [
          {
            title: 'Source Performance',
            columns: ['Source / medium', 'Campaign', 'Claims', 'Sessions', 'Claims/session', 'Interpretation'],
            rows: buildTrafficRows(sources.rows),
            emptyCopy: 'No traffic source rows yet.',
          },
          {
            title: 'Attribution Coverage',
            columns: ['Signal', 'Value'],
            rows: [
              ['Attributed claims', formatCount(sources.attributedClaims)],
              ['Unattributed claims', formatCount(sources.unattributedClaims)],
              ['Attribution coverage rate', formatRate(sources.attributionCoverageRate)],
            ],
            emptyCopy: 'No attribution coverage rows yet.',
          },
          {
            title: 'Top Referrers',
            columns: ['Referrer', 'Sessions'],
            rows: sources.topReferrers.map((row) => [row.referrer, formatCount(row.sessionCount)]),
            emptyCopy: 'No referrer rows yet.',
          },
        ],
      })
    }

    case 'retention': {
      const retention = metrics.retentionIntelligence
      const status =
        retention.uniqueSessions === 0
          ? { statusLabel: 'Partial', statusTone: 'muted' as const }
          : (retention.returningSessionRate ?? 0) < 0.15
            ? { statusLabel: 'Weak repeat use', statusTone: 'warning' as const }
            : { statusLabel: 'Repeat signal', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Retention',
        definition: 'Repeat behavior, session depth, and high-intent usage patterns.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'Unique sessions', value: formatCount(retention.uniqueSessions) },
          { label: 'Returning sessions', value: formatCount(retention.returningSessions) },
          {
            label: 'Returning session rate',
            value: formatRate(retention.returningSessionRate),
            tone: (retention.returningSessionRate ?? 0) < 0.15 ? 'warning' : 'good',
          },
          { label: 'Repeat-claim sessions', value: formatCount(retention.repeatClaimSessions) },
          { label: 'Claims per session', value: formatDecimal(retention.averageClaimsPerSession) },
          { label: 'High-intent sessions', value: formatCount(retention.highIntentSessions.length) },
        ],
        interpretation: retention.interpretation,
        dataQuality: [
          'Retention is inferred from tracked session behavior already exposed by the metrics service.',
          `Average time per session: ${formatLatency(retention.averageTimePerSessionMs)}.`,
          retention.averageTimeBetweenSessionsMs === null
            ? 'Average time between sessions is not measurable yet.'
            : `Average time between sessions is ${formatLatency(retention.averageTimeBetweenSessionsMs)}.`,
        ],
        currentRisk: [
          (retention.returningSessionRate ?? 0) < 0.15
            ? 'Repeat use is still too weak for dependable habit formation.'
            : 'Repeat use exists and should be reinforced rather than rescued.',
          retention.highIntentSessions.length === 0
            ? 'There are no obvious high-intent sessions to inspect yet.'
            : 'High-intent sessions are present, which means behavior quality can be studied directly.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations
                .filter((item) => /repeat|retention|session|usage/i.test(item.title + item.detail))
                .slice(0, 3)
                .map((item) => item.title)
            : ['No retention-specific action is available yet.'],
        tables: [
          {
            title: 'High-Intent Sessions',
            columns: ['Session', 'Claims', 'Source', 'Returning', 'Email', 'Last seen'],
            rows: retention.highIntentSessions.slice(0, 10).map((session) => [
              shortenId(session.sessionId),
              formatCount(session.claimCount),
              formatText(session.source, 'Unattributed'),
              session.isReturning ? 'Yes' : 'No',
              session.emailCaptured ? 'Yes' : 'No',
              formatDateTime(session.lastSeenAt),
            ]),
            emptyCopy: 'No high-intent sessions yet.',
          },
        ],
      })
    }

    case 'claim-categories': {
      const categories = metrics.categoryIntelligence
      const weakestConfidence = categories.lowestConfidenceCategory?.averageConfidence ?? null
      const status =
        categories.categoryBreakdown.length === 0
          ? { statusLabel: 'Partial', statusTone: 'muted' as const }
          : (weakestConfidence ?? 100) < 60
            ? { statusLabel: 'Quality watch', statusTone: 'warning' as const }
            : { statusLabel: 'Readable', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Claim Categories',
        definition: 'What users test most, where quality is weakest, and which themes dominate.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'Categories', value: formatCount(categories.categoryBreakdown.length) },
          {
            label: 'Most tested',
            value: formatCategory(categories.mostTestedCategory?.category),
            note: formatRate(categories.mostTestedCategory?.percentage),
          },
          {
            label: 'Lowest confidence',
            value: formatCategory(categories.lowestConfidenceCategory?.category),
            note: categories.lowestConfidenceCategory
              ? `${categories.lowestConfidenceCategory.averageConfidence.toFixed(1)} / 100`
              : 'No data yet',
            tone: (weakestConfidence ?? 100) < 60 ? 'warning' : 'neutral',
          },
          {
            label: 'Highest latency',
            value: formatCategory(categories.highestLatencyCategory?.category),
            note: formatLatency(categories.highestLatencyCategory?.averageLatencyMs),
          },
        ],
        interpretation: categories.interpretation,
        dataQuality: [
          'Category derivation is analytics-only and does not change analyzer behavior.',
          categories.categoryBreakdown.length === 0
            ? 'There are not enough categorized claims to read demand shape yet.'
            : `The category mix is currently driven by ${formatCount(categories.categoryBreakdown.length)} visible buckets.`,
          categories.highestSourceCampaignCategory
            ? `${formatCategory(categories.highestSourceCampaignCategory.category)} currently has the strongest source/campaign concentration.`
            : 'No category has a clear source/campaign concentration yet.',
        ],
        currentRisk: [
          (weakestConfidence ?? 100) < 60
            ? `${formatCategory(categories.lowestConfidenceCategory?.category)} is the clearest answer-quality risk today.`
            : 'No category is flashing extreme quality risk from the current averages.',
          categories.highestLatencyCategory
            ? `${formatCategory(categories.highestLatencyCategory.category)} is the main latency-heavy category.`
            : 'No dominant slow category is visible yet.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations
                .filter((item) => /quality|confidence|category|product/i.test(item.title + item.detail))
                .slice(0, 3)
                .map((item) => item.title)
            : ['No category-specific action is available yet.'],
        tables: [
          {
            title: 'Category Breakdown',
            columns: ['Category', 'Claims', 'Share', 'Avg confidence', 'Avg latency', 'Top source'],
            rows: categories.categoryBreakdown.map((row) => [
              formatCategory(row.category),
              formatCount(row.count),
              formatRate(row.percentage),
              `${row.averageConfidence.toFixed(1)} / 100`,
              formatLatency(row.averageLatencyMs),
              formatText(row.topSource),
            ]),
            emptyCopy: 'No category rows yet.',
          },
        ],
      })
    }

    case 'operational-health': {
      const health = metrics.operationalHealth
      const status =
        health.averageLatencyMs >= 8000 || health.claimsOver8s > 0
          ? { statusLabel: 'Under pressure', statusTone: 'danger' as const }
          : health.lowConfidenceClaimsCount > 0
            ? { statusLabel: 'Watch', statusTone: 'warning' as const }
            : { statusLabel: 'Stable', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Operational Health',
        definition: 'Latency, evidence coverage, low-confidence pressure, and operational risk.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          {
            label: 'Average latency',
            value: formatLatency(health.averageLatencyMs),
            tone: health.averageLatencyMs >= 8000 ? 'danger' : 'neutral',
          },
          { label: 'P95 latency', value: formatLatency(health.p95LatencyMs) },
          { label: 'Claims over 8s', value: formatCount(health.claimsOver8s) },
          { label: 'Claims over 12s', value: formatCount(health.claimsOver12s) },
          { label: 'Zero-source claims', value: formatCount(health.claimsWithZeroSources) },
          { label: 'Low-confidence claims', value: formatCount(health.lowConfidenceClaimsCount) },
        ],
        interpretation: [
          `Median latency is ${formatLatency(health.medianLatencyMs)}.`,
          `Average evidence count per claim is ${formatDecimal(health.averageSourceCount)}.`,
          `Latest claim seen: ${formatDateTime(health.lastClaimAt)}. Latest event seen: ${formatDateTime(health.lastEventAt)}.`,
        ],
        dataQuality: [
          'This branch measures only what the current metrics service already exposes.',
          'Error counts, fallback counts, and malformed-output counts are not currently tracked and are not invented here.',
          `${formatCount(health.claimsWithZeroSources)} claims returned zero sources in the visible telemetry.`,
        ],
        currentRisk: [
          health.averageLatencyMs >= 8000
            ? 'Latency is the main operational risk right now.'
            : 'Latency is not catastrophic, but it still needs monitoring.',
          health.lowConfidenceClaimsCount > 0
            ? `${formatCount(health.lowConfidenceClaimsCount)} low-confidence rows are currently visible.`
            : 'No large low-confidence stack is visible right now.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations
                .filter((item) => /latency|health|reliability|source|quality/i.test(item.title + item.detail))
                .slice(0, 3)
                .map((item) => item.title)
            : ['No operations-specific action is available yet.'],
        tables: [
          {
            title: 'Slowest Claims',
            columns: ['Created', 'Category', 'Confidence', 'Latency', 'Source', 'Risk', 'Claim'],
            rows: buildClaimRows(health.slowestClaims),
            emptyCopy: 'No slow-claim rows yet.',
          },
          {
            title: 'Low-Confidence Claims',
            columns: ['Created', 'Category', 'Confidence', 'Latency', 'Source', 'Risk', 'Claim'],
            rows: buildClaimRows(health.lowConfidenceClaims),
            emptyCopy: 'No low-confidence rows yet.',
          },
        ],
      })
    }

    case 'recent-claims': {
      const claims = metrics.recentClaims
      const highRiskCount = claims.filter((claim) => /high|severe/i.test(claim.riskLabel)).length
      const status =
        claims.length === 0
          ? { statusLabel: 'No rows', statusTone: 'muted' as const }
          : highRiskCount > 0
            ? { statusLabel: 'Contains risk', statusTone: 'warning' as const }
            : { statusLabel: 'Live', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Recent Claims',
        definition: 'The newest claims with verdict, confidence, risk, and attribution context.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked'],
        keyMetrics: [
          { label: 'Visible rows', value: formatCount(claims.length) },
          { label: 'High-risk rows', value: formatCount(highRiskCount) },
          {
            label: 'Low-confidence rows',
            value: formatCount(claims.filter((claim) => claim.confidence < 60).length),
          },
          {
            label: 'Latest claim',
            value: claims[0] ? formatDateTime(claims[0].createdAt) : 'No data yet',
          },
        ],
        interpretation: [
          'This branch is the fastest way to inspect the latest raw operating activity.',
          highRiskCount > 0
            ? 'Recent rows include at least one high-risk or severe-risk claim.'
            : 'Recent rows do not show an immediate high-risk spike.',
          claims.some((claim) => !claim.attributed)
            ? 'Some recent rows are unattributed, so traffic interpretation remains incomplete.'
            : 'Recent rows carry usable attribution coverage.',
        ],
        dataQuality: [
          'Rows come directly from the recent-claims slice exposed by `/api/admin/metrics`.',
          'Only the latest visible rows are shown here, so this branch is intentionally tactical rather than exhaustive.',
          `${formatCount(claims.filter((claim) => !claim.attributed).length)} recent rows are unattributed.`,
        ],
        currentRisk: [
          highRiskCount > 0
            ? 'A founder should inspect the recent high-risk rows directly.'
            : 'No immediate cluster of high-risk rows dominates the latest sample.',
          claims.some((claim) => claim.latencyMs >= 8000)
            ? 'Some recent claims are also operationally slow.'
            : 'The latest sample is not dominated by extreme latency.',
        ],
        recommendedAction:
          metrics.operatorRecommendations.length > 0
            ? metrics.operatorRecommendations.slice(0, 3).map((item) => item.title)
            : ['No linked recommendation is available yet.'],
        tables: [
          {
            title: 'Recent Claim Log',
            columns: ['Created', 'Category', 'Confidence', 'Latency', 'Source', 'Risk', 'Claim'],
            rows: buildClaimRows(claims),
            emptyCopy: 'No recent claims yet.',
          },
        ],
      })
    }

    case 'recommendations': {
      const recommendations = metrics.operatorRecommendations
      const status = recommendationTone(recommendations)

      return makeReport({
        slug,
        href: `/admin/report/${slug}`,
        title: 'Recommendations',
        definition: 'Metrics-derived operator actions ranked by urgency and leverage.',
        family: 'admin',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Derived'],
        keyMetrics: [
          { label: 'Recommendations', value: formatCount(recommendations.length) },
          {
            label: 'High priority',
            value: formatCount(recommendations.filter((item) => item.priority === 'high').length),
            tone: recommendations.some((item) => item.priority === 'high') ? 'danger' : 'neutral',
          },
          {
            label: 'Medium priority',
            value: formatCount(recommendations.filter((item) => item.priority === 'medium').length),
          },
          { label: 'Current executive status', value: metrics.executiveSnapshot.status.replace(/_/g, ' ') },
        ],
        interpretation: [
          'These recommendations come from the current metrics response only.',
          recommendations.length > 0
            ? `${recommendations[0].title} is the top current operator priority.`
            : 'No metrics-derived recommendation is available yet.',
        ],
        dataQuality: [
          'No recommendation in this branch is hard-coded against fake analytics values.',
          'If a signal is missing in the metrics response, it is not invented in the recommendation layer.',
        ],
        currentRisk: [
          recommendations.some((item) => item.priority === 'high')
            ? 'There is at least one high-priority issue requiring founder attention.'
            : 'No high-priority action currently dominates the system.',
        ],
        recommendedAction:
          recommendations.length > 0
            ? recommendations.slice(0, 5).map((item) => `${item.priority.toUpperCase()}: ${item.title}`)
            : ['No recommendation is available yet.'],
        tables: [
          {
            title: 'Action Queue',
            columns: ['Priority', 'Title', 'Detail'],
            rows: recommendations.map((item) => [item.priority, item.title, item.detail]),
            emptyCopy: 'No recommendations yet.',
          },
        ],
      })
    }
  }
}

export function buildLifetimeBranchReport(
  slug: LifetimeBranchSlug,
  metrics: AdminMetricsResponse
): BranchReport {
  const lifetime = metrics.lifetimeIntelligence
  const lastUpdated = formatDateTime(metrics.generatedAt)

  switch (slug) {
    case 'intelligence': {
      const status =
        lifetime.snapshot.totalClaimSubmissions === 0
          ? { statusLabel: 'Sparse', statusTone: 'muted' as const }
          : lifetime.reliability.currentReliabilityStatus.toLowerCase().includes('stable')
            ? { statusLabel: 'Operating', statusTone: 'good' as const }
            : { statusLabel: 'Watch', statusTone: 'warning' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Lifetime Intelligence',
        definition: 'Founder-level lifetime operating read across growth, behavior, trust, and reliability.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'DAM stage', value: lifetime.snapshot.currentDamStage },
          { label: 'Total claim submissions', value: formatCount(lifetime.snapshot.totalClaimSubmissions) },
          { label: 'Tracked sessions', value: formatCount(lifetime.snapshot.totalSessions) },
          { label: 'Returning session rate', value: formatRate(lifetime.snapshot.returningSessionRate) },
          { label: 'Strongest signal', value: lifetime.strategy.strongestCurrentSignal },
          { label: 'Reliability status', value: lifetime.reliability.currentReliabilityStatus },
        ],
        interpretation: [
          `Current DAM stage: ${lifetime.snapshot.currentDamStage}.`,
          lifetime.strategy.strongestCurrentSignal,
          `Most valuable behavioral signal: ${lifetime.behavior.mostValuableBehavioralSignal}`,
        ],
        dataQuality: [
          lifetime.dataCoverage.mismatchSummary,
          'Lifetime intelligence is bounded by tracked Supabase telemetry and derived interpretation only.',
          'Vercel aggregate traffic is still not connected into the metrics response.',
        ],
        currentRisk: [
          lifetime.strategy.biggestOperationalRisk,
          lifetime.growth.biggestGrowthBottleneck,
          `Current user intent: ${lifetime.trustProduct.currentUserIntent}.`,
        ],
        recommendedAction: lifetime.strategy.topNextActions.slice(0, 4).map((item) => item.title),
        tables: [
          {
            title: 'Channel Leaders',
            columns: ['Source / medium', 'Campaign', 'Claims', 'Sessions', 'Claims/session', 'Interpretation'],
            rows: buildTrafficRows(lifetime.growth.topAcquisitionChannels),
            emptyCopy: 'No channel leaders yet.',
          },
        ],
      })
    }

    case 'company-snapshot': {
      const split = lifetime.snapshot.mobileVsDesktopSplit
      const status =
        lifetime.snapshot.totalClaimSubmissions === 0
          ? { statusLabel: 'Sparse', statusTone: 'muted' as const }
          : { statusLabel: 'Mapped', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Company Snapshot',
        definition: 'Lifetime scale, operating footprint, and product stage from tracked telemetry.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'Tracked visitors', value: formatCount(lifetime.snapshot.totalVisitors, 'Unavailable') },
          { label: 'Tracked sessions', value: formatCount(lifetime.snapshot.totalSessions) },
          { label: 'Page views', value: formatCount(lifetime.snapshot.totalPageViews) },
          { label: 'Claim submissions', value: formatCount(lifetime.snapshot.totalClaimSubmissions) },
          { label: 'Email captures', value: formatCount(lifetime.snapshot.totalEmailCaptures, 'Not tracked yet') },
          { label: 'Operational days', value: formatCount(lifetime.snapshot.totalOperationalDays) },
        ],
        interpretation: [
          `Current DAM stage is ${lifetime.snapshot.currentDamStage}.`,
          `Most active source: ${formatText(lifetime.snapshot.mostActiveSource)}.`,
          `Most tested lifetime category: ${formatCategory(lifetime.snapshot.mostTestedCategory)}.`,
        ],
        dataQuality: [
          lifetime.dataCoverage.mismatchSummary,
          split
            ? 'Device split is computed from tracked Supabase event metadata only.'
            : 'Device split is not fully measurable from the current telemetry.',
          'Country-level reach is not available from the current metrics response.',
        ],
        currentRisk: [
          lifetime.snapshot.totalVisitors === null
            ? 'Visitor totals are partial because visitor_id coverage is incomplete.'
            : 'Visitor totals are tracked where visitor_id coverage exists.',
          lifetime.snapshot.averageLatencyMs >= 8000
            ? 'Average lifetime latency is still high for a premium internal system.'
            : 'Lifetime latency is not the dominant snapshot risk.',
        ],
        recommendedAction: [
          lifetime.strategy.highestLeverageGrowthAction,
          lifetime.strategy.highestLeverageRetentionAction,
          lifetime.strategy.highestLeverageProductFix,
        ],
        tables: [
          {
            title: 'Device Split',
            columns: ['Device', 'Sessions', 'Share'],
            rows: split
              ? buildValueShareRows(
                  [
                    { label: 'Mobile', count: split.mobile, percentage: split.mobile / Math.max(lifetime.snapshot.totalSessions, 1) },
                    { label: 'Desktop', count: split.desktop, percentage: split.desktop / Math.max(lifetime.snapshot.totalSessions, 1) },
                    { label: 'Tablet', count: split.tablet, percentage: split.tablet / Math.max(lifetime.snapshot.totalSessions, 1) },
                    { label: 'Unknown', count: split.unknown, percentage: split.unknown / Math.max(lifetime.snapshot.totalSessions, 1) },
                  ].filter((row) => row.count > 0)
                )
              : [],
            emptyCopy: 'Device split is not available yet.',
          },
        ],
      })
    }

    case 'growth-intelligence': {
      const status =
        (lifetime.growth.unattributedTrafficPercentage ?? 0) >= 0.2
          ? { statusLabel: 'Attribution drag', statusTone: 'warning' as const }
          : { statusLabel: 'Readable', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Growth Intelligence',
        definition: 'Traffic quality, channel conversion, bottlenecks, and growth trajectory.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'Visitor trend', value: lifetime.growth.visitorGrowthTrend.summary },
          { label: 'Claim trend', value: lifetime.growth.claimGrowthTrend.summary },
          { label: 'Repeat trend', value: lifetime.growth.repeatSessionTrend.summary },
          { label: 'Email trend', value: lifetime.growth.emailCaptureTrend.summary },
          {
            label: 'Unattributed traffic',
            value: formatRate(lifetime.growth.unattributedTrafficPercentage),
            tone: (lifetime.growth.unattributedTrafficPercentage ?? 0) >= 0.2 ? 'warning' : 'neutral',
          },
          { label: 'Biggest bottleneck', value: lifetime.growth.biggestGrowthBottleneck },
        ],
        interpretation: [
          lifetime.growth.visitorGrowthTrend.summary,
          lifetime.growth.claimGrowthTrend.summary,
          lifetime.growth.emailCaptureTrend.summary,
        ],
        dataQuality: [
          'Growth conclusions depend on tracked source and visitor coverage only.',
          `${formatCount(lifetime.growth.topAcquisitionChannels.length)} acquisition channels are currently visible in the lifetime layer.`,
          'Vercel aggregate top-line traffic is still absent from this branch.',
        ],
        currentRisk: [
          lifetime.growth.biggestGrowthBottleneck,
          (lifetime.growth.unattributedTrafficPercentage ?? 0) >= 0.2
            ? 'Attribution gaps are materially weakening growth confidence.'
            : 'Attribution quality is not the main growth blocker right now.',
        ],
        recommendedAction: [
          lifetime.strategy.highestLeverageGrowthAction,
          ...lifetime.strategy.topNextActions.slice(0, 2).map((item) => item.title),
        ],
        tables: [
          {
            title: 'Top Acquisition Channels',
            columns: ['Source / medium', 'Campaign', 'Claims', 'Sessions', 'Claims/session', 'Interpretation'],
            rows: buildTrafficRows(lifetime.growth.topAcquisitionChannels),
            emptyCopy: 'No lifetime channel rows yet.',
          },
          {
            title: 'Best Converting Sources',
            columns: ['Source / medium', 'Campaign', 'Claims', 'Sessions', 'Claims/session', 'Interpretation'],
            rows: buildTrafficRows(lifetime.growth.bestConvertingSources),
            emptyCopy: 'No best-converting rows yet.',
          },
        ],
      })
    }

    case 'user-behavior': {
      const status =
        (lifetime.snapshot.returningSessionRate ?? 0) < 0.15
          ? { statusLabel: 'Weak habit', statusTone: 'warning' as const }
          : { statusLabel: 'Behavior signal', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'User Behavior',
        definition: 'Session depth, time to first claim, common flows, and repeat-use patterns.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'First-time sessions', value: formatCount(lifetime.behavior.firstTimeSessions) },
          { label: 'Repeat sessions', value: formatCount(lifetime.behavior.repeatSessions) },
          { label: 'Time before first claim', value: formatLatency(lifetime.behavior.averageTimeBeforeFirstClaimMs) },
          { label: 'Most common flow', value: lifetime.behavior.mostCommonUserFlow?.label ?? 'No data yet' },
          { label: 'Example claim usage rate', value: formatRate(lifetime.behavior.exampleClaimUsageRate) },
          { label: 'Most valuable signal', value: lifetime.behavior.mostValuableBehavioralSignal },
        ],
        interpretation: [
          lifetime.behavior.mostValuableBehavioralSignal,
          lifetime.behavior.highIntentSessionPatterns[0] ?? 'No high-intent pattern is visible yet.',
          lifetime.behavior.repeatUserPatterns[0] ?? 'No repeat-user pattern is visible yet.',
        ],
        dataQuality: [
          'Behavior is modeled from tracked sessions and event order only.',
          lifetime.behavior.mobileVsDesktopEngagement
            ? 'Device engagement split is partially measurable.'
            : 'Device engagement split is incomplete because device metadata coverage is partial.',
        ],
        currentRisk: [
          (lifetime.snapshot.returningSessionRate ?? 0) < 0.15
            ? 'The lifetime system still lacks strong repeat-use behavior.'
            : 'Repeat-use behavior exists and should now be amplified.',
          lifetime.behavior.mostCommonUserFlow === null
            ? 'There is no stable dominant flow yet.'
            : `The main flow is ${lifetime.behavior.mostCommonUserFlow.label}, which should shape future operating loops.`,
        ],
        recommendedAction: [
          lifetime.strategy.highestLeverageRetentionAction,
          ...lifetime.strategy.topNextActions.slice(0, 2).map((item) => item.title),
        ],
        tables: [
          {
            title: 'Claims per Session Distribution',
            columns: ['Bucket', 'Sessions', 'Share'],
            rows: buildValueShareRows(lifetime.behavior.claimsPerSessionDistribution),
            emptyCopy: 'No claims-per-session distribution yet.',
          },
          {
            title: 'Longest Sessions',
            columns: ['Session', 'Source', 'Device', 'Claims', 'Duration', 'Email'],
            rows: lifetime.behavior.longestSessions.map((row) => [
              shortenId(row.sessionId),
              formatText(row.source, 'Unattributed'),
              row.deviceType,
              formatCount(row.claimCount),
              formatLatency(row.durationMs),
              row.emailCaptured ? 'Yes' : 'No',
            ]),
            emptyCopy: 'No long sessions yet.',
          },
        ],
      })
    }

    case 'trust-product': {
      const weakestConfidence = lifetime.trustProduct.lowestConfidenceCategory?.averageConfidence ?? null
      const status =
        (weakestConfidence ?? 100) < 60
          ? { statusLabel: 'Quality pressure', statusTone: 'warning' as const }
          : { statusLabel: 'Intent visible', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Trust & Product',
        definition: 'Category demand, answer quality, suspicious themes, and user intent.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived'],
        keyMetrics: [
          { label: 'Current user intent', value: lifetime.trustProduct.currentUserIntent },
          {
            label: 'Lowest-confidence category',
            value: formatCategory(lifetime.trustProduct.lowestConfidenceCategory?.category),
            note: weakestConfidence !== null ? `${weakestConfidence.toFixed(1)} / 100` : 'No data yet',
            tone: (weakestConfidence ?? 100) < 60 ? 'warning' : 'neutral',
          },
          {
            label: 'Highest-latency category',
            value: formatCategory(lifetime.trustProduct.highestLatencyCategory?.category),
            note: formatLatency(lifetime.trustProduct.highestLatencyCategory?.averageLatencyMs),
          },
          { label: 'Low-confidence trend', value: lifetime.trustProduct.lowConfidenceTrend.summary },
        ],
        interpretation: [
          lifetime.trustProduct.currentUserIntent,
          lifetime.trustProduct.lowConfidenceTrend.summary,
          lifetime.trustProduct.recurringMisinformationThemes[0]
            ? `${lifetime.trustProduct.recurringMisinformationThemes[0].label} is the leading misinformation theme.`
            : 'No dominant misinformation theme is visible yet.',
        ],
        dataQuality: [
          'This branch is derived from existing claim logs and analytics-only category mapping.',
          `${formatCount(lifetime.trustProduct.topClaimCategories.length)} top lifetime categories are currently visible.`,
          'Theme detection is descriptive and does not alter analyzer behavior.',
        ],
        currentRisk: [
          (weakestConfidence ?? 100) < 60
            ? `${formatCategory(lifetime.trustProduct.lowestConfidenceCategory?.category)} is the primary trust/product risk.`
            : 'No category is showing severe quality decay right now.',
          lifetime.trustProduct.recurringScamThemes[0]
            ? `${lifetime.trustProduct.recurringScamThemes[0].label} is the main recurring scam theme.`
            : 'No recurring scam theme dominates the current lifetime sample.',
        ],
        recommendedAction: [
          lifetime.strategy.highestLeverageProductFix,
          ...lifetime.strategy.topNextActions.slice(0, 2).map((item) => item.title),
        ],
        tables: [
          {
            title: 'Top Claim Categories',
            columns: ['Category', 'Claims', 'Share', 'Avg confidence', 'Avg latency', 'Top source'],
            rows: lifetime.trustProduct.topClaimCategories.map((row) => [
              formatCategory(row.category),
              formatCount(row.count),
              formatRate(row.percentage),
              `${row.averageConfidence.toFixed(1)} / 100`,
              formatLatency(row.averageLatencyMs),
              formatText(row.topSource),
            ]),
            emptyCopy: 'No lifetime category rows yet.',
          },
          {
            title: 'Scam vs Misinformation Mix',
            columns: ['Bucket', 'Claims', 'Share'],
            rows: buildValueShareRows(lifetime.trustProduct.scamVsMisinformationDistribution),
            emptyCopy: 'No trust-product mix yet.',
          },
        ],
      })
    }

    case 'reliability': {
      const status =
        lifetime.reliability.averageLatencyMs >= 8000 || lifetime.reliability.claimsOver8Seconds > 0
          ? { statusLabel: 'Under pressure', statusTone: 'danger' as const }
          : { statusLabel: 'Stable', statusTone: 'good' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Reliability',
        definition: 'Latency distribution, bad rows, attribution failures, and infrastructure pressure.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'Average latency', value: formatLatency(lifetime.reliability.averageLatencyMs) },
          { label: 'Median latency', value: formatLatency(lifetime.reliability.medianLatencyMs) },
          { label: 'Highest latency ever', value: formatLatency(lifetime.reliability.highestLatencyEverMs) },
          { label: 'Claims over 8s', value: formatCount(lifetime.reliability.claimsOver8Seconds) },
          { label: 'Attribution failures', value: formatCount(lifetime.reliability.attributionFailures) },
          {
            label: 'Unknown / empty rows',
            value: formatCount(
              lifetime.reliability.unknownVerdictRows +
                lifetime.reliability.unknownRiskRows +
                lifetime.reliability.emptyClaimRows
            ),
          },
        ],
        interpretation: [
          lifetime.reliability.currentReliabilityStatus,
          formatText(lifetime.reliability.operationalUptimeIndicator, 'No uptime indicator yet.'),
          `Vercel function health: ${formatText(lifetime.reliability.vercelFunctionHealth, 'Not connected yet')}.`,
        ],
        dataQuality: [
          'Infrastructure status is limited to what the current metrics response already provides.',
          'Vercel function health and deployment count remain unconnected unless a server-side integration is added.',
          `${formatCount(lifetime.reliability.attributionFailures)} lifetime claims still lack attribution.`,
        ],
        currentRisk: [
          lifetime.strategy.biggestOperationalRisk,
          lifetime.reliability.averageLatencyMs >= 8000
            ? 'Lifetime latency remains too high for a premium operating surface.'
            : 'Latency is not the only reliability concern right now.',
        ],
        recommendedAction: [
          lifetime.strategy.highestLeverageProductFix,
          ...lifetime.strategy.topNextActions.slice(0, 2).map((item) => item.title),
        ],
        tables: [
          {
            title: 'Latency Distribution',
            columns: ['Bucket', 'Claims', 'Share'],
            rows: buildValueShareRows(lifetime.reliability.latencyDistribution),
            emptyCopy: 'No latency distribution yet.',
          },
          {
            title: 'Slowest Claims Ever',
            columns: ['Created', 'Category', 'Confidence', 'Latency', 'Source', 'Risk', 'Claim'],
            rows: buildClaimRows(lifetime.reliability.slowestClaimsEver),
            emptyCopy: 'No lifetime slow-claim rows yet.',
          },
        ],
      })
    }

    case 'strategic-recommendations': {
      const status = recommendationTone(lifetime.strategy.topNextActions)

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Strategic Recommendations',
        definition: 'Highest-leverage product, growth, retention, and risk actions from the lifetime record.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Derived'],
        keyMetrics: [
          { label: 'Top next actions', value: formatCount(lifetime.strategy.topNextActions.length) },
          { label: 'Highest leverage product fix', value: lifetime.strategy.highestLeverageProductFix },
          { label: 'Highest leverage growth action', value: lifetime.strategy.highestLeverageGrowthAction },
          { label: 'Highest leverage retention action', value: lifetime.strategy.highestLeverageRetentionAction },
        ],
        interpretation: [
          lifetime.strategy.strongestCurrentSignal,
          lifetime.strategy.biggestAnalyticsBlindSpot,
          lifetime.strategy.biggestOperationalRisk,
        ],
        dataQuality: [
          'This branch is generated from the actual lifetime telemetry-derived recommendation layer.',
          'Missing metrics do not get replaced with fabricated strategic certainty.',
        ],
        currentRisk: [lifetime.strategy.biggestOperationalRisk],
        recommendedAction: [
          lifetime.strategy.highestLeverageProductFix,
          lifetime.strategy.highestLeverageGrowthAction,
          lifetime.strategy.highestLeverageRetentionAction,
        ],
        tables: [
          {
            title: 'Strategic Action Queue',
            columns: ['Priority', 'Title', 'Detail'],
            rows: lifetime.strategy.topNextActions.map((item) => [item.priority, item.title, item.detail]),
            emptyCopy: 'No strategic actions yet.',
          },
        ],
      })
    }

    case 'timeline': {
      const status = lifetime.timeline.hasEnoughHistoricalData
        ? { statusLabel: 'History present', statusTone: 'good' as const }
        : { statusLabel: 'Sparse history', statusTone: 'muted' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Timeline',
        definition: 'Historical milestones across product usage, growth signals, and system evolution.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Derived', 'Partial coverage'],
        keyMetrics: [
          { label: 'Milestones', value: formatCount(lifetime.timeline.milestones.length) },
          { label: 'Historical coverage', value: lifetime.timeline.hasEnoughHistoricalData ? 'Sufficient' : 'Sparse' },
          {
            label: 'Most active day',
            value: lifetime.snapshot.mostActiveDay ? formatDateTime(lifetime.snapshot.mostActiveDay.day) : 'No data yet',
          },
        ],
        interpretation: [
          lifetime.timeline.hasEnoughHistoricalData
            ? 'There is enough historical data to read company milestones.'
            : 'History is still too sparse for a confident narrative arc.',
          lifetime.timeline.milestones[0]?.detail ?? 'No milestone detail is visible yet.',
        ],
        dataQuality: [
          'Timeline quality depends on historical depth in tracked claims, events, and beta-user rows.',
          lifetime.timeline.hasEnoughHistoricalData
            ? 'Historical coverage is good enough for milestone reporting.'
            : 'Sparse historical depth means any timeline story should be read cautiously.',
        ],
        currentRisk: [
          lifetime.timeline.hasEnoughHistoricalData
            ? 'The main risk is interpretation quality, not total absence of history.'
            : 'History is too thin to rely on trend narratives yet.',
        ],
        recommendedAction: [
          'Keep expanding tracked history before making major strategy calls from timeline shape alone.',
        ],
        tables: [
          {
            title: 'Milestones',
            columns: ['Milestone', 'At', 'Detail'],
            rows: lifetime.timeline.milestones.map((item) => [item.label, formatDateTime(item.at), item.detail]),
            emptyCopy: 'No milestones yet.',
          },
          {
            title: 'Growth Timeline',
            columns: ['Day', 'Visitors', 'Sessions', 'Claims', 'Emails'],
            rows: lifetime.growth.timeline.map((row) => [
              row.day,
              formatCount(row.visitors),
              formatCount(row.sessions),
              formatCount(row.claims),
              formatCount(row.emails),
            ]),
            emptyCopy: 'No growth timeline yet.',
          },
        ],
      })
    }

    case 'data-coverage': {
      const status =
        !lifetime.dataCoverage.vercelConnected || lifetime.dataCoverage.eventRowsWithVisitorId === 0
          ? { statusLabel: 'Coverage gap', statusTone: 'warning' as const }
          : { statusLabel: 'Partial', statusTone: 'muted' as const }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Data Coverage',
        definition: 'What the telemetry stack measures today, what is partial, and what is missing.',
        family: 'lifetime',
        ...status,
        lastUpdated,
        dataSourceBadges: ['Supabase tracked', 'Partial coverage', 'Vercel Analytics'],
        keyMetrics: [
          { label: 'Vercel connected', value: lifetime.dataCoverage.vercelConnected ? 'Yes' : 'No' },
          {
            label: 'Traffic truth',
            value: lifetime.dataCoverage.vercelConnected ? 'Split systems' : 'Vercel unavailable',
            note: lifetime.dataCoverage.trafficTruthStatus,
          },
          { label: 'Tracked visitors', value: formatCount(lifetime.dataCoverage.trackedVisitors, 'Unavailable') },
          { label: 'Tracked sessions', value: formatCount(lifetime.dataCoverage.trackedSessions) },
          {
            label: 'Vercel visitors',
            value: metrics.vercelAnalytics.visitors === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.visitors),
          },
          {
            label: 'Vercel page views',
            value: metrics.vercelAnalytics.pageViews === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.pageViews),
          },
          {
            label: 'Attribution coverage',
            value: formatRate(lifetime.dataCoverage.attributionCoverageRate, 'Unavailable'),
          },
        ],
        interpretation: [
          lifetime.dataCoverage.mismatchSummary,
          'Supabase telemetry is the source of truth for product usage and attribution inside this admin.',
          metrics.vercelAnalytics.connected
            ? 'Vercel aggregate traffic is available separately from Supabase product telemetry.'
            : `Vercel aggregate traffic is unavailable: ${formatText(lifetime.dataCoverage.vercelUnavailableReason)}.`,
        ],
        dataQuality: [
          lifetime.dataCoverage.trafficTruthStatus,
          `Event rows with referrer: ${formatCount(lifetime.dataCoverage.eventRowsWithReferrer)}.`,
          `Event rows with landing path: ${formatCount(lifetime.dataCoverage.eventRowsWithLandingPath)}.`,
          `Event rows with any UTM metadata: ${formatCount(lifetime.dataCoverage.eventRowsWithAnyUtm)}.`,
        ],
        currentRisk: [
          lifetime.dataCoverage.eventRowsWithVisitorId === 0
            ? 'Visitor-level analysis is fundamentally limited because visitor_id coverage is missing.'
            : 'Visitor-level analysis is only as strong as current visitor_id coverage.',
          metrics.vercelAnalytics.connected
            ? 'Vercel and Supabase should be compared as different systems, not forced to match.'
            : 'Vercel aggregate visitors and page views are unavailable, so traffic truth is incomplete.',
        ],
        recommendedAction: [
          lifetime.strategy.biggestAnalyticsBlindSpot,
          'Improve visitor_id and attribution coverage before over-trusting growth conclusions.',
        ],
        supplementalPanels: [
          {
            title: 'What can be trusted',
            items: [
              'Supabase tracked sessions, claims, email captures, latency, and returning sessions measure product telemetry.',
              'Vercel traffic, when available, measures aggregate site traffic rather than claim-level product behavior.',
            ],
          },
          {
            title: 'What cannot be trusted yet',
            items: [
              'Supabase tracked visitors should not be presented as a replacement for Vercel aggregate visitors.',
              metrics.vercelAnalytics.connected
                ? 'The two systems use different scopes and should not be expected to match exactly.'
                : `Vercel traffic remains unavailable: ${formatText(lifetime.dataCoverage.vercelUnavailableReason)}.`,
            ],
          },
        ],
        tables: [
          {
            title: 'Coverage Detail',
            columns: ['Signal', 'Value'],
            rows: [
              ['Vercel connected', lifetime.dataCoverage.vercelConnected ? 'Yes' : 'No'],
              ['Vercel visitors', metrics.vercelAnalytics.visitors === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.visitors)],
              ['Vercel page views', metrics.vercelAnalytics.pageViews === null ? 'Unavailable' : formatCount(metrics.vercelAnalytics.pageViews)],
              ['Vercel bounce rate', metrics.vercelAnalytics.bounceRate === null ? 'Unavailable' : formatRate(metrics.vercelAnalytics.bounceRate)],
              ['Tracked visitors', formatCount(lifetime.dataCoverage.trackedVisitors, 'Unavailable')],
              ['Tracked sessions', formatCount(lifetime.dataCoverage.trackedSessions)],
              ['Tracked page_view events', formatCount(lifetime.dataCoverage.trackedPageViewEvents)],
              ['Tracked app_open events', formatCount(lifetime.dataCoverage.trackedAppOpenEvents)],
              ['Event rows with visitor_id / total', `${formatCount(lifetime.dataCoverage.eventRowsWithVisitorId)} / ${formatCount(lifetime.dataCoverage.eventRowsTotal)}`],
              ['Event rows with device_type / total', `${formatCount(lifetime.dataCoverage.eventRowsWithDeviceType)} / ${formatCount(lifetime.dataCoverage.eventRowsTotal)}`],
              ['Event rows with referrer', formatCount(lifetime.dataCoverage.eventRowsWithReferrer)],
              ['Event rows with landing path', formatCount(lifetime.dataCoverage.eventRowsWithLandingPath)],
              ['Event rows with any UTM', formatCount(lifetime.dataCoverage.eventRowsWithAnyUtm)],
              ['Claim rows with visitor_id / total', `${formatCount(lifetime.dataCoverage.claimRowsWithVisitorId)} / ${formatCount(lifetime.dataCoverage.claimRowsTotal)}`],
              ['Claim rows with attribution / total', `${formatCount(lifetime.dataCoverage.claimRowsWithAttribution)} / ${formatCount(lifetime.dataCoverage.claimRowsTotal)}`],
              ['Attribution coverage rate', formatRate(lifetime.dataCoverage.attributionCoverageRate)],
              ['Traffic truth status', lifetime.dataCoverage.trafficTruthStatus],
            ],
            emptyCopy: 'No coverage rows yet.',
          },
        ],
      })
    }

    case 'vercel-traffic': {
      const vercel = metrics.vercelAnalytics
      const supabasePageViews = formatCount(
        metrics.lifetimeIntelligence.dataCoverage.trackedPageViewEvents
      )

      if (!vercel.connected) {
        const unavailableExplanation =
          'Vercel Web Analytics is enabled, but aggregate traffic metrics are not currently available through the server-side admin connection.'
        const apiStatus = vercelApiStatusLabel(vercel.unavailableReason)
        const diagnosticConclusion = vercel.diagnostics.finalConclusion

        return makeReport({
          slug,
          href: `/admin/lifetime/${slug}`,
          title: 'Vercel Traffic',
          definition:
            'Compact diagnostic status for the secure Vercel Web Analytics connection used by the admin.',
          layoutVariant: 'diagnostic',
          family: 'lifetime',
          statusLabel: 'Unavailable',
          statusTone: 'warning',
          lastUpdated,
          dataSourceBadges: ['Vercel Analytics', 'Supabase tracked', 'Partial coverage'],
          keyMetrics: [
            {
              label: 'Project linked',
              value: vercel.projectLinked ? 'Yes' : 'No',
            },
            {
              label: 'Vercel API status',
              value: apiStatus,
              note: formatText(vercel.unavailableReason),
            },
            {
              label: 'Project metadata',
              value: vercel.diagnostics.projectApiStatus,
              note: 'Official Vercel REST project endpoint',
            },
            {
              label: 'Supabase page_view events',
              value: supabasePageViews,
              note: 'Supabase tracked only, not Vercel aggregate traffic',
            },
            {
              label: 'Traffic truth status',
              value: 'Partial coverage',
              note: metrics.lifetimeIntelligence.dataCoverage.trafficTruthStatus,
            },
          ],
          interpretation: [
            unavailableExplanation,
            'Supabase page_view events still exist, but they should not be read as Vercel visitors, page views, or bounce rate.',
            diagnosticConclusion,
          ],
          dataQuality: [
            formatText(vercel.unavailableReason),
            'No real Vercel visitor, page-view, or bounce-rate metrics are available to this branch right now.',
          ],
          currentRisk: [
            'Traffic truth is incomplete inside admin until the secure Vercel connection returns aggregate metrics.',
          ],
          recommendedAction: [
            'Fix the secure server-side Vercel connection before using this branch for traffic decisions.',
          ],
          tables: [],
          diagnostics: {
            projectApiStatus: vercel.diagnostics.projectApiStatus,
            analyticsEndpointAttempts: vercel.diagnostics.analyticsEndpointAttempts,
            finalConclusion: diagnosticConclusion,
          },
          supplementalPanels: [
            {
              title: 'Diagnostic result',
              items: vercel.diagnostics.analyticsEndpointAttempts.map(
                (attempt) =>
                  `${attempt.label}: ${attempt.httpStatus === null ? 'n/a' : attempt.httpStatus} - ${attempt.safeErrorMessage}`
              ),
            },
            {
              title: 'Fix checklist',
              items: [
                'Verify VERCEL_ACCESS_TOKEN has project or team access.',
                'Verify VERCEL_PROJECT_ID is correct.',
                'Add or verify VERCEL_TEAM_ID if the project belongs to a team.',
                'Redeploy after environment changes.',
                'Re-test /api/admin/metrics.',
              ],
            },
            {
              title: 'What is known',
              items: [
                `Supabase page_view events are available: ${supabasePageViews}.`,
                'The admin is intentionally not fabricating Vercel visitors, page views, or bounce rate.',
              ],
            },
            {
              title: 'What is unavailable',
              items: [
                'Vercel aggregate visitors are unavailable.',
                'Vercel aggregate page views are unavailable.',
                'Vercel aggregate bounce rate is unavailable.',
              ],
            },
          ],
        })
      }

      return makeReport({
        slug,
        href: `/admin/lifetime/${slug}`,
        title: 'Vercel Traffic',
        definition: 'Real Vercel aggregate traffic if available, or an exact unavailable state if the server-side connection is not working.',
        family: 'lifetime',
        statusLabel: vercel.connected ? 'Connected' : 'Unavailable',
        statusTone: vercel.connected ? 'good' : 'warning',
        lastUpdated,
        dataSourceBadges: ['Vercel Analytics', 'Partial coverage'],
        keyMetrics: [
          { label: 'Server-side Vercel API feed', value: vercel.connected ? 'Connected' : 'Unavailable' },
          { label: 'Visitors', value: vercel.visitors === null ? 'Unavailable' : formatCount(vercel.visitors) },
          { label: 'Page views', value: vercel.pageViews === null ? 'Unavailable' : formatCount(vercel.pageViews) },
          { label: 'Bounce rate', value: vercel.bounceRate === null ? 'Unavailable' : formatRate(vercel.bounceRate) },
        ],
        interpretation: [
          vercel.connected
            ? 'Vercel aggregate traffic is being returned directly from the server-side Vercel integration.'
            : `Vercel aggregate traffic is unavailable: ${formatText(vercel.unavailableReason)}.`,
          'No Vercel traffic numbers are fabricated in this branch.',
        ],
        dataQuality: [
          'Supabase page_view events still exist elsewhere in admin metrics, but they are not equivalent to Vercel aggregate traffic.',
          vercel.connected
            ? `Date range: ${vercel.dateRangeLabel}.`
            : 'The server-side Vercel connection is not returning aggregate visitor/page-view metrics.',
        ],
        currentRisk: [
          vercel.connected
            ? 'Vercel and Supabase should still be read as different measurement systems.'
            : 'Founders cannot currently compare Supabase telemetry against Vercel aggregate traffic from inside this admin.',
        ],
        recommendedAction: [
          vercel.connected
            ? 'Use Vercel for traffic truth and Supabase for product telemetry, without forcing the systems to match.'
            : 'Fix the secure server-side Vercel connection before treating traffic totals as complete.',
        ],
        tables: [
          {
            title: 'Current Coverage',
            columns: ['Signal', 'Status', 'Note'],
            rows: [
              ['Project linked', vercel.projectLinked ? 'Yes' : 'No', vercel.hasWebAnalytics ? 'Web Analytics enabled on project' : 'Web Analytics not enabled on project'],
              ['Vercel visitors', vercel.visitors === null ? 'Unavailable' : formatCount(vercel.visitors), vercel.unavailableReason ?? 'Live Vercel aggregate visitor count'],
              ['Vercel page views', vercel.pageViews === null ? 'Unavailable' : formatCount(vercel.pageViews), vercel.unavailableReason ?? 'Live Vercel aggregate page-view count'],
              ['Vercel bounce rate', vercel.bounceRate === null ? 'Unavailable' : formatRate(vercel.bounceRate), vercel.unavailableReason ?? 'Live Vercel aggregate bounce rate'],
              ['Supabase page_view events', formatCount(lifetime.dataCoverage.trackedPageViewEvents), 'Available elsewhere as tracked events, not Vercel aggregate traffic'],
            ],
            emptyCopy: 'No Vercel coverage rows yet.',
          },
          {
            title: 'Vercel Breakdown',
            columns: ['Dimension', 'Value', 'Share'],
            rows:
              vercel.topPages.length > 0
                ? vercel.topPages.map((row) => [row.label, formatCount(row.value), formatRate(row.percentage)])
                : [
                    ['Top pages', 'Unavailable', formatText(vercel.unavailableReason)],
                    ['Top referrers', 'Unavailable', formatText(vercel.unavailableReason)],
                    ['Countries / devices', 'Unavailable', formatText(vercel.unavailableReason)],
                  ],
            emptyCopy: 'No Vercel breakdown rows yet.',
          },
        ],
      })
    }
  }
}

export function buildAdminReportIndexRows(metrics: AdminMetricsResponse): BranchTableRow[] {
  const rows = adminBranchDefinitions.map((branch, index) => {
    const report = buildAdminBranchReport(branch.slug, metrics)
    return {
      number: `${index + 1}`.padStart(2, '0'),
      title: branch.title,
      definition: branch.definition,
      href: report.href,
      statusLabel: report.statusLabel,
      statusTone: report.statusTone,
    }
  })

  const lifetimeReport = buildLifetimeBranchReport('intelligence', metrics)
  const coverageReport = buildLifetimeBranchReport('data-coverage', metrics)
  const vercelReport = buildLifetimeBranchReport('vercel-traffic', metrics)

  return [
    ...rows,
    {
      number: '10',
      title: 'Lifetime Intelligence',
      definition:
        'Founder-level lifetime operating read across growth, behavior, trust, reliability, and coverage.',
      href: lifetimeReport.href,
      statusLabel: lifetimeReport.statusLabel,
      statusTone: lifetimeReport.statusTone,
    },
    {
      number: '11',
      title: 'Data Coverage',
      definition: 'Coverage quality across visitor, session, attribution, and telemetry completeness.',
      href: coverageReport.href,
      statusLabel: coverageReport.statusLabel,
      statusTone: coverageReport.statusTone,
    },
    {
      number: '12',
      title: 'Vercel Traffic',
      definition: 'Aggregate Vercel traffic coverage status without fabricated numbers.',
      href: vercelReport.href,
      statusLabel: vercelReport.statusLabel,
      statusTone: vercelReport.statusTone,
    },
  ]
}

export function buildLifetimeReportIndexRows(metrics: AdminMetricsResponse): BranchTableRow[] {
  return lifetimeBranchDefinitions.map((branch, index) => {
    const report = buildLifetimeBranchReport(branch.slug, metrics)
    return {
      number: `${index + 1}`.padStart(2, '0'),
      title: branch.title,
      definition: branch.definition,
      href: report.href,
      statusLabel: report.statusLabel,
      statusTone: report.statusTone,
    }
  })
}
