import { isValidAdminPassword } from '@/lib/admin/adminAuth'
import { getAdminMetrics } from '@/lib/admin/adminMetricsService'

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
    const metrics = await getAdminMetrics()
    return jsonResponse(metrics)
  } catch {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message: 'Admin metrics are temporarily unavailable.',
        },
      },
      500
    )
  }
}
