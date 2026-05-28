import 'server-only'

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tavily } from '@tavily/core'
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin'
import type {
  ScamOfTheDayDraft,
  ScamOfTheDaySource,
  ScamOfTheDayStatus,
  ScamSourceCheckStatus,
} from '@/lib/admin/scamOfTheDayTypes'
import { SCAM_OF_THE_DAY_STATUSES } from '@/lib/admin/scamOfTheDayTypes'

const CLAIMS_TABLE = 'dam_claim_logs'
const EVENTS_TABLE = 'dam_events'
const RECENT_WINDOW_DAYS = 7
const MAX_CLAIMS_TO_SCAN = 250
const MAX_EVENTS_TO_SCAN = 500
const DRAFTS_DIRECTORY = path.join(process.cwd(), 'drafts', 'scam-of-the-day')

type EventRow = Record<string, unknown>

type RecentClaim = {
  createdAt: string
  claimText: string
  sessionId: string | null
  verdict: string
  riskLabel: string
}

type PatternDefinition = {
  key: string
  shortName: string
  patternDescription: string
  riskDescription: string
  warningSigns: [string, string, string, string]
  priority: number
  signals: readonly string[]
  regexSignals?: readonly RegExp[]
  preferredDomains: readonly string[]
  sourceQueries: readonly string[]
}

type ScoredClaim = {
  claim: RecentClaim
  redactedText: string
  score: number
}

type PatternCluster = {
  pattern: PatternDefinition
  claims: ScoredClaim[]
  sourceSessionCount: number
  engagementEventCount: number
}

type DraftFrontmatter = {
  slug: string
  title: string
  status: ScamOfTheDayStatus
  patternName: string
  patternKey: string
  sourceCheckStatus: ScamSourceCheckStatus
  sourceCheckMessage: string | null
  sourceCount: number
  claimCount: number
  sessionCount: number
  generatedAt: string
  updatedAt: string
  sources: ScamOfTheDaySource[]
}

type TavilySearchResult = {
  title?: string
  url?: string
  content?: string
  score?: number
}

const PATTERN_DEFINITIONS: readonly PatternDefinition[] = [
  {
    key: 'bank-kyc-link',
    shortName: 'Fake bank KYC update link',
    patternDescription:
      'Messages impersonate a bank and pressure the recipient to complete KYC or re-verify account details through a link, form, or callback.',
    riskDescription:
      'This can lead to credential theft, account takeover, card misuse, or direct financial loss through social engineering.',
    warningSigns: [
      'Urgent claims that your bank account will be blocked or frozen today.',
      'A link that asks for KYC completion, card details, login credentials, or personal data.',
      'Requests to verify identity outside the official banking app or website.',
      'Pressure to act immediately without using normal bank support channels.',
    ],
    priority: 10,
    signals: [
      'kyc',
      'bank',
      'account blocked',
      'account freeze',
      'verify now',
      'update pan',
      'update aadhaar',
      'click link',
      'suspended account',
      're-kyc',
    ],
    regexSignals: [/\bkyc\b/i, /\baccount\s+(?:blocked|frozen|suspended)\b/i, /\bverify\b.{0,24}\blink\b/i],
    preferredDomains: ['rbi.org.in', 'cybercrime.gov.in', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com'],
    sourceQueries: [
      'bank kyc scam warning official',
      'RBI warning fake KYC update message',
      'cybercrime fake bank account blocked scam',
    ],
  },
  {
    key: 'authority-impersonation-payment',
    shortName: 'Authority impersonation payment threat',
    patternDescription:
      'Fraudsters impersonate police, regulators, couriers, tax officials, or other authorities and demand immediate payment or compliance to avoid penalties.',
    riskDescription:
      'This uses fear and impersonation to force rushed payments, data sharing, or unsafe callbacks before the target verifies the claim.',
    warningSigns: [
      'Messages claim legal action, account suspension, or arrest unless you act immediately.',
      'The sender pretends to be police, RBI, a regulator, customs, or another authority.',
      'Payment is requested through an unofficial number, link, QR code, or personal account.',
      'The message discourages independent verification through official contact channels.',
    ],
    priority: 9,
    signals: [
      'police',
      'court notice',
      'legal notice',
      'rbi',
      'customs',
      'urgent payment',
      'penalty',
      'fine',
      'authority',
      'govt',
      'government',
    ],
    regexSignals: [/\bpolice\b/i, /\burgent\b.{0,24}\bpayment\b/i, /\b(arrest|penalty|fine|court)\b/i],
    preferredDomains: ['cybercrime.gov.in', 'mha.gov.in', 'rbi.org.in', 'reuters.com'],
    sourceQueries: [
      'authority impersonation scam official warning',
      'cybercrime police impersonation payment scam',
      'RBI impersonation fraud advisory',
    ],
  },
  {
    key: 'upi-collect-request',
    shortName: 'UPI collect request scam',
    patternDescription:
      'The message pushes the target to approve a collect request, scan a QR code, or enter UPI details while pretending the action will receive money or fix an account issue.',
    riskDescription:
      'Victims can unknowingly authorize a debit, expose payment credentials, or transfer funds to an attacker.',
    warningSigns: [
      'The sender says you must approve a request to receive a refund, cashback, or payment.',
      'A QR code or collect request is presented as a verification step instead of a payment step.',
      'The message mixes urgency with UPI, wallet, or account-fix language.',
      'The request comes from an unknown person, business, or spoofed support channel.',
    ],
    priority: 9,
    signals: [
      'upi',
      'collect request',
      'qr code',
      'refund',
      'cashback',
      'approve request',
      'pay request',
      'payment receive',
      'wallet',
    ],
    regexSignals: [/\bupi\b/i, /\bcollect\s+request\b/i, /\bqr\b.{0,18}\bcode\b/i],
    preferredDomains: ['npci.org.in', 'cybercrime.gov.in', 'rbi.org.in', 'reuters.com'],
    sourceQueries: [
      'UPI collect request scam official warning',
      'NPCI advisory QR code fraud',
      'cybercrime UPI payment scam warning',
    ],
  },
  {
    key: 'otp-account-takeover',
    shortName: 'OTP or account takeover pretext',
    patternDescription:
      'A sender invents a login, reward, refund, or verification problem and then asks for OTPs, passwords, or bank-linked credentials.',
    riskDescription:
      'Sharing OTPs, PINs, or passwords can directly enable account takeover, payment fraud, and identity abuse.',
    warningSigns: [
      'The sender asks for an OTP, PIN, password, or card security detail.',
      'The request is framed as customer support, account recovery, or a refund.',
      'The message creates panic about a blocked account or failed payment.',
      'You are told to share private credentials over chat, call, or text.',
    ],
    priority: 8,
    signals: [
      'otp',
      'one time password',
      'pin',
      'password',
      'cvv',
      'login issue',
      'account recovery',
      'refund',
      'support executive',
    ],
    regexSignals: [/\botp\b/i, /\b(one\s+time\s+password|cvv|pin)\b/i],
    preferredDomains: ['cybercrime.gov.in', 'rbi.org.in', 'consumer.ftc.gov', 'reuters.com'],
    sourceQueries: [
      'OTP sharing fraud official warning',
      'cybercrime otp scam advisory',
      'bank never ask OTP official safety page',
    ],
  },
] as const

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function readIsoDate(value: unknown) {
  const text = readOptionalString(value)

  if (!text) {
    return null
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeFrontmatterValue(value: string) {
  return JSON.stringify(value)
}

function unescapeFrontmatterValue(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function clampText(value: string, limit: number) {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function redactSensitiveText(value: string) {
  return normalizeSpaces(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\d[-.\s]?){9,13}\b/g, '[redacted phone]')
    .replace(/\b(?:otp|one time password)\b[:\s-]*\d{3,8}\b/gi, '[redacted otp]')
    .replace(/\b\d{9,18}\b/g, '[redacted number]')
    .replace(/\b[a-z0-9._-]+@[a-z]{2,}\b/gi, '[redacted upi]')
    .replace(/\bhttps?:\/\/\S+\b/gi, '[redacted link]')
    .replace(/\bwww\.\S+\b/gi, '[redacted link]')
    .replace(/\b(?:address|addr)\b[:\s-]*[^,.;]{6,}/gi, '[redacted address]')
}

function sanitizeObservationSnippet(value: string) {
  const redacted = redactSensitiveText(value)
  return clampText(redacted, 180)
}

function getClaimAgeHours(isoDate: string) {
  return Math.max(0, (Date.now() - Date.parse(isoDate)) / (60 * 60 * 1000))
}

function scoreClaimForPattern(claimText: string, pattern: PatternDefinition) {
  const normalized = claimText.toLowerCase()
  let score = pattern.priority

  for (const signal of pattern.signals) {
    if (normalized.includes(signal)) {
      score += signal.includes(' ') ? 3 : 2
    }
  }

  for (const expression of pattern.regexSignals ?? []) {
    if (expression.test(claimText)) {
      score += 4
    }
  }

  if (normalized.includes('urgent') || normalized.includes('immediately')) {
    score += 1
  }

  if (normalized.includes('bank') || normalized.includes('payment')) {
    score += 1
  }

  return score
}

function pickBestPattern(claimText: string) {
  let winner: PatternDefinition | null = null
  let winningScore = 0

  for (const pattern of PATTERN_DEFINITIONS) {
    const score = scoreClaimForPattern(claimText, pattern)
    if (score > winningScore) {
      winner = pattern
      winningScore = score
    }
  }

  return winningScore >= 15 && winner ? { pattern: winner, score: winningScore } : null
}

function countClusterSignals(cluster: PatternCluster) {
  const signalCounts = new Map<string, number>()

  for (const row of cluster.claims) {
    const normalized = row.redactedText.toLowerCase()
    for (const signal of cluster.pattern.signals) {
      if (normalized.includes(signal)) {
        signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1)
      }
    }
  }

  return Array.from(signalCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([signal]) => signal)
}

function buildDamObservation(cluster: PatternCluster) {
  const examples = Array.from(
    new Set(cluster.claims.map((row) => sanitizeObservationSnippet(row.redactedText)))
  )
    .slice(0, 2)
    .map((value) => `"${value}"`)
  const commonSignals = countClusterSignals(cluster)

  const summaryParts = [
    `In the last ${RECENT_WINDOW_DAYS} days, DAM logged ${cluster.claims.length} recent claims across ${cluster.sourceSessionCount} sessions that matched this scam pattern.`,
  ]

  if (cluster.engagementEventCount > 0) {
    summaryParts.push(
      `Related sessions also produced ${cluster.engagementEventCount} tracked events, which suggests repeated user interaction around the same pattern.`
    )
  }

  if (commonSignals.length > 0) {
    summaryParts.push(`Common non-sensitive cues included ${commonSignals.join(', ')}.`)
  }

  if (examples.length > 0) {
    summaryParts.push(`Redacted examples included ${examples.join(' and ')}.`)
  }

  summaryParts.push(
    'These repeated submissions indicate a user-reported pattern only; they do not confirm the underlying claim as true on their own.'
  )

  return summaryParts.join(' ')
}

function dedupeSources(sources: ScamOfTheDaySource[]) {
  return Array.from(new Map(sources.map((source) => [source.url, source])).values()).slice(0, 3)
}

function buildSourceCheck(sources: ScamOfTheDaySource[]) {
  if (sources.length >= 2) {
    return {
      status: 'complete' as const,
      message: null,
      lines: sources.map((source) => `- ${source.name} — ${source.support}`),
    }
  }

  return {
    status: 'incomplete' as const,
    message: 'Source check incomplete — do not publish yet.',
    lines: ['- Source check incomplete — do not publish yet.'],
  }
}

function buildDraftBody(input: {
  title: string
  cluster: PatternCluster
  sources: ScamOfTheDaySource[]
}) {
  const sourceCheck = buildSourceCheck(input.sources)

  return [
    'Title:',
    input.title,
    '',
    'Status:',
    'Draft only — requires human approval before publish.',
    '',
    'Scam pattern:',
    input.cluster.pattern.patternDescription,
    '',
    'Why this is risky:',
    input.cluster.pattern.riskDescription,
    '',
    'Common warning signs:',
    ...input.cluster.pattern.warningSigns.map((warning) => `- ${warning}`),
    '',
    'What DAM observed:',
    buildDamObservation(input.cluster),
    '',
    'Reputable source check:',
    ...sourceCheck.lines,
    '',
    'What users should do:',
    '- Do not click unknown links.',
    '- Do not share OTPs, PINs, passwords, or bank details.',
    '- Verify through the official app, website, or phone number.',
    '- Report/block suspicious senders.',
    '- Use DAM before forwarding or acting.',
    '',
    'DAM CTA:',
    'Before you click, forward, trust, or act — test the message on DAM.',
    '',
    'Approval checklist:',
    '- [ ] Claim pattern is based on logged user behavior',
    '- [ ] Sensitive user data is removed',
    '- [ ] At least two reputable sources checked',
    '- [ ] No exaggerated certainty',
    '- [ ] No legal/financial advice beyond safe user guidance',
    '- [ ] Human approved for publishing',
    '',
    'Publication status:',
    'Not approved.',
  ].join('\n')
}

function serializeDraft(frontmatter: DraftFrontmatter, body: string) {
  return [
    '---',
    `slug: ${escapeFrontmatterValue(frontmatter.slug)}`,
    `title: ${escapeFrontmatterValue(frontmatter.title)}`,
    `status: ${escapeFrontmatterValue(frontmatter.status)}`,
    `patternName: ${escapeFrontmatterValue(frontmatter.patternName)}`,
    `patternKey: ${escapeFrontmatterValue(frontmatter.patternKey)}`,
    `sourceCheckStatus: ${escapeFrontmatterValue(frontmatter.sourceCheckStatus)}`,
    `sourceCheckMessage: ${escapeFrontmatterValue(frontmatter.sourceCheckMessage ?? '')}`,
    `sourceCount: ${frontmatter.sourceCount}`,
    `claimCount: ${frontmatter.claimCount}`,
    `sessionCount: ${frontmatter.sessionCount}`,
    `generatedAt: ${escapeFrontmatterValue(frontmatter.generatedAt)}`,
    `updatedAt: ${escapeFrontmatterValue(frontmatter.updatedAt)}`,
    `sourcesJson: ${escapeFrontmatterValue(JSON.stringify(frontmatter.sources))}`,
    '---',
    '',
    body,
    '',
  ].join('\n')
}

function parseDraftFile(fileContents: string, storagePath: string): ScamOfTheDayDraft | null {
  const match = fileContents.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return null
  }

  const [, rawFrontmatter, body] = match
  const values = new Map<string, string>()

  for (const line of rawFrontmatter.split('\n')) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    values.set(key, value)
  }

  const status = unescapeFrontmatterValue(values.get('status') ?? '')
  if (!SCAM_OF_THE_DAY_STATUSES.includes(status as ScamOfTheDayStatus)) {
    return null
  }

  const rawSources = unescapeFrontmatterValue(values.get('sourcesJson') ?? '[]')
  let parsedSources: unknown[] = []
  if (typeof rawSources === 'string') {
    try {
      const parsed = JSON.parse(rawSources) as unknown
      parsedSources = Array.isArray(parsed) ? parsed : []
    } catch {
      parsedSources = []
    }
  }
  const sources = Array.isArray(parsedSources) ? parsedSources.filter(isScamOfTheDaySource) : []

  return {
    slug: String(unescapeFrontmatterValue(values.get('slug') ?? '')),
    title: String(unescapeFrontmatterValue(values.get('title') ?? '')),
    status: status as ScamOfTheDayStatus,
    body: body.trim(),
    patternName: String(unescapeFrontmatterValue(values.get('patternName') ?? '')),
    patternKey: String(unescapeFrontmatterValue(values.get('patternKey') ?? '')),
    sourceCheckStatus:
      String(unescapeFrontmatterValue(values.get('sourceCheckStatus') ?? 'incomplete')) === 'complete'
        ? 'complete'
        : 'incomplete',
    sourceCheckMessage: String(unescapeFrontmatterValue(values.get('sourceCheckMessage') ?? '') || '') || null,
    sourceCount: Number(values.get('sourceCount') ?? '0') || 0,
    claimCount: Number(values.get('claimCount') ?? '0') || 0,
    sessionCount: Number(values.get('sessionCount') ?? '0') || 0,
    generatedAt: String(unescapeFrontmatterValue(values.get('generatedAt') ?? '')),
    updatedAt: String(unescapeFrontmatterValue(values.get('updatedAt') ?? '')),
    storagePath,
    sources,
  }
}

function isScamOfTheDaySource(value: unknown): value is ScamOfTheDaySource {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ScamOfTheDaySource>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.support === 'string'
  )
}

async function ensureDraftDirectory() {
  await mkdir(DRAFTS_DIRECTORY, { recursive: true })
}

async function readDraftFromPath(storagePath: string) {
  const fileContents = await readFile(storagePath, 'utf8')
  return parseDraftFile(fileContents, storagePath)
}

async function getRecentClaims() {
  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured for draft generation.')
  }

  const sinceIso = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from(CLAIMS_TABLE)
    .select('created_at, claim_text, session_id, verdict, risk_label')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(MAX_CLAIMS_TO_SCAN)

  if (error) {
    throw new Error('Unable to read recent DAM claims from Supabase.')
  }

  return (data ?? [])
    .map((row) => {
      const createdAt = readIsoDate(row.created_at)
      const claimText = normalizeSpaces(readString(row.claim_text))
      if (!createdAt || !claimText) {
        return null
      }

      return {
        createdAt,
        claimText,
        sessionId: readOptionalString(row.session_id),
        verdict: readString(row.verdict) || 'unknown',
        riskLabel: readString(row.risk_label) || 'unknown',
      } satisfies RecentClaim
    })
    .filter((row): row is RecentClaim => Boolean(row))
}

async function getRecentEventsForSessions(sessionIds: string[]) {
  if (!sessionIds.length) {
    return [] as EventRow[]
  }

  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    return [] as EventRow[]
  }

  const sinceIso = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .select('session_id, event_name, created_at')
    .in('session_id', sessionIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(MAX_EVENTS_TO_SCAN)

  if (error) {
    return [] as EventRow[]
  }

  return (data ?? []) as EventRow[]
}

function clusterClaims(claims: RecentClaim[], events: EventRow[]) {
  const clusters = new Map<string, PatternCluster>()

  for (const claim of claims) {
    const bestMatch = pickBestPattern(claim.claimText)
    if (!bestMatch) {
      continue
    }

    const redactedText = redactSensitiveText(claim.claimText)
    const existing =
      clusters.get(bestMatch.pattern.key) ??
      ({
        pattern: bestMatch.pattern,
        claims: [],
        sourceSessionCount: 0,
        engagementEventCount: 0,
      } satisfies PatternCluster)

    existing.claims.push({
      claim,
      redactedText,
      score: bestMatch.score,
    })

    clusters.set(bestMatch.pattern.key, existing)
  }

  const eventCounts = new Map<string, number>()
  for (const event of events) {
    const sessionId = readOptionalString(event.session_id)
    if (!sessionId) {
      continue
    }

    eventCounts.set(sessionId, (eventCounts.get(sessionId) ?? 0) + 1)
  }

  for (const cluster of clusters.values()) {
    const sessionIds = new Set(
      cluster.claims.map((row) => row.claim.sessionId).filter((value): value is string => Boolean(value))
    )
    cluster.sourceSessionCount = sessionIds.size
    cluster.engagementEventCount = Array.from(sessionIds).reduce(
      (total, sessionId) => total + (eventCounts.get(sessionId) ?? 0),
      0
    )
    cluster.claims.sort((left, right) => right.score - left.score)
  }

  return Array.from(clusters.values())
}

function chooseTopCluster(clusters: PatternCluster[]) {
  return [...clusters].sort((left, right) => {
    const leftFreshness = Math.min(...left.claims.map((row) => getClaimAgeHours(row.claim.createdAt)))
    const rightFreshness = Math.min(...right.claims.map((row) => getClaimAgeHours(row.claim.createdAt)))
    const leftScore = left.claims.length * 20 + left.sourceSessionCount * 8 + left.pattern.priority * 5 - leftFreshness
    const rightScore =
      right.claims.length * 20 + right.sourceSessionCount * 8 + right.pattern.priority * 5 - rightFreshness

    return rightScore - leftScore
  })[0] ?? null
}

async function lookupReputableSources(pattern: PatternDefinition) {
  if (!process.env.TAVILY_API_KEY) {
    return [] as ScamOfTheDaySource[]
  }

  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const responses = await Promise.all(
    pattern.sourceQueries.slice(0, 3).map(async (query) => {
      const response = await client.search(query, {
        searchDepth: 'advanced',
        topic: 'general',
        maxResults: 3,
        includeRawContent: false,
        includeAnswer: false,
        autoParameters: false,
        timeout: 8,
        includeDomains: [...pattern.preferredDomains],
      })

      return response.results as TavilySearchResult[]
    })
  ).catch(() => [] as TavilySearchResult[][])

  return dedupeSources(
    responses
      .flat()
      .filter((result) => typeof result.url === 'string' && typeof result.title === 'string')
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .map((result) => ({
        name: clampText(result.title ?? 'Untitled source', 90),
        url: result.url ?? '',
        support: clampText(normalizeSpaces(result.content ?? 'Supports the reported scam context.'), 140),
      }))
      .filter((source) => source.url.length > 0)
  )
}

async function writeDraftFile(draft: ScamOfTheDayDraft) {
  await ensureDraftDirectory()

  const frontmatter: DraftFrontmatter = {
    slug: draft.slug,
    title: draft.title,
    status: draft.status,
    patternName: draft.patternName,
    patternKey: draft.patternKey,
    sourceCheckStatus: draft.sourceCheckStatus,
    sourceCheckMessage: draft.sourceCheckMessage,
    sourceCount: draft.sourceCount,
    claimCount: draft.claimCount,
    sessionCount: draft.sessionCount,
    generatedAt: draft.generatedAt,
    updatedAt: draft.updatedAt,
    sources: draft.sources,
  }

  await writeFile(draft.storagePath, serializeDraft(frontmatter, draft.body), 'utf8')
}

export async function generateScamOfTheDayDraft() {
  const recentClaims = await getRecentClaims()
  const candidateSessionIds = Array.from(
    new Set(recentClaims.map((claim) => claim.sessionId).filter((value): value is string => Boolean(value)))
  )
  const recentEvents = await getRecentEventsForSessions(candidateSessionIds)
  const clusters = clusterClaims(recentClaims, recentEvents)
  const topCluster = chooseTopCluster(clusters)

  if (!topCluster) {
    throw new Error('No strong recent scam pattern was found in DAM claim logs.')
  }

  const sources = await lookupReputableSources(topCluster.pattern)
  const sourceCheck = buildSourceCheck(sources)
  const generatedAt = new Date().toISOString()
  const slug = `${generatedAt.slice(0, 10)}-${slugify(topCluster.pattern.key)}`
  const title = `Scam of the Day: ${topCluster.pattern.shortName}`
  const body = buildDraftBody({
    title,
    cluster: topCluster,
    sources,
  })

  const draft: ScamOfTheDayDraft = {
    slug,
    title,
    status: 'draft',
    body,
    patternName: topCluster.pattern.shortName,
    patternKey: topCluster.pattern.key,
    sourceCheckStatus: sourceCheck.status,
    sourceCheckMessage: sourceCheck.message,
    sourceCount: sources.length,
    claimCount: topCluster.claims.length,
    sessionCount: topCluster.sourceSessionCount,
    generatedAt,
    updatedAt: generatedAt,
    storagePath: path.join(DRAFTS_DIRECTORY, `${slug}.md`),
    sources,
  }

  await writeDraftFile(draft)
  return draft
}

export async function getLatestScamOfTheDayDraft() {
  await ensureDraftDirectory()
  const entries = await readdir(DRAFTS_DIRECTORY)
  const markdownFiles = entries.filter((entry) => entry.endsWith('.md'))

  if (!markdownFiles.length) {
    return null
  }

  const fileStats = await Promise.all(
    markdownFiles.map(async (entry) => {
      const storagePath = path.join(DRAFTS_DIRECTORY, entry)
      const details = await stat(storagePath)
      return {
        storagePath,
        modifiedAt: details.mtimeMs,
      }
    })
  )

  fileStats.sort((left, right) => right.modifiedAt - left.modifiedAt)

  for (const file of fileStats) {
    const draft = await readDraftFromPath(file.storagePath)
    if (draft) {
      return draft
    }
  }

  return null
}

export async function updateScamOfTheDayDraftStatus(input: {
  slug: string
  status: ScamOfTheDayStatus
}) {
  const targetPath = path.join(DRAFTS_DIRECTORY, `${input.slug}.md`)
  const draft = await readDraftFromPath(targetPath).catch(() => null)

  if (!draft) {
    throw new Error('Draft not found.')
  }

  const updatedDraft: ScamOfTheDayDraft = {
    ...draft,
    status: input.status,
    updatedAt: new Date().toISOString(),
  }

  await writeDraftFile(updatedDraft)
  return updatedDraft
}
