import 'server-only'

import type { AdminVercelAnalyticsSnapshot } from '@/lib/admin/adminMetricsTypes'

type ProjectLookup = {
  id?: string
  name?: string
  webAnalytics?: {
    enabledAt?: number | null
    hasData?: boolean
  } | null
}

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
    ...overrides,
  }
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildProjectUrl(projectId: string, teamId: string | null) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  return `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${query}`
}

function readableStatusMessage(status: number) {
  switch (status) {
    case 401:
      return 'Vercel access token is invalid.'
    case 403:
      return 'Vercel access token cannot access this project.'
    case 404:
      return 'Configured Vercel project was not found.'
    default:
      return `Vercel project lookup failed with status ${status}.`
  }
}

export async function getVercelAnalyticsSnapshot(): Promise<AdminVercelAnalyticsSnapshot> {
  const accessToken = trimEnvValue(process.env.VERCEL_ACCESS_TOKEN)
  const projectId = trimEnvValue(process.env.VERCEL_PROJECT_ID)
  const teamId = trimEnvValue(process.env.VERCEL_TEAM_ID)

  if (!accessToken || !projectId) {
    return emptySnapshot({
      unavailableReason:
        'VERCEL_ACCESS_TOKEN or VERCEL_PROJECT_ID is missing on the server.',
    })
  }

  try {
    const response = await fetch(buildProjectUrl(projectId, teamId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return emptySnapshot({
        configured: true,
        unavailableReason: readableStatusMessage(response.status),
      })
    }

    const project = (await response.json()) as ProjectLookup
    const hasWebAnalytics = Boolean(project.webAnalytics)
    const hasData = Boolean(project.webAnalytics?.hasData)

    // Vercel's public REST reference exposes project webAnalytics metadata, but not the
    // dashboard's aggregate visitors/page views/referrers breakdowns as a documented endpoint.
    return emptySnapshot({
      configured: true,
      projectLinked: true,
      hasWebAnalytics,
      hasData,
      unavailableReason: hasWebAnalytics
        ? 'Project is linked to Vercel Web Analytics, but aggregate traffic metrics are not available through the current documented server-side API used by this admin.'
        : 'Vercel Web Analytics is not enabled for this project.',
    })
  } catch (error) {
    return emptySnapshot({
      configured: true,
      unavailableReason:
        error instanceof Error
          ? `Vercel project lookup failed: ${error.message}`
          : 'Vercel project lookup failed.',
    })
  }
}
