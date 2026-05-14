import { createClient } from '@supabase/supabase-js'
import { DAM_TRACK_EVENT_NAMES } from '@/lib/analytics'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('http') &&
  supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null

const allowedEventNames = new Set<string>(DAM_TRACK_EVENT_NAMES)

export const runtime = 'nodejs'
export const maxDuration = 5

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(request: Request) {
  let body: unknown = null

  try {
    body = await request.json()
  } catch {}

  const eventName = typeof (body as { event_name?: unknown })?.event_name === 'string'
    ? String((body as { event_name?: unknown }).event_name).trim()
    : ''
  const sessionId = typeof (body as { session_id?: unknown })?.session_id === 'string'
    ? String((body as { session_id?: unknown }).session_id).trim()
    : ''
  const metadata = isPlainObject((body as { metadata?: unknown })?.metadata)
    ? (body as { metadata?: Record<string, unknown> }).metadata
    : {}

  if (!allowedEventNames.has(eventName)) {
    return Response.json({ ok: true, ignored: true }, { status: 200 })
  }

  try {
    if (supabase) {
      await supabase.from('dam_events').insert({
        event_name: eventName,
        session_id: sessionId || null,
        metadata,
      })
    }
  } catch {}

  return Response.json({ ok: true }, { status: 200 })
}
