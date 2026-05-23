import OpenAI from 'openai'
import { isValidAdminPassword } from '@/lib/admin/adminAuth'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

const OPENAI_MODEL = 'gpt-4o-mini'
const MAX_REPORT_DATA_CHARS = 60_000

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 14

type SummaryShape = {
  goodStuff: string[]
  badStuff: string[]
  improvementsNeeded: string[]
  ignore: string[]
  nextSteps: string[]
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSummary(value: unknown): SummaryShape {
  const input = isPlainObject(value) ? value : {}
  const readList = (key: keyof SummaryShape) => {
    const source = input[key]

    if (!Array.isArray(source)) {
      return [] as string[]
    }

    return source
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  return {
    goodStuff: readList('goodStuff'),
    badStuff: readList('badStuff'),
    improvementsNeeded: readList('improvementsNeeded'),
    ignore: readList('ignore'),
    nextSteps: readList('nextSteps'),
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

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message: 'OpenAI summary is not configured on the server.',
        },
      },
      503
    )
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          branch?: unknown
          reportData?: unknown
        }
      | null

    if (!body || typeof body.branch !== 'string' || !isPlainObject(body.reportData)) {
      return jsonResponse(
        {
          error: {
            code: 'unknown',
            message: 'Branch and structured reportData are required.',
          },
        },
        400
      )
    }

    const reportDataJson = JSON.stringify(body.reportData)

    if (reportDataJson.length > MAX_REPORT_DATA_CHARS) {
      return jsonResponse(
        {
          error: {
            code: 'unknown',
            message: 'Selected branch report is too large to summarize safely.',
          },
        },
        400
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 700,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content:
            'You summarize internal company analytics for a founder. Be direct, concrete, and plain-language. Return JSON only with keys goodStuff, badStuff, improvementsNeeded, ignore, nextSteps. Each key must be an array of short bullet strings. Do not invent missing numbers or tools. If data quality is weak, partial, incomparable, or unavailable, say that first and avoid confident growth recommendations. Distinguish what is known, what is partially tracked, what is unavailable, and what action is safe.',
        },
        {
          role: 'user',
          content: `Summarize this DAM admin branch report for a founder.\nBranch: ${body.branch}\nInstructions:\n- Read dataSourceBadges, dataQuality, supplementalPanels, keyMetrics, currentRisk, and recommendedAction before recommending action.\n- If funnel conversion is marked not comparable or not reliable, say that clearly and avoid confident funnel advice.\n- If reportData.funnelOverview exists, treat the funnel as Supabase product telemetry with Vercel kept as an external traffic reference. Do not compare it to Vercel visitors, page views, or bounce rate as if they were the same system.\n- If this is the Funnel branch, use Vercel only as an external dashboard reference and focus recommendations on Supabase product conversion and attribution coverage.\n- If attribution coverage is weak or Vercel is unavailable, make that the first caution.\n- If this is the Vercel Traffic branch and Vercel is unavailable, explain only: what is known, what is unavailable, the likely cause, and the next fix. Do not infer real Vercel visitors, page views, or bounce rate from Supabase events.\n- If reportData.diagnostics exists, use the endpoint attempts and finalConclusion as the source of truth for the failure mode.\n- Supabase page_view events are product telemetry, not Vercel aggregate traffic.\nStructured report data:\n${reportDataJson}`,
        },
      ],
    })

    const rawContent = completion.choices[0]?.message?.content

    if (!rawContent) {
      throw new Error('OpenAI returned an empty summary.')
    }

    const parsed = JSON.parse(rawContent) as unknown

    return jsonResponse({
      summary: normalizeSummary(parsed),
    })
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Founder summary is temporarily unavailable.',
        },
      },
      500
    )
  }
}
