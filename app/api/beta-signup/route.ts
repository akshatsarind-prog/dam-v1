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
  const captureVariant = normalizeOptionalString(
    (body as { capture_variant?: unknown })?.capture_variant
  )
  const sourceResultType = normalizeOptionalString(
    (body as { source_result_type?: unknown })?.source_result_type
  )
  const riskLabel = normalizeOptionalString((body as { risk_label?: unknown })?.risk_label)
  const claimCategory = normalizeOptionalString(
    (body as { claim_category?: unknown })?.claim_category
  )

  if (!email || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: 'Invalid email.' }, { status: 400 })
  }

  if (!supabase) {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  let insertErrorCode: string | null = null

  try {
    const baseInsertPayload = {
      email,
      session_id: sessionId,
      source,
    }
    const extendedInsertPayload = {
      ...baseInsertPayload,
      capture_variant: captureVariant,
      source_result_type: sourceResultType,
      risk_label: riskLabel,
      claim_category: claimCategory,
      created_at: new Date().toISOString(),
    }

    const shouldAttemptExtendedInsert = Boolean(
      captureVariant || sourceResultType || riskLabel || claimCategory
    )

    let error = null

    if (shouldAttemptExtendedInsert) {
      const extendedInsertResult = await supabase.from('dam_beta_users').insert(extendedInsertPayload)
      error = extendedInsertResult.error

      if (error && error.code !== '23505') {
        const baseInsertResult = await supabase.from('dam_beta_users').insert(baseInsertPayload)
        error = baseInsertResult.error
      }
    } else {
      const baseInsertResult = await supabase.from('dam_beta_users').insert(baseInsertPayload)
      error = baseInsertResult.error
    }

    insertErrorCode = error?.code ?? null
  } catch {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  if (insertErrorCode && insertErrorCode !== '23505') {
    return Response.json({ error: 'Signup unavailable.' }, { status: 500 })
  }

  return Response.json({ ok: true }, { status: 200 })
}
