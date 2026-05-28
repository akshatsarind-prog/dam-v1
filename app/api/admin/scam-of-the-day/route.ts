import { isValidAdminPassword } from '@/lib/admin/adminAuth'
import {
  generateScamOfTheDayDraft,
  getLatestScamOfTheDayDraft,
  ScamOfTheDayApprovalError,
  updateScamOfTheDayDraftStatus,
} from '@/lib/admin/scamOfTheDay'
import type { ScamOfTheDayStatus } from '@/lib/admin/scamOfTheDayTypes'
import { SCAM_OF_THE_DAY_STATUSES } from '@/lib/admin/scamOfTheDayTypes'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function isStatus(value: unknown): value is ScamOfTheDayStatus {
  return typeof value === 'string' && SCAM_OF_THE_DAY_STATUSES.includes(value as ScamOfTheDayStatus)
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
    const draft = await getLatestScamOfTheDayDraft()
    return jsonResponse({ draft })
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Scam of the Day draft is temporarily unavailable.',
        },
      },
      500
    )
  }
}

export async function POST(request: Request) {
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
    const draft = await generateScamOfTheDayDraft()
    return jsonResponse({ draft }, 201)
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to generate Scam of the Day draft.',
        },
      },
      500
    )
  }
}

export async function PATCH(request: Request) {
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

  const body = (await request.json().catch(() => null)) as
    | {
        slug?: unknown
        status?: unknown
      }
    | null

  if (!body || typeof body.slug !== 'string' || !isStatus(body.status)) {
    return jsonResponse(
      {
        error: {
          code: 'bad_request',
          message: 'Draft slug and a valid internal status are required.',
        },
      },
      400
    )
  }

  try {
    const draft = await updateScamOfTheDayDraftStatus({
      slug: body.slug,
      status: body.status,
    })

    return jsonResponse({ draft })
  } catch (error) {
    if (error instanceof ScamOfTheDayApprovalError) {
      return jsonResponse(
        {
          error: {
            code: 'bad_request',
            message: error.message,
          },
        },
        400
      )
    }

    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message:
            error instanceof Error ? error.message : 'Unable to update draft approval state.',
        },
      },
      500
    )
  }
}
