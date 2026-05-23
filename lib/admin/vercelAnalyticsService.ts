import 'server-only'

import type { AdminVercelAnalyticsSnapshot } from '@/lib/admin/adminMetricsTypes'
import { getVercelDiagnostics } from '@/lib/admin/vercelDiagnosticsService'

const DEFAULT_DATE_RANGE_LABEL = 'Last 30 days'

function emptySnapshot(
  overrides: Partial<AdminVercelAnalyticsSnapshot> = {}
): AdminVercelAnalyticsSnapshot {
  return {
    configured: false,
    connected: false,
    projectLinked: false,
    hasWebAnalytics: false,
    hasData: false,
    visitors: null,
    pageViews: null,
    bounceRate: null,
    topPages: [],
    topReferrers: [],
    countries: [],
    devices: [],
    dateRangeLabel: DEFAULT_DATE_RANGE_LABEL,
    since: null,
    until: null,
    unavailableReason: 'Vercel Analytics is not configured.',
    sourceLabel: 'Vercel Analytics REST API',
    diagnostics: {
      hasAccessToken: false,
      hasProjectId: false,
      hasTeamId: false,
      projectLinked: false,
      projectApiStatus: 'not_configured',
      analyticsEndpointAttempts: [],
      finalConclusion: 'Vercel Analytics is not configured.',
    },
    ...overrides,
  }
}

export async function getVercelAnalyticsSnapshot(): Promise<AdminVercelAnalyticsSnapshot> {
  const diagnostics = await getVercelDiagnostics()

  if (!diagnostics.hasAccessToken || !diagnostics.hasProjectId) {
    return emptySnapshot({
      unavailableReason: diagnostics.finalConclusion,
      diagnostics,
    })
  }

  const hasWebAnalytics = diagnostics.hasWebAnalytics
  const hasData = diagnostics.hasData

  // The public REST API can confirm project metadata and webAnalytics.hasData,
  // but this admin does not rely on any undocumented aggregate analytics endpoint.
  return emptySnapshot({
    configured: true,
    projectLinked: diagnostics.projectLinked,
    hasWebAnalytics,
    hasData,
    unavailableReason: diagnostics.finalConclusion,
    diagnostics,
  })
}
