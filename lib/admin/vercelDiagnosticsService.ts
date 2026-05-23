import 'server-only'

import type {
  AdminVercelDiagnostics,
  AdminVercelEndpointAttempt,
} from '@/lib/admin/adminMetricsTypes'

type VercelProjectResponse = {
  id?: string
  webAnalytics?: {
    id?: string
    enabledAt?: number | null
    disabledAt?: number | null
    canceledAt?: number | null
    hasData?: boolean
  } | null
}

type VercelProjectsListResponse = {
  projects?: Array<{
    id?: string
    webAnalytics?: {
      hasData?: boolean
    } | null
  }>
}

export type AdminVercelDiagnosticsResult = AdminVercelDiagnostics & {
  hasWebAnalytics: boolean
  hasData: boolean
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildProjectMetadataUrl(projectId: string, teamId: string | null) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  return `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${query}`
}

function buildProjectsListUrl(teamId: string | null) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  return `https://api.vercel.com/v10/projects${query}`
}

function safeStatusMessage(status: number) {
  switch (status) {
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not found'
    case 429:
      return 'Rate limited'
    default:
      return `HTTP ${status}`
  }
}

function classifyStatus(status: number): AdminVercelEndpointAttempt['classification'] {
  if (status >= 200 && status < 300) {
    return 'success'
  }

  if (status === 401 || status === 403) {
    return 'forbidden'
  }

  if (status === 404) {
    return 'not_found'
  }

  if (status === 429) {
    return 'error'
  }

  return 'error'
}

function unavailableConclusion(parts: {
  hasAccessToken: boolean
  hasProjectId: boolean
  hasTeamId: boolean
  projectApiStatus: AdminVercelDiagnostics['projectApiStatus']
  projectLinked: boolean
  hasWebAnalytics: boolean
  hasData: boolean
  metadataAttempt: AdminVercelEndpointAttempt | null
  listAttempt: AdminVercelEndpointAttempt | null
}): string {
  if (!parts.hasAccessToken || !parts.hasProjectId) {
    return 'Vercel is not fully configured on the server, so the admin cannot test project access or aggregate analytics.'
  }

  if (parts.projectApiStatus === 'forbidden') {
    if (parts.hasTeamId) {
      return 'The project metadata endpoint is forbidden with the current team-scoped credentials, so aggregate Vercel analytics cannot be queried from this admin.'
    }

    return 'The project metadata endpoint is forbidden with the current access token, so aggregate Vercel analytics cannot be queried from this admin.'
  }

  if (parts.projectApiStatus === 'not_found') {
    return 'The configured Vercel project ID was not found, so the admin cannot resolve project analytics.'
  }

  if (parts.projectLinked && parts.hasWebAnalytics && parts.hasData) {
    return 'The project is linked to Vercel Web Analytics, but no documented public server-side API was verified for the dashboard-style aggregate metrics.'
  }

  if (parts.projectLinked && parts.hasWebAnalytics) {
    return 'The project is linked to Vercel Web Analytics, but aggregate metrics are unavailable through the documented server-side API used by this admin.'
  }

  if (parts.projectLinked) {
    return 'The project metadata endpoint is accessible, but Vercel Web Analytics is not enabled for the linked project.'
  }

  if (parts.listAttempt?.classification === 'success') {
    return 'The token can list projects, but the specific project metadata endpoint could not be resolved with the current scope.'
  }

  return 'The admin cannot verify a server-side Vercel analytics path with the current credentials.'
}

async function probeEndpoint(
  label: string,
  endpoint: string,
  request: RequestInit
): Promise<{ attempt: AdminVercelEndpointAttempt; body: unknown | null }> {
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      ...request,
    })

    let body: unknown | null = null
    if (response.ok) {
      body = await response.json().catch(() => null)
    }

    return {
      body,
      attempt: {
        label,
        endpoint,
        httpStatus: response.status,
        classification: classifyStatus(response.status),
        safeErrorMessage: response.ok ? 'OK' : safeStatusMessage(response.status),
      },
    }
  } catch (error) {
    return {
      body: null,
      attempt: {
        label,
        endpoint,
        httpStatus: null,
        classification: 'error',
        safeErrorMessage:
          error instanceof Error ? error.message : 'Request failed before receiving a response.',
      },
    }
  }
}

export async function getVercelDiagnostics(): Promise<AdminVercelDiagnosticsResult> {
  const hasAccessToken = Boolean(trimEnvValue(process.env.VERCEL_ACCESS_TOKEN))
  const hasProjectId = Boolean(trimEnvValue(process.env.VERCEL_PROJECT_ID))
  const hasTeamId = Boolean(trimEnvValue(process.env.VERCEL_TEAM_ID))
  const accessToken = trimEnvValue(process.env.VERCEL_ACCESS_TOKEN)
  const projectId = trimEnvValue(process.env.VERCEL_PROJECT_ID)
  const teamId = trimEnvValue(process.env.VERCEL_TEAM_ID)

  const analyticsEndpointAttempts: AdminVercelEndpointAttempt[] = []

  if (!hasAccessToken || !hasProjectId || !accessToken || !projectId) {
    analyticsEndpointAttempts.push({
      label: 'Project metadata',
      endpoint: 'https://api.vercel.com/v9/projects/:projectId',
      httpStatus: null,
      classification: 'not_configured',
      safeErrorMessage: 'VERCEL_ACCESS_TOKEN or VERCEL_PROJECT_ID is missing.',
    })

    analyticsEndpointAttempts.push({
      label: 'Projects list',
      endpoint: 'https://api.vercel.com/v10/projects',
      httpStatus: null,
      classification: 'not_configured',
      safeErrorMessage: 'Vercel credentials are incomplete.',
    })

    analyticsEndpointAttempts.push({
      label: 'Aggregate Web Analytics',
      endpoint: 'not documented publicly',
      httpStatus: null,
      classification: 'unsupported',
      safeErrorMessage:
        'No documented public server-side endpoint was verified for aggregate visitors/page views/bounce rate.',
    })

    return {
      hasAccessToken,
      hasProjectId,
      hasTeamId,
      projectLinked: false,
      projectApiStatus: 'not_configured',
      analyticsEndpointAttempts,
      finalConclusion:
        'Vercel is not fully configured on the server, so the admin cannot test project access or aggregate analytics.',
      hasWebAnalytics: false,
      hasData: false,
    }
  }

  const withTeamProjectUrl = buildProjectMetadataUrl(projectId, teamId)
  const withoutTeamProjectUrl = buildProjectMetadataUrl(projectId, null)

  const primaryProjectProbe = await probeEndpoint('Project metadata', withTeamProjectUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  analyticsEndpointAttempts.push(primaryProjectProbe.attempt)

  let projectBody = primaryProjectProbe.body as VercelProjectResponse | null
  let projectApiStatus: AdminVercelDiagnostics['projectApiStatus'] =
    primaryProjectProbe.attempt.classification === 'success'
      ? 'accessible'
      : primaryProjectProbe.attempt.classification === 'not_found'
        ? 'not_found'
        : primaryProjectProbe.attempt.classification === 'forbidden'
          ? 'forbidden'
          : 'error'

  if (teamId && primaryProjectProbe.attempt.classification !== 'success') {
    const fallbackProbe = await probeEndpoint('Project metadata without teamId', withoutTeamProjectUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    analyticsEndpointAttempts.push(fallbackProbe.attempt)

    if (fallbackProbe.attempt.classification === 'success') {
      projectBody = fallbackProbe.body as VercelProjectResponse | null
      projectApiStatus = 'accessible'
    }
  }

  const listUrl = buildProjectsListUrl(teamId)
  const listProbe = await probeEndpoint('Projects list', listUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  analyticsEndpointAttempts.push(listProbe.attempt)

  const projectsList = (listProbe.body as VercelProjectsListResponse | null) ?? null
  const projectLinked =
    Boolean(projectBody?.id) ||
    Boolean(
      projectsList?.projects?.some((project) => project.id && project.id === projectId)
    ) ||
    Boolean(projectBody?.webAnalytics)

  const hasWebAnalytics = Boolean(projectBody?.webAnalytics)
  const hasData = Boolean(projectBody?.webAnalytics?.hasData)

  analyticsEndpointAttempts.push({
    label: 'Aggregate Web Analytics',
    endpoint: 'not documented publicly',
    httpStatus: null,
    classification: 'unsupported',
    safeErrorMessage:
      'No documented public server-side endpoint was verified for aggregate visitors/page views/bounce rate.',
  })

  return {
    hasAccessToken,
    hasProjectId,
    hasTeamId,
    projectLinked,
    projectApiStatus,
    analyticsEndpointAttempts,
    finalConclusion: unavailableConclusion({
      hasAccessToken,
      hasProjectId,
      hasTeamId,
      projectApiStatus,
      projectLinked,
      hasWebAnalytics,
      hasData,
      metadataAttempt: primaryProjectProbe.attempt,
      listAttempt: listProbe.attempt,
    }),
    hasWebAnalytics,
    hasData,
  }
}
