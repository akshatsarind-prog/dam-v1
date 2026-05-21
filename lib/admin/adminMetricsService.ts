import 'server-only'

import type {
  AdminClaimCategory,
  AdminClaimRecord,
  AdminCategoryBreakdownRecord,
  AdminFunnelStage,
  AdminMetricsResponse,
  AdminReferrerRecord,
  AdminTrafficSourceRecord,
  CampaignPerformance,
  CategoryIntelligence,
  EmailCaptureIntelligence,
  EmailSourceBreakdownRecord,
  ExecutiveSnapshot,
  FunnelIntelligence,
  OperationalHealth,
  OperatorRecommendation,
  RetentionIntelligence,
  RiskLabelBreakdown,
  TrafficSourceIntelligence,
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
const MANUAL_APP_VISITORS_BASELINE = 61
const RETURNING_SESSION_GAP_MS = 30 * 60 * 1000
const PAGE_VIEW_EVENT_NAMES = new Set(['page_view', 'campaign_page_view'] as const)
const CTA_EVENT_NAMES = new Set([
  'landing_cta_click',
  'campaign_scam_checker_cta_click',
  'campaign_whatsapp_checker_cta_click',
  'campaign_govt_checker_cta_click',
] as const)
const RECENT_DATA_WINDOW_MS = 24 * 60 * 60 * 1000
const LATENCY_WATCH_MS = 7_000
const LATENCY_NEEDS_ATTENTION_MS = 10_000
const LOW_CONFIDENCE_THRESHOLD = 60
const HIGH_LATENCY_THRESHOLD_MS = 8_000
const VERY_HIGH_LATENCY_THRESHOLD_MS = 12_000
const LOW_SOURCE_THRESHOLD = 1
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
type BetaUserRow = Record<string, unknown>

type ReadRowsResult<T extends Record<string, unknown>> = {
  rows: T[]
  available: boolean
}

type TrafficSourceDimensions = {
  source: string
  medium: string
  campaign: string
  attributed: boolean
}

type SessionAggregate = {
  sessionId: string
  visitorId: string | null
  firstSeenAt: number | null
  lastSeenAt: number | null
  firstEventAt: number | null
  lastEventAt: number | null
  claimCount: number
  totalEvents: number
  meaningfulEventCount: number
  appOpenTimestamps: number[]
  claimTimestamps: number[]
  meaningfulEventTimestamps: number[]
  exampleClaimTimestamps: number[]
  realClaimTimestamps: number[]
  activityDaysUtc: Set<string>
  source: string | null
  medium: string | null
  campaign: string | null
  attributed: boolean
  firstReferrer: string | null
  emailCaptured: boolean
}

type SessionContext = {
  sessionAggregates: Map<string, SessionAggregate>
  topReferrers: AdminReferrerRecord[]
}

type TrafficSourceAggregate = {
  source: string
  medium: string
  campaign: string
  sessionIds: Set<string>
  visitorIds: Set<string>
  claimSubmissions: number
  eventCount: number
  ctaClicks: number
  emailCaptures: number
  latestClaimAt: number | null
}

type BetaUserRecord = {
  email: string
  sessionId: string | null
  source: string | null
  createdAt: string | null
}

const emptyExecutiveSnapshot: ExecutiveSnapshot = {
  status: 'needs_attention',
  totalClaims: 0,
  claimsToday: 0,
  uniqueSessions: 0,
  returningSessionRate: null,
  repeatClaimSessions: 0,
  emailCaptures: null,
  claimToEmailConversionRate: null,
  averageLatencyMs: 0,
  p95LatencyMs: null,
  attributedClaims: 0,
  unattributedClaims: 0,
  lastClaimAt: null,
  lastEventAt: null,
  eventsToday: 0,
}

const emptyTrafficSourceIntelligence: TrafficSourceIntelligence = {
  available: false,
  note: 'Tracked events, not exact visitors.',
  rows: [],
  bestSourceByClaims: null,
  bestSourceByClaimsPerSession: null,
  bestCampaignByClaimSubmissions: null,
  attributedClaims: 0,
  unattributedClaims: 0,
  topReferrers: [],
}

const emptyFunnelIntelligence: FunnelIntelligence = {
  stages: [],
  biggestDropOff: null,
  strongestRetainedStage: null,
  bestSource: null,
  nextRecommendedAction: 'Not enough data yet.',
}

const emptyRetentionIntelligence: RetentionIntelligence = {
  uniqueSessions: 0,
  firstTimeSessions: 0,
  returningSessions: 0,
  returningSessionRate: null,
  repeatClaimSessions: 0,
  sessionsWithTwoPlusClaims: 0,
  sessionsWithThreePlusClaims: 0,
  multiDayUsers: 0,
  averageClaimsPerSession: 0,
  averageTimePerSessionMs: null,
  averageTimeBetweenSessionsMs: null,
  exampleToRealConversionRate: null,
  highIntentSessions: [],
  interpretation: ['Not enough data yet.'],
}

const emptyCategoryIntelligence: CategoryIntelligence = {
  categoryBreakdown: [],
  mostTestedCategory: null,
  highestLatencyCategory: null,
  lowestConfidenceCategory: null,
  highestSourceCampaignCategory: null,
  interpretation: ['Not enough data yet.'],
}

const emptyOperationalHealth: OperationalHealth = {
  averageLatencyMs: 0,
  medianLatencyMs: null,
  p95LatencyMs: null,
  maxLatencyMs: null,
  claimsOver8s: 0,
  claimsOver12s: 0,
  averageSourceCount: null,
  claimsWithZeroSources: 0,
  lowConfidenceClaimsCount: 0,
  lastClaimAt: null,
  lastEventAt: null,
  slowestClaims: [],
  lowConfidenceClaims: [],
  highRiskClaims: [],
  claimsWithLowSources: [],
}

const emptyEmailCaptureIntelligence: EmailCaptureIntelligence = {
  totalEmails: 0,
  emailsToday: 0,
  emailsLast7Days: 0,
  claimToEmailConversionRate: null,
  linkable: false,
  note: 'Not linkable yet.',
  sourceBreakdown: [],
  latestMaskedEmails: [],
}

const emptyMetrics: AdminMetricsResponse = {
  generatedAt: '',
  placeholder: false,
  executiveSnapshot: emptyExecutiveSnapshot,
  verdictBreakdown: [],
  riskLabelBreakdown: [],
  trafficSourceIntelligence: emptyTrafficSourceIntelligence,
  funnelIntelligence: emptyFunnelIntelligence,
  retentionIntelligence: emptyRetentionIntelligence,
  categoryIntelligence: emptyCategoryIntelligence,
  operationalHealth: emptyOperationalHealth,
  emailCaptureIntelligence: emptyEmailCaptureIntelligence,
  recentClaims: [],
  operatorRecommendations: [],
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

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim()
  return normalizedValue ? normalizedValue : null
}

function readDateString(value: unknown) {
  const text = readOptionalString(value)

  if (!text) {
    return null
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function readTimestamp(value: unknown) {
  const text = readOptionalString(value)

  if (!text) {
    return null
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : parsed
}

function readMetadata(row: EventRow) {
  return row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {}
}

function normalizeReferrerLabel(value: unknown) {
  const rawValue = readOptionalString(value)

  if (!rawValue) {
    return null
  }

  if (rawValue === 'direct') {
    return 'direct'
  }

  try {
    const parsedUrl = new URL(rawValue)
    return parsedUrl.hostname || rawValue
  } catch {
    return rawValue
  }
}

function truncateClaimText(claimText: string) {
  if (claimText.length <= CLAIM_TEXT_MAX_LENGTH) {
    return claimText
  }

  return `${claimText.slice(0, CLAIM_TEXT_MAX_LENGTH - 3)}...`
}

function normalizeText(value: string) {
  return ` ${value.trim().toLowerCase().replace(/\s+/g, ' ')} `
}

function hasAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function deriveClaimCategory(row: ClaimLogRow): AdminClaimCategory {
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

function hasClaimAttribution(row: ClaimLogRow) {
  return Boolean(
    readOptionalString(row.visitor_id) ||
      readOptionalString(row.utm_source) ||
      readOptionalString(row.utm_medium) ||
      readOptionalString(row.utm_campaign) ||
      readOptionalString(row.utm_content) ||
      readOptionalString(row.utm_term) ||
      readOptionalString(row.gclid) ||
      readOptionalString(row.referrer) ||
      readOptionalString(row.landing_path)
  )
}

function resolveTrafficSourceDimensions(input: {
  utmSource?: unknown
  utmMedium?: unknown
  utmCampaign?: unknown
  referrer?: unknown
  landingPath?: unknown
}) {
  const utmSource = readOptionalString(input.utmSource)
  const utmMedium = readOptionalString(input.utmMedium)
  const utmCampaign = readOptionalString(input.utmCampaign)
  const referrer = normalizeReferrerLabel(input.referrer)
  const landingPath = readOptionalString(input.landingPath)

  if (!utmSource && !utmMedium && !utmCampaign && !referrer && !landingPath) {
    return {
      source: 'unattributed',
      medium: 'unattributed',
      campaign: 'unattributed',
      attributed: false,
    } satisfies TrafficSourceDimensions
  }

  const source = utmSource || (referrer && referrer !== 'direct' ? referrer : 'direct')
  const medium = utmMedium || (!utmSource && referrer && referrer !== 'direct' ? 'referral' : 'none')
  const campaign = utmCampaign || 'not set'

  return {
    source,
    medium,
    campaign,
    attributed: true,
  } satisfies TrafficSourceDimensions
}

function buildTrafficSourceKey(dimensions: TrafficSourceDimensions) {
  return `${dimensions.source}__${dimensions.medium}__${dimensions.campaign}`
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) {
    return null
  }

  const sortedValues = [...values].sort((left, right) => left - right)
  const rank = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1)
  )
  return sortedValues[rank]
}

function buildBreakdown<T>(
  counts: Map<string, number>,
  mapKey: (key: string, count: number) => T
) {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => mapKey(key, count))
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

function getLocalStartOfToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

function getTimestampDaysAgo(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

function toIsoString(timestamp: number | null) {
  if (timestamp === null) {
    return null
  }

  return new Date(timestamp).toISOString()
}

function shortenEmail(email: string) {
  const [localPart, domain] = email.split('@')

  if (!localPart || !domain) {
    return '***'
  }

  const firstCharacter = localPart.slice(0, 1) || '*'
  return `${firstCharacter}***@${domain}`
}

function normalizeClaimRecord(row: ClaimLogRow): AdminClaimRecord {
  return {
    createdAt: readDateString(row.created_at),
    claimText: truncateClaimText(readString(row.claim_text)),
    verdict: readString(row.verdict, 'unknown') || 'unknown',
    confidence: readNumber(row.confidence, 0),
    riskLabel: readString(row.risk_label, 'unknown') || 'unknown',
    latencyMs: readNumber(row.latency_ms, 0),
    evidenceQuality: readOptionalString(row.evidence_quality),
    sourceCount:
      typeof row.source_count === 'number' && Number.isFinite(row.source_count)
        ? row.source_count
        : null,
    sessionId: readOptionalString(row.session_id),
    visitorId: readOptionalString(row.visitor_id),
    utmSource: readOptionalString(row.utm_source),
    utmMedium: readOptionalString(row.utm_medium),
    utmCampaign: readOptionalString(row.utm_campaign),
    referrer: normalizeReferrerLabel(row.referrer),
    landingPath: readOptionalString(row.landing_path),
    category: deriveClaimCategory(row),
    attributed: hasClaimAttribution(row),
  }
}

function normalizeBetaUserRecord(row: BetaUserRow): BetaUserRecord {
  return {
    email: readString(row.email).toLowerCase(),
    sessionId: readOptionalString(row.session_id),
    source: readOptionalString(row.source),
    createdAt: readDateString(row.created_at),
  }
}

function ensureSessionAggregate(sessionAggregates: Map<string, SessionAggregate>, sessionId: string) {
  let aggregate = sessionAggregates.get(sessionId)

  if (!aggregate) {
    aggregate = {
      sessionId,
      visitorId: null,
      firstSeenAt: null,
      lastSeenAt: null,
      firstEventAt: null,
      lastEventAt: null,
      claimCount: 0,
      totalEvents: 0,
      meaningfulEventCount: 0,
      appOpenTimestamps: [],
      claimTimestamps: [],
      meaningfulEventTimestamps: [],
      exampleClaimTimestamps: [],
      realClaimTimestamps: [],
      activityDaysUtc: new Set<string>(),
      source: null,
      medium: null,
      campaign: null,
      attributed: false,
      firstReferrer: null,
      emailCaptured: false,
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

function applyTrafficSourceToSession(
  aggregate: SessionAggregate,
  dimensions: TrafficSourceDimensions
) {
  if (
    aggregate.source === null ||
    (!aggregate.attributed && dimensions.attributed) ||
    (aggregate.source === 'unattributed' && dimensions.attributed)
  ) {
    aggregate.source = dimensions.source
    aggregate.medium = dimensions.medium
    aggregate.campaign = dimensions.campaign
    aggregate.attributed = dimensions.attributed
  }
}

function getVisitTimestamps(aggregate: SessionAggregate) {
  const timestamps = aggregate.appOpenTimestamps.length
    ? aggregate.appOpenTimestamps
    : [...aggregate.claimTimestamps, ...aggregate.meaningfulEventTimestamps]

  return [...timestamps].sort((left, right) => left - right)
}

function countSessionVisits(aggregate: SessionAggregate) {
  const timestamps = getVisitTimestamps(aggregate)

  if (!timestamps.length) {
    return aggregate.claimCount > 0 || aggregate.totalEvents > 0 ? 1 : 0
  }

  let visitCount = 1

  for (let index = 1; index < timestamps.length; index += 1) {
    const gapMs = timestamps[index] - timestamps[index - 1]

    if (gapMs > RETURNING_SESSION_GAP_MS) {
      visitCount += 1
    }
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
      const durationMs = previousTimestamp - windowStart

      if (durationMs > 0) {
        durations.push(durationMs)
      }

      windowStart = currentTimestamp
    }

    previousTimestamp = currentTimestamp
  }

  const finalDurationMs = previousTimestamp - windowStart

  if (finalDurationMs > 0) {
    durations.push(finalDurationMs)
  }

  return durations
}

function buildSessionContext(
  claimRows: ClaimLogRow[],
  normalizedClaims: AdminClaimRecord[],
  eventRows: EventRow[],
  betaUsers: BetaUserRecord[]
) {
  const sessionAggregates = new Map<string, SessionAggregate>()
  const referrerCounts = new Map<string, number>()

  for (const row of claimRows) {
    const sessionId = readOptionalString(row.session_id)

    if (!sessionId) {
      continue
    }

    const aggregate = ensureSessionAggregate(sessionAggregates, sessionId)
    const timestamp = readTimestamp(row.created_at)
    const dimensions = resolveTrafficSourceDimensions({
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      referrer: row.referrer,
      landingPath: row.landing_path,
    })

    aggregate.claimCount += 1
    if (timestamp !== null) {
      aggregate.claimTimestamps.push(timestamp)
    }
    aggregate.visitorId = aggregate.visitorId ?? readOptionalString(row.visitor_id)
    applyActivityTimestamp(aggregate, timestamp)
    applyTrafficSourceToSession(aggregate, dimensions)
  }

  for (const row of eventRows) {
    const sessionId = readOptionalString(row.session_id)

    if (!sessionId) {
      continue
    }

    const aggregate = ensureSessionAggregate(sessionAggregates, sessionId)
    const eventName = readString(row.event_name)
    const timestamp = readTimestamp(row.created_at)
    const metadata = readMetadata(row)
    const dimensions = resolveTrafficSourceDimensions({
      utmSource: metadata.utm_source,
      utmMedium: metadata.utm_medium,
      utmCampaign: metadata.utm_campaign,
      referrer: metadata.referrer,
      landingPath: metadata.landing_path,
    })
    const visitorId = readOptionalString(metadata.visitor_id)
    const referrer = normalizeReferrerLabel(metadata.referrer)

    aggregate.totalEvents += 1
    aggregate.visitorId = aggregate.visitorId ?? visitorId
    applyActivityTimestamp(aggregate, timestamp)
    applyTrafficSourceToSession(aggregate, dimensions)

    if (timestamp !== null) {
      aggregate.firstEventAt =
        aggregate.firstEventAt === null ? timestamp : Math.min(aggregate.firstEventAt, timestamp)
      aggregate.lastEventAt =
        aggregate.lastEventAt === null ? timestamp : Math.max(aggregate.lastEventAt, timestamp)
    }

    if (eventName !== 'app_session_end') {
      aggregate.meaningfulEventCount += 1

      if (timestamp !== null) {
        aggregate.meaningfulEventTimestamps.push(timestamp)
      }
    }

    if (eventName === 'app_open_click' && timestamp !== null) {
      aggregate.appOpenTimestamps.push(timestamp)
    }

    if (eventName === 'example_claim_click' && timestamp !== null) {
      aggregate.exampleClaimTimestamps.push(timestamp)
    }

    if (eventName === 'real_claim_submit' && timestamp !== null) {
      aggregate.realClaimTimestamps.push(timestamp)
    }

    if (referrer && !aggregate.firstReferrer) {
      aggregate.firstReferrer = referrer
    }
  }

  for (const betaUser of betaUsers) {
    if (!betaUser.sessionId) {
      continue
    }

    const aggregate = ensureSessionAggregate(sessionAggregates, betaUser.sessionId)
    aggregate.emailCaptured = true
  }

  for (const aggregate of sessionAggregates.values()) {
    if (aggregate.firstReferrer) {
      referrerCounts.set(
        aggregate.firstReferrer,
        (referrerCounts.get(aggregate.firstReferrer) ?? 0) + 1
      )
    }
  }

  const topReferrers = Array.from(referrerCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map<AdminReferrerRecord>(([referrer, sessionCount]) => ({
      referrer,
      sessionCount,
    }))

  // Touch normalizedClaims so TypeScript treats the function inputs as intentionally consumed.
  void normalizedClaims

  return {
    sessionAggregates,
    topReferrers,
  } satisfies SessionContext
}

function computeCampaignPerformance(
  rows: AdminTrafficSourceRecord[],
  mode: 'claims' | 'claims_per_session'
) {
  const eligibleRows =
    mode === 'claims'
      ? rows.filter((row) => row.claimSubmissions > 0)
      : rows.filter(
          (row) => row.claimSubmissions > 0 && row.claimsPerSession !== null && row.uniqueSessions > 0
        )

  if (!eligibleRows.length) {
    return null
  }

  const selectedRow = [...eligibleRows].sort((left, right) => {
    if (mode === 'claims') {
      return (
        right.claimSubmissions - left.claimSubmissions ||
        right.uniqueSessions - left.uniqueSessions ||
        left.source.localeCompare(right.source)
      )
    }

    return (
      (right.claimsPerSession ?? 0) - (left.claimsPerSession ?? 0) ||
      right.claimSubmissions - left.claimSubmissions ||
      left.source.localeCompare(right.source)
    )
  })[0]

  return {
    source: selectedRow.source,
    medium: selectedRow.medium,
    campaign: selectedRow.campaign,
    claimSubmissions: selectedRow.claimSubmissions,
    uniqueSessions: selectedRow.uniqueSessions,
    uniqueVisitors: selectedRow.uniqueVisitors,
    claimsPerSession: selectedRow.claimsPerSession,
    latestClaimAt: selectedRow.latestClaimAt,
    label: `${selectedRow.source} / ${selectedRow.medium} / ${selectedRow.campaign}`,
  } satisfies CampaignPerformance
}

export function groupByTrafficSource(
  claimRows: ClaimLogRow[],
  normalizedClaims: AdminClaimRecord[],
  eventRows: EventRow[],
  betaUsers: BetaUserRecord[],
  sessionContext: SessionContext
) {
  const aggregates = new Map<string, TrafficSourceAggregate>()

  function ensureAggregate(dimensions: TrafficSourceDimensions) {
    const key = buildTrafficSourceKey(dimensions)
    let aggregate = aggregates.get(key)

    if (!aggregate) {
      aggregate = {
        source: dimensions.source,
        medium: dimensions.medium,
        campaign: dimensions.campaign,
        sessionIds: new Set<string>(),
        visitorIds: new Set<string>(),
        claimSubmissions: 0,
        eventCount: 0,
        ctaClicks: 0,
        emailCaptures: 0,
        latestClaimAt: null,
      }
      aggregates.set(key, aggregate)
    }

    return aggregate
  }

  for (let index = 0; index < claimRows.length; index += 1) {
    const row = claimRows[index]
    const claim = normalizedClaims[index]
    const dimensions = resolveTrafficSourceDimensions({
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      referrer: row.referrer,
      landingPath: row.landing_path,
    })
    const aggregate = ensureAggregate(dimensions)

    aggregate.claimSubmissions += 1

    if (claim.sessionId) {
      aggregate.sessionIds.add(claim.sessionId)
    }

    if (claim.visitorId) {
      aggregate.visitorIds.add(claim.visitorId)
    }

    if (claim.createdAt) {
      const timestamp = Date.parse(claim.createdAt)

      if (!Number.isNaN(timestamp)) {
        aggregate.latestClaimAt =
          aggregate.latestClaimAt === null ? timestamp : Math.max(aggregate.latestClaimAt, timestamp)
      }
    }
  }

  for (const row of eventRows) {
    const metadata = readMetadata(row)
    const eventName = readString(row.event_name)
    const dimensions = resolveTrafficSourceDimensions({
      utmSource: metadata.utm_source,
      utmMedium: metadata.utm_medium,
      utmCampaign: metadata.utm_campaign,
      referrer: metadata.referrer,
      landingPath: metadata.landing_path,
    })
    const aggregate = ensureAggregate(dimensions)
    const sessionId = readOptionalString(row.session_id)
    const visitorId = readOptionalString(metadata.visitor_id)

    aggregate.eventCount += 1

    if (sessionId) {
      aggregate.sessionIds.add(sessionId)
    }

    if (visitorId) {
      aggregate.visitorIds.add(visitorId)
    }

    if (CTA_EVENT_NAMES.has(eventName as
      | 'landing_cta_click'
      | 'campaign_scam_checker_cta_click'
      | 'campaign_whatsapp_checker_cta_click'
      | 'campaign_govt_checker_cta_click')) {
      aggregate.ctaClicks += 1
    }
  }

  for (const betaUser of betaUsers) {
    if (!betaUser.sessionId) {
      continue
    }

    const sessionAggregate = sessionContext.sessionAggregates.get(betaUser.sessionId)

    if (!sessionAggregate || !sessionAggregate.source || !sessionAggregate.medium || !sessionAggregate.campaign) {
      continue
    }

    const dimensions = {
      source: sessionAggregate.source,
      medium: sessionAggregate.medium,
      campaign: sessionAggregate.campaign,
      attributed: sessionAggregate.attributed,
    } satisfies TrafficSourceDimensions
    const aggregate = ensureAggregate(dimensions)

    aggregate.emailCaptures += 1
    aggregate.sessionIds.add(betaUser.sessionId)

    if (sessionAggregate.visitorId) {
      aggregate.visitorIds.add(sessionAggregate.visitorId)
    }
  }

  const rows = Array.from(aggregates.values())
    .sort(
      (left, right) =>
        right.claimSubmissions - left.claimSubmissions ||
        right.eventCount - left.eventCount ||
        right.emailCaptures - left.emailCaptures ||
        left.source.localeCompare(right.source) ||
        left.medium.localeCompare(right.medium) ||
        left.campaign.localeCompare(right.campaign)
    )
    .slice(0, 30)
    .map<AdminTrafficSourceRecord>((aggregate) => {
      const uniqueSessions = aggregate.sessionIds.size
      const claimsPerSession =
        uniqueSessions > 0 ? Number((aggregate.claimSubmissions / uniqueSessions).toFixed(2)) : null
      const interpretation =
        aggregate.claimSubmissions > 0 && claimsPerSession !== null && claimsPerSession >= 1.5
          ? 'High-intent traffic'
          : aggregate.claimSubmissions > 0 && aggregate.eventCount > 0
            ? 'Traffic is producing claims'
            : aggregate.eventCount > 0 && aggregate.claimSubmissions === 0
              ? 'Traffic observed, but claims have not converted yet'
              : aggregate.claimSubmissions > 0
                ? 'Claims logged; event coverage is partial'
                : 'Not enough data yet'

      return {
        source: aggregate.source,
        medium: aggregate.medium,
        campaign: aggregate.campaign,
        claimSubmissions: aggregate.claimSubmissions,
        uniqueSessions,
        uniqueVisitors: aggregate.visitorIds.size,
        eventCount: aggregate.eventCount,
        ctaClicks: aggregate.ctaClicks,
        emailCaptures: aggregate.emailCaptures,
        claimsPerSession,
        latestClaimAt: toIsoString(aggregate.latestClaimAt),
        interpretation,
      }
    })

  return rows
}

function buildFunnelStage(input: {
  key: string
  label: string
  count: number | null
  status: AdminFunnelStage['status']
  manualBaseline: boolean
  sourceLabel: string
  previousCount: number | null
}) {
  return {
    key: input.key,
    label: input.label,
    count: input.count,
    status: input.status,
    manualBaseline: input.manualBaseline,
    sourceLabel: input.sourceLabel,
    conversionFromPrevious:
      input.count !== null && input.previousCount !== null && input.previousCount > 0
        ? input.count / input.previousCount
        : null,
  } satisfies AdminFunnelStage
}

export function computeFunnelMetrics(input: {
  totalClaims: number
  pageViewSessions: number
  appOpenSessions: number
  emailCaptures: number | null
  betaRowsAvailable: boolean
  bestSource: CampaignPerformance | null
}) {
  const distributedStage = buildFunnelStage({
    key: 'distributed',
    label: 'Reached / Distributed',
    count: MANUAL_DISTRIBUTED_BASELINE,
    status: 'manual',
    manualBaseline: true,
    sourceLabel: 'Manual baseline',
    previousCount: null,
  })

  const landingStage = input.pageViewSessions > 0
    ? buildFunnelStage({
        key: 'landing_visitors',
        label: 'Landing visitors',
        count: input.pageViewSessions,
        status: 'tracked',
        manualBaseline: false,
        sourceLabel: 'Tracked sessions',
        previousCount: distributedStage.count,
      })
    : buildFunnelStage({
        key: 'landing_visitors',
        label: 'Landing visitors',
        count: MANUAL_LANDING_VISITORS_BASELINE,
        status: 'manual',
        manualBaseline: true,
        sourceLabel: 'Manual baseline',
        previousCount: distributedStage.count,
      })

  const appStage = input.appOpenSessions > 0
    ? buildFunnelStage({
        key: 'app_visitors',
        label: 'App visitors / sessions',
        count: input.appOpenSessions,
        status: 'tracked',
        manualBaseline: false,
        sourceLabel: 'Tracked sessions',
        previousCount: landingStage.count,
      })
    : buildFunnelStage({
        key: 'app_visitors',
        label: 'App visitors / sessions',
        count: MANUAL_APP_VISITORS_BASELINE,
        status: 'manual',
        manualBaseline: true,
        sourceLabel: 'Manual baseline',
        previousCount: landingStage.count,
      })

  const claimStage = buildFunnelStage({
    key: 'claim_submissions',
    label: 'Claim submissions',
    count: input.totalClaims,
    status: 'tracked',
    manualBaseline: false,
    sourceLabel: 'Tracked claims',
    previousCount: appStage.count,
  })

  const emailStage = input.betaRowsAvailable
    ? buildFunnelStage({
        key: 'email_captures',
        label: 'Email captures / signups',
        count: input.emailCaptures ?? 0,
        status: 'tracked',
        manualBaseline: false,
        sourceLabel: 'Tracked signups',
        previousCount: claimStage.count,
      })
    : buildFunnelStage({
        key: 'email_captures',
        label: 'Email captures / signups',
        count: null,
        status: 'not_tracked',
        manualBaseline: false,
        sourceLabel: 'Not tracked yet',
        previousCount: claimStage.count,
      })

  const stages = [distributedStage, landingStage, appStage, claimStage, emailStage]
  const comparableStages = stages
    .filter((stage) => stage.conversionFromPrevious !== null)
    .map((stage) => ({
      label: `${stage.label} from previous stage`,
      conversion: stage.conversionFromPrevious,
    }))

  const biggestDropOff = comparableStages.length
    ? [...comparableStages].sort((left, right) => (left.conversion ?? 0) - (right.conversion ?? 0))[0]
    : null

  const strongestRetainedStage = comparableStages.length
    ? [...comparableStages].sort((left, right) => (right.conversion ?? 0) - (left.conversion ?? 0))[0]
    : null

  const nextRecommendedAction =
    biggestDropOff?.label.includes('App visitors')
      ? 'Reduce friction between opening the app and submitting the first claim.'
      : biggestDropOff?.label.includes('Landing visitors')
        ? 'Tighten the landing message and CTA handoff before pushing more reach.'
        : biggestDropOff?.label.includes('Email captures')
          ? 'Improve the email capture timing or copy after results are shown.'
          : input.bestSource
            ? `Keep an eye on ${input.bestSource.label} while the funnel stays stable.`
            : 'Not enough data yet.'

  return {
    stages,
    biggestDropOff,
    strongestRetainedStage,
    bestSource: input.bestSource,
    nextRecommendedAction,
  } satisfies FunnelIntelligence
}

export function computeRetentionMetrics(
  normalizedClaims: AdminClaimRecord[],
  sessionContext: SessionContext
) {
  const aggregates = Array.from(sessionContext.sessionAggregates.values())
  const uniqueSessions = aggregates.length
  let returningSessions = 0
  let repeatClaimSessions = 0
  let sessionsWithTwoPlusClaims = 0
  let sessionsWithThreePlusClaims = 0
  let multiDayUsers = 0
  let totalSessionDurationMs = 0
  let sessionDurationSamples = 0
  let returnIntervalsTotalMs = 0
  let returnIntervalsCount = 0
  let exampleSessions = 0
  let exampleToRealSessions = 0

  const highIntentSessions = aggregates
    .map((aggregate) => {
      const visitTimestamps = getVisitTimestamps(aggregate)
      const sessionVisits = countSessionVisits(aggregate)

      for (let index = 1; index < visitTimestamps.length; index += 1) {
        const gapMs = visitTimestamps[index] - visitTimestamps[index - 1]

        if (gapMs > RETURNING_SESSION_GAP_MS) {
          returnIntervalsTotalMs += gapMs
          returnIntervalsCount += 1
        }
      }

      const activeWindowDurations = buildActiveSessionWindowDurations([
        ...aggregate.claimTimestamps,
        ...aggregate.meaningfulEventTimestamps,
      ])

      for (const durationMs of activeWindowDurations) {
        totalSessionDurationMs += durationMs
        sessionDurationSamples += 1
      }

      const isReturning =
        sessionVisits > 1 ||
        aggregate.claimCount > 1 ||
        aggregate.activityDaysUtc.size > 1 ||
        aggregate.meaningfulEventCount + aggregate.claimCount > 1

      if (isReturning) {
        returningSessions += 1
      }

      if (aggregate.claimCount >= 2) {
        sessionsWithTwoPlusClaims += 1
      }

      if (aggregate.claimCount >= 3) {
        sessionsWithThreePlusClaims += 1
      }

      if (aggregate.claimCount >= 2 && sessionVisits > 1) {
        repeatClaimSessions += 1
      }

      if (aggregate.activityDaysUtc.size > 1) {
        multiDayUsers += 1
      }

      if (aggregate.exampleClaimTimestamps.length > 0) {
        exampleSessions += 1

        const firstExampleAt = Math.min(...aggregate.exampleClaimTimestamps)

        if (aggregate.realClaimTimestamps.some((timestamp) => timestamp > firstExampleAt)) {
          exampleToRealSessions += 1
        }
      }

      return {
        sessionId: aggregate.sessionId,
        visitorId: aggregate.visitorId,
        claimCount: aggregate.claimCount,
        source: aggregate.source,
        campaign: aggregate.campaign,
        firstSeenAt: toIsoString(aggregate.firstSeenAt),
        lastSeenAt: toIsoString(aggregate.lastSeenAt),
        isReturning,
        emailCaptured: aggregate.emailCaptured,
        sessionVisits,
      }
    })
    .sort(
      (left, right) =>
        right.claimCount - left.claimCount ||
        (right.isReturning ? 1 : 0) - (left.isReturning ? 1 : 0) ||
        (right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0) -
          (left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0)
    )
    .slice(0, 12)
    .map((session) => ({
      sessionId: session.sessionId,
      visitorId: session.visitorId,
      claimCount: session.claimCount,
      source: session.source,
      campaign: session.campaign,
      firstSeenAt: session.firstSeenAt,
      lastSeenAt: session.lastSeenAt,
      isReturning: session.isReturning,
      emailCaptured: session.emailCaptured,
    }))

  const firstTimeSessions = Math.max(uniqueSessions - returningSessions, 0)
  const returningSessionRate = uniqueSessions > 0 ? returningSessions / uniqueSessions : null
  const averageClaimsPerSession =
    uniqueSessions > 0 ? normalizedClaims.length / uniqueSessions : 0

  const interpretation: string[] = []

  if (returningSessionRate === null || uniqueSessions === 0) {
    interpretation.push('Not enough data yet.')
  } else if (returningSessionRate < 0.15) {
    interpretation.push('Mostly first-time curiosity.')
    interpretation.push('Habit formation still weak.')
  } else if (returningSessionRate < 0.25) {
    interpretation.push('Repeat usage emerging.')
  } else {
    interpretation.push('Retention signal improving.')
  }

  if (sessionsWithThreePlusClaims > 0) {
    interpretation.push('Some sessions already show deeper repeated claim behavior.')
  }

  return {
    uniqueSessions,
    firstTimeSessions,
    returningSessions,
    returningSessionRate,
    repeatClaimSessions,
    sessionsWithTwoPlusClaims,
    sessionsWithThreePlusClaims,
    multiDayUsers,
    averageClaimsPerSession,
    averageTimePerSessionMs:
      sessionDurationSamples > 0 ? Math.round(totalSessionDurationMs / sessionDurationSamples) : null,
    averageTimeBetweenSessionsMs:
      returnIntervalsCount > 0 ? Math.round(returnIntervalsTotalMs / returnIntervalsCount) : null,
    exampleToRealConversionRate:
      exampleSessions > 0 ? exampleToRealSessions / exampleSessions : null,
    highIntentSessions,
    interpretation,
  } satisfies RetentionIntelligence
}

export function computeCategoryIntelligence(normalizedClaims: AdminClaimRecord[]) {
  const categoryStats = new Map<
    AdminClaimCategory,
    {
      count: number
      totalConfidence: number
      totalLatencyMs: number
      totalSourceCount: number
      sourceCountSamples: number
      attributedClaimCount: number
      sourceCounts: Map<string, number>
      campaignCounts: Map<string, number>
      latestClaimAt: number | null
      latestClaimText: string | null
    }
  >()

  for (const claim of normalizedClaims) {
    const current = categoryStats.get(claim.category) ?? {
      count: 0,
      totalConfidence: 0,
      totalLatencyMs: 0,
      totalSourceCount: 0,
      sourceCountSamples: 0,
      attributedClaimCount: 0,
      sourceCounts: new Map<string, number>(),
      campaignCounts: new Map<string, number>(),
      latestClaimAt: null,
      latestClaimText: null,
    }

    current.count += 1
    current.totalConfidence += claim.confidence
    current.totalLatencyMs += claim.latencyMs

    if (claim.sourceCount !== null) {
      current.totalSourceCount += claim.sourceCount
      current.sourceCountSamples += 1
    }

    if (claim.attributed) {
      current.attributedClaimCount += 1
    }

    if (claim.utmSource) {
      current.sourceCounts.set(claim.utmSource, (current.sourceCounts.get(claim.utmSource) ?? 0) + 1)
    }

    if (claim.utmCampaign) {
      current.campaignCounts.set(
        claim.utmCampaign,
        (current.campaignCounts.get(claim.utmCampaign) ?? 0) + 1
      )
    }

    if (claim.createdAt) {
      const timestamp = Date.parse(claim.createdAt)

      if (!Number.isNaN(timestamp) && (current.latestClaimAt === null || timestamp > current.latestClaimAt)) {
        current.latestClaimAt = timestamp
        current.latestClaimText = claim.claimText
      }
    }

    categoryStats.set(claim.category, current)
  }

  const totalClaims = normalizedClaims.length

  const categoryBreakdown = Array.from(categoryStats.entries())
    .map<AdminCategoryBreakdownRecord>(([category, stats]) => ({
      category,
      count: stats.count,
      percentage: totalClaims > 0 ? stats.count / totalClaims : 0,
      averageConfidence: stats.count > 0 ? Number((stats.totalConfidence / stats.count).toFixed(1)) : 0,
      averageLatencyMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      averageSourceCount:
        stats.sourceCountSamples > 0
          ? Number((stats.totalSourceCount / stats.sourceCountSamples).toFixed(2))
          : null,
      topSource: Array.from(stats.sourceCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
      topCampaign:
        Array.from(stats.campaignCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
      latestClaimText: stats.latestClaimText,
      latestClaimAt: toIsoString(stats.latestClaimAt),
      attributedClaimCount: stats.attributedClaimCount,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))

  const mostTestedCategory = categoryBreakdown[0] ?? null
  const highestLatencyCategory = categoryBreakdown.length
    ? [...categoryBreakdown].sort(
        (left, right) => right.averageLatencyMs - left.averageLatencyMs || right.count - left.count
      )[0]
    : null
  const lowestConfidenceCategory = categoryBreakdown.length
    ? [...categoryBreakdown].sort(
        (left, right) => left.averageConfidence - right.averageConfidence || right.count - left.count
      )[0]
    : null
  const highestSourceCampaignCategory = categoryBreakdown.length
    ? [...categoryBreakdown].sort(
        (left, right) => right.attributedClaimCount - left.attributedClaimCount || right.count - left.count
      )[0]
    : null

  const interpretation: string[] = []
  const otherCategory = categoryBreakdown.find((row) => row.category === 'other')
  const scamCategory = categoryBreakdown.find((row) => row.category === 'scam')

  if (mostTestedCategory) {
    if (mostTestedCategory.category === 'other') {
      interpretation.push('Users are mostly testing general curiosity claims.')
    } else {
      interpretation.push(`Users are mostly testing ${mostTestedCategory.category.replace(/_/g, ' ')} claims.`)
    }
  } else {
    interpretation.push('Not enough data yet.')
  }

  if (scamCategory) {
    interpretation.push(
      scamCategory.percentage >= 0.25 ? 'Scam usage is strong.' : 'Scam usage is still a minority of logged claims.'
    )
  }

  if (lowestConfidenceCategory) {
    interpretation.push(
      `${lowestConfidenceCategory.category.replace(/_/g, ' ')} category has the lowest confidence.`
    )
  }

  if (highestLatencyCategory) {
    interpretation.push(
      `${highestLatencyCategory.category.replace(/_/g, ' ')} claims are currently the slowest.`
    )
  }

  if (otherCategory && otherCategory.percentage >= 0.35) {
    interpretation.push('Other category is too high; category derivation may need refinement.')
  }

  return {
    categoryBreakdown,
    mostTestedCategory,
    highestLatencyCategory,
    lowestConfidenceCategory,
    highestSourceCampaignCategory,
    interpretation,
  } satisfies CategoryIntelligence
}

export function computeOperationalHealth(
  normalizedClaims: AdminClaimRecord[],
  eventRows: EventRow[]
) {
  const latencyValues = normalizedClaims.map((claim) => claim.latencyMs).filter((value) => value > 0)
  const sourceCountValues = normalizedClaims
    .map((claim) => claim.sourceCount)
    .filter((value): value is number => value !== null)
  const lastClaimAt = normalizedClaims[0]?.createdAt ?? null
  const lastEventAt = eventRows
    .map((row) => readDateString(row.created_at))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null

  return {
    averageLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : 0,
    medianLatencyMs: percentile(latencyValues, 50),
    p95LatencyMs: percentile(latencyValues, 95),
    maxLatencyMs: latencyValues.length ? Math.max(...latencyValues) : null,
    claimsOver8s: normalizedClaims.filter((claim) => claim.latencyMs >= HIGH_LATENCY_THRESHOLD_MS).length,
    claimsOver12s: normalizedClaims.filter((claim) => claim.latencyMs >= VERY_HIGH_LATENCY_THRESHOLD_MS).length,
    averageSourceCount:
      sourceCountValues.length > 0
        ? Number((sourceCountValues.reduce((sum, value) => sum + value, 0) / sourceCountValues.length).toFixed(2))
        : null,
    claimsWithZeroSources: normalizedClaims.filter((claim) => claim.sourceCount === 0).length,
    lowConfidenceClaimsCount: normalizedClaims.filter((claim) => claim.confidence < LOW_CONFIDENCE_THRESHOLD).length,
    lastClaimAt,
    lastEventAt,
    slowestClaims: sortByLatencyDesc(normalizedClaims).slice(0, 10),
    lowConfidenceClaims: sortByCreatedAtDesc(
      normalizedClaims.filter((claim) => claim.confidence < LOW_CONFIDENCE_THRESHOLD)
    ).slice(0, 12),
    highRiskClaims: sortByCreatedAtDesc(
      normalizedClaims.filter((claim) => {
        const risk = claim.riskLabel.toLowerCase()
        return risk.includes('high') || risk.includes('severe')
      })
    ).slice(0, 12),
    claimsWithLowSources: sortByCreatedAtDesc(
      normalizedClaims.filter(
        (claim) => claim.sourceCount !== null && claim.sourceCount <= LOW_SOURCE_THRESHOLD
      )
    ).slice(0, 12),
  } satisfies OperationalHealth
}

function computeExecutiveStatus(input: {
  averageLatencyMs: number
  claimsToday: number
  eventsToday: number
  lastClaimAt: string | null
  lastEventAt: string | null
}) {
  const now = Date.now()
  const lastClaimTimestamp = input.lastClaimAt ? Date.parse(input.lastClaimAt) : null
  const lastEventTimestamp = input.lastEventAt ? Date.parse(input.lastEventAt) : null
  const hasRecentData = [lastClaimTimestamp, lastEventTimestamp].some(
    (timestamp) => timestamp !== null && now - timestamp <= RECENT_DATA_WINDOW_MS
  )
  const fewRecentEvents = input.claimsToday < 3 && input.eventsToday < 10

  if (input.averageLatencyMs > LATENCY_NEEDS_ATTENTION_MS || !hasRecentData) {
    return 'needs_attention' as const
  }

  if (input.averageLatencyMs >= LATENCY_WATCH_MS || fewRecentEvents) {
    return 'watch' as const
  }

  return 'healthy' as const
}

export function computeExecutiveSnapshot(input: {
  totalClaims: number
  claimsToday: number
  eventsToday: number
  retention: RetentionIntelligence
  totalEmails: number | null
  operationalHealth: OperationalHealth
  attributedClaims: number
  unattributedClaims: number
}) {
  const claimToEmailConversionRate =
    input.totalClaims > 0 && input.totalEmails !== null ? input.totalEmails / input.totalClaims : null

  return {
    status: computeExecutiveStatus({
      averageLatencyMs: input.operationalHealth.averageLatencyMs,
      claimsToday: input.claimsToday,
      eventsToday: input.eventsToday,
      lastClaimAt: input.operationalHealth.lastClaimAt,
      lastEventAt: input.operationalHealth.lastEventAt,
    }),
    totalClaims: input.totalClaims,
    claimsToday: input.claimsToday,
    uniqueSessions: input.retention.uniqueSessions,
    returningSessionRate: input.retention.returningSessionRate,
    repeatClaimSessions: input.retention.repeatClaimSessions,
    emailCaptures: input.totalEmails,
    claimToEmailConversionRate,
    averageLatencyMs: input.operationalHealth.averageLatencyMs,
    p95LatencyMs: input.operationalHealth.p95LatencyMs,
    attributedClaims: input.attributedClaims,
    unattributedClaims: input.unattributedClaims,
    lastClaimAt: input.operationalHealth.lastClaimAt,
    lastEventAt: input.operationalHealth.lastEventAt,
    eventsToday: input.eventsToday,
  } satisfies ExecutiveSnapshot
}

function computeEmailSourceBreakdown(
  betaUsers: BetaUserRecord[],
  sessionContext: SessionContext
) {
  const counts = new Map<string, EmailSourceBreakdownRecord>()
  let linkableCount = 0

  for (const betaUser of betaUsers) {
    if (!betaUser.sessionId) {
      continue
    }

    const session = sessionContext.sessionAggregates.get(betaUser.sessionId)

    if (!session || !session.source || !session.medium || !session.campaign) {
      continue
    }

    const key = `${session.source}__${session.medium}__${session.campaign}`
    const current = counts.get(key) ?? {
      source: session.source,
      medium: session.medium,
      campaign: session.campaign,
      emailCaptures: 0,
    }

    current.emailCaptures += 1
    counts.set(key, current)
    linkableCount += 1
  }

  return {
    rows: Array.from(counts.values())
      .sort(
        (left, right) =>
          right.emailCaptures - left.emailCaptures ||
          left.source.localeCompare(right.source) ||
          left.medium.localeCompare(right.medium) ||
          left.campaign.localeCompare(right.campaign)
      )
      .slice(0, 8),
    linkableCount,
  }
}

function computeEmailCaptureIntelligence(
  betaUsers: BetaUserRecord[],
  betaRowsAvailable: boolean,
  sessionContext: SessionContext,
  totalClaims: number
) {
  if (!betaRowsAvailable) {
    return {
      ...emptyEmailCaptureIntelligence,
      totalEmails: 0,
      note: 'Not enough data yet.',
    } satisfies EmailCaptureIntelligence
  }

  const startOfToday = getLocalStartOfToday()
  const sevenDaysAgo = getTimestampDaysAgo(7)
  const { rows: sourceBreakdown, linkableCount } = computeEmailSourceBreakdown(betaUsers, sessionContext)
  const totalEmails = betaUsers.length
  const emailsToday = betaUsers.filter((user) => {
    const timestamp = user.createdAt ? Date.parse(user.createdAt) : NaN
    return !Number.isNaN(timestamp) && timestamp >= startOfToday
  }).length
  const emailsLast7Days = betaUsers.filter((user) => {
    const timestamp = user.createdAt ? Date.parse(user.createdAt) : NaN
    return !Number.isNaN(timestamp) && timestamp >= sevenDaysAgo
  }).length

  return {
    totalEmails,
    emailsToday,
    emailsLast7Days,
    claimToEmailConversionRate: totalClaims > 0 ? totalEmails / totalClaims : null,
    linkable: linkableCount > 0,
    note:
      totalEmails === 0
        ? 'Not enough data yet.'
        : linkableCount === 0
          ? 'Not linkable yet.'
          : linkableCount < totalEmails
            ? `Linked via session_id for ${linkableCount} of ${totalEmails} captures.`
            : 'Linked via session_id.',
    sourceBreakdown,
    latestMaskedEmails: betaUsers
      .slice()
      .sort((left, right) => {
        const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0
        const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0
        return rightTime - leftTime
      })
      .slice(0, 8)
      .map((user) => {
        const session = user.sessionId ? sessionContext.sessionAggregates.get(user.sessionId) : null

        return {
          maskedEmail: shortenEmail(user.email),
          createdAt: user.createdAt,
          source: session?.source ?? null,
          campaign: session?.campaign ?? null,
        }
      }),
  } satisfies EmailCaptureIntelligence
}

export function computeOperatorRecommendations(input: {
  executiveSnapshot: ExecutiveSnapshot
  trafficSourceIntelligence: TrafficSourceIntelligence
  funnelIntelligence: FunnelIntelligence
  retentionIntelligence: RetentionIntelligence
  categoryIntelligence: CategoryIntelligence
  operationalHealth: OperationalHealth
  emailCaptureIntelligence: EmailCaptureIntelligence
}) {
  const recommendations: OperatorRecommendation[] = []

  if (
    input.emailCaptureIntelligence.claimToEmailConversionRate !== null &&
    input.executiveSnapshot.totalClaims >= 5 &&
    input.emailCaptureIntelligence.claimToEmailConversionRate < 0.15
  ) {
    recommendations.push({
      priority: 'high',
      title: 'Improve email capture timing or copy',
      detail: 'Claims are coming in, but the claim-to-email conversion rate is still weak.',
    })
  }

  if (
    input.executiveSnapshot.totalClaims > 0 &&
    input.executiveSnapshot.unattributedClaims / input.executiveSnapshot.totalClaims >= 0.2
  ) {
    recommendations.push({
      priority: 'high',
      title: 'Use tracked links more consistently',
      detail: 'A meaningful share of claims still arrive without logged attribution.',
    })
  }

  if (input.trafficSourceIntelligence.bestSourceByClaims?.source === 'google_ads') {
    recommendations.push({
      priority: 'medium',
      title: 'Google Ads attribution is active',
      detail: 'Monitor cost per claim closely now that paid search is producing attributable claims.',
    })
  }

  if (
    input.trafficSourceIntelligence.bestSourceByClaimsPerSession?.source === 'linkedin' &&
    input.trafficSourceIntelligence.bestSourceByClaimsPerSession?.medium === 'dm'
  ) {
    recommendations.push({
      priority: 'medium',
      title: 'Double down on LinkedIn DM outreach',
      detail: 'LinkedIn DM currently leads on claims per session.',
    })
  }

  if (
    input.trafficSourceIntelligence.bestSourceByClaimsPerSession?.source === 'whatsapp' &&
    input.trafficSourceIntelligence.bestSourceByClaimsPerSession?.medium === 'group'
  ) {
    recommendations.push({
      priority: 'medium',
      title: 'Push WhatsApp-native distribution',
      detail: 'WhatsApp group traffic is showing stronger session intent than other channels.',
    })
  }

  const otherCategory = input.categoryIntelligence.categoryBreakdown.find(
    (row) => row.category === 'other'
  )

  if (otherCategory && otherCategory.percentage >= 0.35) {
    recommendations.push({
      priority: 'medium',
      title: 'Refine analytics-only category derivation',
      detail: 'The Other bucket is too large to give a clean usage read.',
    })
  }

  if (input.operationalHealth.averageLatencyMs > HIGH_LATENCY_THRESHOLD_MS) {
    recommendations.push({
      priority: 'high',
      title: 'Inspect retrieval or API latency',
      detail: 'Average response latency is above the watch threshold.',
    })
  }

  if (
    input.retentionIntelligence.returningSessionRate !== null &&
    input.retentionIntelligence.returningSessionRate < 0.15
  ) {
    recommendations.push({
      priority: 'medium',
      title: 'Focus on repeat-use triggers',
      detail: 'Returning session rate is still below 15%, so re-engagement remains weak.',
    })
  }

  if (
    input.funnelIntelligence.biggestDropOff?.label.includes('App visitors') ||
    input.funnelIntelligence.biggestDropOff?.label.includes('Claim submissions')
  ) {
    recommendations.push({
      priority: 'high',
      title: 'Reduce app-to-claim friction',
      detail: input.funnelIntelligence.nextRecommendedAction,
    })
  }

  if (!recommendations.length) {
    recommendations.push({
      priority: 'low',
      title: 'Keep monitoring the strongest attributed source',
      detail:
        input.trafficSourceIntelligence.bestSourceByClaims?.label ??
        'The current metrics do not show a single urgent operator action.',
    })
  }

  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
  } as const

  return recommendations
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 6)
}

async function readAllRows<T extends Record<string, unknown>>(table: string) {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return {
      rows: [] as T[],
      available: false,
    } satisfies ReadRowsResult<T>
  }

  const rows: T[] = []

  for (let offset = 0; ; offset += AGGREGATION_BATCH_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .range(offset, offset + AGGREGATION_BATCH_SIZE - 1)

    if (error) {
      return {
        rows: [] as T[],
        available: false,
      } satisfies ReadRowsResult<T>
    }

    const batchRows = (data ?? []) as T[]
    rows.push(...batchRows)

    if (batchRows.length < AGGREGATION_BATCH_SIZE) {
      break
    }
  }

  return {
    rows,
    available: true,
  } satisfies ReadRowsResult<T>
}

export async function getAdminMetrics(): Promise<AdminMetricsResponse> {
  const supabaseAdmin = getSupabaseAdminClient()

  if (!supabaseAdmin) {
    return buildMetricsResponse({
      placeholder: true,
      error: {
        code: 'misconfigured',
        message:
          'Admin metrics service is not configured. Set Supabase admin env vars before requesting live metrics.',
      },
    })
  }

  const [claimResult, eventResult, betaUserResult] = await Promise.all([
    readAllRows<ClaimLogRow>(CLAIM_LOGS_TABLE),
    readAllRows<EventRow>(EVENTS_TABLE),
    readAllRows<BetaUserRow>(BETA_USERS_TABLE),
  ])

  if (!claimResult.available) {
    return buildMetricsResponse({
      error: {
        code: 'unavailable',
        message: 'Unable to read claim log aggregates from Supabase.',
      },
    })
  }

  const claimRows = claimResult.rows
  const normalizedClaims = sortByCreatedAtDesc(claimRows.map((row) => normalizeClaimRecord(row)))
  const betaUsers = betaUserResult.rows.map((row) => normalizeBetaUserRecord(row))
  const verdictCounts = new Map<string, number>()
  const riskLabelCounts = new Map<string, number>()
  const startOfToday = getLocalStartOfToday()
  let claimsToday = 0
  let eventsToday = 0

  for (const claim of normalizedClaims) {
    verdictCounts.set(claim.verdict, (verdictCounts.get(claim.verdict) ?? 0) + 1)
    riskLabelCounts.set(claim.riskLabel, (riskLabelCounts.get(claim.riskLabel) ?? 0) + 1)

    if (claim.createdAt && Date.parse(claim.createdAt) >= startOfToday) {
      claimsToday += 1
    }
  }

  for (const row of eventResult.rows) {
    const createdAt = readDateString(row.created_at)

    if (createdAt && Date.parse(createdAt) >= startOfToday) {
      eventsToday += 1
    }
  }

  const sessionContext = buildSessionContext(
    claimRows,
    normalizedClaims,
    eventResult.rows,
    betaUsers
  )
  const trafficRows = groupByTrafficSource(
    claimRows,
    normalizedClaims,
    eventResult.rows,
    betaUsers,
    sessionContext
  )
  const bestSourceByClaims = computeCampaignPerformance(trafficRows, 'claims')
  const bestSourceByClaimsPerSession = computeCampaignPerformance(
    trafficRows,
    'claims_per_session'
  )
  const trafficSourceIntelligence = {
    available: trafficRows.length > 0,
    note:
      eventResult.available
        ? 'Tracked events, not exact visitors. Unique visitors only count rows with logged visitor_id.'
        : 'Tracked events are not available yet. Claims and attribution rows still render.',
    rows: trafficRows,
    bestSourceByClaims,
    bestSourceByClaimsPerSession,
    bestCampaignByClaimSubmissions: bestSourceByClaims,
    attributedClaims: normalizedClaims.filter((claim) => claim.attributed).length,
    unattributedClaims: normalizedClaims.filter((claim) => !claim.attributed).length,
    topReferrers: sessionContext.topReferrers,
  } satisfies TrafficSourceIntelligence

  const pageViewSessions = new Set(
    eventResult.rows
      .filter((row) => PAGE_VIEW_EVENT_NAMES.has(readString(row.event_name) as 'page_view' | 'campaign_page_view'))
      .map((row) => readOptionalString(row.session_id))
      .filter((value): value is string => Boolean(value))
  ).size
  const appOpenSessions = new Set(
    eventResult.rows
      .filter((row) => readString(row.event_name) === 'app_open_click')
      .map((row) => readOptionalString(row.session_id))
      .filter((value): value is string => Boolean(value))
  ).size
  const funnelIntelligence = computeFunnelMetrics({
    totalClaims: normalizedClaims.length,
    pageViewSessions,
    appOpenSessions,
    emailCaptures: betaUserResult.available ? betaUsers.length : null,
    betaRowsAvailable: betaUserResult.available,
    bestSource: bestSourceByClaims,
  })
  const retentionIntelligence = computeRetentionMetrics(normalizedClaims, sessionContext)
  const categoryIntelligence = computeCategoryIntelligence(normalizedClaims)
  const operationalHealth = computeOperationalHealth(normalizedClaims, eventResult.rows)
  const emailCaptureIntelligence = computeEmailCaptureIntelligence(
    betaUsers,
    betaUserResult.available,
    sessionContext,
    normalizedClaims.length
  )
  const executiveSnapshot = computeExecutiveSnapshot({
    totalClaims: normalizedClaims.length,
    claimsToday,
    eventsToday,
    retention: retentionIntelligence,
    totalEmails: betaUserResult.available ? betaUsers.length : null,
    operationalHealth,
    attributedClaims: trafficSourceIntelligence.attributedClaims,
    unattributedClaims: trafficSourceIntelligence.unattributedClaims,
  })
  const operatorRecommendations = computeOperatorRecommendations({
    executiveSnapshot,
    trafficSourceIntelligence,
    funnelIntelligence,
    retentionIntelligence,
    categoryIntelligence,
    operationalHealth,
    emailCaptureIntelligence,
  })

  return buildMetricsResponse({
    executiveSnapshot,
    verdictBreakdown: buildBreakdown<VerdictBreakdown>(verdictCounts, (verdict, count) => ({
      verdict,
      count,
    })),
    riskLabelBreakdown: buildBreakdown<RiskLabelBreakdown>(
      riskLabelCounts,
      (riskLabel, count) => ({
        riskLabel,
        count,
      })
    ),
    trafficSourceIntelligence,
    funnelIntelligence,
    retentionIntelligence,
    categoryIntelligence,
    operationalHealth,
    emailCaptureIntelligence,
    recentClaims: normalizedClaims.slice(0, 20),
    operatorRecommendations,
    error: null,
  })
}
