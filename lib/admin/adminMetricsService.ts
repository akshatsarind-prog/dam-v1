import 'server-only'

import type {
  AdminClaimRecord,
  AdminMetricsResponse,
  RiskLabelBreakdown,
  VerdictBreakdown,
} from '@/lib/admin/adminMetricsTypes'
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

const CLAIM_LOGS_TABLE = 'dam_claim_logs'
const CLAIM_TEXT_MAX_LENGTH = 280
const AGGREGATION_BATCH_SIZE = 1000

type ClaimLogRow = Record<string, unknown>

const emptyMetrics: AdminMetricsResponse = {
  generatedAt: '',
  placeholder: false,
  totalClaims: 0,
  claimsToday: 0,
  averageLatencyMs: 0,
  verdictBreakdown: [],
  riskLabelBreakdown: [],
  recentClaims: [],
  lowConfidenceClaims: [],
  slowestClaims: [],
  error: null,
}

function buildMetricsResponse(
  overrides: Partial<AdminMetricsResponse> = {}
): AdminMetricsResponse {
  return {
    ...emptyMetrics,
    generatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readDateString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function truncateClaimText(claimText: string) {
  if (claimText.length <= CLAIM_TEXT_MAX_LENGTH) {
    return claimText
  }

  return `${claimText.slice(0, CLAIM_TEXT_MAX_LENGTH - 3)}...`
}

function normalizeClaimRecord(row: ClaimLogRow): AdminClaimRecord {
  return {
    createdAt: readDateString(row.created_at),
    claimText: truncateClaimText(readString(row.claim_text)),
    verdict: readString(row.verdict, 'unknown') || 'unknown',
    confidence: readNumber(row.confidence, 0),
    riskLabel: readString(row.risk_label, 'unknown') || 'unknown',
    latencyMs: readNumber(row.latency_ms, 0),
  }
}

function getLocalStartOfToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

function sortByCreatedAtDesc(records: AdminClaimRecord[]) {
  return [...records].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0
    return rightTime - leftTime
  })
}

function sortByLatencyDesc(records: AdminClaimRecord[]) {
  return [...records].sort((left, right) => right.latencyMs - left.latencyMs)
}

function buildBreakdown<T>(
  counts: Map<string, number>,
  mapKey: (key: string, count: number) => T
) {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => mapKey(key, count))
}

async function readAggregateRows() {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return {
      rows: [] as ClaimLogRow[],
      error: {
        code: 'misconfigured' as const,
        message:
          'Admin metrics service is not configured. Set Supabase admin env vars before requesting live metrics.',
      },
      totalClaims: 0,
    }
  }

  const { count, error: countError } = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*', { count: 'exact', head: true })

  if (countError) {
    return {
      rows: [] as ClaimLogRow[],
      error: {
        code: 'unavailable' as const,
        message: 'Unable to read claim log totals from Supabase.',
      },
      totalClaims: 0,
    }
  }

  const totalClaims = count ?? 0

  if (totalClaims === 0) {
    return { rows: [] as ClaimLogRow[], error: null, totalClaims }
  }

  const rows: ClaimLogRow[] = []

  for (let offset = 0; offset < totalClaims; offset += AGGREGATION_BATCH_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(CLAIM_LOGS_TABLE)
      .select('*')
      .range(offset, offset + AGGREGATION_BATCH_SIZE - 1)

    if (error) {
      return {
        rows: [] as ClaimLogRow[],
        error: {
          code: 'unavailable' as const,
          message: 'Unable to read claim log aggregates from Supabase.',
        },
        totalClaims,
      }
    }

    rows.push(...((data ?? []) as ClaimLogRow[]))

    if (!data || data.length < AGGREGATION_BATCH_SIZE) {
      break
    }
  }

  return { rows, error: null, totalClaims }
}

async function readRecentClaims() {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return [] as AdminClaimRecord[]
  }

  const orderedQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!orderedQuery.error) {
    return (orderedQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  }

  const fallbackQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .limit(20)

  if (fallbackQuery.error) {
    return []
  }

  return sortByCreatedAtDesc(
    (fallbackQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  ).slice(0, 20)
}

async function readLowConfidenceClaims() {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return [] as AdminClaimRecord[]
  }

  const orderedQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .lt('confidence', 60)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!orderedQuery.error) {
    return (orderedQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  }

  const fallbackQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .lt('confidence', 60)
    .limit(20)

  if (fallbackQuery.error) {
    return []
  }

  return sortByCreatedAtDesc(
    (fallbackQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  ).slice(0, 20)
}

async function readSlowestClaims() {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return [] as AdminClaimRecord[]
  }

  const orderedQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .order('latency_ms', { ascending: false })
    .limit(10)

  if (!orderedQuery.error) {
    return (orderedQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  }

  const fallbackQuery = await supabaseAdmin
    .from(CLAIM_LOGS_TABLE)
    .select('*')
    .limit(10)

  if (fallbackQuery.error) {
    return []
  }

  return sortByLatencyDesc(
    (fallbackQuery.data ?? []).map((row) => normalizeClaimRecord(row as ClaimLogRow))
  ).slice(0, 10)
}

export async function getAdminMetrics(): Promise<AdminMetricsResponse> {
  const aggregateResult = await readAggregateRows()

  if (aggregateResult.error) {
    return buildMetricsResponse({
      placeholder: aggregateResult.error.code === 'misconfigured',
      error: aggregateResult.error,
    })
  }

  const verdictCounts = new Map<string, number>()
  const riskLabelCounts = new Map<string, number>()
  let claimsToday = 0
  let totalLatencyMs = 0
  let latencySamples = 0

  const startOfToday = getLocalStartOfToday()

  for (const row of aggregateResult.rows) {
    const verdict = readString(row.verdict, 'unknown') || 'unknown'
    const riskLabel = readString(row.risk_label, 'unknown') || 'unknown'
    const latencyMs = readNumber(row.latency_ms, 0)
    const createdAt = readDateString(row.created_at)

    verdictCounts.set(verdict, (verdictCounts.get(verdict) ?? 0) + 1)
    riskLabelCounts.set(riskLabel, (riskLabelCounts.get(riskLabel) ?? 0) + 1)
    totalLatencyMs += latencyMs
    latencySamples += 1

    if (createdAt && Date.parse(createdAt) >= startOfToday) {
      claimsToday += 1
    }
  }

  const [recentClaims, lowConfidenceClaims, slowestClaims] = await Promise.all([
    readRecentClaims(),
    readLowConfidenceClaims(),
    readSlowestClaims(),
  ])

  return buildMetricsResponse({
    totalClaims: aggregateResult.totalClaims,
    claimsToday,
    averageLatencyMs:
      latencySamples > 0 ? Math.round(totalLatencyMs / latencySamples) : 0,
    verdictBreakdown: buildBreakdown<VerdictBreakdown>(verdictCounts, (verdict, count) => ({
      verdict,
      count,
    })),
    riskLabelBreakdown: buildBreakdown<RiskLabelBreakdown>(riskLabelCounts, (riskLabel, count) => ({
      riskLabel,
      count,
    })),
    recentClaims,
    lowConfidenceClaims,
    slowestClaims,
    error: null,
  })
}
