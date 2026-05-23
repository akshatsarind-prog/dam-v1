import { isValidAdminPassword } from '@/lib/admin/adminAuth'
import { getVercelDiagnostics } from '@/lib/admin/vercelDiagnosticsService'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

export async function GET(request: Request) {
  if (!isValidAdminPassword(request)) {
    return jsonResponse(
      {
        error: {
          code: 'unauthorized',
          message: 'Invalid admin password.',
        },
      },
      401
    )
  }

  try {
    const diagnostics = await getVercelDiagnostics()

    return jsonResponse({
      hasAccessToken: diagnostics.hasAccessToken,
      hasProjectId: diagnostics.hasProjectId,
      hasTeamId: diagnostics.hasTeamId,
      projectLinked: diagnostics.projectLinked,
      projectApiStatus: diagnostics.projectApiStatus,
      analyticsEndpointAttempts: diagnostics.analyticsEndpointAttempts,
      finalConclusion: diagnostics.finalConclusion,
    })
  } catch {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message: 'Vercel diagnostics are temporarily unavailable.',
        },
      },
      500
    )
  }
}
