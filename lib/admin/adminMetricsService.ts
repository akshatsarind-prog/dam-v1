import 'server-only'

import type {
  AdminClaimRecord,
  AdminCategorizedClaimRecord,
  AdminCategoryBreakdownRecord,
  AdminCategoryIntelligence,
  AdminClaimCategory,
  AdminFunnelMetrics,
  AdminFunnelStage,
  AdminMetricsResponse,
  AdminRetentionMetrics,
  AdminReturningSessionRecord,
  AdminReferrerRecord,
  RiskLabelBreakdown,
  VerdictBreakdown,
} from '@/lib/admin/adminMetricsTypes'
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

const CLAIM_LOGS_TABLE = 'dam_claim_logs'
const BETA_USERS_TABLE = 'dam_beta_users'
const EVENTS_TABLE = 'dam_events'
const CLAIM_TEXT_MAX_LENGTH = 280
const AGGREGATION_BATCH_SIZE = 1000
const MANUAL_DISTRIBUTED_BASELINE = 1000
const MANUAL_LANDING_VISITORS_BASELINE = 200
const MANUAL_APP_VISITORS_BASELINE = 57
const RETURNING_SESSION_GAP_MS = 30 * 60 * 1000
const CRYPTO_KEYWORDS = [
  'crypto',
  'bitcoin',
  'trading',
  'investment',
  'guaranteed return',
  'double money',
  'wallet',
] as const
const SCAM_KEYWORDS = [
  'kyc',
  'otp',
  'bank',
  'account blocked',
  'reward',
  'lottery',
  'urgent payment',
  'verification',
  'phishing',
  'click link',
  'credential harvesting',
  'impersonation',
] as const
const HEALTH_KEYWORDS = [
  'medicine',
  'cure',
  'diabetes',
  'vaccine',
  'hospital',
  'doctor',
  'disease',
  'heart',
  'cancer',
  'health',
] as const
const POLITICAL_KEYWORDS = [
  'election',
  'party',
  'minister',
  ' mp ',
  ' mla ',
  ' cm ',
  ' pm ',
  'vote',
  'lok sabha',
  'rajya sabha',
] as const
const GOVERNMENT_KEYWORDS = [
  'aadhaar',
  'pan',
  'rbi',
  'government',
  'subsidy',
  'scheme',
  'tax',
  'police',
  'court',
  'official notice',
  'official circular',
  'notice',
] as const
const STATISTICS_KEYWORDS = [
  'percent',
  '%',
  'study',
  'survey',
  'report',
  'data',
  'research',
  'rate',
  'number',
  'deaths',
  'people',
] as const
const SOCIAL_RUMOR_KEYWORDS = [
  'viral',
  'whatsapp',
  'forwarded',
  'rumor',
  'community',
  'school',
  'city',
  'local',
  'everyone says',
] as const

type ClaimLogRow = Record<string, unknown>
type EventRow = Record<string, unknown>
type SessionAggregate = {
  firstSeenAt: number | null
  lastSeenAt: number | null
  firstEventAt: number | null
  lastEventAt: number | null
  totalClaims: number
  totalEvents: number
  meaningfulEventCount: number
  exampleClaimCount: number
  realClaimCount: number
  appOpenTimestamps: number[]
  firstReferrer: string | null
  lastReferrer: string | null
  deviceType: string | null
  activityDaysUtc: Set<string>
}

const emptyFunnel: AdminFunnelMetrics = {
  distributed: {
    label: 'Reached / Distributed',
    count: MANUAL_DISTRIBUTED_BASELINE,
    status: 'manual',
    manualBaseline: true,
  },
  landingVisitors: {
    label: 'Landing visitors',
    count: MANUAL_LANDING_VISITORS_BASELINE,
    status: 'manual',
    manualBaseline: true,
  },
  appVisitors: {
    label: 'App visitors / sessions',
    count: MANUAL_APP_VISITORS_BASELINE,
    status: 'manual',
    manualBaseline: true,
  },
  claimSubmissions: {
    label: 'Claim submissions',
    count: 0,
    status: 'tracked',
    manualBaseline: false,
  },
  emailCaptures: {
    label: 'Email captures / signups',
    count: null,
    status: 'not_tracked',
    manualBaseline: false,
  },
}

const emptyMetrics: AdminMetricsResponse = {
  generatedAt: '',
  placeholder: false,
  totalClaims: 0,
  claimsToday: 0,
  averageLatencyMs: 0,
  verdictBreakdown: [],
  riskLabelBreakdown: [],
  funnel: emptyFunnel,
  retention: {
    uniqueSessions: 0,
    returningSessions: 0,
    returnRate: null,
    returningUserRate: null,
    firstTimeSessions: 0,
    repeatClaimSessions: 0,
    latestReturningSessions: [],
    multiDayUsers: 0,
    averageClaimsPerUser: 0,
    averageTimePerSessionMs: null,
    averageTimeBetweenSessionsMs: null,
    exampleToRealConversionRate: null,
    topReferrers: [],
  },
  categoryIntelligence: {
    categoryBreakdown: [],
    mostTestedCategory: null,
    highestLatencyCategory: null,
    lowestConfidenceCategory: null,
    emailConversionByCategory: {
      available: false,
      message: 'Not linkable yet',
    },
    topCategoryClaims: [],
  },
  recentClaims: [],
  lowConfidenceClaims: [],
  slowestClaims: [],
  error: null,
}

function buildMetricsResponse(
  overrides: Partial<AdminMetricsResponse> = {}
): AdminMetricsResponse {
  const { funnel, ...restOverrides } = overrides

  return {
    ...emptyMetrics,
    generatedAt: new Date().toISOString(),
    funnel: {
      ...emptyFunnel,
      ...(funnel ?? {}),
    },
    ...restOverrides,
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

function readTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
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

function normalizeText(value: string) {
  return ` ${value.trim().toLowerCase().replace(/\s+/g, ' ')} `
}

function hasAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function deriveClaimCategory(row: ClaimLogRow): AdminClaimCategory {
  const claimText = readString(row.claim_text)
  const riskLabel = readString(row.risk_label, 'unknown')
  const verdict = readString(row.verdict, 'unknown')
  const combinedText = normalizeText(`${claimText} ${riskLabel} ${verdict}`)

  if (hasAnyKeyword(combinedText, CRYPTO_KEYWORDS)) {
    return 'crypto'
  }

  if (
    hasAnyKeyword(combinedText, SCAM_KEYWORDS) ||
    combinedText.includes('phishing') ||
    combinedText.includes('harvesting') ||
    combinedText.includes('reward bait') ||
    combinedText.includes('payment extraction')
  ) {
    return 'scam'
  }

  if (hasAnyKeyword(combinedText, HEALTH_KEYWORDS)) {
    return 'health'
  }

  if (hasAnyKeyword(combinedText, POLITICAL_KEYWORDS)) {
    return 'political'
  }

  if (hasAnyKeyword(combinedText, GOVERNMENT_KEYWORDS)) {
    return 'government'
  }

  if (hasAnyKeyword(combinedText, STATISTICS_KEYWORDS)) {
    return 'statistics'
  }

  if (hasAnyKeyword(combinedText, SOCIAL_RUMOR_KEYWORDS)) {
    return 'social_rumor'
  }

  return 'other'
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

function buildTrackedFunnelStage(label: string, count: number): AdminFunnelStage {
  return {
    label,
    count,
    status: 'tracked',
    manualBaseline: false,
  }
}

function toIsoString(timestamp: number | null) {
  if (timestamp === null) {
    return null
  }

  return new Date(timestamp).toISOString()
}

function countSessionVisits(aggregate: SessionAggregate) {
  const sortedOpenTimestamps = [...aggregate.appOpenTimestamps].sort((left, right) => left - right)
  let visitCount = sortedOpenTimestamps.length ? 1 : 0

  for (let index = 1; index < sortedOpenTimestamps.length; index += 1) {
    const gapMs = sortedOpenTimestamps[index] - sortedOpenTimestamps[index - 1]

    if (gapMs > RETURNING_SESSION_GAP_MS) {
      visitCount += 1
    }
  }

  if (visitCount === 0 && (aggregate.totalClaims > 0 || aggregate.totalEvents > 0)) {
    return 1
  }

  return visitCount
}

function buildActiveSessionWindowDurations(timestamps: number[]) {
  const sortedTimestamps = [...timestamps].sort((left, right) => left - right)

  if (sortedTimestamps.length < 2) {
    return [] as number[]
  }

  const durations: number[] = []
  let windowStart = sortedTimestamps[0]
  let previousTimestamp = sortedTimestamps[0]

  for (let index = 1; index < sortedTimestamps.length; index += 1) {
    const currentTimestamp = sortedTimestamps[index]
    const gapMs = currentTimestamp - previousTimestamp

    if (gapMs > RETURNING_SESSION_GAP_MS) {
      const completedWindowDuration = previousTimestamp - windowStart

      if (completedWindowDuration > 0) {
        durations.push(completedWindowDuration)
      }

      windowStart = currentTimestamp
    }

    previousTimestamp = currentTimestamp
  }

  const finalWindowDuration = previousTimestamp - windowStart

  if (finalWindowDuration > 0) {
    durations.push(finalWindowDuration)
  }

  return durations
}

function buildCategoryIntelligence(
  claimRows: ClaimLogRow[],
  totalClaims: number
): AdminCategoryIntelligence {
  const categoryStats = new Map<
    AdminClaimCategory,
    {
      count: number
      totalLatencyMs: number
      totalConfidence: number
    }
  >()

  const categorizedClaims = claimRows.map<AdminCategorizedClaimRecord>((row) => ({
    ...normalizeClaimRecord(row),
    category: deriveClaimCategory(row),
  }))

  for (const claim of categorizedClaims) {
    const current = categoryStats.get(claim.category) ?? {
      count: 0,
      totalLatencyMs: 0,
      totalConfidence: 0,
    }

    current.count += 1
    current.totalLatencyMs += claim.latencyMs
    current.totalConfidence += claim.confidence
    categoryStats.set(claim.category, current)
  }

  const categoryBreakdown = Array.from(categoryStats.entries())
    .map<AdminCategoryBreakdownRecord>(([category, stats]) => ({
      category,
      count: stats.count,
      percentage: totalClaims > 0 ? stats.count / totalClaims : 0,
      averageLatencyMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      averageConfidence: stats.count > 0 ? Number((stats.totalConfidence / stats.count).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))

  const mostTestedCategory = categoryBreakdown.length ? categoryBreakdown[0] : null
  const highestLatencyCategory = categoryBreakdown.length
    ? [...categoryBreakdown].sort(
        (left, right) =>
          right.averageLatencyMs - left.averageLatencyMs || right.count - left.count
      )[0]
    : null
  const lowestConfidenceCategory = categoryBreakdown.length
    ? [...categoryBreakdown].sort(
        (left, right) =>
          left.averageConfidence - right.averageConfidence || right.count - left.count
      )[0]
    : null

  const topCategoryClaims = [...categorizedClaims]
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0
      return rightTime - leftTime
    })
    .slice(0, 20)

  return {
    categoryBreakdown,
    mostTestedCategory,
    highestLatencyCategory,
    lowestConfidenceCategory,
    emailConversionByCategory: {
      available: false,
      message: 'Not linkable yet',
    },
    topCategoryClaims,
  }
}

function buildRetentionMetrics(
  claimRows: ClaimLogRow[],
  eventRows: EventRow[],
  totalClaims: number
): AdminRetentionMetrics {
  const sessionAggregates = new Map<string, SessionAggregate>()

  function ensureSession(sessionId: string) {
    let aggregate = sessionAggregates.get(sessionId)

    if (!aggregate) {
        aggregate = {
          firstSeenAt: null,
          lastSeenAt: null,
          firstEventAt: null,
          lastEventAt: null,
          totalClaims: 0,
          totalEvents: 0,
          meaningfulEventCount: 0,
        exampleClaimCount: 0,
        realClaimCount: 0,
        appOpenTimestamps: [],
        firstReferrer: null,
        lastReferrer: null,
        deviceType: null,
        activityDaysUtc: new Set<string>(),
      }
      sessionAggregates.set(sessionId, aggregate)
    }

    return aggregate
  }

  function applyActivityTimestamp(aggregate: SessionAggregate, timestamp: number | null) {
    if (timestamp === null) {
      return
    }

    aggregate.firstSeenAt =
      aggregate.firstSeenAt === null ? timestamp : Math.min(aggregate.firstSeenAt, timestamp)
    aggregate.lastSeenAt =
      aggregate.lastSeenAt === null ? timestamp : Math.max(aggregate.lastSeenAt, timestamp)
    aggregate.activityDaysUtc.add(new Date(timestamp).toISOString().slice(0, 10))
  }

  for (const row of claimRows) {
    const sessionId = readString(row.session_id).trim()

    if (!sessionId) {
      continue
    }

    const aggregate = ensureSession(sessionId)
    const timestamp = readTimestamp(row.created_at)

    aggregate.totalClaims += 1
    aggregate.realClaimCount += 1
    applyActivityTimestamp(aggregate, timestamp)
  }

  const exampleFirstSeenBySession = new Map<string, number>()
  const realClaimTimesBySession = new Map<string, number[]>()

  for (const row of eventRows) {
    const sessionId = readString(row.session_id).trim()

    if (!sessionId) {
      continue
    }

    const aggregate = ensureSession(sessionId)
    const eventName = readString(row.event_name)
    const timestamp = readTimestamp(row.created_at)
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    const referrer = readString(metadata.referrer).trim()
    const deviceType = readString(metadata.device_type).trim()

    applyActivityTimestamp(aggregate, timestamp)
    aggregate.totalEvents += 1

    if (timestamp !== null) {
      aggregate.firstEventAt =
        aggregate.firstEventAt === null ? timestamp : Math.min(aggregate.firstEventAt, timestamp)
      aggregate.lastEventAt =
        aggregate.lastEventAt === null ? timestamp : Math.max(aggregate.lastEventAt, timestamp)
    }

    if (eventName !== 'app_session_end') {
      aggregate.meaningfulEventCount += 1
    }

    if (referrer) {
      aggregate.firstReferrer = aggregate.firstReferrer ?? referrer
      aggregate.lastReferrer = referrer
    }

    if (deviceType) {
      aggregate.deviceType = deviceType
    }

    if (eventName === 'app_open_click' && timestamp !== null) {
      aggregate.appOpenTimestamps.push(timestamp)
    }

    if (eventName === 'example_claim_click') {
      aggregate.exampleClaimCount += 1

      if (timestamp !== null) {
        const existing = exampleFirstSeenBySession.get(sessionId)
        exampleFirstSeenBySession.set(
          sessionId,
          existing === undefined ? timestamp : Math.min(existing, timestamp)
        )
      }
    }

    if (eventName === 'real_claim_submit') {
      if (timestamp !== null) {
        const existingTimes = realClaimTimesBySession.get(sessionId) ?? []
        existingTimes.push(timestamp)
        realClaimTimesBySession.set(sessionId, existingTimes)
      }
    }
  }

  const uniqueSessions = sessionAggregates.size
  let returningSessions = 0
  let repeatClaimSessions = 0
  let multiDayUsers = 0
  let totalSessionDurationMs = 0
  let sessionDurationSamples = 0
  let returnIntervalsTotalMs = 0
  let returnIntervalsCount = 0
  let exampleSessions = 0
  let exampleToRealSessions = 0

  const referrerCounts = new Map<string, number>()
  const latestReturningSessions: AdminReturningSessionRecord[] = []

  for (const [sessionId, aggregate] of sessionAggregates) {
    const sortedOpenTimestamps = [...aggregate.appOpenTimestamps].sort((left, right) => left - right)
    const sessionVisitCount = countSessionVisits(aggregate)

    for (let index = 1; index < sortedOpenTimestamps.length; index += 1) {
      const gapMs = sortedOpenTimestamps[index] - sortedOpenTimestamps[index - 1]

      if (gapMs > RETURNING_SESSION_GAP_MS) {
        returnIntervalsTotalMs += gapMs
        returnIntervalsCount += 1
      }
    }

    const hasMultipleActivities = aggregate.totalClaims + aggregate.meaningfulEventCount > 1
    const isReturningSession =
      hasMultipleActivities || aggregate.totalClaims > 1 || sessionVisitCount > 1

    if (isReturningSession) {
      returningSessions += 1
      latestReturningSessions.push({
        sessionId,
        firstSeenAt: toIsoString(aggregate.firstSeenAt),
        lastSeenAt: toIsoString(aggregate.lastSeenAt),
        totalClaims: aggregate.totalClaims,
        totalEvents: aggregate.totalEvents,
        totalVisits: sessionVisitCount,
      })
    }

    if (aggregate.totalClaims > 1) {
      repeatClaimSessions += 1
    }

    const activityTimestamps = [
      ...aggregate.appOpenTimestamps,
      ...(realClaimTimesBySession.get(sessionId) ?? []),
    ]
    const activeWindowDurations = buildActiveSessionWindowDurations(activityTimestamps)

    for (const durationMs of activeWindowDurations) {
      totalSessionDurationMs += durationMs
      sessionDurationSamples += 1
    }

    if (aggregate.activityDaysUtc.size > 1) {
      multiDayUsers += 1
    }

    if (aggregate.firstReferrer) {
      referrerCounts.set(
        aggregate.firstReferrer,
        (referrerCounts.get(aggregate.firstReferrer) ?? 0) + 1
      )
    }

    const exampleFirstSeenAt = exampleFirstSeenBySession.get(sessionId)

    if (exampleFirstSeenAt !== undefined) {
      exampleSessions += 1
      const realClaimTimes = (realClaimTimesBySession.get(sessionId) ?? []).sort((left, right) => left - right)

      if (realClaimTimes.some((time) => time > exampleFirstSeenAt)) {
        exampleToRealSessions += 1
      }
    }
  }

  const topReferrers = Array.from(referrerCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map<AdminReferrerRecord>(([referrer, sessionCount]) => ({
      referrer,
      sessionCount,
    }))

  latestReturningSessions.sort((left, right) => {
    const leftTime = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0
    const rightTime = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0
    return rightTime - leftTime
  })

  const firstTimeSessions = Math.max(uniqueSessions - returningSessions, 0)
  const returningUserRate = uniqueSessions > 0 ? returningSessions / uniqueSessions : null

  return {
    uniqueSessions,
    returningSessions,
    returnRate: returningUserRate,
    returningUserRate,
    firstTimeSessions,
    repeatClaimSessions,
    latestReturningSessions: latestReturningSessions.slice(0, 10),
    multiDayUsers,
    averageClaimsPerUser: uniqueSessions > 0 ? totalClaims / uniqueSessions : 0,
    averageTimePerSessionMs:
      sessionDurationSamples > 0 ? Math.round(totalSessionDurationMs / sessionDurationSamples) : null,
    averageTimeBetweenSessionsMs:
      returnIntervalsCount > 0 ? Math.round(returnIntervalsTotalMs / returnIntervalsCount) : null,
    exampleToRealConversionRate:
      exampleSessions > 0 ? exampleToRealSessions / exampleSessions : null,
    topReferrers,
  }
}

async function readTableCountSafe(table: string) {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return null
  }

  const { count, error } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error || typeof count !== 'number') {
    return null
  }

  return count
}

async function readEventRows() {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return [] as EventRow[]
  }

  const { count, error: countError } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .select('*', { count: 'exact', head: true })

  if (countError) {
    return [] as EventRow[]
  }

  const totalRows = count ?? 0

  if (totalRows === 0) {
    return [] as EventRow[]
  }

  const rows: EventRow[] = []

  for (let offset = 0; offset < totalRows; offset += AGGREGATION_BATCH_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .select('*')
      .range(offset, offset + AGGREGATION_BATCH_SIZE - 1)

    if (error) {
      return [] as EventRow[]
    }

    rows.push(...((data ?? []) as EventRow[]))

    if (!data || data.length < AGGREGATION_BATCH_SIZE) {
      break
    }
  }

  return rows
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

async function readFunnelMetrics(totalClaims: number): Promise<AdminFunnelMetrics> {
  const emailCaptureCount = await readTableCountSafe(BETA_USERS_TABLE)

  return {
    ...emptyFunnel,
    claimSubmissions: buildTrackedFunnelStage('Claim submissions', totalClaims),
    emailCaptures:
      emailCaptureCount === null
        ? emptyFunnel.emailCaptures
        : buildTrackedFunnelStage('Email captures / signups', emailCaptureCount),
  }
}

export async function getAdminMetrics(): Promise<AdminMetricsResponse> {
  const aggregateResult = await readAggregateRows()

  if (aggregateResult.error) {
    return buildMetricsResponse({
      placeholder: aggregateResult.error.code === 'misconfigured',
      error: aggregateResult.error,
    })
  }

  const eventRows = await readEventRows()
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

  const [recentClaims, lowConfidenceClaims, slowestClaims, funnel] = await Promise.all([
    readRecentClaims(),
    readLowConfidenceClaims(),
    readSlowestClaims(),
    readFunnelMetrics(aggregateResult.totalClaims),
  ])
  const retention = buildRetentionMetrics(
    aggregateResult.rows,
    eventRows,
    aggregateResult.totalClaims
  )
  const categoryIntelligence = buildCategoryIntelligence(
    aggregateResult.rows,
    aggregateResult.totalClaims
  )

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
    funnel,
    retention,
    categoryIntelligence,
    recentClaims,
    lowConfidenceClaims,
    slowestClaims,
    error: null,
  })
}
