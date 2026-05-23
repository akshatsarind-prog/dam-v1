import { isValidAdminPassword } from '@/lib/admin/adminAuth'
import { getAdminMetrics } from '@/lib/admin/adminMetricsService'
import { renderFullAdminReportHtml } from '@/lib/admin/adminReportExport'

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
    const html = renderFullAdminReportHtml(metrics)
    const fileDate = new Date(metrics.generatedAt || Date.now()).toISOString().slice(0, 10)

    return new Response(html, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="dam-full-admin-report-${fileDate}.html"`,
      },
    })
  } catch {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message: 'Admin report export is temporarily unavailable.',
        },
      },
      500
    )
  }
}

