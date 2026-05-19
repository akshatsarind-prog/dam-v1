import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

class SupabaseAdminConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseAdminConfigurationError'
  }
}

let supabaseAdminClient: SupabaseClient | null | undefined

function readSupabaseUrl() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  return typeof url === 'string' && url.startsWith('http') ? url : null
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new SupabaseAdminConfigurationError(
      'Supabase admin client is server-only and cannot run in the browser.'
    )
  }

  if (supabaseAdminClient !== undefined) {
    return supabaseAdminClient
  }

  const supabaseUrl = readSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    supabaseAdminClient = null
    return supabaseAdminClient
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseAdminClient
}
