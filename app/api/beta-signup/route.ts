import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('http') &&
  supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const runtime = 'nodejs'
export const maxDuration = 5

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue ? normalizedValue : null
}

export async function POST(request: Request) {
  let body: unknown = null

  try {
    body = await request.json()
  } catch {}

  const emailValue = typeof (body as { email?: unknown })?.email === 'string'
    ? (body as { email: string }).email
    : ''
  const email = emailValue.trim().toLowerCase()
  const sessionId = normalizeOptionalString((body as { session_id?: unknown })?.session_id)
  const source = normalizeOptionalString((body as { source?: unknown })?.source)

  if (!email || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: 'Invalid email.' }, { status: 400 })
  }

  if (!supabase) {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  let insertErrorCode: string | null = null

  try {
    const { error } = await supabase.from('dam_beta_users').insert({
      email,
      session_id: sessionId,
      source,
    })

    insertErrorCode = error?.code ?? null
  } catch {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  if (insertErrorCode && insertErrorCode !== '23505') {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  return Response.json({ ok: true }, { status: 200 })
}
