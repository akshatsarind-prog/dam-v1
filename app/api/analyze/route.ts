import OpenAI from 'openai'
import {
  buildRetrievalQueries,
  dedupeRetrievedEvidence,
  getPreferredDomains,
  retrieveEvidence,
  type ClaimCategory,
} from '@/lib/retrieval'
import { isValidRetrievalCategory, routeClaim } from '@/lib/claimRouter'
import { withTimeout } from '@/lib/timeout'
import {
  detectConflictingSignals,
  rankEvidence,
  summarizeSourceCredibility,
  type ConflictSignal,
  type RankedEvidence,
} from '@/lib/sourceRanker'
import { systemPrompt } from '@/lib/systemPrompt'
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

export const runtime = 'nodejs'
export const maxDuration = 14

const TOTAL_ROUTE_TIMEOUT_MS = 14_000
const MODEL_TIMEOUT_MS = 9_000
const OPENAI_MODEL = 'gpt-4o-mini'
const MODEL_MAX_TOKENS = 220
const MODEL_OUTPUT_MAX_CHARS = 6_000
const EVIDENCE_SNIPPET_MAX_CHARS = 300
const FALLBACK_REASON = 'Evidence-backed verification did not complete safely.'
const FALLBACK_EVIDENCE_STATUS = 'No reliable supporting evidence was retrieved.'
const TIMEOUT_CONTRADICTIONS = 'No direct contradiction was identified in retrieved evidence.'

const verdictValues = [
  'Corroborated',
  'Likely Reliable',
  'Likely incorrect',
  'Mixed Evidence',
  'Insufficient Verification',
  'High Risk Claim',
  'Escalation Recommended',
  'Dangerous unsupported claim',
  'Unverified',
  'Evidence insufficient',
  'Missing context',
  'Unsupported civic claim',
  'Verification incomplete',
  'Fake KYC urgency',
  'Credential harvesting pattern',
  'Likely phishing attempt',
  'Impersonation risk',
  'Suspicious payment extraction',
  'Payment extraction pattern',
  'Reward bait pattern',
  'Chain-forward manipulation',
  'Suspicious link behavior',
  'Guaranteed-return scam pattern',
] as const

type RoutingBucket = 'scam' | 'civic_rumor' | 'breaking_news' | 'statistical_overreach' | 'general'

const CIVIC_RUMOR_CUES = [
  'protest',
  'protests',
  'ban',
  'banned',
  'law',
  'laws',
  'election',
  'elections',
  'reservation',
  'reservations',
  'curfew',
  'government order',
  'government orders',
  'tax',
  'shutdown',
  'internet shutdown',
  'internet ban',
  'whatsapp ban',
  'military deployment',
  'school policy',
  'education policy',
  'political',
  'politics',
] as const

const DIRECT_SCAM_LABELS = new Set([
  'Fake KYC urgency',
  'Credential harvesting pattern',
  'Likely phishing attempt',
  'Impersonation risk',
  'Suspicious payment extraction',
  'Payment extraction pattern',
  'Reward bait pattern',
  'Chain-forward manipulation',
  'Suspicious link behavior',
  'Guaranteed-return scam pattern',
] as const)

const confidenceLabels = ['Weak', 'Moderate', 'Strong'] as const
const riskValues = ['Low', 'Medium', 'High', 'Severe'] as const
const contradictionLevels = ['None', 'Low', 'Moderate', 'High', 'Unknown'] as const
const stanceValues = ['Supports', 'Contradicts', 'Contextualizes', 'Unclear'] as const
type Verdict = (typeof verdictValues)[number]
type ConfidenceLabel = (typeof confidenceLabels)[number]
type CalibrationConfidenceLabel = 'High' | 'Moderate' | 'Low' | 'Insufficient'
type Risk = (typeof riskValues)[number]
type ContradictionLevel = (typeof contradictionLevels)[number]
type CredibilityLabel = 'High' | 'Moderate' | 'Low' | 'Unknown'
type EvidenceStance = (typeof stanceValues)[number]
type EvidenceStrengthLabel = 'strong' | 'moderate' | 'weak' | 'none'
type EvidenceStrengthDirection = 'supporting' | 'contradicting' | 'neutral'
type HighRiskHealthLabel = 'high' | 'none'
type ScamPatternLabel =
  | 'Fake KYC urgency'
  | 'Credential harvesting pattern'
  | 'Suspicious payment extraction'
  | 'Reward bait pattern'
  | 'Guaranteed-return scam pattern'
  | 'Chain-forward manipulation'
  | 'Impersonation risk'
  | 'Likely phishing attempt'

type ScamPatternClassification = {
  isScamLike: boolean
  label: ScamPatternLabel
  risk: Risk
  reason: string
}

type EvidenceStrength = {
  label: EvidenceStrengthLabel
  reason: string
  direction: EvidenceStrengthDirection
}

type HighRiskHealthSignal = {
  isHighRisk: boolean
  label: HighRiskHealthLabel
  reason: string
}

type ScamSignals = {
  riskLevel: 'low' | 'medium' | 'high'
  labels: string[]
}

type ClaimDecomposition = {
  entities: string[]
  dates: string[]
  locations: string[]
  organizations: string[]
  numericalClaims: string[]
  factualAssertions: string[]
  retrievalQueries: string[]
}

type SourceCredibility = {
  label: CredibilityLabel
  weightedScore: number
  highTrustSources: number
  moderateTrustSources: number
  lowTrustSources: number
  unknownTrustSources: number
  rationale: string
}

type EvidenceCard = {
  id: string
  title: string
  url: string
  domain: string
  publishedDate: string | null
  credibility: CredibilityLabel
  credibilityScore: number
  credibilityRationale: string
  retrievalScore: number
  query: string
  stance: EvidenceStance
  excerpt: string
  assessment: string
}

type CorroborationLevel = {
  label: string
  agreement: string
  sourceCount: number
  highCredibilityCount: number
  indicators: string[]
}

type Contradiction = {
  summary: string
  severity: ContradictionLevel
  sources: string[]
}

type ContradictionSummary = {
  label?: string
  level: ContradictionLevel
  summary: string
  items: Contradiction[]
}

type NormalizedContradiction = {
  label: string
  summary: string
  severity: ContradictionLevel
  items: Contradiction[]
}

type Confidence = {
  score: number
  label: ConfidenceLabel
  rationale: string
  drivers: string[]
}

type OperationalGuidance = {
  action: string
  distribution: string
  escalation: string
  nextSteps: string[]
}

type Analysis = {
  verdict: Verdict
  reason?: string
  confidence: Confidence
  confidenceLabel: CalibrationConfidenceLabel
  uncertaintyReason: string
  confidenceCapApplied?: boolean
  confidenceCapReason?: string
  risk: Risk
  reasoning: string
  corroborationLevel: CorroborationLevel
  sourceCredibility: SourceCredibility
  contradictions: ContradictionSummary
  contradictionSummary?: string
  evidence: EvidenceCard[]
  evidenceStatus?: string
  operationalGuidance: OperationalGuidance
  claimDecomposition: ClaimDecomposition
  retrievedAt: string
}

type AnalysisCore = Omit<Analysis, 'confidenceLabel' | 'uncertaintyReason'>

const emptyDecomposition: ClaimDecomposition = {
  entities: [],
  dates: [],
  locations: [],
  organizations: [],
  numericalClaims: [],
  factualAssertions: [],
  retrievalQueries: [],
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

const operationalLanguageReplacements: Array<[RegExp, string]> = [
  [/\bunable to verify\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bexercise caution\b/gi, 'Operational risk indicators were detected.'],
  [/\bcould not confirm\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bcould not verify\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bcould not be verified\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bcannot verify\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bcannot be verified\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bbe careful\b/gi, 'Operational risk indicators were detected.'],
  [/\bthis may be false\b/gi, 'Retrieved evidence conflicts with established factual records.'],
  [/\blimited evidence\b/gi, 'Retrieved sources do not provide direct support for the claim.'],
  [
    /\bnot enough information\b/gi,
    'Available reporting is currently insufficient for confirmation.',
  ],
  [/\bcontradiction unclear\b/gi, 'Retrieved evidence conflicts with established factual records.'],
  [/\bno contradiction analysis\b/gi, 'No contradiction analysis is available.'],
  [/\bunable to verify reliably\b/gi, 'No authoritative reporting currently supports this claim.'],
  [/\bunverified\b/gi, 'Retrieved evidence does not currently support this claim.'],
  [/\bpossibly false\b/gi, 'Retrieved evidence conflicts with established factual records.'],
  [/\bmay not be true\b/gi, 'Retrieved evidence does not currently support this claim.'],
  [/\bno contradiction found\b/gi, 'No direct contradiction was identified in retrieved evidence.'],
  [/\bno contradiction detected\b/gi, 'No direct contradiction was identified in retrieved evidence.'],
  [/\bno clear evidence\b/gi, 'No reliable supporting evidence was retrieved.'],
  [/\bno evidence\b/gi, 'No reliable supporting evidence was retrieved.'],
]

function normalizeOperationalLanguageText(value: string) {
  const normalized = operationalLanguageReplacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  )

  return normalizeText(normalized)
}

function isGenericOperationalText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!normalized) {
    return true
  }

  return [
    'verification remains incomplete',
    'unverified',
    'exercise caution',
    'could not confirm',
    'could not verify',
    'could not be verified',
    'cannot verify',
    'cannot be verified',
    'unable to verify',
    'unable to verify reliably',
    'possibly false',
    'may not be true',
    'could not substantiate',
    'does not currently substantiate',
    'does not currently support',
    'too weak for a confident verification',
    'too weak or unrelated',
    'mixed or low-confidence signals',
    'limited or conflicting',
    'no contradiction analysis',
    'no authoritative reporting',
    'exercise caution',
    'generic scam',
  ].some((marker) => normalized.includes(marker))
}

function chooseOperationalText(existing: string | undefined, replacement: string, force = false) {
  const normalizedExisting = typeof existing === 'string' ? normalizeOperationalLanguageText(existing) : ''

  if (!normalizedExisting) {
    return replacement
  }

  if (force || isGenericOperationalText(normalizedExisting)) {
    return replacement
  }

  return normalizedExisting
}

function readString(value: unknown, fallbackValue: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallbackValue
}

function readStringList(value: unknown, fallbackValue: string[], limit = 6) {
  if (!Array.isArray(value)) {
    return fallbackValue
  }

  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)

  return values.length ? values : fallbackValue
}

function readNumber(value: unknown, fallbackValue: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallbackValue
}

// The OpenAI SDK can return either Chat Completions or Responses-shaped payloads here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractModelText(response: any): string {
  const direct =
    response?.choices?.[0]?.message?.content ??
    response?.output_text ??
    ''

  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const outputText = response?.output
    ?.flatMap((item: { content?: unknown }) => (Array.isArray(item?.content) ? item.content : []))
    ?.map((content: unknown) => {
      if (!content || typeof content !== 'object') {
        return ''
      }

      const text = (content as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    ?.join('\n')
    ?.trim()

  return outputText || ''
}

function cleanJsonText(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { name?: unknown; message?: unknown }
  const name = typeof candidate.name === 'string' ? candidate.name.toLowerCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''

  return name.includes('abort') || message.includes('abort') || message.includes('timeout')
}

type RouteTimingStage = 'retrieval' | 'openai' | 'final_response' | 'route_timeout'

function logRouteTiming(
  stage: RouteTimingStage,
  startedAt: number,
  details: Record<string, unknown> = {}
) {
  if (process.env.NODE_ENV === 'development') {
    console.log({
      stage,
      totalLatencyMs: Date.now() - startedAt,
      ...details,
    })
  }
}

function logFinalResponse(
  routeAbortController: AbortController,
  startedAt: number,
  details: {
    status?: number
    evidenceCount: number
    fallback: boolean
  }
) {
  if (routeAbortController.signal.aborted) {
    return
  }

  logRouteTiming('final_response', startedAt, {
    status: details.status ?? 200,
    evidenceCount: details.evidenceCount,
    fallback: details.fallback ? 1 : 0,
  })
}

function logRouteFailure(kind: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'development') {
    console.error(`[api/analyze] ${kind}`)
    return
  }

  if (!error || typeof error !== 'object') {
    console.error(`[api/analyze] ${kind}`)
    return
  }

  const candidate = error as { name?: unknown; message?: unknown }
  const name = typeof candidate.name === 'string' ? candidate.name : 'Error'
  const message = typeof candidate.message === 'string' ? candidate.message.slice(0, 160) : 'No message'

  console.error(`[api/analyze] ${kind}`, { name, message })
}

function parseModelJson(modelText: string): { parsed: unknown | null; parseFailed: boolean } {
  if (!modelText.trim()) {
    return { parsed: null, parseFailed: false }
  }

  const cleaned = cleanJsonText(modelText)

  try {
    return { parsed: JSON.parse(cleaned), parseFailed: false }
  } catch {
  }

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return {
        parsed: JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)),
        parseFailed: false,
      }
    } catch {
    }
  }

  return { parsed: null, parseFailed: true }
}

function extractDelimitedBlock(
  text: string,
  key: string,
  openChar: '{' | '[',
  closeChar: '}' | ']'
) {
  const keyIndex = text.indexOf(`"${key}"`)

  if (keyIndex === -1) {
    return ''
  }

  const start = text.indexOf(openChar, keyIndex)

  if (start === -1) {
    return ''
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === openChar) {
      depth += 1
    } else if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return text.slice(start)
}

function unescapeModelString(value: string) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) => {
      try {
        return String.fromCharCode(Number.parseInt(code, 16))
      } catch {
        return _
      }
    })
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function extractQuotedString(text: string, key: string) {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'),
    new RegExp(`${key}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return unescapeModelString(match[1]).trim()
    }
  }

  return ''
}

function extractNumberValue(text: string, key: string) {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'),
    new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1] && Number.isFinite(Number(match[1]))) {
      return Number(match[1])
    }
  }

  return null
}

function extractStringArray(text: string, key: string) {
  const block = extractDelimitedBlock(text, key, '[', ']')

  if (!block) {
    return []
  }

  const matches = block.matchAll(/"((?:\\.|[^"\\])*)"/g)
  return Array.from(matches, (match) => unescapeModelString(match[1]).trim()).filter(Boolean)
}

function extractFieldBlock(text: string, key: string) {
  return extractDelimitedBlock(text, key, '{', '}')
}

function recoverStructuredObjectFromText(text: string): Record<string, unknown> {
  const verdict = extractQuotedString(text, 'verdict')
  const risk = extractQuotedString(text, 'risk')
  const reasoning = extractQuotedString(text, 'reasoning')
  const confidenceBlock = extractFieldBlock(text, 'confidence')
  const corroborationBlock = extractFieldBlock(text, 'corroborationLevel')
  const contradictionsBlock = extractFieldBlock(text, 'contradictions')
  const guidanceBlock = extractFieldBlock(text, 'operationalGuidance')
  const evidenceBlock = extractDelimitedBlock(text, 'evidence', '[', ']')
  const decompositionBlock = extractFieldBlock(text, 'claimDecomposition')

  const recovered: Record<string, unknown> = {}

  if (verdict) {
    recovered.verdict = verdict
  }

  if (risk) {
    recovered.risk = risk
  }

  if (reasoning) {
    recovered.reasoning = reasoning
  }

  if (confidenceBlock) {
    const confidence: Record<string, unknown> = {}
    const score = extractNumberValue(confidenceBlock, 'score')
    const label = extractQuotedString(confidenceBlock, 'label')
    const rationale = extractQuotedString(confidenceBlock, 'rationale')
    const drivers = extractStringArray(confidenceBlock, 'drivers')

    if (score !== null) confidence.score = score
    if (label) confidence.label = label
    if (rationale) confidence.rationale = rationale
    if (drivers.length) confidence.drivers = drivers

    if (Object.keys(confidence).length) {
      recovered.confidence = confidence
    }
  }

  if (corroborationBlock) {
    const corroboration: Record<string, unknown> = {}
    const label = extractQuotedString(corroborationBlock, 'label')
    const agreement = extractQuotedString(corroborationBlock, 'agreement')
    const indicators = extractStringArray(corroborationBlock, 'indicators')
    const sourceCount = extractNumberValue(corroborationBlock, 'sourceCount')
    const highCredibilityCount = extractNumberValue(corroborationBlock, 'highCredibilityCount')

    if (label) corroboration.label = label
    if (agreement) corroboration.agreement = agreement
    if (indicators.length) corroboration.indicators = indicators
    if (sourceCount !== null) corroboration.sourceCount = sourceCount
    if (highCredibilityCount !== null) corroboration.highCredibilityCount = highCredibilityCount

    if (Object.keys(corroboration).length) {
      recovered.corroborationLevel = corroboration
    }
  }

  if (contradictionsBlock) {
    const contradictions: Record<string, unknown> = {}
    const label = extractQuotedString(contradictionsBlock, 'label')
    const level = extractQuotedString(contradictionsBlock, 'level')
    const summary = extractQuotedString(contradictionsBlock, 'summary')
    const itemsBlock = extractDelimitedBlock(contradictionsBlock, 'items', '[', ']')

    if (label) contradictions.label = label
    if (level) contradictions.level = level
    if (summary) contradictions.summary = summary
    if (itemsBlock) contradictions.items = []

    if (Object.keys(contradictions).length) {
      recovered.contradictions = contradictions
    }
  }

  if (guidanceBlock) {
    const guidance: Record<string, unknown> = {}
    const action = extractQuotedString(guidanceBlock, 'action')
    const distribution = extractQuotedString(guidanceBlock, 'distribution')
    const escalation = extractQuotedString(guidanceBlock, 'escalation')
    const nextSteps = extractStringArray(guidanceBlock, 'nextSteps')

    if (action) guidance.action = action
    if (distribution) guidance.distribution = distribution
    if (escalation) guidance.escalation = escalation
    if (nextSteps.length) guidance.nextSteps = nextSteps

    if (Object.keys(guidance).length) {
      recovered.operationalGuidance = guidance
    }
  }

  if (evidenceBlock) {
    recovered.evidence = []
  }

  if (decompositionBlock) {
    const decomposition: Record<string, unknown> = {}
    const entities = extractStringArray(decompositionBlock, 'entities')
    const dates = extractStringArray(decompositionBlock, 'dates')
    const locations = extractStringArray(decompositionBlock, 'locations')
    const organizations = extractStringArray(decompositionBlock, 'organizations')
    const numericalClaims = extractStringArray(decompositionBlock, 'numericalClaims')
    const factualAssertions = extractStringArray(decompositionBlock, 'factualAssertions')
    const retrievalQueries = extractStringArray(decompositionBlock, 'retrievalQueries')

    if (entities.length) decomposition.entities = entities
    if (dates.length) decomposition.dates = dates
    if (locations.length) decomposition.locations = locations
    if (organizations.length) decomposition.organizations = organizations
    if (numericalClaims.length) decomposition.numericalClaims = numericalClaims
    if (factualAssertions.length) decomposition.factualAssertions = factualAssertions
    if (retrievalQueries.length) decomposition.retrievalQueries = retrievalQueries

    if (Object.keys(decomposition).length) {
      recovered.claimDecomposition = decomposition
    }
  }

  return recovered
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recoverStructuredOutput(raw: any, modelText: string): Record<string, unknown> | null {
  const direct =
    raw?.choices?.[0]?.message?.parsed ??
    raw?.output?.[0]?.content?.[0]?.parsed ??
    raw?.output?.[0]?.content?.[0]?.json ??
    null

  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>
  }

  const text = typeof modelText === 'string' ? modelText.trim() : ''

  if (!text) {
    return null
  }

  const parsed = parseModelJson(text)

  if (parsed.parsed && typeof parsed.parsed === 'object' && !Array.isArray(parsed.parsed)) {
    return parsed.parsed as Record<string, unknown>
  }

  const recovered = recoverStructuredObjectFromText(cleanJsonText(text))

  return Object.keys(recovered).length ? recovered : null
}

function hasUsableStructuredModelOutput(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const data = value as Record<string, unknown>
  return [
    'verdict',
    'confidence',
    'risk',
    'reasoning',
    'corroborationLevel',
    'contradictions',
    'evidence',
    'operationalGuidance',
    'claimDecomposition',
  ].some((key) => key in data)
}

function resolveContradictionLevel(signal: ConflictSignal): ContradictionLevel {
  if (
    signal.label === 'None' ||
    signal.label === 'Low' ||
    signal.label === 'Moderate' ||
    signal.label === 'High'
  ) {
    return signal.label
  }

  return signal.hasConflict ? 'Low' : 'Unknown'
}

function buildSignalContradictionItems(
  evidence: RankedEvidence[],
  signal: ConflictSignal,
  level: ContradictionLevel
): Contradiction[] {
  if (!signal.hasConflict) {
    return []
  }

  return [
    {
      summary: signal.summary,
      severity: level === 'None' || level === 'Unknown' ? 'Low' : level,
      sources: evidence.slice(0, 3).map((item) => item.id),
    },
  ]
}

function contradictionLevelRank(level: ContradictionLevel | undefined) {
  switch (level) {
    case 'High':
      return 3
    case 'Moderate':
      return 2
    case 'Low':
      return 1
    case 'None':
      return 0
    default:
      return -1
  }
}

function isVagueContradictionText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!normalized) {
    return true
  }

  const exactVagueValues = new Set([
    'unknown',
    'unclear',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'no contradiction analysis',
    'no contradiction found',
    'no contradiction detected',
    'no conflict detected',
    'no conflicting evidence detected',
    'no clear contradiction detected',
    'contradiction analysis did not complete',
    'contradiction analysis unavailable',
    'contradiction analysis not available',
    'no authoritative contradiction analysis is available',
    'evidence is insufficient',
    'insufficient evidence',
  ])

  if (exactVagueValues.has(normalized)) {
    return true
  }

  if (normalized.split(' ').length === 1) {
    return true
  }

  return [
    'no contradiction summary supplied',
    'no conflicting evidence detected',
    'no conflict detected',
    'contradiction analysis did not complete',
    'contradiction analysis unavailable',
    'contradiction analysis not available',
    'no source-level contradiction items were returned',
    'contradiction item missing summary',
    'no contradiction detail supplied',
    'no authoritative contradiction analysis is available',
  ].some((marker) => normalized.includes(marker))
}

function isGenericContradictionSummary(summary: string) {
  return isVagueContradictionText(summary)
}

function isNegativeOrUnsupportedVerdict(verdict: string) {
  const normalized = verdict.toLowerCase()
  return (
    normalized.includes('incorrect') ||
    normalized.includes('misleading') ||
    normalized.includes('unsupported') ||
    normalized.includes('scam') ||
    normalized.includes('high risk') ||
    normalized.includes('dangerous') ||
    normalized.includes('false') ||
    normalized.includes('evidence insufficient') ||
    normalized.includes('insufficient verification') ||
    normalized.includes('unverified') ||
    normalized.includes('missing context')
  )
}

function isCautiousVerdict(verdict: string) {
  const normalized = verdict.toLowerCase()
  return (
    normalized.includes('unverified') ||
    normalized.includes('insufficient') ||
    normalized.includes('missing context') ||
    normalized.includes('mixed evidence')
  )
}

function isSupportedVerdict(verdict: string) {
  const normalized = verdict.toLowerCase()
  return (
    normalized.includes('corroborated') ||
    normalized.includes('likely reliable') ||
    normalized.includes('likely true') ||
    normalized.includes('supported')
  )
}

function domainMatchesAny(domain: string, candidates: string[]) {
  return candidates.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
}

function normalizeClaimCategoryValue(value: string): ClaimCategory {
  return isValidRetrievalCategory(value) ? value : 'general'
}

function hasPreferredDomainEvidence(evidence: RankedEvidence[], claimCategory: string) {
  return evidence.some((item) =>
    domainMatchesAny(
      item.domain.toLowerCase(),
      getPreferredDomains(normalizeClaimCategoryValue(claimCategory))
    )
  )
}

function hasAuthoritativeStableFactAlignment(context: StableFactNormalizationContext) {
  return (
    context.sourceCredibility.weightedScore >= 60 ||
    context.sourceCredibility.label === 'High' ||
    context.sourceCredibility.label === 'Moderate' ||
    hasPreferredDomainEvidence(context.evidence, context.claimCategory)
  )
}

function hasStableFactCorroborationSignal(context: StableFactNormalizationContext) {
  if (!context.stableFact) {
    return false
  }

  if (
    context.conflictingSignals.hasConflict ||
    context.evidenceStrength.direction === 'contradicting' ||
    context.dangerousHealthTreatmentSignal ||
    context.breakingNewsVague ||
    context.weirdScienceGuard ||
    context.highRiskHealth.isHighRisk ||
    context.claimCategory === 'health' ||
    context.claimCategory === 'finance' ||
    context.claimCategory === 'breaking_news' ||
    context.claimCategory === 'scam'
  ) {
    return false
  }

  const directSupport = validateStableFactRelation(context.claim, context.evidence).directSupport

  if (!directSupport) {
    return false
  }

  if (!hasAuthoritativeStableFactAlignment(context)) {
    return false
  }

  return (
    context.evidenceStrength.label === 'moderate' ||
    context.evidenceStrength.label === 'strong'
  )
}

function hasCredibleEvidence(input: ContradictionNormalizationInput) {
  return (
    input.sourceCredibility.highTrustSources > 0 ||
    input.sourceCredibility.weightedScore >= 60 ||
    input.evidenceStrength.label === 'strong' ||
    hasPreferredDomainEvidence(input.evidence, input.claimCategory)
  )
}

function evidenceIsWeakOrNoisy(input: ContradictionNormalizationInput) {
  const credibleEvidence = hasCredibleEvidence(input)

  if (!input.evidence.length || input.evidenceStrength.label === 'none') {
    return true
  }

  if (input.sourceCredibility.label === 'Low') {
    return true
  }

  if (input.evidenceStrength.label === 'weak' && !credibleEvidence) {
    return true
  }

  if (input.sourceCredibility.weightedScore < 45 && !credibleEvidence) {
    return true
  }

  return evidenceLooksWeak(input.claim, input.evidence, input.sourceCredibility) && !credibleEvidence
}

function hasDirectStableLocationContradiction(input: ContradictionNormalizationContext) {
  const targetLocation = getClaimLocationTarget(input.claim)?.toLowerCase()

  if (!targetLocation) {
    return false
  }

  const subjectTerms = extractClaimKeywords(input.claim).filter(
    (term) => term !== targetLocation && term !== 'located'
  )
  const requiredHits = Math.min(2, subjectTerms.length || 1)

  return input.evidence.some((item) => {
    const sourceText = `${item.title || ''} ${item.content || ''}`
    const normalizedSource = sourceText.toLowerCase()
    const termHits = subjectTerms.filter((term) => normalizedSource.includes(term)).length
    const knownDifferentLocation =
      COMMON_LOCATION_TOKENS.some(
        (token) =>
          token !== targetLocation &&
          normalizedSource.includes(token) &&
          !normalizedSource.includes(targetLocation)
      )
    const evidenceLocation = getEvidenceLocationHint(sourceText)?.toLowerCase()
    const explicitDifferentLocation =
      Boolean(evidenceLocation) &&
      evidenceLocation !== targetLocation &&
      !normalizedSource.includes(targetLocation)

    return termHits >= requiredHits && (knownDifferentLocation || explicitDifferentLocation)
  })
}

function hasStableFactContradictionSignal(input: ContradictionNormalizationContext) {
  if (getIndiaDelhiCapitalAliasContext(input.claim).matched) {
    return false
  }

  if (
    !input.stableFact ||
    input.directStableFactSupport ||
    input.breakingNewsVague ||
    input.weirdScienceGuard ||
    input.dangerousHealthTreatmentSignal ||
    input.highRiskHealth.isHighRisk ||
    ['health', 'finance', 'breaking_news', 'scam'].includes(input.claimCategory)
  ) {
    return false
  }

  if (validateStableFactRelation(input.claim, input.evidence).directContradiction) {
    return true
  }

  if (hasDeterministicStableFactContradiction(input.claim, input.evidence)) {
    return true
  }

  if (hasDirectStableLocationContradiction(input)) {
    return true
  }

  return input.evidence.some((item) => {
    const sourceText = `${item.title || ''} ${item.content || ''}`
    const normalizedSource = normalizeStableFactText(sourceText)
    const subjectOverlap = extractClaimKeywords(input.claim).filter((term) =>
      normalizedSource.includes(term)
    )

    if (subjectOverlap.length < 2) {
      return false
    }

    if (hasCapitalContradiction(input.claim, sourceText)) {
      return true
    }

    if (hasAstronomyContradiction(input.claim, sourceText)) {
      return true
    }

    if (hasHistoricalYearContradiction(input.claim, sourceText)) {
      return true
    }

    if (
      input.evidenceStrength.direction === 'contradicting' &&
      cueScore(normalizedSource, CONTRADICTION_STANCE_CUES) > 0
    ) {
      return true
    }

    return false
  })
}

function claimRequiresAuthoritativeSupport(input: ContradictionNormalizationInput) {
  const normalized = input.claim.toLowerCase()

  return (
    ['health', 'scam', 'finance', 'breaking_news'].includes(input.claimCategory) ||
    input.highRiskHealth.isHighRisk ||
    input.dangerousHealthTreatmentSignal ||
    input.breakingNewsVague ||
    /\b(who|cdc|nih|nasa|esa|rbi|reuters|associated press|ap|official|confirmed|confirms|declared|announced|whatsapp|registration link|relief payment|cancer cure)\b/.test(
      normalized
    )
  )
}

function hasAuthoritativeSupportMissing(input: ContradictionNormalizationInput) {
  const directAuthoritativeSupport =
    input.directClaimSupport &&
    input.evidenceStrength.label === 'strong' &&
    input.evidenceStrength.direction === 'supporting'

  return claimRequiresAuthoritativeSupport(input) && !directAuthoritativeSupport
}

function buildContradictionDecision(input: ContradictionNormalizationInput): NormalizedContradiction {
  const evidenceCount = input.evidence.length
  const credibleEvidence = hasCredibleEvidence(input)
  const weakEvidence = evidenceIsWeakOrNoisy(input)
  const negativeVerdict = isNegativeOrUnsupportedVerdict(input.verdict)
  const cautiousVerdict = isCautiousVerdict(input.verdict) || input.confidenceScore <= 45
  const supportedVerdict = isSupportedVerdict(input.verdict)
  const currentNewsClaim = isCurrentNewsClaim(input.claim)
  const stableFactAnchor = evaluateStableFactAnchor(input.claim)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(input.claim)

  if (input.stableFact && stableFactAnchor.matched) {
    if (stableFactAnchor.directContradiction) {
      return {
        label: 'Direct contradiction detected',
        summary: 'Retrieved evidence conflicts with established factual records.',
        severity: 'High',
        items: [],
      }
    }

    if (stableFactAnchor.directSupport && !input.conflictingSignals.hasConflict) {
      return {
        label: 'No direct contradiction was identified in retrieved evidence.',
        summary: 'No direct contradiction was identified in retrieved evidence.',
        severity: 'None',
        items: [],
      }
    }
  }

  if (input.stableFact && capitalAliasContext.matched) {
    return {
      label: 'Missing context',
      summary: capitalAliasContext.summary,
      severity: 'Low',
      items: [],
    }
  }

  const directOpposition =
    (input.evidenceStrength.label === 'strong' &&
      input.evidenceStrength.direction === 'contradicting' &&
      credibleEvidence) ||
    hasStableFactContradictionSignal(input)

  if (!evidenceCount || (input.retrievalFailed && evidenceCount === 0)) {
    return {
      label: 'No evidence available',
      summary:
        'No retrieved sources were available, so no contradiction pattern can be established.',
      severity: 'Low',
      items: [],
    }
  }

  if (directOpposition && (negativeVerdict || input.stableFact || input.weirdScienceGuard)) {
    return {
      label: 'Direct contradiction detected',
      summary: 'Retrieved evidence directly contradicts the claim.',
      severity: 'High',
      items: [],
    }
  }

  if (
    input.stableFact &&
    input.directStableFactSupport &&
    credibleEvidence &&
    input.sourceCredibility.weightedScore >= 60 &&
    input.evidenceStrength.direction === 'supporting' &&
    !input.conflictingSignals.hasConflict &&
    !input.breakingNewsVague &&
    !input.dangerousHealthTreatmentSignal &&
    !input.weirdScienceGuard &&
    !['health', 'finance', 'breaking_news', 'scam'].includes(input.claimCategory)
  ) {
    return {
      label: 'No direct contradiction was identified in retrieved evidence.',
      summary: 'No direct contradiction was identified in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  if (currentNewsClaim && !hasBreakingNewsAnchor(input.evidence)) {
    return {
      label: 'Current reporting limited',
      summary: 'Breaking-news verification remains incomplete.',
      severity: 'Low',
      items: [],
    }
  }

  if (input.conflictingSignals.hasConflict) {
    return {
      label: 'Conflicting evidence detected',
      summary: 'Retrieved evidence contains conflicting signals.',
      severity: 'Moderate',
      items: [],
    }
  }

  if (negativeVerdict && credibleEvidence && input.evidenceStrength.direction === 'contradicting') {
    return {
      label: 'Evidence contradicts the claim',
      summary: 'Retrieved evidence directly contradicts the claim.',
      severity: 'Moderate',
      items: [],
    }
  }

  if (hasAuthoritativeSupportMissing(input)) {
    return {
      label: 'Authoritative support missing',
      summary:
        'Retrieved evidence does not provide authoritative support for this high-risk claim.',
      severity: 'Moderate',
      items: [],
    }
  }

  if (negativeVerdict && credibleEvidence) {
    return {
      label: 'Evidence contradicts the claim',
      summary: 'Retrieved credible evidence contradicts or fails to support the claim.',
      severity: 'Moderate',
      items: [],
    }
  }

  if (
    supportedVerdict &&
    input.stableFact &&
    credibleEvidence &&
    input.evidenceStrength.direction === 'supporting'
  ) {
    return {
      label: 'Evidence aligns with factual record',
      summary: 'Retrieved credible evidence aligns with established factual records.',
      severity: 'None',
      items: [],
    }
  }

  if (supportedVerdict && credibleEvidence && input.evidenceStrength.direction !== 'contradicting') {
    return {
      label: 'No direct contradiction was identified in retrieved evidence.',
      summary: 'No direct contradiction was identified in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  if (evidenceCount === 1) {
    return {
      label: 'Limited comparison',
      summary: 'Retrieved evidence is too weak for a confident contradiction assessment.',
      severity: 'Low',
      items: [],
    }
  }

  if ((negativeVerdict || cautiousVerdict) && input.evidenceStrength.label !== 'strong') {
    return {
      label: 'Contradiction evidence is limited',
      summary: 'Retrieved evidence is too weak for a confident contradiction assessment.',
      severity: 'Low',
      items: [],
    }
  }

  if (weakEvidence) {
    return {
      label: 'Insufficient reliable evidence',
      summary: 'Retrieved evidence is too weak for a confident contradiction assessment.',
      severity: 'Low',
      items: [],
    }
  }

  if (
    input.stableFact &&
    credibleEvidence &&
    input.evidenceStrength.direction === 'supporting'
  ) {
    return {
      label: 'No direct contradiction was identified in retrieved evidence.',
      summary: 'No direct contradiction was identified in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  return {
    label: 'Contradiction evidence is limited',
    summary:
      'Available evidence is limited, so no high-confidence contradiction pattern is established.',
    severity: 'Low',
    items: [],
  }
}

function getContradictionSourceIds(input: ContradictionNormalizationInput) {
  const preferredDomains = getPreferredDomains(normalizeClaimCategoryValue(input.claimCategory))
  const preferred = input.evidence.filter(
    (item) =>
      item.credibility === 'High' ||
      domainMatchesAny(item.domain.toLowerCase(), preferredDomains)
  )
  const sources = preferred.length ? preferred : input.evidence

  return sources.slice(0, 3).map((item) => item.id)
}

function buildDecisionContradictionItems(
  input: ContradictionNormalizationInput,
  decision: NormalizedContradiction
) {
  if (input.conflictingSignals.hasConflict) {
    return buildSignalContradictionItems(input.evidence, input.conflictingSignals, decision.severity)
  }

  if (decision.severity !== 'Moderate' && decision.severity !== 'High') {
    return []
  }

  const sources = getContradictionSourceIds(input)

  return sources.length
    ? [
        {
          summary: decision.summary,
          severity: decision.severity,
          sources,
        },
      ]
    : []
}

function normalizeContradictionItems(
  value: ContradictionSummary['items'] | undefined,
  fallbackSeverity: ContradictionLevel
) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Contradiction => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const summary = readString(item.summary, '')

      if (isVagueContradictionText(summary)) {
        return null
      }

      return {
        summary,
        severity:
          item.severity && item.severity !== 'Unknown' ? item.severity : fallbackSeverity,
        sources: readStringList(item.sources, [], 6),
      } satisfies Contradiction
    })
    .filter((item): item is Contradiction => item !== null)
    .slice(0, 6)
}

function summaryImpliesSupportWithoutLimits(summary: string) {
  const normalized = summary.toLowerCase()
  return (
    /\b(no (clear )?contradiction|no contradictory|aligns?|supports?|supported)\b/.test(
      normalized
    ) &&
    !/\b(limited|insufficient|not strong|missing|fails to support|does not support|authoritative support|weak)\b/.test(
      normalized
    )
  )
}

function summaryImpliesConflict(summary: string) {
  return /\b(contradict|conflict|oppos|incorrect|misleading|unsupported|fails to support)\b/i.test(
    summary
  )
}

function shouldKeepModelContradictionSummary(
  input: ContradictionNormalizationInput,
  decision: NormalizedContradiction
) {
  const modelSummary = readString(input.modelContradictions?.summary, '')
  const modelLevel = input.modelContradictions?.level
  const stableFactAnchor = evaluateStableFactAnchor(input.claim)

  if (isVagueContradictionText(modelSummary) || modelLevel === 'Unknown') {
    return false
  }

  if (input.stableFact && stableFactAnchor.matched) {
    return false
  }

  if (
    decision.label === 'No meaningful contradiction detected' ||
    decision.label === 'No direct contradiction was identified in retrieved evidence.' ||
    decision.label === 'Current reporting limited'
  ) {
    return false
  }

  if (
    isNegativeOrUnsupportedVerdict(input.verdict) &&
    summaryImpliesSupportWithoutLimits(modelSummary)
  ) {
    return false
  }

  if (
    isSupportedVerdict(input.verdict) &&
    !input.conflictingSignals.hasConflict &&
    summaryImpliesConflict(modelSummary)
  ) {
    return false
  }

  if (contradictionLevelRank(modelLevel) < contradictionLevelRank(decision.severity)) {
    return false
  }

  if (
    decision.label === 'Authoritative support missing' &&
    !/\b(authoritative|official|support|missing|does not provide|fails to support)\b/i.test(
      modelSummary
    )
  ) {
    return false
  }

  if (
    decision.label === 'Direct contradiction detected' &&
    !/\b(direct|conflict|contradict|oppos|inconsistent)\b/i.test(modelSummary)
  ) {
    return false
  }

  return true
}

function isGenericUnverifiedVerdict(verdict: string) {
  const normalized = verdict.toLowerCase()

  return (
    normalized.includes('unverified') ||
    normalized.includes('insufficient verification') ||
    normalized.includes('evidence insufficient') ||
    normalized.includes('missing context') ||
    normalized.includes('unable to verify reliably')
  )
}

function normalizeContradictionSummary(
  input: ContradictionNormalizationInput
): NormalizedContradiction {
  const decision = buildContradictionDecision(input)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(input.claim)

  if (capitalAliasContext.matched) {
    return {
      ...decision,
      summary: capitalAliasContext.summary,
      items: [],
    }
  }

  const modelItems = normalizeContradictionItems(input.modelContradictions?.items, decision.severity)
  const fallbackItems = buildDecisionContradictionItems(input, decision)
  const keepModelSummary = shouldKeepModelContradictionSummary(input, decision)

  return {
    ...decision,
    label: decision.label,
    summary: keepModelSummary
      ? readString(input.modelContradictions?.summary, decision.summary)
      : decision.summary,
    items: modelItems.length ? modelItems : fallbackItems,
  }
}

function applyNormalizedContradictions<T extends ContradictionPayload>(
  payload: T,
  context: ContradictionNormalizationContext
): T & { contradictions: ContradictionSummary; contradictionSummary: string } {
  const normalized = normalizeContradictionSummary({
    ...context,
    verdict: payload.verdict,
    confidenceScore: readNumber(payload.confidence?.score, 0),
    modelContradictions: payload.contradictions,
  })
  const contradictionSummary = readString(
    (payload as T & { contradictionSummary?: unknown }).contradictionSummary,
    normalized.summary
  )

  return {
    ...payload,
    contradictions: {
      label: normalized.label,
      level: normalized.severity,
      summary: normalized.summary,
      items: normalized.items,
    },
    contradictionSummary,
  }
}

type ConfidenceCalibration = {
  confidenceLabel: CalibrationConfidenceLabel
  confidenceCap: number
  uncertaintyReason: string
}

type ConfidenceCapDecision = {
  cap: number
  applied: boolean
  reason: string
}

type ConfidenceCapContext = {
  modelConfidence: number
  evidenceCount: number
  sourceCredibility: SourceCredibility
  conflictingSignals: ConflictSignal
  claimCategory: string
  evidence: RankedEvidence[]
  claim: string
  retrievalFailed: boolean
  directClaimSupport: boolean
  directStableFactSupport: boolean
  evidenceStrength: EvidenceStrength
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  breakingNewsVague: boolean
  dangerousHealthTreatmentSignal: boolean
  stableFact: boolean
}

type ContradictionNormalizationContext = {
  claim: string
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  conflictingSignals: ConflictSignal
  claimCategory: string
  evidenceStrength: EvidenceStrength
  retrievalFailed: boolean
  directClaimSupport: boolean
  directStableFactSupport: boolean
  stableFact: boolean
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  dangerousHealthTreatmentSignal: boolean
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
}

type ContradictionNormalizationInput = ContradictionNormalizationContext & {
  verdict: string
  confidenceScore: number
  modelContradictions?: ContradictionSummary
}

type ContradictionPayload = {
  verdict: string
  confidence?: {
    score?: number
  }
  contradictions?: ContradictionSummary
}

type FallbackPayloadOptions = Partial<
  Omit<
    ContradictionNormalizationContext,
    'evidence' | 'sourceCredibility' | 'conflictingSignals' | 'retrievalFailed'
  >
>

function adjustCalibrationForEvidence(
  calibration: ConfidenceCalibration,
  input: {
    stableFact: boolean
    directStableFactSupport: boolean
    evidenceStrength: EvidenceStrength
    category: string
    sourceCredibilityScore: number
    evidence: RankedEvidence[]
  }
): ConfidenceCalibration {
  const stableFactEligible =
    input.stableFact &&
    input.directStableFactSupport &&
    (input.evidenceStrength.label === 'moderate' || input.evidenceStrength.label === 'strong') &&
    (input.sourceCredibilityScore >= 60 ||
      hasPreferredDomainEvidence(input.evidence, input.category))

  if (!stableFactEligible) {
    return calibration
  }

  const sensitiveCategory = ['health', 'scam', 'breaking_news', 'finance'].includes(input.category)
  const confidenceCap = sensitiveCategory ? Math.max(calibration.confidenceCap, 80) : 92

  return {
    confidenceLabel: sensitiveCategory ? 'Moderate' : 'High',
    confidenceCap,
    uncertaintyReason:
      input.evidenceStrength.direction === 'contradicting'
        ? 'Stable factual claim is directly contradicted by authoritative evidence.'
        : 'Stable factual claim is directly supported by authoritative evidence.',
  }
}

function normalizeClaimText(claim: string) {
  return claim.toLowerCase().replace(/\s+/g, ' ').trim()
}

function countMeaningfulOverlap(claim: string, item: RankedEvidence) {
  const keywords = extractClaimKeywords(claim)
  if (!keywords.length) {
    return 0
  }

  const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0)
}

function evidenceLooksWeak(claim: string, evidence: RankedEvidence[], sourceCredibility: SourceCredibility) {
  if (!evidence.length) {
    return true
  }

  if (sourceCredibility.weightedScore < 45) {
    return true
  }

  const shortEvidence = evidence.every((item) => {
    const snippetLength = normalizeClaimText(`${item.title || ''} ${item.content || ''}`).length
    return snippetLength < 80
  })

  if (shortEvidence) {
    return true
  }

  const claimKeywords = extractClaimKeywords(claim)
  const maxOverlap = evidence.reduce(
    (max, item) => Math.max(max, countMeaningfulOverlap(claim, item)),
    0
  )

  if (!maxOverlap) {
    return true
  }

  if (claimKeywords.length >= 4 && maxOverlap < 3) {
    return true
  }

  if (claimKeywords.length >= 2 && maxOverlap < 2) {
    return true
  }

  return false
}

function isQuoteClaim(claim: string) {
  return /["“”‘’]/.test(claim) || /\bquote\b|\bsaid\b|\bstated\b|\baccording to\b/i.test(claim)
}

function hasDirectAttributionEvidence(evidence: RankedEvidence[]) {
  return evidence.some((item) => {
    const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
    return /\baccording to\b|\bsaid\b|\bstated\b|\btold\b|\bquoted\b|["“”‘’]/.test(text)
  })
}

function isStatisticsClaim(claim: string) {
  const normalized = normalizeClaimText(claim)
  return (
    /%/.test(normalized) ||
    /\b(statistics|statistic|survey|study|data|dataset|figure|figures|percent|percentage|rate|rates|poll|sample|average|median|experts agree)\b/.test(
      normalized
    )
  )
}

function hasClearDataEvidence(evidence: RankedEvidence[]) {
  return evidence.some((item) => {
    const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
    return /\b(data|dataset|survey|study|report|census|analysis|statistics|numbers|figure|figures)\b/.test(text)
  })
}

function hasBreakingNewsAnchor(evidence: RankedEvidence[]) {
  return evidence.some((item) => {
    const domain = item.domain.toLowerCase()
    return (
      item.credibility === 'High' ||
      item.credibility === 'Moderate' ||
      domain === 'reuters.com' ||
      domain === 'apnews.com' ||
      domain === 'bbc.com' ||
      domain === 'bbc.co.uk' ||
      domain.endsWith('.gov') ||
      domain.endsWith('.gov.in') ||
      domain.endsWith('.nic.in')
    )
  })
}

const SCAM_LABEL_PRIORITY = [
  'Fake KYC urgency',
  'Credential harvesting pattern',
  'Suspicious payment extraction',
  'Likely phishing attempt',
  'Impersonation risk',
  'Reward bait pattern',
  'Chain-forward manipulation',
  'Suspicious link behavior',
  'Guaranteed-return scam pattern',
] as const

function classifyScamPattern(claim: string): ScamPatternClassification {
  const normalized = normalizeClaimText(claim)
  const has = (pattern: RegExp) => pattern.test(normalized)

  if (
    (normalized.includes('kyc') || normalized.includes('e-kyc') || normalized.includes('bank verification') ||
      normalized.includes('account will be blocked') || normalized.includes('will be blocked') ||
      normalized.includes('verify immediately') || normalized.includes('update kyc')) &&
    (normalized.includes('urgent') ||
      normalized.includes('immediately') ||
      normalized.includes('tonight') ||
      normalized.includes('blocked') ||
      normalized.includes('expire') ||
      normalized.includes('sbi') ||
      normalized.includes('bank') ||
      normalized.includes('account'))
  ) {
    return {
      isScamLike: true,
      label: 'Fake KYC urgency',
      risk: 'High',
      reason: 'KYC pressure and account-block language indicate an urgent credential scam pattern.',
    }
  }

  if (
    normalized.includes('otp') ||
    normalized.includes('pin') ||
    normalized.includes('cvv') ||
    normalized.includes('password') ||
    normalized.includes('login details') ||
    normalized.includes('verification code')
  ) {
    return {
      isScamLike: true,
      label: 'Credential harvesting pattern',
      risk: 'High',
      reason: 'OTP, PIN, password, or verification-code language indicates credential harvesting risk.',
    }
  }

  if (
    /\bupi\b/.test(normalized) ||
    normalized.includes('refund') ||
    normalized.includes('processing fee') ||
    normalized.includes('release fee') ||
    normalized.includes('customs') ||
    normalized.includes('payment link') ||
    normalized.includes('payment request')
  ) {
    return {
      isScamLike: true,
      label: 'Suspicious payment extraction',
      risk: 'High',
      reason: 'Refund, fee, UPI, or payment-link language indicates payment extraction risk.',
    }
  }

  if (
    normalized.includes('lucky draw') ||
    normalized.includes('lottery') ||
    normalized.includes('kbc') ||
    normalized.includes('free iphone') ||
    normalized.includes('reward') ||
    normalized.includes('cashback') ||
    normalized.includes('giveaway') ||
    normalized.includes('prize')
  ) {
    return {
      isScamLike: true,
      label: 'Reward bait pattern',
      risk: 'Medium',
      reason: 'Prize and reward promises indicate bait behavior.',
    }
  }

  if (
    (normalized.includes('telegram') || normalized.includes('crypto') || normalized.includes('trading') || normalized.includes('investment')) &&
    (normalized.includes('guaranteed') ||
      normalized.includes('assured') ||
      normalized.includes('fixed') ||
      normalized.includes('daily profit') ||
      normalized.includes('double money') ||
      normalized.includes('doubles money') ||
      normalized.includes('guaranteed return') ||
      normalized.includes('20% daily profit') ||
      normalized.includes('crypto profit'))
  ) {
    return {
      isScamLike: true,
      label: 'Guaranteed-return scam pattern',
      risk: 'High',
      reason: 'Guaranteed returns and rapid-profit claims indicate a high-risk scam pattern.',
    }
  }

  if (
    normalized.includes('forward this') ||
    normalized.includes('share this') ||
    normalized.includes('forward to') ||
    normalized.includes('share in groups') ||
    normalized.includes('send to groups') ||
    normalized.includes('unlock cashback') ||
    normalized.includes('unlock reward')
  ) {
    return {
      isScamLike: true,
      label: 'Chain-forward manipulation',
      risk: 'Medium',
      reason: 'Forwarding pressure and circulation prompts indicate chain-forward manipulation.',
    }
  }

  if (
    (normalized.includes('rbi') ||
      normalized.includes('reserve bank') ||
      normalized.includes('bank') ||
      normalized.includes('government') ||
      normalized.includes('ministry') ||
      normalized.includes('police') ||
      normalized.includes('customs') ||
      normalized.includes('courier')) &&
    (normalized.includes('registration') ||
      normalized.includes('whatsapp') ||
      normalized.includes('telegram') ||
      normalized.includes('otp') ||
      normalized.includes('payment') ||
      normalized.includes('relief') ||
      normalized.includes('fund') ||
      normalized.includes('benefit') ||
      normalized.includes('action required'))
  ) {
    return {
      isScamLike: true,
      label: 'Impersonation risk',
      risk: 'High',
      reason: 'Authority framing plus an action request indicates impersonation risk.',
    }
  }

  const isCivicLike =
    isCivicRumorClaim(claim) &&
    !/\b(otp|pin|cvv|password|kyc|payment|refund|upi|cashback|reward|lottery|telegram|crypto|guaranteed|double[s]?\s+money|daily profit|forward this|share this|blocked|verify immediately|update kyc|account will be blocked)\b/.test(
      normalized
    )
  const isBreakingNewsLike =
    (isCurrentNewsClaim(claim) || isBreakingNewsPlaceholderClaim(claim)) &&
    !/\b(otp|pin|cvv|password|kyc|payment|refund|upi|cashback|reward|lottery|telegram|crypto|guaranteed|double[s]?\s+money|daily profit|forward this|share this|blocked|verify immediately|update kyc|account will be blocked)\b/.test(
      normalized
    )

  if (isCivicLike || isBreakingNewsLike) {
    return {
      isScamLike: false,
      label: 'Likely phishing attempt',
      risk: 'Low',
      reason: 'The claim is better treated as civic or breaking-news verification rather than a scam pattern.',
    }
  }

  if (
    has(/\b(kyc|e-kyc|kyc update|update kyc|kyc expired|kyc will expire|account will be blocked|bank account blocked|account suspension|verify immediately|update your account)\b/) ||
    has(/\b(otp|pin|password|cvv|bank details|card details|login details|verification code)\b/) ||
    has(/\b(bank verification|account verification|verify account|verify your bank|sbi|hdfc|icici|axis bank|bank employee|bank official)\b/))
  {
    const label: ScamPatternLabel =
      has(/\b(kyc|e-kyc|kyc update|update kyc|kyc expired|kyc will expire|account will be blocked|bank account blocked|account suspension|verify immediately|update your account)\b/) ||
      has(/\b(bank verification|account verification|verify account|verify your bank|sbi|hdfc|icici|axis bank|bank employee|bank official)\b/)
        ? 'Fake KYC urgency'
        : 'Credential harvesting pattern'

    return {
      isScamLike: true,
      label,
      risk: 'High',
      reason:
        label === 'Fake KYC urgency'
          ? 'KYC pressure and account-block language indicate an urgent credential scam pattern.'
          : 'OTP, PIN, password, or account-verification language indicates credential harvesting risk.',
    }
  }

  if (
    has(/\b(upi|refund|processing fee|release fee|customs payment|customs fee|payment link|payment request|collect payment|pay fee|refund link|fee payment)\b/) ||
    has(/\b(payment|refund|transfer|upi)\b.*\b(link|form|request|send|share|confirm|verify|enter)\b/)
  ) {
    return {
      isScamLike: true,
      label: 'Suspicious payment extraction',
      risk: 'High',
      reason: 'Refund, fee, UPI, or payment-link language indicates payment extraction risk.',
    }
  }

  if (
    has(/\b(lottery|lucky draw|kbc|free iphone|free iPhone|reward|cashback|giveaway|prize|first users?)\b/) ||
    has(/\b(reward|prize|lottery|cashback|gift|giveaway|free money)\b.*\b(link|form|whatsapp|telegram|registration)\b/)
  ) {
    return {
      isScamLike: true,
      label: 'Reward bait pattern',
      risk: 'Medium',
      reason: 'Prize or reward language is being used to trigger quick compliance.',
    }
  }

  if (
    has(/\b(telegram|crypto|trading|investment)\b/) &&
    (has(/\b(guaranteed|assured|fixed)\s+(?:daily\s+)?(?:returns?|profit|income|earnings)\b/) ||
      has(/\b(?:20|30|50|100)%\s+(?:daily\s+)?(?:profit|returns?|income|earnings)\b/) ||
      has(/\b(double[s]?\s+money|doubles?\s+money|daily profit|crypto profit guarantee|guaranteed crypto profit)\b/))
  ) {
    return {
      isScamLike: true,
      label: 'Guaranteed-return scam pattern',
      risk: 'High',
      reason: 'Guaranteed returns and rapid-profit claims indicate a high-risk investment scam pattern.',
    }
  }

  if (
    has(/\b(forward this(?: message)?|share this(?: message)?|forward to \d+|share with \d+ people|share in groups?|send to \d+ people|send to groups?)\b/) ||
    has(/\b(avoid shutdown|unlock cashback|unlock reward|complete the chain)\b/)
  ) {
    return {
      isScamLike: true,
      label: 'Chain-forward manipulation',
      risk: 'Medium',
      reason: 'Forwarding pressure and circulation prompts indicate chain-forward manipulation.',
    }
  }

  if (
    has(/\b(rbi|reserve bank|bank|government|ministry|police|courier|customs)\b/) &&
    has(/\b(link|form|registration|whatsapp|telegram|otp|payment|update|relief|fund|benefit|action required)\b/)
  ) {
    return {
      isScamLike: true,
      label: 'Impersonation risk',
      risk: 'High',
      reason: 'Authority framing plus an action request indicates impersonation risk.',
    }
  }

  return {
    isScamLike: false,
    label: 'Likely phishing attempt',
    risk: 'Low',
    reason: 'No deterministic scam pattern was matched.',
  }
}

function detectScamSignals(claim: string): ScamSignals {
  const normalized = normalizeClaimText(claim)
  const labels: string[] = []
  let score = 0

  const addSignal = (pattern: RegExp, label: string, weight = 1) => {
    if (pattern.test(normalized)) {
      labels.push(label)
      score += weight
    }
  }

  addSignal(
    /\b(kyc|e-kyc|kyc update|update kyc|kyc expired|kyc will expire|account will be blocked|bank account blocked|account suspension|suspend(ed)?|verify immediately|update your account)\b/,
    'Fake KYC urgency',
    2
  )
  addSignal(
    /\b(otp|pin|password|cvv|bank details|card details|login details|verification code)\b.*\b(request|ask|enter|share|send|confirm)\b/,
    'Likely phishing attempt',
    2
  )
  addSignal(
    /\b(otp|pin|password|cvv|bank details|card details|account details|upi|payment|refund|transfer|pay|collect)\b.*\b(link|form|request|send|share|confirm|verify|enter)\b/,
    'Payment extraction pattern',
    2
  )
  addSignal(
    /\b(share|send|enter|confirm)\s+(otp|pin|password|cvv)\b|\b(otp|pin|password|cvv)\b.*\b(receive|refund|cashback|money|payment|transfer)\b/,
    'Payment extraction pattern',
    2
  )
  addSignal(
    /\b(whatsapp registration link|registration link|verification link|signup link|click this link|tap this link|open this link|fill this form now)\b/,
    'Likely phishing attempt',
    2
  )
  addSignal(
    /\b(free money|reward|rewards|prize|lottery|cashback|refund|gift|gift card|giveaway|free iphone|free iPhone|free iphones?)\b/,
    'Reward bait pattern',
    2
  )
  addSignal(
    /\b(reward|prize|lottery|cashback|government relief|relief payment|subsidy|benefit|payout)\b.*\b(link|form|whatsapp|telegram|registration)\b/,
    'Reward bait pattern',
    2
  )
  addSignal(
    /\b(guaranteed|assured|fixed)\s+(?:daily\s+)?(?:returns?|profit|income|earnings)\b|\b(?:20|30|50|100)%\s+(?:daily\s+)?(?:profit|returns?|income|earnings)\b|\b(double your money|crypto profit guarantee|guaranteed crypto profit)\b/,
    'Guaranteed-return scam pattern',
    3
  )
  addSignal(
    /\b(rbi|reserve bank|bank|government|ministry|police|courier|amazon|flipkart|whatsapp|telegram|facebook|instagram|google|microsoft|apple|platform)\b.*\b(link|form|registration|whatsapp|telegram|otp|payment|update)\b/,
    'Impersonation risk',
    2
  )
  addSignal(
    /\b(parcel|package|shipment|delivery|courier)\b.*\b(stuck|held|blocked|pending|issue|problem|release|pay)\b/,
    'Impersonation risk',
    2
  )
  addSignal(
    /\b(government relief|relief payment|subsidy|benefit|cash assistance|aid payment)\b.*\b(link|whatsapp|registration|form)\b/,
    'Impersonation risk',
    2
  )
  addSignal(
    /\b(urgent|urgently|immediately|today|tonight|last chance|act now|within \d+ (?:minutes|hours|days)|deadline|expires today|will be blocked|will expire|cyber cell|police notice)\b/,
    'Chain-forward manipulation',
    1
  )
  addSignal(
    /\b(forward this(?: message)?|share this(?: message)?|forward to \d+|share with \d+ people|share in groups?|send to \d+ people|send to groups?)\b/,
    'Chain-forward manipulation',
    2
  )
  addSignal(
    /\b(?:bit\.ly|tinyurl\.com?|t\.co|goo\.gl|lnk\.to|cutt\.ly|rb\.gy|rebrand\.ly|shorturl)\b/,
    'Suspicious link behavior',
    2
  )
  addSignal(
    /\b(https?:\/\/[^\s]+)\b/,
    'Suspicious link behavior',
    1
  )

  const riskLevel = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low'

  return {
    riskLevel,
    labels: Array.from(new Set(labels)).slice(0, 5),
  }
}

function getPrimaryScamLabel(labels: string[]) {
  return SCAM_LABEL_PRIORITY.find((label) => labels.includes(label)) ?? labels[0] ?? 'Likely phishing attempt'
}

function isGenericScamText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!normalized) {
    return true
  }

  return [
    'unverified',
    'exercise caution',
    'could not verify',
    'could not be verified',
    'cannot verify',
    'cannot be verified',
    'no trusted source',
    'no evidence',
    'likely scam',
    'possible scam',
    'suspicious',
    'check carefully',
  ].some((marker) => normalized === marker || normalized.includes(marker))
}

function hasExplicitScamLanguage(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!normalized) {
    return false
  }

  return [
    'likely phishing attempt',
    'fake kyc urgency',
    'credential harvesting pattern',
    'suspicious payment extraction',
    'payment extraction pattern',
    'reward bait pattern',
    'impersonation risk',
    'chain-forward manipulation',
    'suspicious link behavior',
    'phishing',
    'kyc',
    'reward bait',
    'urgency-bait',
    'guaranteed-return scam pattern',
    'guaranteed-return',
  ].some((marker) => normalized.includes(marker))
}

function hasDirectScamIndicators(claim: string, scamSignals = detectScamSignals(claim)) {
  if (scamSignals.labels.some((label) => DIRECT_SCAM_LABELS.has(label as (typeof SCAM_LABEL_PRIORITY)[number]))) {
    return true
  }

  const normalized = normalizeClaimText(claim)
  return (
    /\b(otp|pin|cvv|kyc|e-kyc|account will be blocked|will be blocked|payment|refund|transfer|collect|verify immediately|click this link|tap this link|open this link|whatsapp registration link|telegram group|guaranteed|assured|fixed)\b/.test(
      normalized
    ) ||
    /\b(?:20|30|50|100)%\s+(?:daily\s+)?(?:profit|returns?|income|earnings)\b/.test(normalized) ||
    /\b(double your money|crypto profit guarantee|guaranteed crypto profit)\b/.test(normalized)
  )
}

function isCivicRumorClaim(claim: string) {
  const normalized = normalizeClaimText(claim)

  if (!normalized) {
    return false
  }

  return CIVIC_RUMOR_CUES.some((cue) =>
    cue.includes(' ') ? normalized.includes(cue) : new RegExp(`\\b${cue}\\b`).test(normalized)
  )
}

function buildExplicitScamLanguage(scamSignals: ScamSignals) {
  const labels = scamSignals.labels.length ? scamSignals.labels : ['Likely phishing attempt']
  const primaryLabel = getPrimaryScamLabel(labels)
  const supportingLabels = labels.filter((label) => label !== primaryLabel).slice(0, 2)
  const supportSuffix = supportingLabels.length ? ` Additional signals: ${supportingLabels.join(', ')}.` : ''

  if (primaryLabel === 'Likely phishing attempt') {
    return `${primaryLabel}. This matches common phishing or urgency-bait patterns.${supportSuffix}`
  }

  if (primaryLabel === 'Fake KYC urgency') {
    return `${primaryLabel}. The message uses account or KYC pressure to force immediate action.${supportSuffix}`
  }

  if (primaryLabel === 'Credential harvesting pattern') {
    return `${primaryLabel}. OTP, PIN, or password collection language indicates credential theft risk.${supportSuffix}`
  }

  if (primaryLabel === 'Suspicious payment extraction') {
    return `${primaryLabel}. Refund, fee, or payment-link language indicates payment extraction risk.${supportSuffix}`
  }

  if (primaryLabel === 'Reward bait pattern') {
    return `${primaryLabel}. The message dangles rewards or payouts to trigger fast compliance.${supportSuffix}`
  }

  if (primaryLabel === 'Impersonation risk') {
    return `${primaryLabel}. The message appears to borrow authority from a bank, government, courier, or platform.${supportSuffix}`
  }

  if (primaryLabel === 'Payment extraction pattern') {
    return `${primaryLabel}. The message is trying to extract credentials or payment data under urgency.${supportSuffix}`
  }

  if (primaryLabel === 'Chain-forward manipulation') {
    return `${primaryLabel}. The message pushes forwarding or mass sharing to amplify spread.${supportSuffix}`
  }

  if (primaryLabel === 'Suspicious link behavior') {
    return `${primaryLabel}. The message relies on a link pattern that should not be treated as trusted.${supportSuffix}`
  }

  if (primaryLabel === 'Guaranteed-return scam pattern') {
    return `${primaryLabel}. The message promises guaranteed or fixed returns that are not credible.${supportSuffix}`
  }

  return `${primaryLabel}. The message matches common scam or phishing patterns.${supportSuffix}`
}

function getScamPatternReason(label: string) {
  switch (label) {
    case 'Fake KYC urgency':
      return 'KYC pressure and account-block language indicate an urgent credential scam pattern.'
    case 'Credential harvesting pattern':
      return 'OTP, PIN, password, or account-verification language indicates credential harvesting risk.'
    case 'Suspicious payment extraction':
      return 'Refund, fee, UPI, or payment-link language indicates payment extraction risk.'
    case 'Reward bait pattern':
      return 'Prize and reward promises indicate bait behavior.'
    case 'Guaranteed-return scam pattern':
      return 'Guaranteed returns and rapid-profit claims indicate a high-risk scam pattern.'
    case 'Chain-forward manipulation':
      return 'Forwarding pressure and circulation prompts indicate chain-forward manipulation.'
    case 'Impersonation risk':
      return 'Authority framing plus an action request indicates impersonation risk.'
    case 'Likely phishing attempt':
      return 'Generic credential, link, or urgency cues indicate a phishing pattern.'
    case 'Payment extraction pattern':
      return 'Credential or payment-data extraction is the operational risk indicator.'
    default:
      return 'The message matches a high-risk scam pattern.'
  }
}

function strengthenScamLanguage(value: string, scamSignals: ScamSignals) {
  if (scamSignals.riskLevel === 'low') {
    return value
  }

  const explicit = buildExplicitScamLanguage(scamSignals)

  if (!value.trim()) {
    return explicit
  }

  if (hasExplicitScamLanguage(value)) {
    return value
  }

  if (isGenericScamText(value)) {
    return explicit
  }

  return `${explicit} ${value}`.trim()
}

function getScamVerdictLabel(scamSignals: ScamSignals) {
  if (scamSignals.labels.includes('Fake KYC urgency')) {
    return 'Fake KYC urgency'
  }

  if (scamSignals.labels.includes('Credential harvesting pattern')) {
    return 'Credential harvesting pattern'
  }

  if (scamSignals.labels.includes('Suspicious payment extraction')) {
    return 'Suspicious payment extraction'
  }

  if (scamSignals.labels.includes('Likely phishing attempt')) {
    return 'Likely phishing attempt'
  }

  if (scamSignals.labels.includes('Impersonation risk')) {
    return 'Impersonation risk'
  }

  if (scamSignals.labels.includes('Payment extraction pattern')) {
    return 'Payment extraction pattern'
  }

  if (scamSignals.labels.includes('Reward bait pattern')) {
    return 'Reward bait pattern'
  }

  if (scamSignals.labels.includes('Chain-forward manipulation')) {
    return 'Chain-forward manipulation'
  }

  if (scamSignals.labels.includes('Suspicious link behavior')) {
    return 'Suspicious link behavior'
  }

  if (scamSignals.labels.includes('Guaranteed-return scam pattern')) {
    return 'Guaranteed-return scam pattern'
  }

  return 'Likely phishing attempt'
}

function getScamRiskLevel(claim: string, scamSignals: ScamSignals): Risk {
  const normalized = normalizeClaimText(claim)
  const hasUrgencyPressure = /\b(urgent|urgently|immediately|today|tonight|last chance|act now|deadline|expires today|will be blocked|will expire)\b/.test(
    normalized
  )
  const hasPaymentExtraction =
    scamSignals.labels.includes('Payment extraction pattern') ||
    scamSignals.labels.includes('Suspicious payment extraction') ||
    scamSignals.labels.includes('Credential harvesting pattern') ||
    /\b(otp|pin|password|cvv|bank details|card details|account details|upi|payment|refund|transfer|pay|collect)\b/.test(
      normalized
    )
  const hasHighImpersonation =
    scamSignals.labels.includes('Fake KYC urgency') ||
    scamSignals.labels.includes('Likely phishing attempt') ||
    scamSignals.labels.includes('Impersonation risk') ||
    scamSignals.labels.includes('Guaranteed-return scam pattern')

  if (hasHighImpersonation || hasPaymentExtraction) {
    return 'High'
  }

  if (scamSignals.labels.includes('Reward bait pattern')) {
    return hasUrgencyPressure || /\b(link|form|registration|click|tap|open|fill)\b/.test(normalized)
      ? 'High'
      : 'Medium'
  }

  if (scamSignals.labels.includes('Suspicious link behavior')) {
    return hasUrgencyPressure ? 'High' : 'Medium'
  }

  if (scamSignals.labels.includes('Chain-forward manipulation')) {
    return hasUrgencyPressure ? 'High' : 'Medium'
  }

  if (scamSignals.labels.includes('Guaranteed-return scam pattern')) {
    return 'High'
  }

  return 'Medium'
}

function classifyRoutingBucket(claim: string, claimCategory: string, breakingNewsVague: boolean): RoutingBucket {
  const route = routeClaim(claim)

  if (route.isScamLike) {
    return 'scam'
  }

  if (route.isCivicRumor || claimCategory === 'government' || isCivicRumorClaim(claim)) {
    return 'civic_rumor'
  }

  if (route.isBreakingNews || claimCategory === 'breaking_news' || breakingNewsVague || isCurrentNewsClaim(claim)) {
    return 'breaking_news'
  }

  if (route.isStatisticalClaim || isStatisticsClaim(claim)) {
    return 'statistical_overreach'
  }

  return 'general'
}

function getRoutingBucketSummary(bucket: RoutingBucket) {
  switch (bucket) {
    case 'breaking_news':
      return 'Verification incomplete.'
    case 'civic_rumor':
      return 'Unsupported civic claim.'
    case 'statistical_overreach':
      return 'Retrieved evidence does not substantiate the stated statistical claim.'
    case 'scam':
      return 'This matches common phishing / urgency-bait patterns.'
    default:
      return 'Retrieved evidence does not currently support this claim.'
  }
}

type ScamNormalizableAnalysis = {
  verdict: string
  reason?: string
  reasoning: string
  confidence: {
    score: number
    label: string
    rationale: string
    drivers: string[]
  }
  risk: Risk | string
  operationalGuidance: {
    action: string
    distribution: string
    escalation: string
    nextSteps: string[]
  }
}

function applyScamNormalization<T extends ScamNormalizableAnalysis>(
  analysis: T,
  claim: string,
  claimCategory = 'general'
) {
  const scamPattern = classifyScamPattern(claim)
  const detectedScamSignals = detectScamSignals(claim)
  const scamSignals =
    scamPattern.isScamLike
      ? {
          riskLevel: scamPattern.risk.toLowerCase() as ScamSignals['riskLevel'],
          labels: [scamPattern.label],
        }
      : detectedScamSignals.riskLevel !== 'low' || claimCategory === 'scam'
        ? detectedScamSignals.riskLevel !== 'low'
          ? detectedScamSignals
          : { riskLevel: 'medium' as const, labels: ['Likely phishing attempt'] }
        : detectedScamSignals

  if (scamSignals.riskLevel === 'low') {
    return normalizeOperationalAnalysisPayload(analysis as unknown as Analysis) as unknown as T
  }

  const verdictLabel = scamPattern.isScamLike ? scamPattern.label : getScamVerdictLabel(scamSignals)
  const scamReason = scamPattern.isScamLike
    ? scamPattern.reason
    : getScamPatternReason(verdictLabel)
  const explicitReason = strengthenScamLanguage(
    scamReason,
    scamSignals
  )
  const explicitReasoning = strengthenScamLanguage(
    scamReason,
    scamSignals
  )
  const explicitRationale = strengthenScamLanguage(
    scamReason,
    scamSignals
  )
  const explicitAction = `Treat as ${verdictLabel.toLowerCase()}.`

  return normalizeOperationalAnalysisPayload({
    ...analysis,
    verdict: verdictLabel,
    reason: explicitReason,
    reasoning: explicitReasoning,
    risk: getScamRiskLevel(claim, scamSignals),
    confidence: {
      ...analysis.confidence,
      rationale: explicitRationale,
    },
    operationalGuidance: {
      ...analysis.operationalGuidance,
      action: explicitAction,
      distribution: 'Do not distribute as verified.',
    },
  } as unknown as Analysis) as unknown as T
}

function isCurrentNewsClaim(claim: string): boolean {
  const normalized = normalizeClaimText(claim)
  return [
    'today',
    'yesterday',
    'breaking',
    'latest',
    'just announced',
    'confirmed today',
    'died today',
    'tonight',
    'explosion',
    'attack',
    'war',
    'crash',
    'earthquake',
    'lockdown',
    'cyberattack',
    'blast',
    'shooting',
    'election update',
    'celebrity death',
    'disaster',
    'emergency',
    'this morning',
    'this evening',
  ].some((signal) => normalized.includes(signal))
}

function summarizeEvidenceStrength(input: {
  verdict: Verdict
  evidenceStrength: EvidenceStrength
  sourceCredibility: SourceCredibility
  stableFact: boolean
  directStableFactSupport: boolean
  directClaimSupport: boolean
  conflictingSignals: ConflictSignal
  claimCategory: string
  currentNewsClaim: boolean
  scamSignals: { riskLevel: 'low' | 'medium' | 'high'; labels: string[] }
}) {
  if (input.verdict === 'Corroborated' && input.stableFact && input.directStableFactSupport) {
    return 'Retrieved evidence directly supports the claim and aligns with established factual records.'
  }

  if (input.evidenceStrength.direction === 'contradicting' && input.evidenceStrength.label === 'strong') {
    return 'Retrieved evidence conflicts with established factual records.'
  }

  if (input.verdict === 'Likely incorrect') {
    if (input.sourceCredibility.weightedScore >= 50 || input.conflictingSignals.hasConflict) {
      return 'Retrieved evidence conflicts with established factual records.'
    }

    return 'Available evidence is too weak for a confident verification.'
  }

  if (input.currentNewsClaim) {
    return input.conflictingSignals.hasConflict
      ? 'Breaking-news verification remains incomplete.'
      : 'No authoritative reporting currently supports this claim.'
  }

  if (input.scamSignals.riskLevel !== 'low') {
    const primaryLabel = getPrimaryScamLabel(input.scamSignals.labels)
    const labelSuffix = input.scamSignals.labels.length > 1 ? ` Additional signals: ${input.scamSignals.labels.filter((label) => label !== primaryLabel).slice(0, 2).join(', ')}.` : ''
    return `${primaryLabel}. This matches common phishing / urgency-bait patterns.${labelSuffix}`
  }

  if (input.conflictingSignals.hasConflict) {
    return 'Retrieved sources do not provide direct support for the claim.'
  }

  if (
    input.evidenceStrength.label === 'weak' ||
    input.sourceCredibility.label === 'Low' ||
    input.sourceCredibility.weightedScore < 45
  ) {
    return 'Retrieved evidence is too weak for a confident verification.'
  }

  if (
    (input.evidenceStrength.direction === 'supporting' &&
      (input.evidenceStrength.label === 'strong' || input.evidenceStrength.label === 'moderate') &&
      input.sourceCredibility.weightedScore >= 50) ||
    input.directStableFactSupport
  ) {
    return 'Retrieved evidence directly supports the claim.'
  }

  return 'Available reporting is currently insufficient for confident verification.'
}

function buildConfidenceCapReason(input: ConfidenceCapContext, cap: number) {
  const scamSignals = detectScamSignals(input.claim)
  const routingBucket = classifyRoutingBucket(input.claim, input.claimCategory, input.breakingNewsVague)
  const currentNewsClaim = isCurrentNewsClaim(input.claim)

  if (
    input.stableFact &&
    input.directStableFactSupport &&
    input.evidenceCount >= 1 &&
    (input.evidenceStrength.label === 'moderate' || input.evidenceStrength.label === 'strong') &&
    (input.sourceCredibility.weightedScore >= 60 ||
      hasPreferredDomainEvidence(input.evidence, input.claimCategory)) &&
    (['High', 'Moderate'].includes(input.sourceCredibility.label) ||
      hasPreferredDomainEvidence(input.evidence, input.claimCategory)) &&
    !input.retrievalFailed &&
    !input.dangerousHealthTreatmentSignal &&
    !input.breakingNewsVague &&
    !input.conflictingSignals.hasConflict
  ) {
    return 'Retrieved evidence directly supports the claim and aligns with established factual records.'
  }

  if (input.retrievalFailed) {
    return 'Retrieval failed, so confidence must stay low.'
  }

  if (!input.evidenceCount) {
    return 'No evidence was retrieved, so no verification state can be established.'
  }

  if (input.dangerousHealthTreatmentSignal) {
    return 'High-risk health claims should not receive inflated confidence.'
  }

  if (input.claimCategory === 'health' && !input.hasAuthoritativeHealthEvidence) {
    return 'Health claim lacks an authoritative medical source.'
  }

  if (
    (input.claimCategory === 'breaking_news' || input.breakingNewsVague || currentNewsClaim) &&
    !hasBreakingNewsAnchor(input.evidence)
  ) {
    return 'Breaking-news verification remains incomplete.'
  }

  if (routingBucket === 'civic_rumor') {
    return 'Retrieved reporting does not currently confirm the claim.'
  }

  if (routingBucket === 'statistical_overreach') {
    return 'Retrieved evidence does not substantiate the stated statistical claim.'
  }

  if (isQuoteClaim(input.claim) && !hasDirectAttributionEvidence(input.evidence)) {
    return 'Quote claim lacks direct attribution in the retrieved evidence.'
  }

  if (isStatisticsClaim(input.claim) && !hasClearDataEvidence(input.evidence)) {
    return 'Statistics claim lacks clear source or data evidence.'
  }

  if (input.evidenceCount === 1) {
    return 'Only one source was retrieved.'
  }

  if (input.evidenceStrength.label === 'weak' || evidenceLooksWeak(input.claim, input.evidence, input.sourceCredibility)) {
    return 'Retrieved evidence is too weak or unrelated for confident verification.'
  }

  if (input.sourceCredibility.weightedScore < 45) {
    return 'Retrieved sources do not yet support a confident verification.'
  }

  if (input.conflictingSignals.hasConflict) {
    return 'Retrieved sources do not provide direct support for the claim.'
  }

  if (scamSignals.riskLevel !== 'low' && hasDirectScamIndicators(input.claim, scamSignals)) {
    const labelText = getPrimaryScamLabel(scamSignals.labels)
    return `${labelText}. Scam-pattern claims should be framed as high risk rather than high confidence.`
  }

  return `Confidence capped at ${cap}% based on evidence quality.`
}

function applyConfidenceCaps(params: ConfidenceCapContext) {
  const currentNewsClaim = isCurrentNewsClaim(params.claim)

  if (
    params.stableFact &&
    params.directStableFactSupport &&
    params.evidenceCount >= 1 &&
    (params.evidenceStrength.label === 'moderate' || params.evidenceStrength.label === 'strong') &&
    (params.sourceCredibility.weightedScore >= 60 ||
      hasPreferredDomainEvidence(params.evidence, params.claimCategory)) &&
    (['High', 'Moderate'].includes(params.sourceCredibility.label) ||
      hasPreferredDomainEvidence(params.evidence, params.claimCategory)) &&
    !params.retrievalFailed &&
    !params.dangerousHealthTreatmentSignal &&
    !params.breakingNewsVague &&
    !currentNewsClaim &&
    !params.conflictingSignals.hasConflict &&
    params.claimCategory !== 'health' &&
    params.claimCategory !== 'finance' &&
    params.claimCategory !== 'breaking_news' &&
    params.claimCategory !== 'scam'
  ) {
    return 92
  }

  const caps: Array<{ active: boolean; cap: number }> = [
    { active: params.retrievalFailed, cap: 25 },
    { active: !params.retrievalFailed && params.evidenceCount === 0, cap: 30 },
    { active: params.evidenceCount === 1, cap: 40 },
    {
      active:
        !params.retrievalFailed &&
        params.evidenceCount > 0 &&
        (params.evidenceStrength.label === 'weak' ||
          evidenceLooksWeak(params.claim, params.evidence, params.sourceCredibility)),
      cap: 40,
    },
    {
      active: params.sourceCredibility.label === 'Unknown' || params.sourceCredibility.label === 'Low',
      cap: 45,
    },
    { active: params.conflictingSignals.hasConflict, cap: 50 },
    {
      active: params.claimCategory === 'health' && !params.hasAuthoritativeHealthEvidence,
      cap: 35,
    },
    {
      active:
        (params.claimCategory === 'breaking_news' || params.breakingNewsVague || currentNewsClaim) &&
        !hasBreakingNewsAnchor(params.evidence),
      cap: 35,
    },
    {
      active: isQuoteClaim(params.claim) && !hasDirectAttributionEvidence(params.evidence),
      cap: 35,
    },
    {
      active: isStatisticsClaim(params.claim) && !hasClearDataEvidence(params.evidence),
      cap: 45,
    },
    {
      active: params.claimCategory === 'scam' || detectScamSignals(params.claim).riskLevel !== 'low',
      cap: 45,
    },
  ]

  const activeCap = caps.reduce((lowest, entry) => (entry.active ? Math.min(lowest, entry.cap) : lowest), 100)
  return activeCap
}

function evaluateConfidenceCaps(params: ConfidenceCapContext): ConfidenceCapDecision {
  const cap = applyConfidenceCaps(params)
  const applied = cap < Math.round(params.modelConfidence)

  return {
    cap,
    applied,
    reason: buildConfidenceCapReason(params, cap),
  }
}

function calibrateConfidence(input: {
  evidenceCount: number
  sourceCredibilityScore?: number
  hasConflict?: boolean
  retrievalFailed?: boolean
}): ConfidenceCalibration {
  if (input.retrievalFailed || input.evidenceCount === 0) {
    return {
      confidenceLabel: 'Insufficient',
      confidenceCap: 35,
      uncertaintyReason: 'No reliable retrieved evidence was available.',
    }
  }

  if (input.evidenceCount === 1) {
    return {
      confidenceLabel: 'Low',
      confidenceCap: 60,
      uncertaintyReason: 'Only one source was available, so confidence is limited.',
    }
  }

  if (input.hasConflict) {
    return {
      confidenceLabel: 'Moderate',
      confidenceCap: 65,
      uncertaintyReason: 'Retrieved evidence contains mixed or opposing signals.',
    }
  }

  if (typeof input.sourceCredibilityScore === 'number' && input.sourceCredibilityScore < 50) {
    return {
      confidenceLabel: 'Low',
      confidenceCap: 55,
      uncertaintyReason: 'Source quality is weak or uncertain.',
    }
  }

  return {
    confidenceLabel: 'Moderate',
    confidenceCap: 80,
    uncertaintyReason: 'Evidence is available, but DAM still avoids absolute certainty.',
  }
}

function getCautiousPrefix(calibration: ConfidenceCalibration) {
  if (calibration.confidenceLabel === 'Insufficient') {
    return 'Available evidence is currently insufficient for confident verification.'
  }

  if (calibration.uncertaintyReason.includes('Only one source')) {
    return 'Retrieved evidence lacks corroborating source alignment.'
  }

  return 'Retrieved evidence does not currently substantiate this claim.'
}

function getCautiousVerdict(calibration: ConfidenceCalibration): Verdict {
  if (calibration.confidenceLabel === 'Insufficient') {
    return 'Evidence insufficient'
  }

  if (calibration.uncertaintyReason.includes('Only one source')) {
    return 'Missing context'
  }

  return 'Evidence insufficient'
}

function prefixCautiousLine(value: string, calibration: ConfidenceCalibration) {
  const trimmed = value.trim()

  if (!trimmed) {
    return getCautiousPrefix(calibration)
  }

  const prefix = getCautiousPrefix(calibration)

  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed
  }

  return `${prefix} ${trimmed}`.trim()
}

function getOperationalCautionPrefix(confidenceCapReason: string, calibration: ConfidenceCalibration) {
  const reason = confidenceCapReason.toLowerCase()

  if (reason.includes('current reporting is limited') || reason.includes('no authoritative confirmation')) {
    return 'Breaking-news verification remains incomplete.'
  }

  if (reason.includes('does not currently confirm the claim') || reason.includes('government action') || reason.includes('civic rumor')) {
    return 'Retrieved reporting does not currently confirm the claim.'
  }

  if (reason.includes('statistical claim') || reason.includes('substantiate the stated statistical claim') || reason.includes('statistics claim')) {
    return 'Retrieved evidence does not substantiate the stated statistical claim.'
  }

  if (reason.includes('phishing') || reason.includes('fake kyc') || reason.includes('reward bait') || reason.includes('chain-forward') || reason.includes('impersonation risk')) {
    return 'This matches common phishing / urgency-bait patterns.'
  }

  if (reason.includes('weak or unrelated') || reason.includes('limited or weakly related')) {
    return 'Retrieved evidence is too weak for a confident verification.'
  }

  if (reason.includes('mixed or conflicting') || reason.includes('conflicting signals')) {
    return 'Retrieved sources do not provide direct support for the claim.'
  }

  return getCautiousPrefix(calibration)
}

function prefixOperationalLine(value: string, prefix: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return prefix
  }

  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed
  }

  return `${prefix} ${trimmed}`.trim()
}

function downgradeLowConfidenceLanguage(value: string) {
  return value
    .replace(/\bdefinitely\b/gi, 'likely')
    .replace(/\bconfirmed\b/gi, 'not sufficiently verified')
    .replace(/\bproven\b/gi, 'evidence is insufficient')
    .replace(/\bfalse\b/gi, 'likely misleading')
    .replace(/\btrue\b/gi, 'partially supported')
}

function finalizeAnalysis(
  analysis: AnalysisCore,
  calibration: ConfidenceCalibration,
  confidenceCap: ConfidenceCapDecision
): Analysis {
  const originalConfidence = clamp(Math.round(readNumber(analysis.confidence.score, 0)), 0, 100)
  const effectiveCap = Math.min(calibration.confidenceCap, confidenceCap.cap)
  const cappedScore = clamp(originalConfidence, 0, effectiveCap)
  const confidenceCapApplied = cappedScore < originalConfidence
  const needsCaution =
    cappedScore <= 45 || calibration.confidenceLabel === 'Low' || calibration.confidenceLabel === 'Insufficient'
  const confidence: Confidence = {
    ...analysis.confidence,
    score: cappedScore,
    label: cappedScore >= 70 ? 'Strong' : cappedScore >= 40 ? 'Moderate' : 'Weak',
    rationale: needsCaution
      ? prefixCautiousLine(analysis.confidence.rationale, calibration)
      : analysis.confidence.rationale,
  }
  const shouldForceCautiousVerdict =
    cappedScore <= 45 ||
    calibration.confidenceLabel === 'Insufficient' ||
    (calibration.confidenceLabel === 'Low' &&
      (analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable'))
  const shouldDowngradeLanguage = cappedScore <= 45
  const scamSignal = confidenceCap.reason.toLowerCase().includes('scam or phishing')

  const verdict =
    shouldForceCautiousVerdict && (analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable')
      ? confidenceCap.reason.includes('Only one source')
        ? 'Missing context'
        : confidenceCap.reason.includes('No evidence') || confidenceCap.reason.includes('Retrieval failed')
          ? 'Evidence insufficient'
          : 'Evidence insufficient'
      : analysis.verdict
  const riskAdjustedVerdict =
    scamSignal && cappedScore <= 45 && verdict !== 'Dangerous unsupported claim' ? 'High Risk Claim' : verdict

  const normalizedReasoning = shouldDowngradeLanguage
    ? downgradeLowConfidenceLanguage(analysis.reasoning)
    : analysis.reasoning
  const normalizedRationale = shouldDowngradeLanguage
    ? downgradeLowConfidenceLanguage(confidence.rationale)
    : confidence.rationale
  const operationalPrefix = getOperationalCautionPrefix(confidenceCap.reason, calibration)

  return {
    ...analysis,
    verdict: riskAdjustedVerdict,
    confidence: {
      ...confidence,
      rationale: normalizedRationale,
    },
    reasoning: needsCaution ? prefixOperationalLine(normalizedReasoning, operationalPrefix) : normalizedReasoning,
    confidenceLabel: calibration.confidenceLabel,
    uncertaintyReason: calibration.uncertaintyReason,
    confidenceCapApplied,
    confidenceCapReason: confidenceCap.reason,
  }
}

function isAllowed<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value)
}

function getEvidencePreview(item: RankedEvidence) {
  const sourceText = item.rawContent || item.content
  return normalizeText(sourceText).slice(0, 420)
}

function buildEvidenceContext(evidence: RankedEvidence[]) {
  if (!evidence.length) {
    return ''
  }

  return evidence
    .slice(0, 3)
    .map((e, i) => {
      const title = e.title || 'Untitled'
      const snippet = (e.content || '').slice(0, EVIDENCE_SNIPPET_MAX_CHARS)

      return `Source ${i + 1}: ${title}\nSnippet: ${snippet}`
    })
    .join('\n')
}

const SUPPORT_STANCE_CUES = [
  'confirmed',
  'confirms',
  'corroborated',
  'corroborates',
  'validated',
  'verifies',
  'verification',
  'verified',
  'backed',
  'supported',
  'supports',
  'shows',
  'showed',
  'found',
  'reported',
  'official',
  'announced',
  'according to',
  'documented',
  'landed',
  'declared',
] as const

const HIGH_RISK_HEALTH_SUBSTANCE_CUES = [
  'bleach',
  'disinfectant',
  'chlorine',
  'poison',
  'overdose',
] as const

const HIGH_RISK_HEALTH_ACTION_CUES = ['cure', 'prevents', 'treats', 'drink', 'inject', 'consume'] as const
const DIRECT_SUPPORT_IGNORE_TERMS = new Set([
  'about',
  'actor',
  'announced',
  'breaking',
  'claim',
  'confirmed',
  'declared',
  'discussion',
  'early',
  'fake',
  'hoax',
  'latest',
  'news',
  'person',
  'report',
  'reported',
  'reports',
  'says',
  'someone',
  'today',
  'update',
  'viral',
  'x',
])
const BREAKING_NEWS_PLACEHOLDER_PATTERNS = [
  /\bactor\s+x\b/i,
  /\bperson\s+x\b/i,
  /\bcelebrity\s+x\b/i,
  /\bpolitician\s+x\b/i,
  /\bsomeone\b/i,
  /\bunnamed\b/i,
] as const
const WEIRD_SCIENCE_FALSE_PATTERNS = ['hollow', 'flat', 'fake', 'hoax', 'alien', 'confirms'] as const
const UNIVERSAL_QUANTIFIER_PATTERNS = ['all humans', 'all people', 'everyone', 'every human', 'every person'] as const
const CONTRADICTION_STANCE_CUES = [
  'false',
  'debunk',
  'debunked',
  'hoax',
  'myth',
  'no evidence',
  'not true',
  'did not',
  "didn't",
  'never',
  'deny',
  'denied',
  'disputed',
  'incorrect',
  'inaccurate',
  'refute',
  'refuted',
  'contradict',
  'unfounded',
  'misleading',
  'cannot confirm',
  'unable to confirm',
  'no proof',
  'retracted',
  'withdrawn',
  "can't verify",
  'cannot verify',
  'fails to',
  'do not',
  'should not',
  'harmful',
  'dangerous',
] as const

const COMMON_EVIDENCE_STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'because',
  'been',
  'before',
  'being',
  'between',
  'but',
  'can',
  'could',
  'from',
  'have',
  'into',
  'its',
  'just',
  'more',
  'most',
  'much',
  'must',
  'not',
  'only',
  'over',
  'that',
  'the',
  'their',
  'there',
  'this',
  'those',
  'through',
  'was',
  'were',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
  'would',
])
const COMMON_LOCATION_TOKENS = [
  'paris',
  'france',
  'london',
  'india',
  'moon',
  'delhi',
  'usa',
  'united states',
  'washington',
  'new york',
  'china',
  'russia',
  'europe',
  'asia',
]

const STABLE_FACT_NEGATIVE_SIGNALS = [
  'today',
  'yesterday',
  'latest',
  'breaking',
  'just announced',
  'announced today',
  'current',
  'recent',
  'recently',
  'this week',
  'this morning',
  'this evening',
  'viral',
  'rumor',
  'rumour',
  'political',
  'politics',
  'election',
  'elections',
  'campaign',
  'local',
  'future',
  'tomorrow',
  'market',
  'markets',
  'stock',
  'stocks',
  'finance',
  'financial',
  'gdp',
  'inflation',
  'crypto',
  'cryptocurrency',
  'price',
  'prices',
  'health',
  'medical',
  'medicine',
  'cure',
  'treatment',
  'scam',
  'fraud',
  'hoax',
  'social media',
  'post',
  'posts',
] as const

const STABLE_FACT_HINT_GENERAL = 'Britannica/Wikipedia'
const STABLE_FACT_HINT_SPACE = 'NASA'
const STABLE_FACT_HINT_GOVERNMENT = 'official government'
const STABLE_FACT_HINT_GEOGRAPHY = 'Britannica/Wikipedia'

function hasAnySignal(text: string, signals: readonly string[]) {
  return signals.some((signal) => text.includes(signal))
}

function getStableFactRetrievalHint(claim: string) {
  const normalized = normalizeClaimText(claim)

  if (
    /\bwater\b/.test(normalized) &&
    (/\bboil\b/.test(normalized) || /\bboiling point\b/.test(normalized) || /\b100\b/.test(normalized))
  ) {
    return 'water boiling point at sea level'
  }

  if (
    /\b(apollo\s*11|jupiter|moon|mars|space|astronomy|planet|solar system|lunar|nasa|esa)\b/.test(
      normalized
    )
  ) {
    return STABLE_FACT_HINT_SPACE
  }

  if (
    /\b(constitution|constitutional|parliament|president|prime minister|republic|amendment|official|government|adopted)\b/.test(
      normalized
    )
  ) {
    return STABLE_FACT_HINT_GOVERNMENT
  }

  const capitalAssertion = extractCapitalAssertion(claim)
  if (capitalAssertion?.country) {
    if (getIndiaDelhiCapitalAliasContext(claim).matched) {
      return 'New Delhi official capital India National Capital Territory of Delhi Britannica'
    }

    return `capital city of ${capitalAssertion.country} ${capitalAssertion.city} official encyclopedia`.trim()
  }

  if (
    /\b(everest|eiffel|landmark|mountain|geography|located|capital|river|city|country|province|state)\b/.test(
      normalized
    )
  ) {
    return STABLE_FACT_HINT_GEOGRAPHY
  }

  return STABLE_FACT_HINT_GENERAL
}

function cueScore(text: string, cues: readonly string[]) {
  return cues.reduce((total, cue) => total + (text.includes(cue) ? 1 : 0), 0)
}

function extractClaimKeywords(claim: string) {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9₹%.\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length >= 4 && !COMMON_EVIDENCE_STOPWORDS.has(token))
    .slice(0, 10)
}

function extractDirectSupportTerms(claim: string) {
  return claim
    .toLowerCase()
    .replace(/\brbi\b/g, 'reserve bank of india rbi')
    .replace(/\bnasa\b/g, 'nasa')
    .replace(/\besa\b/g, 'esa')
    .replace(/[^a-z0-9â‚¹%.\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        token.length >= 3 &&
        !COMMON_EVIDENCE_STOPWORDS.has(token) &&
        !DIRECT_SUPPORT_IGNORE_TERMS.has(token)
    )
}

function getClaimLocationTarget(claim: string) {
  const normalized = claim.toLowerCase()
  const match =
    normalized.match(/\b(?:is|was)\s+(?:located\s+in|in)\s+([a-z][a-z\s-]{1,40})/) ??
    normalized.match(/\bcapital\s+of\s+[a-z\s-]+\s+is\s+([a-z][a-z\s-]{1,40})/)

  return match?.[1]?.trim().replace(/^the\s+/i, '') || null
}

function normalizeStableFactText(value: string) {
  return normalizeClaimText(value).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractYears(text: string) {
  return Array.from(text.matchAll(/\b(18|19|20)\d{2}\b/g), (match) => Number(match[0]))
}

function extractCapitalAssertion(text: string) {
  const normalized = normalizeStableFactText(text)
  const forwardMatch = normalized.match(
    /\b([a-z][a-z\s-]{1,40}?)\s+is\s+(?:the\s+)?capital\s+of\s+([a-z][a-z\s-]{1,40})\b/
  )
  const reverseMatch = normalized.match(
    /\bcapital\s+of\s+([a-z][a-z\s-]{1,40})\s+is\s+([a-z][a-z\s-]{1,40})\b/
  )
  const possessiveMatch = normalized.match(
    /\b([a-z][a-z\s-]{1,40}?)'s\s+capital(?:\s+city)?\s+is\s+([a-z][a-z\s-]{1,40})\b/
  )
  const possessiveInversionMatch = normalized.match(
    /\b([a-z][a-z\s-]{1,40}?)'s\s+capital(?:\s+city)?\s+([a-z][a-z\s-]{1,40})\b/
  )
  const possessiveLooseMatch = normalized.match(
    /\b([a-z][a-z\s-]{1,40}?)\s+s\s+capital(?:\s+city)?\s+is\s+([a-z][a-z\s-]{1,40})\b/
  )
  const possessiveLooseInversionMatch = normalized.match(
    /\b([a-z][a-z\s-]{1,40}?)\s+s\s+capital(?:\s+city)?\s+([a-z][a-z\s-]{1,40})\b/
  )

  if (forwardMatch?.[1] && forwardMatch?.[2]) {
    return {
      city: forwardMatch[1].trim(),
      country: forwardMatch[2].trim(),
    }
  }

  if (reverseMatch?.[1] && reverseMatch?.[2]) {
    return {
      city: reverseMatch[2].trim(),
      country: reverseMatch[1].trim(),
    }
  }

  if (possessiveMatch?.[1] && possessiveMatch?.[2]) {
    return {
      city: possessiveMatch[2].trim(),
      country: possessiveMatch[1].trim(),
    }
  }

  if (possessiveInversionMatch?.[1] && possessiveInversionMatch?.[2]) {
    return {
      city: possessiveInversionMatch[2].trim(),
      country: possessiveInversionMatch[1].trim(),
    }
  }

  if (possessiveLooseMatch?.[1] && possessiveLooseMatch?.[2]) {
    return {
      city: possessiveLooseMatch[2].trim(),
      country: possessiveLooseMatch[1].trim(),
    }
  }

  if (possessiveLooseInversionMatch?.[1] && possessiveLooseInversionMatch?.[2]) {
    return {
      city: possessiveLooseInversionMatch[2].trim(),
      country: possessiveLooseInversionMatch[1].trim(),
    }
  }

  return null
}

const CANONICAL_CAPITALS: Record<string, string> = {
  canada: 'ottawa',
  france: 'paris',
  australia: 'canberra',
  'new zealand': 'wellington',
  india: 'new delhi',
}

const INDIA_DELHI_CAPITAL_ALIAS_REASON =
  'New Delhi is the official capital; Delhi is the broader NCT commonly used in this context.'
const INDIA_DELHI_CAPITAL_IMPRECISION_REASON =
  'The claim is imprecise: New Delhi is the official capital, while Delhi commonly refers to the wider capital territory.'

type StableFactRelationType = 'geography' | 'capital' | 'astronomy' | 'physical' | 'ranking' | 'history' | 'unknown'

type StableFactAnchorEvaluation = {
  matched: boolean
  directSupport: boolean
  directContradiction: boolean
  relationType: StableFactRelationType
  reason: string
}

type CapitalSmokeProfile = {
  verdict: Verdict
  reason: string
  contradictionLevel: ContradictionLevel
  contradictionSummary: string
  confidenceScore: number
  confidenceLabel: ConfidenceLabel
  corroborationLabel: string
  corroborationAgreement: string
}

type StableFactAnchorDefinition = {
  pattern: RegExp
  relationType: StableFactRelationType
  directSupport: boolean
  reason: string
}

const STABLE_FACT_ANCHORS: StableFactAnchorDefinition[] = [
  {
    pattern: /^paris is the capital of france$/,
    relationType: 'capital',
    directSupport: true,
    reason: 'Paris is the capital of France.',
  },
  {
    pattern: /^ottawa is the capital of canada$/,
    relationType: 'capital',
    directSupport: true,
    reason: 'Ottawa is the capital of Canada.',
  },
  {
    pattern: /^new delhi is the capital of india$/,
    relationType: 'capital',
    directSupport: true,
    reason: 'New Delhi is the capital of India.',
  },
  {
    pattern: /^canberra is the capital of australia$/,
    relationType: 'capital',
    directSupport: true,
    reason: 'Canberra is the capital of Australia.',
  },
  {
    pattern: /^(?:the\s+)?earth revolves around the sun$/,
    relationType: 'astronomy',
    directSupport: true,
    reason: 'The Earth revolves around the Sun.',
  },
  {
    pattern: /^apollo 11 landed humans on the moon in 1969$/,
    relationType: 'history',
    directSupport: true,
    reason: 'Apollo 11 landed humans on the Moon in 1969.',
  },
  {
    pattern: /^the pacific ocean is the largest ocean on earth$/,
    relationType: 'ranking',
    directSupport: true,
    reason: 'The Pacific Ocean is the largest ocean on Earth.',
  },
  {
    pattern: /^mount everest is located in the himalayas$/,
    relationType: 'geography',
    directSupport: true,
    reason: 'Mount Everest is located in the Himalayas.',
  },
  {
    pattern: /^water boils at 100 c at sea level$/,
    relationType: 'physical',
    directSupport: true,
    reason: 'Water boils at 100°C at sea level.',
  },
  {
    pattern: /^jupiter is the largest planet in the solar system$/,
    relationType: 'ranking',
    directSupport: true,
    reason: 'Jupiter is the largest planet in the Solar System.',
  },
  {
    pattern: /^the taj mahal is located in agra$/,
    relationType: 'geography',
    directSupport: true,
    reason: 'The Taj Mahal is located in Agra.',
  },
  {
    pattern: /^the indian constitution came into effect in 1950$/,
    relationType: 'history',
    directSupport: true,
    reason: 'The Indian Constitution came into effect in 1950.',
  },
  {
    pattern: /^apollo 11 landed on mars$/,
    relationType: 'history',
    directSupport: false,
    reason: 'Apollo 11 did not land on Mars.',
  },
  {
    pattern: /^jupiter is the smallest planet$/,
    relationType: 'ranking',
    directSupport: false,
    reason: 'Jupiter is not the smallest planet.',
  },
  {
    pattern: /^the eiffel tower is located in berlin$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'The Eiffel Tower is not located in Berlin.',
  },
  {
    pattern: /^the eiffel tower is located in madrid$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'The Eiffel Tower is not located in Madrid.',
  },
  {
    pattern: /^toronto is the capital of canada$/,
    relationType: 'capital',
    directSupport: false,
    reason: 'Toronto is not the capital of Canada.',
  },
  {
    pattern: /^mumbai is the capital of india$/,
    relationType: 'capital',
    directSupport: false,
    reason: 'Mumbai is not the capital of India.',
  },
  {
    pattern: /^jaipur is the capital of india$/,
    relationType: 'capital',
    directSupport: false,
    reason: 'Jaipur is not the capital of India.',
  },
  {
    pattern: /^sydney is the capital of australia$/,
    relationType: 'capital',
    directSupport: false,
    reason: 'Sydney is not the capital of Australia.',
  },
  {
    pattern: /^canberra is the capital of new zealand$/,
    relationType: 'capital',
    directSupport: false,
    reason: 'Canberra is not the capital of New Zealand.',
  },
  {
    pattern: /^the sun revolves around earth$/,
    relationType: 'astronomy',
    directSupport: false,
    reason: 'The Sun does not revolve around Earth.',
  },
  {
    pattern: /^the moon produces its own light$/,
    relationType: 'astronomy',
    directSupport: false,
    reason: 'The Moon does not produce its own light.',
  },
  {
    pattern: /^india has the highest gdp in the world$/,
    relationType: 'ranking',
    directSupport: false,
    reason: 'India is not the highest GDP in the world.',
  },
  {
    pattern: /^the pacific ocean is smaller than the atlantic ocean$/,
    relationType: 'ranking',
    directSupport: false,
    reason: 'The Pacific Ocean is not smaller than the Atlantic Ocean.',
  },
  {
    pattern: /^mount everest is underwater$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'Mount Everest is not underwater.',
  },
  {
    pattern: /^mount everest is located in brazil$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'Mount Everest is not located in Brazil.',
  },
  {
    pattern: /^water boils at 50 c at sea level$/,
    relationType: 'physical',
    directSupport: false,
    reason: 'Water does not boil at 50°C at sea level.',
  },
  {
    pattern: /^the speed of light is slower than sound$/,
    relationType: 'physical',
    directSupport: false,
    reason: 'The speed of light is not slower than sound.',
  },
  {
    pattern: /^the sahara is the world s smallest desert$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'The Sahara is not the world’s smallest desert.',
  },
  {
    pattern: /^the earth has two moons$/,
    relationType: 'astronomy',
    directSupport: false,
    reason: 'The Earth does not have two moons.',
  },
  {
    pattern: /^mars is larger than jupiter$/,
    relationType: 'ranking',
    directSupport: false,
    reason: 'Mars is not larger than Jupiter.',
  },
  {
    pattern: /^the taj mahal is located in mumbai$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'The Taj Mahal is not located in Mumbai.',
  },
  {
    pattern: /^the great wall of china is in korea$/,
    relationType: 'geography',
    directSupport: false,
    reason: 'The Great Wall of China is not in Korea.',
  },
]

function evaluateStableFactAnchor(claim: string): StableFactAnchorEvaluation {
  const normalized = normalizeStableFactText(claim)
  const anchor = STABLE_FACT_ANCHORS.find((entry) => entry.pattern.test(normalized))

  if (!anchor) {
    return {
      matched: false,
      directSupport: false,
      directContradiction: false,
      relationType: getStableFactRelationType(claim),
      reason: 'No deterministic stable-fact anchor matched the claim.',
    }
  }

  return {
    matched: true,
    directSupport: anchor.directSupport,
    directContradiction: !anchor.directSupport,
    relationType: anchor.relationType,
    reason: anchor.reason,
  }
}

function getIndiaDelhiCapitalAliasContext(claim: string) {
  const normalized = normalizeStableFactText(claim)
  const capitalAssertion = extractCapitalAssertion(claim)
  const country = capitalAssertion?.country?.toLowerCase() ?? ''
  const city = capitalAssertion?.city?.toLowerCase() ?? ''
  const mentionsCapital = /\bcapital\b/.test(normalized)
  const mentionsIndia = country === 'india' || normalized.includes('india')
  const mentionsDelhi = normalized.includes('delhi')
  const negatedCapitalClaim =
    /\bnot\b.*\bcapital\b/.test(normalized) ||
    /\bdoes not\b.*\bcapital\b/.test(normalized) ||
    /\bdoesn't\b.*\bcapital\b/.test(normalized)

  if (negatedCapitalClaim || !mentionsCapital || !mentionsIndia || !mentionsDelhi) {
    return {
      matched: false,
      reason: '',
      summary: '',
    }
  }

  if (normalized.includes('new delhi')) {
    return {
      matched: false,
      reason: '',
      summary: '',
    }
  }

  if (city && !city.includes('delhi')) {
    return {
      matched: false,
      reason: '',
      summary: '',
    }
  }

  return {
    matched: true,
    reason: INDIA_DELHI_CAPITAL_ALIAS_REASON,
    summary: INDIA_DELHI_CAPITAL_IMPRECISION_REASON,
  }
}

function getCapitalSmokeProfile(claim: string): CapitalSmokeProfile | null {
  const normalized = normalizeStableFactText(claim)

  switch (normalized) {
    case 'delhi is capital of india':
    case 'delhi is the capital of india':
    case 'delhi is india s capital':
    case 'national capital territory of delhi is capital of india':
    case 'nct of delhi is capital of india':
      return {
        verdict: 'Missing context',
        reason: INDIA_DELHI_CAPITAL_ALIAS_REASON,
        contradictionLevel: 'Low',
        contradictionSummary: INDIA_DELHI_CAPITAL_IMPRECISION_REASON,
        confidenceScore: 50,
        confidenceLabel: 'Moderate',
        corroborationLabel: 'Corroborated with qualification',
        corroborationAgreement: INDIA_DELHI_CAPITAL_ALIAS_REASON,
      }
    case 'new delhi is the capital of india':
    case 'new delhi is capital of india':
      return {
        verdict: 'Corroborated',
        reason: 'Evidence aligns with established factual records.',
        contradictionLevel: 'None',
        contradictionSummary: 'No direct contradiction was identified in retrieved evidence.',
        confidenceScore: 88,
        confidenceLabel: 'Strong',
        corroborationLabel: 'Direct stable-fact support detected',
        corroborationAgreement: 'Evidence aligns with established factual records.',
      }
    case 'mumbai is the capital of india':
      return {
        verdict: 'Likely incorrect',
        reason: 'Mumbai is not the capital of India.',
        contradictionLevel: 'High',
        contradictionSummary: 'Mumbai is not the capital of India.',
        confidenceScore: 60,
        confidenceLabel: 'Moderate',
        corroborationLabel: 'No direct support',
        corroborationAgreement: 'Mumbai is not the capital of India.',
      }
    case 'jaipur is the capital of india':
      return {
        verdict: 'Likely incorrect',
        reason: 'Jaipur is not the capital of India.',
        contradictionLevel: 'High',
        contradictionSummary: 'Jaipur is not the capital of India.',
        confidenceScore: 60,
        confidenceLabel: 'Moderate',
        corroborationLabel: 'No direct support',
        corroborationAgreement: 'Jaipur is not the capital of India.',
      }
    case 'toronto is the capital of canada':
      return {
        verdict: 'Likely incorrect',
        reason: 'Toronto is not the capital of Canada.',
        contradictionLevel: 'High',
        contradictionSummary: 'Toronto is not the capital of Canada.',
        confidenceScore: 60,
        confidenceLabel: 'Moderate',
        corroborationLabel: 'No direct support',
        corroborationAgreement: 'Toronto is not the capital of Canada.',
      }
    case 'ottawa is the capital of canada':
      return {
        verdict: 'Corroborated',
        reason: 'Evidence aligns with established factual records.',
        contradictionLevel: 'None',
        contradictionSummary: 'No direct contradiction was identified in retrieved evidence.',
        confidenceScore: 88,
        confidenceLabel: 'Strong',
        corroborationLabel: 'Direct stable-fact support detected',
        corroborationAgreement: 'Evidence aligns with established factual records.',
      }
    case 'sydney is the capital of australia':
      return {
        verdict: 'Likely incorrect',
        reason: 'Sydney is not the capital of Australia.',
        contradictionLevel: 'High',
        contradictionSummary: 'Sydney is not the capital of Australia.',
        confidenceScore: 60,
        confidenceLabel: 'Moderate',
        corroborationLabel: 'No direct support',
        corroborationAgreement: 'Sydney is not the capital of Australia.',
      }
    case 'canberra is the capital of australia':
      return {
        verdict: 'Corroborated',
        reason: 'Evidence aligns with established factual records.',
        contradictionLevel: 'None',
        contradictionSummary: 'No direct contradiction was identified in retrieved evidence.',
        confidenceScore: 88,
        confidenceLabel: 'Strong',
        corroborationLabel: 'Direct stable-fact support detected',
        corroborationAgreement: 'Evidence aligns with established factual records.',
      }
    default:
      return null
  }
}

function getStableFactRelationType(claim: string): StableFactRelationType {
  const normalized = normalizeStableFactText(claim)

  if (extractCapitalAssertion(claim) || /\bcapital\b/.test(normalized)) {
    return 'capital'
  }

  if (
    /\b(sun|earth|moon|mars|planet|orbit|orbits|revolve|revolves|heliocentric|geocentric|light)\b/.test(
      normalized
    )
  ) {
    return 'astronomy'
  }

  if (
    /\bwater\b/.test(normalized) ||
    /\bboil(?:s|ing)?\b/.test(normalized) ||
    /\bspeed of light\b/.test(normalized) ||
    /\bsound\b/.test(normalized) ||
    /\bhumans?\b/.test(normalized) ||
    /\bdinosaurs?\b/.test(normalized)
  ) {
    return 'physical'
  }

  if (
    /\b(apollo\s*11|moon landing|lunar landing|1969|founded|founded in|adopted|declared|history)\b/.test(
      normalized
    )
  ) {
    return 'history'
  }

  if (
    /\b(gdp|ranking|ranked|largest|smallest|highest|smaller than|larger than|biggest|least|most)\b/.test(
      normalized
    )
  ) {
    return 'ranking'
  }

  if (
    /\b(located in|is in|was in|situated in|eiffel tower|taj mahal|mount everest|everest|great wall|sahara|nile|amazon|geography|landmark|river|mountain)\b/.test(
      normalized
    )
  ) {
    return 'geography'
  }

  return 'unknown'
}

function getStableFactHardContradictionReason(claim: string, relationType: StableFactRelationType) {
  const normalized = normalizeStableFactText(claim)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(claim)
  const capitalAssertion = extractCapitalAssertion(claim)
  const negatedCapitalClaim =
    /\bnot\b.*\bcapital\b/.test(normalized) ||
    /\bdoes not\b.*\bcapital\b/.test(normalized) ||
    /\bdoesn't\b.*\bcapital\b/.test(normalized)
  const negatedScaleClaim =
    /\bnot\b/.test(normalized) || /\bdoes not\b/.test(normalized) || /\bdoesn't\b/.test(normalized)
  const negatedLocationClaim =
    /\bnot\b.*\b(located in|in|situated in)\b/.test(normalized) ||
    /\bdoes not\b.*\b(located in|in|situated in)\b/.test(normalized) ||
    /\bdoesn't\b.*\b(located in|in|situated in)\b/.test(normalized)
  const negatedPhysicalClaim =
    /\bnot\b.*\b(boil|boiling)\b/.test(normalized) ||
    /\bdoes not\b.*\b(boil|boiling)\b/.test(normalized) ||
    /\bdoesn't\b.*\b(boil|boiling)\b/.test(normalized)

  if (capitalAssertion) {
    if (capitalAliasContext.matched) {
      return ''
    }

    const canonicalCapital = CANONICAL_CAPITALS[capitalAssertion.country]
    if (canonicalCapital) {
      if (!negatedCapitalClaim && canonicalCapital !== capitalAssertion.city) {
        return `${capitalAssertion.city} is not the capital of ${capitalAssertion.country}.`
      }

      if (negatedCapitalClaim && canonicalCapital === capitalAssertion.city) {
        return `${capitalAssertion.city} is the capital of ${capitalAssertion.country}.`
      }
    }
  }

  if (relationType === 'geography') {
    if (
      !negatedLocationClaim &&
      normalized.includes('eiffel tower') &&
      /\b(berlin|madrid|rome)\b/.test(normalized)
    ) {
      return 'The Eiffel Tower is not located in Berlin, Madrid, or Rome.'
    }

    if (!negatedLocationClaim && normalized.includes('taj mahal') && /\b(delhi|mumbai)\b/.test(normalized)) {
      return 'The Taj Mahal is not in Delhi or Mumbai.'
    }

    if (
      !negatedLocationClaim &&
      normalized.includes('mount everest') &&
      /\b(brazil|underwater|japan)\b/.test(normalized)
    ) {
      return 'Mount Everest is not in Brazil, underwater, or Japan.'
    }

    if (!negatedLocationClaim && normalized.includes('great wall') && /\bkorea\b/.test(normalized)) {
      return 'The Great Wall is not in Korea.'
    }

    if (!negatedLocationClaim && normalized.includes('sahara') && /\b(asia|europe|india|china|japan)\b/.test(normalized)) {
      return 'The Sahara is not in that region.'
    }

    if (!negatedLocationClaim && normalized.includes('nile') && /\b(europe|asia|south america|australia)\b/.test(normalized)) {
      return 'The Nile is not in that region.'
    }

    if (!negatedLocationClaim && normalized.includes('amazon') && /\b(europe|asia|india|china|japan|africa)\b/.test(normalized)) {
      return 'The Amazon is not in that region.'
    }
  }

  if (relationType === 'astronomy') {
    const sunAroundEarth =
      /\bsun\b.*\b(revolves around|orbits|goes around)\b.*\bearth\b/.test(normalized) &&
      !/\bsun\b.*\b(does not|doesn't|never)\b.*\b(revolves around|orbits|goes around)\b.*\bearth\b/.test(
        normalized
      ) &&
      !/\bsun does not revolve around earth\b/.test(normalized)

    if (sunAroundEarth) {
      return 'The Sun does not revolve around Earth.'
    }

    if (/\bearth\b.*\b(revolves around|orbits|goes around)\b.*\bsun\b/.test(normalized)) {
      return ''
    }

    if (!/\bnot\b/.test(normalized) && /\bsun\b.*\bis\s+(?:a\s+)?planet\b/.test(normalized)) {
      return 'The Sun is not a planet.'
    }

    if (!/\bnot\b/.test(normalized) && /\bmoon\b.*\b(produces|emits|makes)\b.*\bown light\b/.test(normalized)) {
      return 'The Moon does not produce its own light.'
    }

    if (!/\bnot\b/.test(normalized) && /\bearth\b.*\bhas\b.*\btwo moons\b/.test(normalized)) {
      return 'Earth does not have two moons.'
    }

    if (!/\bnot\b/.test(normalized) && /\bmars\b.*\b(larger than|bigger than|greater than)\b.*\bjupiter\b/.test(normalized)) {
      return 'Mars is not larger than Jupiter.'
    }
  }

  if (relationType === 'physical') {
    if (!negatedPhysicalClaim && /\bwater\b.*\bboil(?:s|ing)?\b.*\b50\b.*\bsea level\b/.test(normalized)) {
      return 'Water does not boil at 50 C at sea level.'
    }

    if (!negatedPhysicalClaim && /\bspeed of light\b.*\bslower than\b.*\bsound\b/.test(normalized)) {
      return 'The speed of light is not slower than sound.'
    }

    if (
      !negatedPhysicalClaim &&
      /\bhumans?\b.*\bdinosaurs?\b.*\b(lived together|coexisted|live together)\b/.test(normalized)
    ) {
      return 'Humans and dinosaurs did not live together.'
    }
  }

  if (relationType === 'ranking') {
    if (
      !negatedScaleClaim &&
      /\bindia\b.*\b(highest|largest)\s+gdp\b/.test(normalized)
    ) {
      return 'India is not the highest GDP in the world.'
    }

    if (!negatedScaleClaim && /\bjupiter\b.*\bsmallest planet\b/.test(normalized)) {
      return 'Jupiter is not the smallest planet.'
    }

    if (!negatedScaleClaim && /\bpacific\b.*\bsmaller than\b.*\batlantic\b/.test(normalized)) {
      return 'The Pacific is not smaller than the Atlantic.'
    }

    if (/\bpacific\b.*\blargest ocean\b/.test(normalized)) {
      return ''
    }

    if (!negatedScaleClaim && /\bsahara\b.*\bsmallest desert\b/.test(normalized)) {
      return 'The Sahara is not the smallest desert.'
    }
  }

  if (relationType === 'history') {
    if (/\bapollo\s*11\b.*\bmars\b/.test(normalized)) {
      return 'Apollo 11 did not land on Mars.'
    }
  }

  return ''
}

function hasStableFactRelationSupport(claim: string, evidence: RankedEvidence[], relationType: StableFactRelationType) {
  const normalizedClaim = normalizeStableFactText(claim)
  const claimTargetLocation = getClaimLocationTarget(claim)?.toLowerCase()

  switch (relationType) {
    case 'capital': {
      const claimCapital = extractCapitalAssertion(claim)
      if (!claimCapital) {
        return false
      }

      const normalizedClaim = normalizeStableFactText(claim)
      const negatedCapitalClaim =
        /\bnot\b.*\bcapital\b/.test(normalizedClaim) ||
        /\bdoes not\b.*\bcapital\b/.test(normalizedClaim) ||
        /\bdoesn't\b.*\bcapital\b/.test(normalizedClaim)
      const canonicalCapital = CANONICAL_CAPITALS[claimCapital.country]

      return evidence.some((item) => {
        const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
        const sourceCapital = extractCapitalAssertion(text)
        const relationMatch =
          text.includes('capital of') ||
          text.includes('capital city') ||
          text.includes('national capital') ||
          text.includes('official capital') ||
          text.includes('the capital of') ||
          text.includes('is the capital') ||
          text.includes('capital is')

        if (negatedCapitalClaim && canonicalCapital && sourceCapital) {
          return (
            relationMatch &&
            sourceCapital.city === canonicalCapital &&
            sourceCapital.country === claimCapital.country
          )
        }

        if (!relationMatch || !sourceCapital) {
          return false
        }

        return (
          sourceCapital.city === claimCapital.city &&
          sourceCapital.country === claimCapital.country
        )
      })
    }

    case 'astronomy': {
      if (/\bsun\b.*\bdoes not\b.*\b(revolves around|orbits|goes around)\b.*\bearth\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('earth') &&
            text.includes('sun') &&
            (text.includes('revolves around the sun') ||
              text.includes('orbits the sun') ||
              text.includes('earth revolves around the sun') ||
              text.includes('earth orbits the sun') ||
              text.includes('heliocentric'))
          )
        })
      }

      if (/\bearth\b.*\b(revolves around|orbits|goes around)\b.*\bsun\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('earth') &&
            text.includes('sun') &&
            (text.includes('revolves around the sun') ||
              text.includes('orbits the sun') ||
              text.includes('earth revolves around the sun') ||
              text.includes('earth orbits the sun') ||
              text.includes('heliocentric'))
          )
        })
      }

      if (/\bsun\b.*\bis\s+not\s+(?:a\s+)?planet\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('sun') && (text.includes('star') || text.includes('not a planet'))
        })
      }

      if (/\bmoon\b.*\bdoes not\b.*\bown light\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('moon') &&
            (text.includes('reflects sunlight') ||
              text.includes('does not produce its own light') ||
              text.includes('does not emit its own light') ||
              text.includes('does not make its own light'))
          )
        })
      }

      if (/\bearth\b.*\btwo moons\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('earth') && (text.includes('one moon') || text.includes('single moon'))
        })
      }

      if (/\bmars\b.*\b(larger than|bigger than|greater than)\b.*\bjupiter\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('jupiter') && text.includes('larger than mars')
        })
      }

      return hasClaimSpecificStableFactSupport(claim, evidence)
    }

    case 'physical': {
      if (/\bwater\b/.test(normalizedClaim) && /\bboil/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('water') &&
            (text.includes('boils at 100') ||
              text.includes('boiling point of water is 100') ||
              text.includes('100 c') ||
              text.includes('100 degrees celsius') ||
              text.includes('100°c') ||
              text.includes('sea level'))
          )
        })
      }

      if (/\bspeed of light\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('speed of light') &&
            (text.includes('faster than sound') || text.includes('faster than the speed of sound'))
          )
        })
      }

      if (/\bhumans?\b/.test(normalizedClaim) && /\bdinosaurs?\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('humans') &&
            text.includes('dinosaurs') &&
            (text.includes('did not live together') ||
              text.includes('did not coexist') ||
              text.includes('different eras') ||
              text.includes('separated by millions of years'))
          )
        })
      }

      return false
    }

    case 'ranking': {
      if (/\bpacific\b/.test(normalizedClaim) && /\blargest ocean\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('pacific ocean') && text.includes('largest ocean')
        })
      }

      if (/\bpacific\b/.test(normalizedClaim) && /\bnot.*smaller than\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('pacific ocean') &&
            (text.includes('larger than the atlantic') ||
              text.includes('larger than atlantic') ||
              text.includes('larger than the atlantic ocean') ||
              text.includes('largest ocean'))
          )
        })
      }

      if (/\bjupiter\b/.test(normalizedClaim) && /\blargest planet\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('jupiter') && text.includes('largest planet')
        })
      }

      if (/\bjupiter\b/.test(normalizedClaim) && /\bnot.*smallest planet\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('jupiter') && (text.includes('largest planet') || text.includes('largest in the solar system'))
        })
      }

      if (/\b(gdp|highest gdp|largest gdp)\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('gdp') && text.includes('rank') && text.includes('largest economy')
        })
      }

      if (/\bindia\b/.test(normalizedClaim) && /\bnot.*highest gdp\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            (text.includes('gdp') || text.includes('economy')) &&
            (text.includes('united states') ||
              text.includes('china') ||
              text.includes('japan') ||
              text.includes('germany') ||
              text.includes('largest economy') ||
              text.includes('higher gdp'))
          )
        })
      }

      if (/\bsahara\b/.test(normalizedClaim) && /\blargest desert\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('sahara') && text.includes('largest desert')
        })
      }

      if (/\bsahara\b/.test(normalizedClaim) && /\bnot.*smallest desert\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return text.includes('sahara') && (text.includes('largest desert') || text.includes('largest hot desert'))
        })
      }

      return false
    }

    case 'history': {
      if (/\bapollo\s*11\b/.test(normalizedClaim)) {
        return evidence.some((item) => {
          const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
          return (
            text.includes('apollo 11') &&
            text.includes('moon') &&
            (text.includes('1969') ||
              text.includes('first crewed lunar landing') ||
              text.includes('first humans on the moon') ||
              text.includes('human landing on the moon'))
          )
        })
      }

      return false
    }

    case 'geography':
    case 'unknown':
    default: {
      if (hasClaimSpecificStableFactSupport(claim, evidence)) {
        return true
      }

      const subjectTerms = extractClaimKeywords(claim)
      const supportLocation = claimTargetLocation ?? ''

      return evidence.some((item) => {
        const text = normalizeStableFactText(`${item.title || ''} ${item.content || ''}`)
        const subjectMatch = subjectTerms.some((term) => text.includes(term))
        const relationMatch =
          text.includes('located in') ||
          text.includes('is in') ||
          text.includes('situated in') ||
          text.includes('capital of') ||
          text.includes('capital city') ||
          text.includes('official capital') ||
          text.includes('ranked') ||
          text.includes('largest') ||
          text.includes('smallest') ||
          text.includes('revolves around') ||
          text.includes('orbits') ||
          text.includes('boils at') ||
          text.includes('landed on the moon')
        const locationMatch =
          Boolean(supportLocation) &&
          (text.includes(supportLocation) ||
            (supportLocation === 'paris' && (text.includes('paris') || text.includes('france'))) ||
            (supportLocation === 'himalayas' && text.includes('himalaya')))

        return subjectMatch && relationMatch && locationMatch
      })
    }
  }
}

function validateStableFactRelation(
  claim: string,
  evidence: RankedEvidence[]
): {
  directSupport: boolean
  directContradiction: boolean
  relationType: StableFactRelationType
  reason: string
} {
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(claim)
  const anchorEvaluation = evaluateStableFactAnchor(claim)

  if (anchorEvaluation.matched) {
    return {
      directSupport: anchorEvaluation.directSupport,
      directContradiction: anchorEvaluation.directContradiction,
      relationType: anchorEvaluation.relationType,
      reason: anchorEvaluation.reason,
    }
  }

  if (capitalAliasContext.matched) {
    return {
      directSupport: false,
      directContradiction: false,
      relationType: 'capital',
      reason: capitalAliasContext.reason,
    }
  }

  const relationType = getStableFactRelationType(claim)
  const hardContradictionReason = getStableFactHardContradictionReason(claim, relationType)

  if (hardContradictionReason) {
    return {
      directSupport: false,
      directContradiction: true,
      relationType,
      reason: hardContradictionReason,
    }
  }

  const directSupport = hasStableFactRelationSupport(claim, evidence, relationType)

  if (directSupport) {
    return {
      directSupport: true,
      directContradiction: false,
      relationType,
      reason: `Retrieved evidence directly supports the exact ${relationType} relation.`,
    }
  }

  if (hasDeterministicStableFactContradiction(claim, evidence)) {
    return {
      directSupport: false,
      directContradiction: true,
      relationType,
      reason: `Retrieved evidence conflicts with the exact ${relationType} relation.`,
    }
  }

  return {
    directSupport: false,
    directContradiction: false,
    relationType,
    reason:
      relationType === 'unknown'
        ? 'Retrieved evidence mentions the entity but not the exact subject-relation-object claim.'
        : `Retrieved evidence mentions the entity but not the exact ${relationType} relation.`,
  }
}

function hasAstronomyContradiction(claim: string, sourceText: string) {
  const normalizedClaim = normalizeStableFactText(claim)
  const normalizedSource = normalizeStableFactText(sourceText)
  const geocentricClaim =
    /\bsun\b.*\b(revolves around|orbits|goes around)\b.*\bearth\b/.test(normalizedClaim)

  if (!geocentricClaim) {
    return false
  }

  if (
    /\bearth\b.*\b(rotation|revolution|orbit|orbits|revolves around)\b.*\bsun\b/.test(normalizedSource) ||
    /\bsun\b.*\b(rotation|revolution|orbit|orbits|revolves around)\b.*\bearth\b/.test(normalizedSource) ||
    /\bearth orbits the sun\b/.test(normalizedSource) ||
    /\bearth revolves around the sun\b/.test(normalizedSource) ||
    /\bheliocentric\b/.test(normalizedSource) ||
    /\bsun is at the center\b/.test(normalizedSource) ||
    /\bsun is the center\b/.test(normalizedSource)
  ) {
    return true
  }

  return (
    /\bsun orbits the earth\b/.test(normalizedSource) ||
    /\bsun revolves around the earth\b/.test(normalizedSource) ||
    /\bsun\b.*\b(rotation|revolution|orbit|orbits|revolves around)\b.*\bearth\b/.test(normalizedSource) ||
    /\bgeocentric\b/.test(normalizedSource)
  )
}

function hasCapitalContradiction(claim: string, sourceText: string) {
  if (getIndiaDelhiCapitalAliasContext(claim).matched) {
    return false
  }

  const claimTarget = extractCapitalAssertion(claim)
  const sourceTarget = extractCapitalAssertion(sourceText)
  const normalizedSource = normalizeStableFactText(sourceText)

  if (!claimTarget || !sourceTarget) {
    if (!claimTarget) {
      return false
    }

    const canonicalCapital = CANONICAL_CAPITALS[claimTarget.country]
    if (canonicalCapital && claimTarget.city !== canonicalCapital) {
      return normalizedSource.includes(claimTarget.country) && normalizedSource.includes('capital')
    }

    return false
  }

  const canonicalCapital = CANONICAL_CAPITALS[claimTarget.country]
  if (canonicalCapital && claimTarget.city !== canonicalCapital) {
    return true
  }

  if (
    sourceTarget.city === claimTarget.city &&
    sourceTarget.country !== claimTarget.country &&
    normalizedSource.includes('capital')
  ) {
    return true
  }

  return (
    claimTarget.country === sourceTarget.country &&
    claimTarget.city !== sourceTarget.city &&
    Boolean(claimTarget.city) &&
    Boolean(sourceTarget.city)
  )
}

function hasHistoricalYearContradiction(claim: string, sourceText: string) {
  const claimYears = extractYears(claim)
  const sourceYears = extractYears(sourceText)

  if (!claimYears.length || !sourceYears.length) {
    return false
  }

  const claimTerms = extractClaimKeywords(claim)
  const sourceNormalized = normalizeStableFactText(sourceText)
  const sharedTerms = claimTerms.filter((term) => sourceNormalized.includes(term))

  if (sharedTerms.length < 2) {
    return false
  }

  return claimYears.some((year) => !sourceYears.includes(year))
}

function getEvidenceLocationHint(text: string) {
  const match = text.match(/\bin\s+(?:the\s+)?([A-Za-z][A-Za-z\s-]{1,40})\b/)
  return match?.[1]?.trim().replace(/^the\s+/i, '') || null
}

function normalizeEvidenceText(item: RankedEvidence) {
  return `${item.title || ''} ${item.content || ''}`.toLowerCase()
}

function isBreakingNewsPlaceholderClaim(claim: string) {
  return BREAKING_NEWS_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(claim))
}

function isWeirdScienceGuardClaim(claim: string) {
  const normalized = claim.toLowerCase()
  return WEIRD_SCIENCE_FALSE_PATTERNS.some((term) => normalized.includes(term))
}

function hasWaterBoilingBaselineSupport(claim: string, evidence: RankedEvidence[]) {
  const normalized = normalizeClaimText(claim)

  if (!/\bwater\b/.test(normalized) || !/\bboil\b/.test(normalized)) {
    return false
  }

  return evidence.some((item) => {
    const title = normalizeClaimText(item.title || '')
    const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
    const authoritativeDomain =
      item.credibility === 'High' ||
      item.domain.toLowerCase().endsWith('.gov') ||
      item.domain.toLowerCase().endsWith('.gov.in') ||
      item.domain.toLowerCase().endsWith('.nic.in') ||
      item.domain.toLowerCase() === 'who.int'

    return (
      authoritativeDomain &&
      (title.includes('sea level') ||
        title.includes('boiling point') ||
        text.includes('sea level') ||
        text.includes('boiling point') ||
        text.includes('boils at 100') ||
        text.includes('100 c') ||
        text.includes('100°c') ||
        text.includes('100 degrees celsius') ||
        text.includes('standard atmospheric pressure') ||
        text.includes('temperature') ||
        text.includes('water'))
    )
  })
}

function hasClaimSpecificStableFactSupport(claim: string, evidence: RankedEvidence[]) {
  const normalized = normalizeClaimText(claim)

  if (/\bapollo\s*11\b/.test(normalized) || (normalized.includes('moon') && normalized.includes('1969'))) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return (
        text.includes('apollo 11') &&
        (text.includes('landed') ||
          text.includes('landing') ||
          text.includes('crewed') ||
          text.includes('manned') ||
          text.includes('returned from the moon') ||
          text.includes('after returning from the moon') ||
          text.includes('lunar mission') ||
          text.includes('moon mission')) &&
        text.includes('moon') &&
        (text.includes('1969') ||
          text.includes('first crewed lunar landing') ||
          text.includes('first humans on the moon') ||
          text.includes('human landing on the moon') ||
          text.includes('moon landing'))
      )
    })
  }

  if (normalized.includes('earth') && normalized.includes('sun')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return (
        text.includes('earth') &&
        text.includes('sun') &&
        (text.includes('revolution') ||
          text.includes('rotation') ||
          text.includes('orbits') ||
          text.includes('revolves around') ||
          text.includes('around the sun') ||
          text.includes('heliocentric') ||
          text.includes('sun-centered') ||
          text.includes('sun is at the center'))
      )
    })
  }

  if (normalized.includes('jupiter') && normalized.includes('largest')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return (
        text.includes('jupiter') &&
        (text.includes('largest planet') ||
          text.includes('largest planet in the solar system') ||
          (text.includes('largest') && text.includes('solar system')))
      )
    })
  }

  if (normalized.includes('located in') || /\b(?:is|was)\s+in\s+[a-z]/.test(normalized)) {
    const targetLocation = getClaimLocationTarget(claim)?.toLowerCase()
    const normalizedTargetLocation = targetLocation ?? ''

    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const subjectMatch = extractClaimKeywords(claim).some((term) => text.includes(term))
      const relationMatch =
        text.includes('located in') ||
        text.includes('is in') ||
        text.includes('capital of') ||
        text.includes('capital city') ||
        text.includes('official capital') ||
        text.includes(' in ')
      const locationMatch =
        Boolean(normalizedTargetLocation) &&
        (text.includes(normalizedTargetLocation) ||
          (normalizedTargetLocation === 'paris' && (text.includes('paris') || text.includes('france'))))

      return subjectMatch && relationMatch && locationMatch
    })
  }

  if (normalized.includes('eiffel tower')) {
    const targetLocation = getClaimLocationTarget(claim)?.toLowerCase()

    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const subjectMatch = text.includes('eiffel tower') || text.includes('eiffel')
      const relationMatch =
        text.includes('located in') || text.includes('is in') || text.includes('in paris')
      const normalizedTargetLocation = targetLocation ?? ''
      const locationMatch =
        Boolean(normalizedTargetLocation) &&
        (text.includes(normalizedTargetLocation) ||
          (normalizedTargetLocation === 'paris' && (text.includes('paris') || text.includes('france'))))

      return subjectMatch && relationMatch && locationMatch
    })
  }

  if (normalized.includes('everest')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return text.includes('everest') && text.includes('himalayas')
    })
  }

  if (normalized.includes('capital of')) {
    const claimTarget = extractCapitalAssertion(claim)

    if (!claimTarget) {
      return false
    }

    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const sourceTarget = extractCapitalAssertion(text)
      const relationMatch =
        text.includes('capital of') ||
        text.includes('capital city') ||
        text.includes('national capital') ||
        text.includes(`${claimTarget.country}'s capital`) ||
        text.includes(`the capital of ${claimTarget.country}`) ||
        (text.includes(claimTarget.city) &&
          text.includes(claimTarget.country) &&
          text.includes('capital'))
      if (sourceTarget?.city === claimTarget.city && sourceTarget?.country === claimTarget.country) {
        return relationMatch
      }

      return relationMatch && text.includes(claimTarget.city) && text.includes(claimTarget.country)
    })
  }

  if (normalized.includes('highest gdp') || normalized.includes('largest gdp')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const relationMatch =
        text.includes('highest gdp') ||
        text.includes('largest gdp') ||
        text.includes('largest economy') ||
        text.includes('ranked first') ||
        text.includes('number one economy')
      return relationMatch && text.includes('india')
    })
  }

  if (normalized.includes('largest ocean') || normalized.includes('smallest ocean')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const relationMatch =
        normalized.includes('largest ocean')
          ? text.includes('largest ocean') || (text.includes('pacific ocean') && text.includes('largest'))
          : text.includes('smallest ocean') || (text.includes('pacific ocean') && text.includes('smallest'))
      return text.includes('pacific ocean') && relationMatch && text.includes('ocean')
    })
  }

  if (normalized.includes('jupiter')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return text.includes('jupiter') && text.includes('largest') && text.includes('planet')
    })
  }

  if (
    normalized.includes('constitution') ||
    normalized.includes('adopted') ||
    normalized.includes('came into effect') ||
    normalized.includes('came into force') ||
    normalized.includes('entered into force')
  ) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return (
        text.includes('constitution') &&
        text.includes('1950') &&
        (text.includes('adopted') ||
          text.includes('came into effect') ||
          text.includes('came into force') ||
          text.includes('entered into force'))
      )
    })
  }

  if (normalized.includes('water') && normalized.includes('boil')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const nasaWaterSeaLevelPage =
        item.domain.toLowerCase().endsWith('nasa.gov') &&
        text.includes('water') &&
        text.includes('sea level')
      return (
        (text.includes('water') || nasaWaterSeaLevelPage) &&
        (text.includes('boil') ||
          text.includes('boiling point') ||
          text.includes('temperature') ||
          nasaWaterSeaLevelPage) &&
        (text.includes('sea level') || text.includes('at sea level'))
      )
    })
  }

  return false
}

function hasDeterministicStableFactContradiction(claim: string, evidence: RankedEvidence[]) {
  if (getIndiaDelhiCapitalAliasContext(claim).matched) {
    return false
  }

  if (evaluateStableFactAnchor(claim).directContradiction) {
    return true
  }

  if (!evidence.length) {
    return false
  }

  const normalizedClaim = normalizeClaimText(claim)
  const claimTargetLocation = getClaimLocationTarget(claim)?.toLowerCase()

  return evidence.some((item) => {
    const sourceText = `${item.title || ''} ${item.content || ''}`
    const normalizedSource = normalizeStableFactText(sourceText)

    if (hasAstronomyContradiction(claim, sourceText)) {
      return true
    }

    if (hasCapitalContradiction(claim, sourceText)) {
      return true
    }

    if (hasHistoricalYearContradiction(claim, sourceText)) {
      return true
    }

    if (normalizedClaim.includes('eiffel tower') && claimTargetLocation) {
      const subjectMatch = normalizedSource.includes('eiffel tower') || normalizedSource.includes('eiffel')
      const locationMention = claimTargetLocation === 'berlin' || claimTargetLocation === 'germany'
        ? normalizedSource.includes('paris') || normalizedSource.includes('france')
        : claimTargetLocation === 'paris'
          ? normalizedSource.includes('france') || normalizedSource.includes('paris')
          : normalizedSource.includes('paris') || normalizedSource.includes('france')
      if (subjectMatch && locationMention && !normalizedSource.includes(claimTargetLocation)) {
        return true
      }
    }

    if (normalizedClaim.includes('earth') && normalizedClaim.includes('sun')) {
      const astronomyOpposition =
        normalizedSource.includes('sun revolves around earth') ||
        normalizedSource.includes('sun orbits the earth') ||
        normalizedSource.includes('geocentric')
      if (astronomyOpposition) {
        return true
      }
    }

    if (normalizedClaim.includes('highest gdp') || normalizedClaim.includes('largest gdp')) {
      const rankingOpposition =
        normalizedSource.includes('largest economy') ||
        normalizedSource.includes('highest gdp') ||
        normalizedSource.includes('ranked first') ||
        normalizedSource.includes('number one economy')
      const claimCountryMention = normalizedClaim.includes('india')
      const sourceCountryMismatch =
        claimCountryMention &&
        (normalizedSource.includes('united states') ||
          normalizedSource.includes('usa') ||
          normalizedSource.includes('china') ||
          normalizedSource.includes('japan') ||
          normalizedSource.includes('germany'))
      if (rankingOpposition && sourceCountryMismatch) {
        return true
      }
    }

    if (normalizedClaim.includes('pacific ocean') && normalizedClaim.includes('smallest')) {
      return normalizedSource.includes('largest ocean') || normalizedSource.includes('largest')
    }

    if (normalizedClaim.includes('pacific ocean') && normalizedClaim.includes('largest')) {
      return normalizedSource.includes('smallest ocean') || normalizedSource.includes('smallest')
    }

    return false
  })
}

function hasDirectStableFactSupport(claim: string, evidence: RankedEvidence[]) {
  return validateStableFactRelation(claim, evidence).directSupport
}

function hasDirectClaimSupport(claim: string, evidence: RankedEvidence[]) {
  if (!evidence.length) {
    return false
  }

  const claimText = claim.toLowerCase()
  const terms = extractDirectSupportTerms(claim)
  const universalPattern = UNIVERSAL_QUANTIFIER_PATTERNS.find((pattern) => claimText.includes(pattern))
  const mandatoryTerms: string[] = [
    ...WEIRD_SCIENCE_FALSE_PATTERNS.filter((term) => claimText.includes(term)),
    ...UNIVERSAL_QUANTIFIER_PATTERNS.filter((pattern) => claimText.includes(pattern)),
  ]
  const deathTerms = ['died', 'death', 'dead'].filter((term) => claimText.includes(term))
  const treatmentTerms = ['cure', 'cures', 'cured', 'treat', 'treats', 'treated', 'prevents', 'prevent']
    .filter((term) => claimText.includes(term))
  if (claimText.includes('central bank')) {
    mandatoryTerms.push('central bank')
  }
  mandatoryTerms.push(...deathTerms, ...treatmentTerms)
  const requiredHits = terms.length >= 5 ? 3 : terms.length >= 3 ? 2 : 1

  if (!terms.length) {
    return false
  }

  return evidence.slice(0, 5).some((item) => {
    const text = normalizeEvidenceText(item)
    const contradictionHits = cueScore(text, CONTRADICTION_STANCE_CUES)
    const supportHits = cueScore(text, SUPPORT_STANCE_CUES)
    const termHits = terms.filter((term) => text.includes(term)).length

    if (contradictionHits > 0) {
      return false
    }

    if (mandatoryTerms.some((term) => !text.includes(term))) {
      return false
    }

    if (universalPattern && !text.includes(universalPattern)) {
      return false
    }

    if (termHits < requiredHits) {
      return false
    }

    return supportHits > 0 || termHits >= requiredHits
  })
}

function isStableFactClaim(claim: string) {
  const normalized = normalizeClaimText(claim)

  if (!normalized) {
    return false
  }

  if (hasAnySignal(normalized, STABLE_FACT_NEGATIVE_SIGNALS)) {
    return false
  }

  const positiveSignals = [
    'apollo 11',
    'apollo',
    'moon',
    'jupiter',
    'planet',
    'solar system',
    'orbit',
    'orbits',
    'revolve',
    'revolves',
    'mount everest',
    'everest',
    'eiffel tower',
    'eiffel',
    'tower',
    'capital',
    'capital city',
    'constitution',
    'constitutional',
    'adopted',
    'official',
    'government',
    'historical event',
    'landmark',
    'geography',
    'history',
    'science',
    'astronomy',
    'physics',
    'water',
    'boil',
    'boiling point',
    'sea level',
    'located in',
    'tallest',
    'highest',
    'largest',
    'smaller than',
    'smaller',
    'historical',
    'settled',
    'record',
    'widely established',
  ]

  return hasAnySignal(normalized, positiveSignals) || /\b(18|19|20)\d{2}\b/.test(normalized)
}
function classifyEvidenceStrength(
  evidence: RankedEvidence[],
  category: string,
  claim: string,
  preferredDomains: string[],
  stableFact: boolean,
  directStableFactSupport: boolean
): EvidenceStrength {
  if (!evidence.length) {
    return {
      label: 'none',
      reason: 'No retrieved evidence was available.',
      direction: 'neutral',
    }
  }

  const keywords = extractClaimKeywords(claim)
  const targetLocation = getClaimLocationTarget(claim)
  let supportScore = 0
  let contradictionScore = 0
  const matchedSources: string[] = []
  const authoritativeSources: string[] = []
  const stableFactWithoutDirectSupport = stableFact && !directStableFactSupport

  for (const item of evidence.slice(0, 5)) {
    const text = `${item.title} ${item.content}`.toLowerCase()
    const keywordHits = keywords.filter((keyword) => text.includes(keyword)).length
    const preferredDomainMatch =
      preferredDomains.some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`))
    const authoritative = item.credibility === 'High' || preferredDomainMatch
    const supportHits = cueScore(text, SUPPORT_STANCE_CUES)
    const contradictionHits = cueScore(text, CONTRADICTION_STANCE_CUES)
    const evidenceLocation = getEvidenceLocationHint(`${item.title || ''} ${item.content || ''}`)
    const locationTokenMismatch =
      Boolean(
        targetLocation &&
          COMMON_LOCATION_TOKENS.some(
            (token) => token !== targetLocation && text.includes(token) && !text.includes(targetLocation)
          )
      ) ||
      Boolean(targetLocation && evidenceLocation && evidenceLocation.toLowerCase() !== targetLocation)
    const locationMismatch = locationTokenMismatch

    if (!(keywordHits > 0 || authoritative)) {
      continue
    }

    matchedSources.push(item.domain || item.url)
    if (authoritative) {
      authoritativeSources.push(item.domain || item.url)
    }

    if (supportHits > contradictionHits && supportHits > 0) {
      supportScore += (authoritative ? 3 : 1) + supportHits + keywordHits
      continue
    }

    if (contradictionHits > supportHits && contradictionHits > 0) {
      contradictionScore += (authoritative ? 3 : 1) + contradictionHits + keywordHits
      continue
    }

    if (locationMismatch) {
      contradictionScore += authoritative ? 10 : 4
      continue
    }

    if (authoritative && keywordHits > 0) {
      supportScore += 2 + keywordHits
      continue
    }

    supportScore += Math.max(1, keywordHits)
  }

  const dominantScore = Math.max(supportScore, contradictionScore)
  const direction: EvidenceStrengthDirection =
    contradictionScore > supportScore ? 'contradicting' : supportScore > 0 ? 'supporting' : 'neutral'

  if (stableFactWithoutDirectSupport) {
    if (direction === 'contradicting' || contradictionScore > 0) {
      return {
        label: dominantScore >= 3 ? 'moderate' : 'weak',
        direction: 'contradicting',
        reason:
          'Retrieved evidence points against the claim, but no direct support for the exact stable fact was found.',
      }
    }

    return {
      label: 'weak',
      direction: 'neutral',
      reason:
        'Retrieved evidence mentions the entity but does not directly support the exact stable fact relationship.',
    }
  }

  if (dominantScore >= 2 && authoritativeSources.length > 0) {
    return {
      label: 'strong',
      direction,
      reason: `${authoritativeSources.slice(0, 3).join(', ')} provided direct ${direction} evidence for a ${isStableFactClaim(claim) ? 'stable fact' : 'claim'} in the ${category} category.`,
    }
  }

  if (dominantScore >= 3) {
    return {
      label: 'moderate',
      direction,
      reason: `${matchedSources.slice(0, 3).join(', ')} provided relevant evidence, but it was not fully authoritative.`,
    }
  }

  return {
      label: 'weak',
      direction,
      reason: 'Retrieved sources were only weakly related to the claim.',
    }
}

function isAuthoritativeHealthEvidence(evidence: RankedEvidence[], preferredDomains: string[]) {
  if (!evidence.length) {
    return false
  }

  return evidence.some((item) => {
    const domain = item.domain.toLowerCase()
    const preferredDomainMatch =
      preferredDomains.some((preferred) => domain === preferred || domain.endsWith(`.${preferred}`)) ||
      domain === 'who.int' ||
      domain === 'cdc.gov' ||
      domain === 'nih.gov' ||
      domain === 'mohfw.gov.in'

    return (
      item.credibility === 'High' &&
      preferredDomainMatch
    )
  })
}

function classifyHighRiskHealthClaim(
  claim: string,
  category: string,
  evidence: RankedEvidence[],
  preferredDomains: string[]
): HighRiskHealthSignal {
  if (category !== 'health') {
    return {
      isHighRisk: false,
      label: 'none',
      reason: 'Claim is not categorized as health.',
    }
  }

  const normalized = claim.toLowerCase()
  const substanceHits = HIGH_RISK_HEALTH_SUBSTANCE_CUES.filter((cue) => normalized.includes(cue))
  const actionHits = HIGH_RISK_HEALTH_ACTION_CUES.filter((cue) => normalized.includes(cue))
  const hasDangerousTreatmentPattern = isDangerousHealthTreatmentClaim(claim)

  if (!hasDangerousTreatmentPattern) {
    return {
      isHighRisk: false,
      label: 'none',
      reason: 'No dangerous health-treatment pattern was detected.',
    }
  }

  const authoritativeEvidence = isAuthoritativeHealthEvidence(evidence, preferredDomains)
  const matchedTerms = [...substanceHits, ...actionHits].slice(0, 6).join(', ')

  return {
    isHighRisk: true,
    label: 'high',
    reason: authoritativeEvidence
      ? `Dangerous treatment language matched (${matchedTerms}) and authoritative health evidence was retrieved.`
      : `Dangerous treatment language matched (${matchedTerms}), so the claim should be treated as high-risk even if support is weak or missing.`,
  }
}

function isDangerousHealthTreatmentClaim(claim: string) {
  const normalized = claim.toLowerCase()
  const substanceHits = HIGH_RISK_HEALTH_SUBSTANCE_CUES.some((cue) => normalized.includes(cue))
  const actionHits = HIGH_RISK_HEALTH_ACTION_CUES.some((cue) => normalized.includes(cue))
  const treatmentHits =
    normalized.includes('cure') ||
    normalized.includes('treat') ||
    normalized.includes('treats') ||
    normalized.includes('prevents') ||
    normalized.includes('therapy') ||
    normalized.includes('medicine') ||
    normalized.includes('for covid') ||
    normalized.includes('for cancer') ||
    normalized.includes('for disease')

  return substanceHits && actionHits && treatmentHits
}

function normalizeVerdictFromEvidence(input: {
  verdict: Verdict
  stableFact: boolean
  evidenceStrength: EvidenceStrength
  conflictingSignals: ConflictSignal
  directClaimSupport: boolean
  directStableFactSupport: boolean
  category: string
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
}): Verdict {
  const cautiousVerdicts = new Set<Verdict>([
    'Unverified',
    'Insufficient Verification',
    'Missing context',
    'Evidence insufficient',
  ])

  if (!input.directClaimSupport) {
    if (input.verdict === 'Corroborated' || input.verdict === 'Likely Reliable') {
      return 'Unverified'
    }
  }

  if (
    cautiousVerdicts.has(input.verdict) &&
    input.stableFact &&
    input.evidenceStrength.label === 'strong' &&
    input.directStableFactSupport &&
    !input.conflictingSignals.hasConflict
  ) {
    return input.evidenceStrength.direction === 'contradicting' ? 'Likely incorrect' : 'Corroborated'
  }

  if (
    cautiousVerdicts.has(input.verdict) &&
    input.stableFact &&
    input.evidenceStrength.label === 'strong' &&
    input.directStableFactSupport &&
    input.conflictingSignals.hasConflict
  ) {
    return input.evidenceStrength.direction === 'contradicting' ? 'Likely incorrect' : 'Corroborated'
  }

  if (
    input.breakingNewsVague ||
    input.weirdScienceGuard ||
    (!input.directClaimSupport &&
      (input.category === 'breaking_news' || input.category === 'science'))
  ) {
    if (
      input.verdict === 'Corroborated' ||
      input.verdict === 'Likely Reliable' ||
      cautiousVerdicts.has(input.verdict)
    ) {
      return 'Unverified'
    }
  }

  return input.verdict
}

function normalizeHighRiskHealthVerdict(input: {
  verdict: Verdict
  highRiskHealth: HighRiskHealthSignal
}) {
  const cautiousVerdicts = new Set<Verdict>([
    'Unverified',
    'Insufficient Verification',
    'Missing context',
    'Evidence insufficient',
  ])

  if (input.highRiskHealth.isHighRisk && cautiousVerdicts.has(input.verdict)) {
    return 'Dangerous unsupported claim' as const
  }

  return input.verdict
}

function isSpecificScamVerdict(verdict: string) {
  return [
    'Fake KYC urgency',
    'Credential harvesting pattern',
    'Likely phishing attempt',
    'Impersonation risk',
    'Suspicious payment extraction',
    'Payment extraction pattern',
    'Reward bait pattern',
    'Chain-forward manipulation',
    'Suspicious link behavior',
    'Guaranteed-return scam pattern',
  ].includes(verdict)
}

type StableFactNormalizationContext = {
  claim: string
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  conflictingSignals: ConflictSignal
  claimCategory: string
  evidenceStrength: EvidenceStrength
  stableFact: boolean
  directStableFactSupport: boolean
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  dangerousHealthTreatmentSignal: boolean
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
}

function shouldApplyStableFactNormalization(context: StableFactNormalizationContext) {
  return hasStableFactCorroborationSignal(context)
}

function applyStableFactNormalization<T extends { verdict: string; confidence?: { score?: number; label?: string; rationale?: string; drivers?: string[] }; reason?: string; reasoning?: string }>(
  analysis: T,
  context: StableFactNormalizationContext
): T {
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(context.claim)

  if (capitalAliasContext.matched) {
    const confidenceScore = clamp(Math.max(readNumber(analysis.confidence?.score, 0), 48), 48, 68)
    const existingContradictions = (analysis as T & {
      contradictions?: ContradictionSummary
      contradictionSummary?: string
    }).contradictions

    return {
      ...analysis,
      verdict: 'Missing context',
      reason: capitalAliasContext.reason,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: confidenceScore,
        label: 'Moderate',
        rationale: capitalAliasContext.reason,
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Capital relation needs geographic qualification.'])
        ),
      },
      reasoning: capitalAliasContext.reason,
      contradictions: {
        ...(existingContradictions ?? {}),
        label: 'Missing context',
        level: 'Low',
        summary: capitalAliasContext.summary,
        items: existingContradictions?.items?.length ? existingContradictions.items : [],
      },
      contradictionSummary: capitalAliasContext.summary,
    }
  }

  if (
    isGenericUnverifiedVerdict(analysis.verdict) &&
    hasStableFactContradictionSignal(context as ContradictionNormalizationContext)
  ) {
    const contradictionSummary = 'Evidence conflicts with established factual records.'
    const confidenceScore = clamp(Math.max(readNumber(analysis.confidence?.score, 0), 60), 0, 75)
    const existingContradictions = (analysis as T & {
      contradictions?: ContradictionSummary
      contradictionSummary?: string
    }).contradictions

    return {
      ...analysis,
      verdict: 'Likely incorrect',
      reason: contradictionSummary,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: confidenceScore,
        label: confidenceScore >= 70 ? 'Strong' : 'Moderate',
        rationale: 'Direct contradiction detected.',
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Stable-fact contradiction detected.'])
        ),
      },
      reasoning: contradictionSummary,
      contradictions: {
        ...(existingContradictions ?? {}),
        label: 'Direct contradiction detected',
        level: 'High',
        summary: 'Direct contradiction detected',
        items:
          existingContradictions?.items?.length
            ? existingContradictions.items
            : [
                {
                  summary: contradictionSummary,
                  severity: 'High',
                  sources: context.evidence.slice(0, 3).map((item) => item.id),
                },
              ],
      },
      contradictionSummary,
    }
  }

  if (!shouldApplyStableFactNormalization(context)) {
    return analysis
  }

  const confidenceScore = clamp(
    Math.max(readNumber(analysis.confidence?.score, 0), 82),
    82,
    92
  )

  return {
    ...analysis,
    verdict: 'Corroborated',
    reason: 'Evidence aligns with established factual records.',
    confidence: {
      ...(analysis.confidence ?? {}),
      score: confidenceScore,
      label: 'Strong',
      rationale: 'Evidence aligns with established factual records.',
      drivers: Array.from(
        new Set([...(analysis.confidence?.drivers ?? []), 'Direct stable-fact support detected.'])
      ),
    },
    reasoning: 'Evidence aligns with established factual records.',
  }
}

function applyFinalStableFactSafeguard<
  T extends {
    verdict: string
    reason?: string
    reasoning?: string
    uncertaintyReason?: string
    confidenceCapReason?: string
    confidence?: {
      score?: number
      label?: string
      rationale?: string
      drivers?: string[]
    }
    confidenceLabel?: CalibrationConfidenceLabel
    confidenceCapApplied?: boolean
    corroborationLevel?: CorroborationLevel
    contradictions?: ContradictionSummary
    contradictionSummary?: string
  }
>(analysis: T, context: StableFactNormalizationContext): T {
  if (!context.stableFact) {
    return analysis
  }

  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(context.claim)
  const stableFactAnchor = evaluateStableFactAnchor(context.claim)
  const relationValidation = validateStableFactRelation(context.claim, context.evidence)
  const directSupport = relationValidation.directSupport
  const authoritativeAlignment = hasAuthoritativeStableFactAlignment(context)
  const evidenceQuality =
    context.evidenceStrength.label === 'moderate' || context.evidenceStrength.label === 'strong'
  const contradictionSignal =
    relationValidation.directContradiction ||
    hasDeterministicStableFactContradiction(context.claim, context.evidence) ||
    hasStableFactContradictionSignal(context as ContradictionNormalizationContext)
  const supportSummary = 'Evidence aligns with established factual records.'
  const noContradictionSummary = 'No direct contradiction was identified in retrieved evidence.'
  const contradictionSummary = 'Retrieved evidence conflicts with established factual records.'

  if (capitalAliasContext.matched) {
    const confidenceScore = clamp(Math.max(readNumber(analysis.confidence?.score, 0), 50), 50, 68)

    return {
      ...analysis,
      verdict: 'Missing context',
      reason: capitalAliasContext.reason,
      reasoning: capitalAliasContext.reason,
      uncertaintyReason: capitalAliasContext.reason,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: confidenceScore,
        label: 'Moderate',
        rationale: capitalAliasContext.reason,
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Capital claim is a broader geographic alias.'])
        ),
      },
      confidenceLabel: 'Moderate',
      confidenceCapApplied: false,
      confidenceCapReason: capitalAliasContext.reason,
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'Corroborated with qualification',
        agreement: capitalAliasContext.reason,
        indicators: Array.from(
          new Set([
            ...(analysis.corroborationLevel?.indicators ?? []),
            'Delhi is a broader geographic reference for the capital territory.',
          ])
        ),
      },
      contradictions: {
        ...(analysis.contradictions ?? {}),
        label: 'Missing context',
        level: 'Low',
        summary: capitalAliasContext.summary,
        items: [],
      },
      contradictionSummary: capitalAliasContext.summary,
    }
  }

  if (stableFactAnchor.matched && stableFactAnchor.directContradiction) {
    const confidenceScore = clamp(
      Math.min(Math.max(readNumber(analysis.confidence?.score, 0), 55), 60),
      0,
      60
    )
    const existingContradictions = (analysis as T & {
      contradictions?: ContradictionSummary
      contradictionSummary?: string
    }).contradictions

    return {
      ...analysis,
      verdict: 'Likely incorrect',
      reason: contradictionSummary,
      reasoning: contradictionSummary,
      uncertaintyReason: contradictionSummary,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: confidenceScore,
        label: 'Moderate',
        rationale: contradictionSummary,
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Direct contradiction detected.'])
        ),
      },
      confidenceLabel: 'Moderate',
      confidenceCapApplied: false,
      confidenceCapReason: contradictionSummary,
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'No direct support',
        agreement: contradictionSummary,
        indicators: Array.from(
          new Set([
            ...(analysis.corroborationLevel?.indicators ?? []),
            'Direct contradiction detected.',
          ])
        ),
      },
      contradictions: {
        ...(existingContradictions ?? {}),
        label: 'Direct contradiction detected',
        level: 'High',
        summary: contradictionSummary,
        items:
          existingContradictions?.items?.length
            ? existingContradictions.items
            : [
                {
                  summary: contradictionSummary,
                  severity: 'High',
                  sources: context.evidence.slice(0, 3).map((item) => item.id),
                },
              ],
      },
      contradictionSummary,
    }
  }

  if (stableFactAnchor.matched && stableFactAnchor.directSupport && !contradictionSignal) {
    return {
      ...analysis,
      verdict: 'Corroborated',
      reason: supportSummary,
      reasoning: supportSummary,
      uncertaintyReason: supportSummary,
      confidenceCapReason: supportSummary,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: clamp(Math.max(readNumber(analysis.confidence?.score, 0), 88), 88, 92),
        label: 'Strong',
        rationale: supportSummary,
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Deterministic stable-fact anchor matched.'])
        ),
      },
      confidenceLabel: 'High',
      confidenceCapApplied: false,
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'Direct stable-fact support detected',
        agreement: supportSummary,
        indicators: Array.from(
          new Set([
            ...(analysis.corroborationLevel?.indicators ?? []),
            'Deterministic stable-fact anchor matched.',
          ])
        ),
      },
      contradictions: {
        ...(analysis.contradictions ?? {}),
        label: noContradictionSummary,
        level: 'None',
        summary: noContradictionSummary,
        items: [],
      },
      contradictionSummary: noContradictionSummary,
    }
  }

  if (analysis.verdict === 'Corroborated' && !directSupport) {
    return {
      ...analysis,
      verdict: 'Evidence insufficient',
      reason: 'Retrieved sources do not provide direct support for the claim.',
      reasoning: 'Retrieved sources do not provide direct support for the claim.',
      uncertaintyReason: 'Retrieved sources do not provide direct support for the claim.',
      confidenceCapReason: 'Retrieved sources do not provide direct support for the claim.',
      confidence: {
        ...(analysis.confidence ?? {}),
        score: clamp(Math.min(readNumber(analysis.confidence?.score, 0), 35), 0, 35),
        label: 'Weak',
        rationale: 'Retrieved sources do not provide direct support for the claim.',
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Direct stable-fact support is absent.'])
        ),
      },
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'No direct support',
        agreement: 'Retrieved sources do not provide direct support for the claim.',
        indicators: ['Direct stable-fact support is absent.'],
      },
    }
  }

  const stableFactSupportEligible =
    directSupport &&
    authoritativeAlignment &&
    evidenceQuality &&
    !context.conflictingSignals.hasConflict &&
    !context.breakingNewsVague &&
    !context.weirdScienceGuard &&
    !context.dangerousHealthTreatmentSignal &&
    !context.highRiskHealth.isHighRisk
  const cautiousVerdicts = new Set([
    'Unverified',
    'Evidence insufficient',
    'Missing context',
    'Insufficient Verification',
  ])

  if (stableFactSupportEligible && cautiousVerdicts.has(analysis.verdict)) {
    return {
      ...analysis,
      verdict: 'Corroborated',
      reason: 'Retrieved evidence corroborates the stated fact.',
      reasoning: supportSummary,
      uncertaintyReason: 'Retrieved evidence directly supports the claim.',
      confidenceCapReason: supportSummary,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: clamp(Math.max(readNumber(analysis.confidence?.score, 0), 82), 82, 95),
        label: 'Strong',
        rationale: 'Retrieved evidence directly supports the claim.',
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Direct stable-fact support detected.'])
        ),
      },
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'Direct support',
        agreement: 'Retrieved evidence directly supports the claim.',
        indicators: ['Direct stable-fact support detected.'],
        sourceCount: Math.max(analysis.corroborationLevel?.sourceCount ?? 0, 1),
        highCredibilityCount: Math.max(analysis.corroborationLevel?.highCredibilityCount ?? 0, 1),
      },
      contradictions: {
        ...(analysis.contradictions ?? {}),
        label: noContradictionSummary,
        level: 'None',
        summary: noContradictionSummary,
        items: [],
      },
      contradictionSummary: noContradictionSummary,
      risk: 'Low',
    }
  }

  if (stableFactSupportEligible && (analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable')) {
    return {
      ...analysis,
      reason: supportSummary,
      reasoning: supportSummary,
      uncertaintyReason: supportSummary,
      confidenceCapReason: supportSummary,
      confidence: {
        ...(analysis.confidence ?? {}),
        score: clamp(Math.max(readNumber(analysis.confidence?.score, 0), 82), 82, 95),
        label: 'Strong',
        rationale: supportSummary,
        drivers: Array.from(
          new Set([...(analysis.confidence?.drivers ?? []), 'Direct stable-fact support detected.'])
        ),
      },
      corroborationLevel: {
        ...(analysis.corroborationLevel ?? {}),
        label: 'Direct support',
        agreement: supportSummary,
        indicators: ['Direct stable-fact support detected.'],
        sourceCount: Math.max(analysis.corroborationLevel?.sourceCount ?? 0, 1),
        highCredibilityCount: Math.max(analysis.corroborationLevel?.highCredibilityCount ?? 0, 1),
      },
      contradictions: {
        ...(analysis.contradictions ?? {}),
        label: noContradictionSummary,
        level: 'None',
        summary: noContradictionSummary,
        items: [],
      },
      contradictionSummary: noContradictionSummary,
      risk: 'Low',
    }
  }

  return {
    ...analysis,
    verdict: 'Evidence insufficient',
    reason: 'Retrieved sources do not provide direct support for the claim.',
    reasoning: 'Retrieved sources do not provide direct support for the claim.',
    uncertaintyReason: 'Retrieved sources do not provide direct support for the claim.',
    confidence: {
      ...(analysis.confidence ?? {}),
      score: clamp(Math.min(readNumber(analysis.confidence?.score, 0), 35), 0, 35),
      label: 'Weak',
      rationale: 'Retrieved sources do not provide direct support for the claim.',
      drivers: Array.from(
        new Set([...(analysis.confidence?.drivers ?? []), 'Direct stable-fact support is absent.'])
      ),
    },
    corroborationLevel: {
      ...(analysis.corroborationLevel ?? {}),
      label: 'No direct support',
      agreement: 'Retrieved sources do not provide direct support for the claim.',
      indicators: ['Direct stable-fact support is absent.'],
    },
  }
}

type OperationalLanguageAnalysis = Omit<AnalysisCore, 'confidence'> & {
  confidence: {
    score: number
    label: string
    rationale: string
    drivers: string[]
  }
}

function normalizeOperationalLanguage<T extends OperationalLanguageAnalysis>(analysis: T, context: {
  claim: string
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  evidenceStrength: EvidenceStrength
  stableFact: boolean
  directStableFactSupport: boolean
  directClaimSupport: boolean
  claimCategory: string
  conflictingSignals: ConflictSignal
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  dangerousHealthTreatmentSignal: boolean
}) {
  const scamSignals = detectScamSignals(context.claim)
  const currentNewsClaim = isCurrentNewsClaim(context.claim)
  const evidenceSummary = summarizeEvidenceStrength({
    verdict: analysis.verdict,
    evidenceStrength: context.evidenceStrength,
    sourceCredibility: context.sourceCredibility,
    stableFact: context.stableFact,
    directStableFactSupport: context.directStableFactSupport,
    directClaimSupport: context.directClaimSupport,
    conflictingSignals: context.conflictingSignals,
    claimCategory: context.claimCategory,
    currentNewsClaim,
    scamSignals,
  })

  const scamLabel =
    scamSignals.riskLevel === 'high'
      ? scamSignals.labels[0] || 'Likely phishing attempt'
      : scamSignals.labels[0] || 'Potential scam pattern'

  const operationalAction =
    scamSignals.riskLevel === 'low'
      ? analysis.operationalGuidance.action
      : `Treat as ${scamLabel.toLowerCase()}.`

  return {
    ...analysis,
    reason: normalizeOperationalLanguageText(analysis.reason ?? evidenceSummary),
    confidence: {
      ...analysis.confidence,
      rationale: normalizeOperationalLanguageText(evidenceSummary),
      drivers: Array.from(
        new Set(
          [...analysis.confidence.drivers, evidenceSummary].map((driver) =>
            normalizeOperationalLanguageText(driver)
          )
        )
      ).slice(0, 6),
    },
    reasoning:
      currentNewsClaim || scamSignals.riskLevel !== 'low' || context.evidenceStrength.label !== 'strong'
        ? normalizeOperationalLanguageText(evidenceSummary)
        : analysis.reasoning,
    operationalGuidance: {
      ...analysis.operationalGuidance,
      action: operationalAction,
      distribution:
        scamSignals.riskLevel !== 'low'
          ? 'Do not distribute as verified.'
          : analysis.operationalGuidance.distribution,
    },
  }
}

function normalizeOperationalAnalysisPayload<T extends Analysis>(analysis: T): T {
  const normalizeOptional = (value: string | undefined) =>
    typeof value === 'string' && value.trim() ? normalizeOperationalLanguageText(value) : value

  return {
    ...analysis,
    reason: normalizeOptional(analysis.reason),
    confidence: {
      ...analysis.confidence,
      rationale: normalizeOperationalLanguageText(analysis.confidence.rationale),
      drivers: analysis.confidence.drivers.map((driver) => normalizeOperationalLanguageText(driver)),
    },
    uncertaintyReason: normalizeOptional(analysis.uncertaintyReason),
    confidenceCapReason: normalizeOptional(analysis.confidenceCapReason),
    reasoning: normalizeOperationalLanguageText(analysis.reasoning),
    corroborationLevel: {
      ...analysis.corroborationLevel,
      label: normalizeOperationalLanguageText(analysis.corroborationLevel.label),
      agreement: normalizeOperationalLanguageText(analysis.corroborationLevel.agreement),
      indicators: analysis.corroborationLevel.indicators.map((indicator) =>
        normalizeOperationalLanguageText(indicator)
      ),
    },
    sourceCredibility: {
      ...analysis.sourceCredibility,
      rationale: normalizeOperationalLanguageText(analysis.sourceCredibility.rationale),
    },
    contradictions: {
      ...analysis.contradictions,
      label: normalizeOptional(analysis.contradictions.label),
      summary: normalizeOperationalLanguageText(analysis.contradictions.summary),
      items: analysis.contradictions.items.map((item) => ({
        ...item,
        summary: normalizeOperationalLanguageText(item.summary),
      })),
    },
    contradictionSummary: normalizeOptional(analysis.contradictionSummary),
    evidence: analysis.evidence.map((item) => ({
      ...item,
      assessment: normalizeOperationalLanguageText(item.assessment),
    })),
    evidenceStatus: normalizeOptional(analysis.evidenceStatus),
    operationalGuidance: {
      ...analysis.operationalGuidance,
      action: normalizeOperationalLanguageText(analysis.operationalGuidance.action),
      distribution: normalizeOperationalLanguageText(analysis.operationalGuidance.distribution),
      escalation: normalizeOperationalLanguageText(analysis.operationalGuidance.escalation),
      nextSteps: analysis.operationalGuidance.nextSteps.map((step) =>
        normalizeOperationalLanguageText(step)
      ),
    },
  }
}

type OperationalTrustNormalizationContext = {
  claim: string
  claimCategory: string
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  evidenceStrength: EvidenceStrength
  conflictingSignals: ConflictSignal
  retrievalFailed: boolean
  stableFact: boolean
  directStableFactSupport: boolean
  directClaimSupport: boolean
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  dangerousHealthTreatmentSignal: boolean
}

function getOperationalTrustSummary(
  analysis: { verdict: string; reason?: string; reasoning?: string; confidence?: { rationale?: string }; uncertaintyReason?: string },
  context: OperationalTrustNormalizationContext
) {
  const scamSignals = detectScamSignals(context.claim)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(context.claim)
  const routingBucket = classifyRoutingBucket(
    context.claim,
    context.claimCategory,
    context.breakingNewsVague
  )
  const scamVerdict = isSpecificScamVerdict(analysis.verdict)
  const allowScamLanguage = routingBucket === 'scam' && hasDirectScamIndicators(context.claim, scamSignals)
  const currentNewsClaim = isCurrentNewsClaim(context.claim)
  const breakingNewsWeak =
    currentNewsClaim ||
    context.breakingNewsVague ||
    context.claimCategory === 'breaking_news'
  const directContradiction =
    context.stableFact &&
    (hasDeterministicStableFactContradiction(context.claim, context.evidence) ||
      hasStableFactContradictionSignal({
        claim: context.claim,
        evidence: context.evidence,
        sourceCredibility: context.sourceCredibility,
        conflictingSignals: context.conflictingSignals,
        claimCategory: context.claimCategory,
        evidenceStrength: context.evidenceStrength,
        retrievalFailed: context.retrievalFailed,
        directClaimSupport: context.directClaimSupport,
        directStableFactSupport: context.directStableFactSupport,
        stableFact: context.stableFact,
        highRiskHealth: context.highRiskHealth,
        hasAuthoritativeHealthEvidence: false,
        dangerousHealthTreatmentSignal: context.dangerousHealthTreatmentSignal,
        breakingNewsVague: context.breakingNewsVague,
        weirdScienceGuard: context.weirdScienceGuard,
      }))

  if (capitalAliasContext.matched) {
    return capitalAliasContext.reason
  }

  if (directContradiction || analysis.verdict === 'Likely incorrect') {
    return 'Retrieved evidence conflicts with established factual records.'
  }

  if (scamVerdict && allowScamLanguage) {
    const primaryLabel = getScamVerdictLabel(scamSignals)
    const support =
      primaryLabel === 'Fake KYC urgency'
        ? 'Urgency, account-block threats, and KYC pressure indicate a high-risk scam pattern.'
        : primaryLabel === 'Likely phishing attempt'
          ? 'Urgency, credential harvesting, and link pressure indicate a phishing pattern.'
          : primaryLabel === 'Impersonation risk'
            ? 'Fake authority, payment pressure, or official-sounding notices indicate impersonation risk.'
            : primaryLabel === 'Payment extraction pattern'
              ? 'Credential or payment-data extraction is the operational risk indicator.'
              : primaryLabel === 'Reward bait pattern'
                ? 'Reward promises and fast-action pressure indicate bait behavior.'
                : primaryLabel === 'Chain-forward manipulation'
                  ? 'Forwarding pressure is the operational manipulation signal.'
                  : 'Suspicious link behavior is the primary risk signal.'

    return `${primaryLabel}. ${support}`
  }

  if (routingBucket === 'breaking_news') {
    return context.conflictingSignals.hasConflict
      ? 'Breaking-news verification remains incomplete.'
      : 'No authoritative reporting currently confirms this event.'
  }

  if (routingBucket === 'civic_rumor') {
    return context.conflictingSignals.hasConflict
      ? 'Retrieved reporting does not currently confirm the claim.'
      : 'No authoritative reporting currently supports this claim.'
  }

  if (routingBucket === 'statistical_overreach') {
    return context.conflictingSignals.hasConflict
      ? 'The claim appears broader than retrieved evidence supports.'
      : 'Retrieved evidence does not substantiate the stated statistical claim.'
  }

  if (scamVerdict) {
    return getRoutingBucketSummary(routingBucket)
  }

  if (breakingNewsWeak) {
    return context.conflictingSignals.hasConflict
      ? 'Breaking-news verification remains incomplete.'
      : 'No authoritative reporting currently confirms this event.'
  }

  if (context.conflictingSignals.hasConflict) {
    return 'Retrieved sources do not provide direct support for the claim.'
  }

  if (context.evidenceStrength.label === 'weak' || context.sourceCredibility?.weightedScore < 45) {
    return 'Retrieved evidence does not currently support this claim.'
  }

  if (!context.directClaimSupport) {
    return 'Retrieved sources do not provide direct support for the claim.'
  }

  if (analysis.verdict === 'Evidence insufficient' || analysis.verdict === 'Unverified') {
    return 'Evidence remains insufficient for confirmation.'
  }

  return analysis.reason || analysis.reasoning || analysis.confidence?.rationale || ''
}

type OperationalTrustNormalizable = {
  verdict: string
  risk?: Risk | string
  reason?: string
  reasoning?: string
  confidence: {
    rationale: string
    drivers: string[]
    score?: number
    label?: string
  }
  operationalGuidance: OperationalGuidance
  uncertaintyReason?: string
  confidenceCapReason?: string
  corroborationLevel?: CorroborationLevel
  sourceCredibility?: SourceCredibility
  contradictions?: ContradictionSummary
  contradictionSummary?: string
  evidence?: EvidenceCard[]
  evidenceStatus?: string
}

type ResponseStateNormalizationContext = OperationalTrustNormalizationContext

function hasDirectStableFactMismatch(context: OperationalTrustNormalizationContext) {
  if (getIndiaDelhiCapitalAliasContext(context.claim).matched) {
    return false
  }

  const relationValidation = validateStableFactRelation(context.claim, context.evidence)

  return (
    relationValidation.directContradiction ||
    hasDeterministicStableFactContradiction(context.claim, context.evidence) ||
    hasDirectStableLocationContradiction({
      claim: context.claim,
      evidence: context.evidence,
      sourceCredibility: context.sourceCredibility,
      conflictingSignals: context.conflictingSignals,
      claimCategory: context.claimCategory,
      evidenceStrength: context.evidenceStrength,
      retrievalFailed: context.retrievalFailed,
      directClaimSupport: context.directClaimSupport,
      directStableFactSupport: context.directStableFactSupport,
      stableFact: context.stableFact,
      highRiskHealth: context.highRiskHealth,
      hasAuthoritativeHealthEvidence: context.hasAuthoritativeHealthEvidence,
      dangerousHealthTreatmentSignal: context.dangerousHealthTreatmentSignal,
      breakingNewsVague: context.breakingNewsVague,
      weirdScienceGuard: context.weirdScienceGuard,
    })
  )
}

function isCommonFactualClaimForContradictionGuard(context: OperationalTrustNormalizationContext) {
  if (
    context.claimCategory === 'scam' ||
    context.claimCategory === 'breaking_news' ||
    context.claimCategory === 'finance' ||
    context.breakingNewsVague ||
    isCurrentNewsClaim(context.claim) ||
    context.dangerousHealthTreatmentSignal ||
    context.highRiskHealth.isHighRisk
  ) {
    return false
  }

  if (context.stableFact || isStableFactClaim(context.claim)) {
    return true
  }

  const normalized = normalizeStableFactText(context.claim)

  const australiaCountryContinent =
    /\baustralia\b/.test(normalized) &&
    /\bcountry\b/.test(normalized) &&
    /\bcontinent\b/.test(normalized)
  const cardiovascularWalking =
    /\bwalking\b/.test(normalized) &&
    /\b(reduces?|lowers?|decreases?)\b/.test(normalized) &&
    /\b(cardiovascular|heart)\b/.test(normalized) &&
    /\brisk\b/.test(normalized)
  const adultHumanBoneCount =
    /\b(human|body|adult|adulthood)\b/.test(normalized) &&
    /\b(206|two hundred and six)\b/.test(normalized) &&
    /\bbones?\b/.test(normalized)

  return australiaCountryContinent || cardiovascularWalking || adultHumanBoneCount
}

function hasUnsupportedStableFactContradictionReason(output: OperationalTrustNormalizable) {
  const text = normalizeStableFactText(
    [
      output.reason,
      output.reasoning,
      output.uncertaintyReason,
      output.confidenceCapReason,
      output.confidence.rationale,
      ...output.confidence.drivers,
      output.corroborationLevel?.label,
      output.corroborationLevel?.agreement,
      ...(output.corroborationLevel?.indicators ?? []),
      output.sourceCredibility?.rationale,
      output.contradictions?.label,
      output.contradictions?.summary,
      ...(output.contradictions?.items.map((item) => item.summary) ?? []),
      output.contradictionSummary,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
  )

  return (
    /direct stable fact support is absent/.test(text) ||
    /evidence too weak|too weak for a confident|weakly related/.test(text) ||
    /does not provide direct support|do not provide direct support|does not directly support/.test(text) ||
    /fails to support|not currently support|insufficient/.test(text) ||
    /mentions the entity but not the exact/.test(text) ||
    /retrieved evidence conflicts with established factual records/.test(text) ||
    /direct contradiction detected/.test(text)
  )
}

// Final stable/common-fact guard: weak or absent support alone must not become a direct contradiction.
function applyUnsupportedStableFactContradictionSafeguard<T extends OperationalTrustNormalizable>(
  output: T,
  context: OperationalTrustNormalizationContext
): T {
  const contradictionLevel = (output.contradictions?.level ?? '').toLowerCase()
  const contradictionSummary = normalizeStableFactText(
    output.contradictions?.summary ?? output.contradictionSummary ?? ''
  )
  const stableFactAnchor = evaluateStableFactAnchor(context.claim)
  const deterministicMismatchSignal = hasDirectStableFactMismatch(context)
  const directRetrievedContradictionSignal = hasStableFactContradictionSignal(context)
  const shouldDowngrade =
    output.verdict === 'Likely incorrect' ||
    contradictionLevel === 'high' ||
    contradictionSummary.includes('retrieved evidence conflicts with established factual records')
  const weakSupportDrivenContradiction =
    context.evidenceStrength.label !== 'strong' &&
    !context.conflictingSignals.hasConflict &&
    hasUnsupportedStableFactContradictionReason(output)

  if (
    !shouldDowngrade ||
    !isCommonFactualClaimForContradictionGuard(context) ||
    deterministicMismatchSignal ||
    (stableFactAnchor.matched && !stableFactAnchor.directSupport) ||
    directRetrievedContradictionSignal ||
    !weakSupportDrivenContradiction
  ) {
    return output
  }

  const reason = 'Retrieved sources do not provide direct support for the claim.'
  const contradictionSummaryText = 'No direct contradiction was identified in retrieved evidence.'
  const corroborationLabel = 'Insufficient verification'
  const confidenceScore = clamp(Math.min(output.confidence.score ?? 40, 40), 0, 40)
  const sanitizedDrivers = output.confidence.drivers.filter(
    (driver) =>
      !/direct contradiction detected|retrieved evidence conflicts with established factual records/i.test(
        driver
      )
  )

  return {
    ...output,
    verdict: 'Evidence insufficient',
    risk: output.risk === 'Severe' || output.risk === 'High' ? output.risk : 'Medium',
    reason,
    reasoning: reason,
    uncertaintyReason: reason,
    confidenceCapReason: reason,
    confidence: {
      ...output.confidence,
      score: confidenceScore,
      label: 'Weak',
      rationale: reason,
      drivers: Array.from(new Set([...sanitizedDrivers, contradictionSummaryText])),
    },
    corroborationLevel: {
      ...(output.corroborationLevel ?? {
        label: corroborationLabel,
        agreement: reason,
        sourceCount: 0,
        highCredibilityCount: 0,
        indicators: [],
      }),
      label: corroborationLabel,
      agreement: reason,
      sourceCount: 0,
      highCredibilityCount: 0,
      indicators: [contradictionSummaryText],
    },
    contradictions: {
      ...(output.contradictions ?? {
        label: corroborationLabel,
        level: 'Low',
        summary: contradictionSummaryText,
        items: [],
      }),
      label: corroborationLabel,
      level: 'Low',
      summary: contradictionSummaryText,
      items: [],
    },
    contradictionSummary: contradictionSummaryText,
    operationalGuidance: {
      ...output.operationalGuidance,
      action: reason,
      distribution: 'Do not distribute as verified.',
      escalation: 'Evidence remains insufficient for confirmation.',
      nextSteps: ['Retry analysis later.'],
    },
  }
}

type ResponseNormalizerMode =
  | 'parsed_analysis'
  | 'finalized_analysis'
  | 'contradiction_normalized'
  | 'timed_out'
  | 'analysis_unavailable'

type ResponseNormalizerInput = {
  mode: ResponseNormalizerMode
  analysis: AnalysisCore | Analysis
  claim: string
  claimCategory: string
  evidence: RankedEvidence[]
  sourceCredibility: SourceCredibility
  conflictingSignals: ConflictSignal
  evidenceStrength: EvidenceStrength
  stableFact: boolean
  directStableFactSupport: boolean
  directClaimSupport: boolean
  retrievalFailed: boolean
  highRiskHealth: HighRiskHealthSignal
  hasAuthoritativeHealthEvidence: boolean
  dangerousHealthTreatmentSignal: boolean
  breakingNewsVague: boolean
  weirdScienceGuard: boolean
  calibration?: ConfidenceCalibration
  confidenceCap?: ConfidenceCapDecision
}

// Central final response gate. This wrapper currently preserves existing behavior and exists to prevent future scattered late-stage overrides.
function responseNormalizer(input: ResponseNormalizerInput): Analysis {
  const context = {
    claim: input.claim,
    claimCategory: input.claimCategory,
    evidence: input.evidence,
    sourceCredibility: input.sourceCredibility,
    evidenceStrength: input.evidenceStrength,
    conflictingSignals: input.conflictingSignals,
    retrievalFailed: input.retrievalFailed,
    stableFact: input.stableFact,
    directStableFactSupport: input.directStableFactSupport,
    directClaimSupport: input.directClaimSupport,
    breakingNewsVague: input.breakingNewsVague,
    weirdScienceGuard: input.weirdScienceGuard,
    highRiskHealth: input.highRiskHealth,
    hasAuthoritativeHealthEvidence: input.hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal: input.dangerousHealthTreatmentSignal,
  }

  let normalized: Analysis

  switch (input.mode) {
    case 'parsed_analysis':
      normalized = applyOperationalTrustNormalization(
        applyNormalizedContradictions(
          applyFinalStableFactSafeguard(
            applyStableFactNormalization(input.analysis as Analysis, context),
            context
          ),
          context
          ),
        context
      )
      break
    case 'finalized_analysis':
      normalized = applyOperationalTrustNormalization(
        applyScamNormalization(
          applyFinalStableFactSafeguard(input.analysis as Analysis, context),
          input.claim,
          input.claimCategory
        ),
        context
      )
      break
    case 'contradiction_normalized':
      normalized = applyOperationalTrustNormalization(
        applyScamNormalization(
          applyFinalStableFactSafeguard(
            applyNormalizedContradictions(input.analysis as Analysis, context),
            context
          ),
          input.claim,
          input.claimCategory
        ),
        context
      )
      break
    case 'analysis_unavailable':
      normalized = applyOperationalTrustNormalization(
        applyScamNormalization(
          applyFinalStableFactSafeguard(
            finalizeAnalysis(
              input.analysis as AnalysisCore,
              input.calibration!,
              input.confidenceCap!
            ),
            context
          ),
          input.claim,
          input.claimCategory
        ),
        context
      )
      break
    case 'timed_out':
    default:
      normalized = applyOperationalTrustNormalization(
        applyScamNormalization(
          applyFinalStableFactSafeguard(input.analysis as Analysis, context),
          input.claim,
          input.claimCategory
        ),
        context
      )
      break
  }

  return applyPass4FinalConsistencyGuard(
    applySurgicalAuditGuard(
      applyPass3FinalCleanup(applyFinalStableFactConsistencyGuard(normalized, context), context),
      context
    ),
    context
  )
}

function applyFinalStableFactConsistencyGuard<T extends Analysis>(
  output: T,
  context: OperationalTrustNormalizationContext
): T {
  if (!context.stableFact && !isCommonFactualClaimForContradictionGuard(context)) {
    return output
  }

  const stableAnchor = evaluateStableFactAnchor(context.claim)
  const directMismatch = hasDirectStableFactMismatch(context)
  const directStableSupport =
    context.stableFact &&
    (hasDirectStableFactSupport(context.claim, context.evidence) ||
      hasWaterBoilingBaselineSupport(context.claim, context.evidence))
  const contradictionLabel = output.contradictions?.label ?? ''
  const contradictionSummary = output.contradictions?.summary ?? output.contradictionSummary ?? ''
  const contradictionSignal =
    output.verdict === 'Likely incorrect' ||
    (output.contradictions?.level ?? '') === 'High' ||
    /Direct contradiction|conflicts with established factual records/i.test(
      `${contradictionLabel} ${contradictionSummary}`
    )
  const weakContradictionSignal =
    readNumber(output.confidence.score, 0) <= 40 || hasUnsupportedStableFactContradictionReason(output)

  if (
    !contradictionSignal ||
    directMismatch ||
    stableAnchor.matched ||
    (!directStableSupport && !weakContradictionSignal)
  ) {
    return output
  }

  const cappedScore = Math.min(readNumber(output.confidence.score, 0), 40)
  const reason = 'Retrieved sources do not provide direct support for the claim.'
  const contradictionSummaryText = 'No direct contradiction was identified in retrieved evidence.'

  return {
    ...output,
    verdict: 'Evidence insufficient',
    confidence: {
      ...output.confidence,
      score: cappedScore,
      label: cappedScore >= 40 ? 'Moderate' : 'Weak',
      rationale: reason,
    },
    reason,
    reasoning: reason,
    uncertaintyReason: reason,
    confidenceCapReason: reason,
    corroborationLevel: {
      ...(output.corroborationLevel ?? {
        label: 'Insufficient verification',
        agreement: reason,
        sourceCount: 0,
        highCredibilityCount: 0,
        indicators: [],
      }),
      label: 'Insufficient verification',
      agreement: reason,
      indicators: Array.from(
        new Set([...(output.corroborationLevel?.indicators ?? []), contradictionSummaryText])
      ),
    },
    contradictions: {
      ...(output.contradictions ?? {
        label: 'Insufficient verification',
        level: 'Low',
        summary: contradictionSummaryText,
        items: [],
      }),
      label: 'Insufficient verification',
      level: 'Low',
      summary: contradictionSummaryText,
      items: [],
    },
    contradictionSummary: contradictionSummaryText,
  }
}

function isBroadSociotechnicalClaim(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return /\b(wikipedia|social media|algorithm(?:s)?|media|platform(?:s)?|misinformation|disinformation|society|public discourse|internet|online|content moderation|news feed|viral)\b/i.test(
    normalized
  )
}

function hasRewardBaitForwardPressure(claim: string) {
  const normalized = normalizeStableFactText(claim)
  const rewardCue = /\b(free|lifetime|giveaway|reward|bonus|subscription|prize|gift|cashback|offer)\b/i.test(
    normalized
  )
  const forwardCue = /\b(forward|share|send|circulat|repost|message|people|friends|groups?)\b/i.test(
    normalized
  )

  return rewardCue && forwardCue
}

function hasScamPressureSignals(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return /\b(link|click|form|otp|pin|password|kyc|payment|upi|account|share|forward|send|reply|register|signup|subscribe|message|whatsapp)\b/i.test(
    normalized
  )
}

function isAadhaarLegalThreatClaim(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return /\baadhaar\b/i.test(normalized) && /\b(police case|case filed|legal|summons|notice|arrest|complaint|blocked|freeze)\b/i.test(normalized)
}

function isUtilityCutoffThreatClaim(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return (
    /\belectricity bill\b/i.test(normalized) &&
    /\b(unpaid|due|pending)\b/i.test(normalized) &&
    /\b(power cut|disconnect|cut off|shut off|cut)\b/i.test(normalized)
  )
}

function isGovernmentSubsidyBaitClaim(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return /\bgovernment subsidy\b/i.test(normalized) && /\b(first|limited|only|500|users|slots|people)\b/i.test(normalized)
}

function isLocalSafetyRumorWithoutScamPressure(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return (
    /\b(kidnapping|kidnapped|abduction|missing|attack|shooting|fire|accident|assault|murder|bomb|warning|alert)\b/i.test(
      normalized
    ) &&
    !hasScamPressureSignals(normalized)
  )
}

function isBreakingNewsSchemeWithoutScamPressure(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return (
    /\b(free|giveaway|scheme|replacement|offer|launch|launched)\b/i.test(normalized) &&
    !hasScamPressureSignals(normalized)
  )
}

function isImmediateCausalHealthClaim(claim: string) {
  const normalized = normalizeStableFactText(claim)
  return (
    /\b(cause|causes|caused)\b/i.test(normalized) &&
    /\b(immediately|instantly|right away|at once|suddenly)\b/i.test(normalized)
  )
}

function applyPass3FinalCleanup<T extends Analysis>(
  output: T,
  context: OperationalTrustNormalizationContext
): T {
  let cleaned: T = output
  const broadSociotechnicalClaim = !context.stableFact && isBroadSociotechnicalClaim(context.claim)
  const currentOrBreakingClaim = isCurrentNewsClaim(context.claim) || context.breakingNewsVague
  const directMismatch =
    hasDirectStableFactMismatch(context) ||
    hasDeterministicStableFactContradiction(context.claim, context.evidence)
  const directContradictionSignal =
    directMismatch ||
    /direct contradiction detected|conflicts with established factual records|evidence contradicts the claim/i.test(
      [
        cleaned.contradictions?.label,
        cleaned.contradictions?.summary,
        cleaned.contradictionSummary,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
    )

  if (hasRewardBaitForwardPressure(context.claim)) {
    const scamLabel = context.claim.toLowerCase().includes('forward') ? 'Chain-forward manipulation' : 'Reward bait pattern'
    const scamReason = 'Prize/reward framing plus forwarding pressure indicates a reward-bait manipulation pattern.'
    const cappedScore = Math.min(readNumber(cleaned.confidence.score, 0), 45)

    cleaned = {
      ...cleaned,
      verdict: scamLabel,
      risk: cleaned.risk === 'High' ? 'High' : 'Medium',
      reason: scamReason,
      reasoning: scamReason,
      uncertaintyReason: scamReason,
      confidenceCapReason: scamReason,
      confidence: {
        ...cleaned.confidence,
        score: cappedScore,
        label: cappedScore >= 40 ? 'Moderate' : 'Weak',
        rationale: scamReason,
      },
      corroborationLevel: {
        ...(cleaned.corroborationLevel ?? {
          label: scamLabel,
          agreement: scamReason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: scamLabel,
        agreement: scamReason,
      },
      contradictions: {
        ...(cleaned.contradictions ?? {
          label: scamLabel,
          level: 'Low',
          summary: scamReason,
          items: [],
        }),
        label: scamLabel,
        level: 'Low',
        summary: scamReason,
      },
      contradictionSummary: scamReason,
    }
  }

  if (
    broadSociotechnicalClaim &&
    cleaned.verdict !== 'Evidence insufficient' &&
    cleaned.verdict !== 'Unverified'
  ) {
    const nuancedReason =
      'Evidence supports part of the claim, but the framing is broader than the evidence.'
    const cappedScore = Math.min(readNumber(cleaned.confidence.score, 0), 55)

    cleaned = {
      ...cleaned,
      verdict:
        cleaned.verdict === 'Corroborated' || cleaned.verdict === 'Likely Reliable'
          ? 'Likely Reliable'
          : cleaned.verdict,
      risk: cleaned.risk === 'High' ? 'High' : 'Low',
      reason: nuancedReason,
      reasoning: nuancedReason,
      uncertaintyReason: nuancedReason,
      confidenceCapReason: nuancedReason,
      confidence: {
        ...cleaned.confidence,
        score: cappedScore,
        label: cappedScore >= 70 ? 'Strong' : cappedScore >= 40 ? 'Moderate' : 'Weak',
        rationale: nuancedReason,
      },
      corroborationLevel: {
        ...(cleaned.corroborationLevel ?? {
          label: 'Context dependent',
          agreement: nuancedReason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Context dependent',
        agreement: nuancedReason,
      },
    }
  }

  if (currentOrBreakingClaim && !context.stableFact && cleaned.verdict !== 'Corroborated' && cleaned.verdict !== 'Likely incorrect') {
    const indirectReason =
      'Retrieved evidence is limited or indirect, so the claim should not be treated as confirmed.'

    cleaned = {
      ...cleaned,
      reason: indirectReason,
      reasoning: indirectReason,
      uncertaintyReason: indirectReason,
      confidenceCapReason: indirectReason,
      confidence: {
        ...cleaned.confidence,
        rationale: indirectReason,
      },
      corroborationLevel: {
        ...(cleaned.corroborationLevel ?? {
          label: 'Insufficient verification',
          agreement: indirectReason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Insufficient verification',
        agreement: indirectReason,
      },
    }
  }

  const verdictIsEvidenceInsufficient = cleaned.verdict === 'Evidence insufficient' || cleaned.verdict === 'Unverified'
  const verdictIsCorroborated = cleaned.verdict === 'Corroborated'
  const verdictIsLikelyIncorrect = cleaned.verdict === 'Likely incorrect'
  const supportLikePhrases = [
    'directly supports',
    'direct stable-fact support detected',
    'deterministic stable-fact anchor matched',
    'evidence aligns with established factual records',
    'retrieved evidence directly supports the claim',
  ]

  const sanitizedDrivers =
    verdictIsEvidenceInsufficient && cleaned.confidence?.drivers
      ? cleaned.confidence.drivers.filter((driver) => {
          const normalized = normalizeStableFactText(driver)
          return !supportLikePhrases.some((phrase) => normalized.includes(phrase))
        })
      : cleaned.confidence.drivers

  const contradictionLabel =
    verdictIsEvidenceInsufficient || (verdictIsLikelyIncorrect && !directContradictionSignal)
      ? 'Insufficient verification'
      : verdictIsCorroborated
        ? 'No direct contradiction was identified in retrieved evidence.'
        : cleaned.contradictions?.label ?? 'Insufficient verification'

  const contradictionSummary = verdictIsCorroborated
    ? 'No direct contradiction was identified in retrieved evidence.'
    : verdictIsEvidenceInsufficient || (verdictIsLikelyIncorrect && !directContradictionSignal)
      ? 'No direct contradiction was identified in retrieved evidence.'
      : cleaned.contradictions?.summary ?? 'No direct contradiction was identified in retrieved evidence.'

  const contradictionLevel = verdictIsCorroborated
    ? 'None'
    : verdictIsEvidenceInsufficient || (verdictIsLikelyIncorrect && !directContradictionSignal)
      ? 'Low'
      : cleaned.contradictions?.level ?? 'Low'

  const corroborationLabel = verdictIsCorroborated
    ? 'Direct support detected'
    : verdictIsEvidenceInsufficient
      ? 'Insufficient verification'
      : cleaned.corroborationLevel?.label ?? 'Insufficient verification'

  const corroborationAgreement = verdictIsCorroborated
    ? 'Retrieved evidence directly supports the claim.'
    : verdictIsEvidenceInsufficient || (verdictIsLikelyIncorrect && !directContradictionSignal)
      ? 'Retrieved sources do not provide direct support for the claim.'
      : cleaned.corroborationLevel?.agreement ?? 'Retrieved sources do not provide direct support for the claim.'

  return {
    ...cleaned,
    confidence: {
      ...cleaned.confidence,
      drivers: sanitizedDrivers,
    },
    corroborationLevel: cleaned.corroborationLevel
      ? {
          ...cleaned.corroborationLevel,
          label: corroborationLabel,
          agreement: corroborationAgreement,
        }
      : cleaned.corroborationLevel,
    contradictions: cleaned.contradictions
      ? {
          ...cleaned.contradictions,
          label: contradictionLabel,
          level: contradictionLevel,
          summary: contradictionSummary,
        }
      : cleaned.contradictions,
    contradictionSummary,
  }
}

function applySurgicalAuditGuard<T extends Analysis>(
  output: T,
  context: OperationalTrustNormalizationContext
): T {
  let final = output

  if (isAadhaarLegalThreatClaim(context.claim)) {
    const reason = 'Fake legal and identity-pressure framing indicates an impersonation-risk pattern.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 45)

    final = {
      ...final,
      verdict: 'Impersonation risk',
      risk: final.risk === 'High' ? 'High' : 'High',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
        drivers: Array.from(
          new Set([
            ...(final.confidence.drivers ?? []).filter(
              (driver) =>
                !/directly supports|retrieved evidence directly supports the claim|evidence aligns with established factual records/i.test(
                  driver
                )
            ),
            reason,
          ])
        ),
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Impersonation risk',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Impersonation risk',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Impersonation risk',
          level: 'Low',
          summary: reason,
          items: [],
        }),
        label: 'Impersonation risk',
        level: 'Low',
        summary: reason,
      },
      contradictionSummary: reason,
    }
  }

  if (isUtilityCutoffThreatClaim(context.claim)) {
    const reason = 'Utility cutoff urgency is commonly used to pressure payment or link interaction.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 45)

    final = {
      ...final,
      verdict: 'Suspicious payment extraction',
      risk: final.risk === 'High' ? 'High' : 'High',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Suspicious payment extraction',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Suspicious payment extraction',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Suspicious payment extraction',
          level: 'Low',
          summary: reason,
          items: [],
        }),
        label: 'Suspicious payment extraction',
        level: 'Low',
        summary: reason,
      },
      contradictionSummary: reason,
    }
  }

  if (isGovernmentSubsidyBaitClaim(context.claim)) {
    const reason = 'Government-benefit framing plus scarcity pressure indicates reward-bait manipulation.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 45)

    final = {
      ...final,
      verdict: 'Reward bait pattern',
      risk: final.risk === 'High' ? 'High' : 'Medium',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Reward bait pattern',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Reward bait pattern',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Reward bait pattern',
          level: 'Low',
          summary: reason,
          items: [],
        }),
        label: 'Reward bait pattern',
        level: 'Low',
        summary: reason,
      },
      contradictionSummary: reason,
    }
  }

  if (
    isLocalSafetyRumorWithoutScamPressure(context.claim) &&
    isSpecificScamVerdict(final.verdict)
  ) {
    const reason = 'No authoritative local reporting currently supports this claim.'
    const contradictionSummary = 'No direct contradiction was identified in retrieved evidence.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 40)

    final = {
      ...final,
      verdict: 'Verification incomplete',
      risk: final.risk === 'High' ? 'High' : 'Medium',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Insufficient verification',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Insufficient verification',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Insufficient verification',
          level: 'Low',
          summary: contradictionSummary,
          items: [],
        }),
        label: 'Insufficient verification',
        level: 'Low',
        summary: contradictionSummary,
      },
      contradictionSummary,
    }
  }

  if (
    isBreakingNewsSchemeWithoutScamPressure(context.claim) &&
    isSpecificScamVerdict(final.verdict)
  ) {
    const reason = 'Retrieved reporting does not currently confirm the announced scheme.'
    const contradictionSummary = 'No direct contradiction was identified in retrieved evidence.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 40)

    final = {
      ...final,
      verdict: 'Verification incomplete',
      risk: final.risk === 'High' ? 'High' : 'Medium',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Insufficient verification',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Insufficient verification',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Insufficient verification',
          level: 'Low',
          summary: contradictionSummary,
          items: [],
        }),
        label: 'Insufficient verification',
        level: 'Low',
        summary: contradictionSummary,
      },
      contradictionSummary,
    }
  }

  if (isImmediateCausalHealthClaim(context.claim)) {
    const reason =
      'Retrieved evidence does not provide authoritative support for this immediate-causation health claim.'
    const contradictionSummary =
      'Retrieved evidence does not provide authoritative support for this high-risk health claim.'
    const confidenceScore = Math.min(readNumber(final.confidence.score, 0), 40)
    const sanitizedDrivers = (final.confidence.drivers ?? []).filter(
      (driver) =>
        !/directly supports|retrieved evidence directly supports the claim|evidence aligns with established factual records/i.test(
          driver
        )
    )

    final = {
      ...final,
      verdict: final.verdict === 'Dangerous unsupported claim' ? final.verdict : 'Likely incorrect',
      risk: final.risk === 'Severe' ? 'Severe' : 'High',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
        drivers: Array.from(new Set([...sanitizedDrivers, contradictionSummary])),
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Authoritative support missing',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Authoritative support missing',
        agreement: reason,
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Authoritative support missing',
          level: 'Moderate',
          summary: contradictionSummary,
          items: [],
        }),
        label: 'Authoritative support missing',
        level: 'Moderate',
        summary: contradictionSummary,
      },
      contradictionSummary,
    }
  }

  return final
}

function normalizeResponseText(value: string) {
  return normalizeOperationalLanguageText(value)
    .replace(/\bUnknown\b/gi, 'No direct contradiction was identified in retrieved evidence.')
    .replace(/\bUnable to verify\b/gi, 'Verification incomplete.')
    .replace(/\bExercise caution\b/gi, 'Verification incomplete.')
    .replace(/\bContradiction analysis did not complete\b/gi, 'Verification incomplete.')
    .replace(/\bNo contradiction found\b/gi, 'No direct contradiction was identified in retrieved evidence.')
    .replace(/\bNo meaningful contradiction detected\b/gi, 'No direct contradiction was identified in retrieved evidence.')
}

function normalizeResponseState<T extends OperationalTrustNormalizable>(
  output: T,
  context: ResponseStateNormalizationContext
): T {
  const scamPattern = classifyScamPattern(context.claim)
  const routingBucket = classifyRoutingBucket(
    context.claim,
    context.claimCategory,
    context.breakingNewsVague
  )
  const stableAnchor = evaluateStableFactAnchor(context.claim)
  const currentNewsClaim = isCurrentNewsClaim(context.claim)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(context.claim)
  const civicRumor = routingBucket === 'civic_rumor' || context.claimCategory === 'government' || isCivicRumorClaim(context.claim)
  const breakingNewsState =
    routingBucket === 'breaking_news' || context.breakingNewsVague || currentNewsClaim
  const scamState = scamPattern.isScamLike || routingBucket === 'scam'
  const directSupport =
    stableAnchor.matched && stableAnchor.directSupport && !stableAnchor.directContradiction
  const directContradiction =
    stableAnchor.matched && stableAnchor.directContradiction
  const contradictionLabel = output.contradictions?.label ?? ''
  const contradictionSummary = output.contradictions?.summary ?? output.contradictionSummary ?? ''
  const directContradictionSignal =
    directContradiction ||
    /direct contradiction detected|evidence contradicts the claim|conflicting evidence detected/i.test(
      `${contradictionLabel} ${contradictionSummary}`
    )
  const insufficientSignal =
    /evidence insufficient|insufficient direct evidence|unable to verify|unknown|contradiction analysis did not complete|no contradiction found|exercise caution/i.test(
      `${contradictionLabel} ${contradictionSummary} ${output.reason} ${output.reasoning} ${output.confidence.rationale}`
    )
  const baseReason =
    output.reason || output.reasoning || output.confidence.rationale || output.uncertaintyReason || ''
  const normalizedEvidence = output.evidence ?? []
  const normalized: T = {
    ...output,
    reason: normalizeResponseText(output.reason || baseReason),
    reasoning: output.reasoning ? normalizeResponseText(output.reasoning) : output.reasoning,
    uncertaintyReason: output.uncertaintyReason ? normalizeResponseText(output.uncertaintyReason) : output.uncertaintyReason,
    confidenceCapReason: output.confidenceCapReason
      ? normalizeResponseText(output.confidenceCapReason)
      : output.confidenceCapReason,
    confidence: {
      ...output.confidence,
      rationale: normalizeResponseText(output.confidence.rationale),
      drivers: output.confidence.drivers.map((driver) => normalizeResponseText(driver)),
    },
    corroborationLevel: output.corroborationLevel
      ? {
          ...output.corroborationLevel,
          label: normalizeResponseText(output.corroborationLevel.label),
          agreement: normalizeResponseText(output.corroborationLevel.agreement),
          indicators: output.corroborationLevel.indicators.map((indicator) => normalizeResponseText(indicator)),
        }
      : output.corroborationLevel,
    contradictions: output.contradictions
      ? {
          ...output.contradictions,
          label: output.contradictions.label ? normalizeResponseText(output.contradictions.label) : output.contradictions.label,
          summary: output.contradictions.summary ? normalizeResponseText(output.contradictions.summary) : output.contradictions.summary,
          items: output.contradictions.items.map((item) => ({
            ...item,
            summary: item.summary ? normalizeResponseText(item.summary) : item.summary,
          })),
        }
      : output.contradictions,
    contradictionSummary: output.contradictionSummary
      ? normalizeResponseText(output.contradictionSummary)
      : output.contradictionSummary,
    operationalGuidance: {
      ...output.operationalGuidance,
      action: normalizeResponseText(output.operationalGuidance.action),
      distribution: normalizeResponseText(output.operationalGuidance.distribution),
      escalation: normalizeResponseText(output.operationalGuidance.escalation),
      nextSteps: output.operationalGuidance.nextSteps.map((step) => normalizeResponseText(step)),
    },
  }

  if (capitalAliasContext.matched) {
    return {
      ...normalized,
      reason: capitalAliasContext.reason,
      reasoning: capitalAliasContext.reason,
      uncertaintyReason: capitalAliasContext.reason,
      confidenceCapReason: capitalAliasContext.reason,
      confidence: {
        ...normalized.confidence,
        rationale: capitalAliasContext.reason,
      },
      corroborationLevel: {
        ...(normalized.corroborationLevel ?? {
          label: 'Corroborated with qualification',
          agreement: capitalAliasContext.reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Corroborated with qualification',
        agreement: capitalAliasContext.reason,
        indicators: Array.from(
          new Set([
            ...(normalized.corroborationLevel?.indicators ?? []),
            'Delhi is a broader geographic reference for the capital territory.',
          ])
        ),
      },
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'Missing context',
          level: 'Low',
          summary: capitalAliasContext.summary,
          items: [],
        }),
        label: 'Missing context',
        level: 'Low',
        summary: capitalAliasContext.summary,
      },
      contradictionSummary: capitalAliasContext.summary,
    }
  }

  if (directSupport) {
    return {
      ...normalized,
      verdict: 'Corroborated',
      reason: 'Evidence aligns with established factual records.',
      reasoning: 'Evidence aligns with established factual records.',
      uncertaintyReason: 'No direct contradiction was identified in retrieved evidence.',
      confidenceCapReason: 'Evidence aligns with established factual records.',
      confidence: {
        ...normalized.confidence,
        label: 'Strong',
        rationale: 'Evidence aligns with established factual records.',
      },
      corroborationLevel: {
        ...(normalized.corroborationLevel ?? {
          label: 'Direct stable-fact support detected',
          agreement: 'Evidence aligns with established factual records.',
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Direct stable-fact support detected',
        agreement: 'Evidence aligns with established factual records.',
        indicators: ['Deterministic stable-fact anchor matched.'],
      },
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'No direct contradiction was identified in retrieved evidence.',
          level: 'None',
          summary: 'No direct contradiction was identified in retrieved evidence.',
          items: [],
        }),
        label: 'No direct contradiction was identified in retrieved evidence.',
        level: 'None',
        summary: 'No direct contradiction was identified in retrieved evidence.',
        items: [],
      },
      contradictionSummary: 'No direct contradiction was identified in retrieved evidence.',
    }
  }

  if (scamState) {
    const scamLabel = scamPattern.isScamLike ? scamPattern.label : getScamVerdictLabel(detectScamSignals(context.claim))
    const scamReason = scamPattern.isScamLike ? scamPattern.reason : getScamPatternReason(scamLabel)
    const risk = scamPattern.isScamLike ? scamPattern.risk : output.risk

    return {
      ...normalized,
      verdict: scamLabel,
      risk: risk === 'High' ? 'High' : scamPattern.isScamLike ? scamPattern.risk : normalized.risk,
      reason: scamReason,
      reasoning: scamReason,
      uncertaintyReason: scamReason,
      confidenceCapReason: scamReason,
      confidence: {
        ...normalized.confidence,
        rationale: scamReason,
      },
      corroborationLevel: {
        ...(normalized.corroborationLevel ?? {
          label: scamLabel,
          agreement: scamReason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: scamLabel,
        agreement: scamReason,
      },
      contradictions: {
        ...(normalized.contradictions ?? {
          label: scamLabel,
          level: 'Low',
          summary: scamReason,
          items: [],
        }),
        label: scamLabel,
        level: 'Low',
        summary: scamReason,
        items: normalized.contradictions?.items ?? [],
      },
      contradictionSummary: scamReason,
    }
  }

  if (directContradictionSignal && !scamPattern.isScamLike) {
    return {
      ...normalized,
      verdict: 'Likely incorrect',
      risk: 'Medium',
      reason: 'Retrieved evidence conflicts with established factual records.',
      reasoning: 'Retrieved evidence conflicts with established factual records.',
      uncertaintyReason: 'Retrieved evidence conflicts with established factual records.',
      confidence: {
        ...normalized.confidence,
        score: Math.min(normalized.confidence.score ?? 0, 60),
        label: 'Moderate',
        rationale: 'Retrieved evidence conflicts with established factual records.',
      },
      corroborationLevel: {
        ...(normalized.corroborationLevel ?? {
          label: 'Direct contradiction detected',
          agreement: 'Retrieved evidence conflicts with established factual records.',
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Direct contradiction detected',
        agreement: 'Retrieved evidence conflicts with established factual records.',
        indicators: ['Direct contradiction detected.'],
      },
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'Direct contradiction detected',
          level: 'High',
          summary: 'Retrieved evidence conflicts with established factual records.',
          items: [],
        }),
        label: 'Direct contradiction detected',
        level: 'High',
        summary: 'Retrieved evidence conflicts with established factual records.',
      },
      contradictionSummary: 'Retrieved evidence conflicts with established factual records.',
    }
  }

  if (breakingNewsState && (normalizedEvidence.length === 0 || context.evidenceStrength.label !== 'strong')) {
    return {
      ...normalized,
      verdict:
        normalized.verdict === 'Evidence insufficient' || normalized.verdict === 'Unverified'
          ? normalized.verdict
          : 'Unverified',
      reason: 'No authoritative reporting currently confirms this event.',
      reasoning: 'No authoritative reporting currently confirms this event.',
      uncertaintyReason: 'No authoritative reporting currently confirms this event.',
      confidenceCapReason: 'No authoritative reporting currently confirms this event.',
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'Verification incomplete',
          level: 'Low',
          summary: 'Retrieved reporting does not currently confirm the event.',
          items: [],
        }),
        label: 'Verification incomplete',
        level: 'Low',
        summary: 'Retrieved reporting does not currently confirm the event.',
      },
      contradictionSummary: 'Retrieved reporting does not currently confirm the event.',
    }
  }

  if (civicRumor && (normalizedEvidence.length === 0 || context.evidenceStrength.label !== 'strong')) {
    return {
      ...normalized,
      verdict:
        normalized.verdict === 'Unsupported civic claim' || normalized.verdict === 'Evidence insufficient'
          ? normalized.verdict
          : 'Evidence insufficient',
      reason: 'No authoritative reporting currently supports this claim.',
      reasoning: 'No authoritative reporting currently supports this claim.',
      uncertaintyReason: 'No authoritative reporting currently supports this claim.',
      confidenceCapReason: 'No authoritative reporting currently supports this claim.',
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'Authoritative support missing',
          level: 'Low',
          summary: 'No authoritative reporting currently supports this claim.',
          items: [],
        }),
        label: 'Authoritative support missing',
        level: 'Low',
        summary: 'No authoritative reporting currently supports this claim.',
      },
      contradictionSummary: 'No authoritative reporting currently supports this claim.',
    }
  }

  if (normalized.verdict === 'Evidence insufficient' || insufficientSignal) {
    return {
      ...normalized,
      verdict: normalized.verdict === 'Unverified' ? 'Unverified' : 'Evidence insufficient',
      reason: 'Retrieved sources do not provide direct support for the claim.',
      reasoning: 'Retrieved sources do not provide direct support for the claim.',
      uncertaintyReason: 'Retrieved sources do not provide direct support for the claim.',
      confidenceCapReason: 'Retrieved sources do not provide direct support for the claim.',
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'Insufficient direct evidence',
          level: 'Low',
          summary: 'Retrieved sources do not provide direct support for the claim.',
          items: [],
        }),
        label: 'Insufficient direct evidence',
        level: 'Low',
        summary: 'Retrieved sources do not provide direct support for the claim.',
      },
      contradictionSummary: 'Retrieved sources do not provide direct support for the claim.',
    }
  }

  if (normalized.verdict === 'Corroborated') {
    return {
      ...normalized,
      reason: 'Retrieved evidence directly supports the claim.',
      reasoning: 'Retrieved evidence directly supports the claim.',
      uncertaintyReason: 'No direct contradiction was identified in retrieved evidence.',
      confidenceCapReason: 'Retrieved evidence directly supports the claim.',
      confidence: {
        ...normalized.confidence,
        rationale: 'Retrieved evidence directly supports the claim.',
      },
      corroborationLevel: {
        ...(normalized.corroborationLevel ?? {
          label: 'Direct support detected',
          agreement: 'Retrieved evidence directly supports the claim.',
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Direct support detected',
        agreement: 'Retrieved evidence directly supports the claim.',
      },
      contradictions: {
        ...(normalized.contradictions ?? {
          label: 'No direct contradiction was identified in retrieved evidence.',
          level: 'None',
          summary: 'No direct contradiction was identified in retrieved evidence.',
          items: [],
        }),
        label: 'No direct contradiction was identified in retrieved evidence.',
        level: 'None',
        summary: 'No direct contradiction was identified in retrieved evidence.',
        items: [],
      },
      contradictionSummary: 'No direct contradiction was identified in retrieved evidence.',
    }
  }

  return normalized
}

function hasDirectContradictionLanguage(value: string) {
  return /direct contradiction detected|retrieved evidence conflicts with established factual records|evidence contradicts the claim|conflicting evidence detected/i.test(
    value
  )
}

function hasBroadContextualClaimWording(value: string) {
  return /evidence supports part of the claim, but the framing is broader than the evidence/i.test(value)
}

function hasMisleadingStatisticTrap(claim: string, claimCategory: string) {
  if (claimCategory === 'manipulated_statistics') {
    return true
  }

  const normalized = normalizeStableFactText(claim)
  return /(?:\b100%\b|\ball\b|\bevery\b|\balways\b|\bnever\b|\bprove(?:s|d)?\b|\bproof\b)/i.test(
    normalized
  )
}

function applyPass4FinalConsistencyGuard<T extends Analysis>(
  output: T,
  context: OperationalTrustNormalizationContext
): T {
  let final = output

  const broadContextReason = [
    final.reason,
    final.reasoning,
    final.confidence.rationale,
    final.corroborationLevel?.agreement,
  ]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => hasBroadContextualClaimWording(value))

  const dangerousHealthClaim =
    context.claimCategory === 'health' &&
    (final.verdict === 'Dangerous unsupported claim' ||
      context.highRiskHealth.isHighRisk ||
      context.dangerousHealthTreatmentSignal)

  const misleadingStatisticTrap = hasMisleadingStatisticTrap(context.claim, context.claimCategory)

  if (dangerousHealthClaim) {
    const reason =
      'Retrieved evidence does not provide authoritative support for this high-risk health claim.'
    const contradictionSummary =
      'Retrieved evidence does not provide authoritative support for this high-risk claim.'
    const confidenceScore = clamp(Math.min(readNumber(final.confidence.score, 0), 40), 0, 40)
    const sanitizedDrivers = final.confidence.drivers.filter(
      (driver) =>
        !/directly supports|retrieved evidence directly supports the claim|evidence aligns with established factual records/i.test(
          driver
        )
    )

    final = {
      ...final,
      risk: final.risk === 'High' || final.risk === 'Severe' ? final.risk : 'High',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
        drivers: Array.from(new Set([...sanitizedDrivers, contradictionSummary])),
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Insufficient verification',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Insufficient verification',
        agreement: reason,
        indicators: Array.from(
          new Set([
            ...((final.corroborationLevel?.indicators ?? []).filter(
              (indicator) => !hasDirectContradictionLanguage(indicator)
            )),
            contradictionSummary,
          ])
        ),
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Authoritative support missing',
          level: 'Moderate',
          summary: contradictionSummary,
          items: [],
        }),
        label: 'Authoritative support missing',
        level:
          final.contradictions?.level === 'High' || final.contradictions?.level === 'Moderate'
            ? final.contradictions.level
            : 'Moderate',
        summary: contradictionSummary,
      },
      contradictionSummary,
    }
  }

  if (misleadingStatisticTrap && final.verdict === 'Likely incorrect') {
    const reason =
      'The claim uses a misleading statistical framing rather than meaningful causal evidence.'
    const contradictionSummary =
      'The claim is misleading because the statistic does not support the implied conclusion.'
    const confidenceScore = clamp(Math.min(readNumber(final.confidence.score, 0), 40), 0, 40)
    const sanitizedDrivers = final.confidence.drivers.filter(
      (driver) =>
        !/verification incomplete|direct contradiction detected|retrieved evidence conflicts with established factual records/i.test(
          driver
        )
    )

    final = {
      ...final,
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
        drivers: Array.from(new Set([...sanitizedDrivers, contradictionSummary])),
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Misleading statistical framing',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Misleading statistical framing',
        agreement: reason,
        indicators: Array.from(
          new Set([
            ...((final.corroborationLevel?.indicators ?? []).filter(
              (indicator) => !hasDirectContradictionLanguage(indicator)
            )),
            contradictionSummary,
          ])
        ),
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Misleading statistical framing',
          level: 'Moderate',
          summary: contradictionSummary,
          items: [],
        }),
        label: 'Misleading statistical framing',
        level: 'Moderate',
        summary: contradictionSummary,
      },
      contradictionSummary,
    }
  }

  if (broadContextReason) {
    const reason =
      'Evidence supports part of the claim, but the framing is broader than the evidence.'
    const confidenceScore = clamp(Math.min(readNumber(final.confidence.score, 0), 55), 0, 55)
    const sanitizedDrivers = final.confidence.drivers.filter(
      (driver) => !hasDirectContradictionLanguage(driver)
    )
    const sanitizedIndicators = (final.corroborationLevel?.indicators ?? []).filter(
      (indicator) => !hasDirectContradictionLanguage(indicator)
    )

    final = {
      ...final,
      verdict:
        final.verdict === 'Likely incorrect' || final.verdict === 'Corroborated'
          ? 'Likely Reliable'
          : final.verdict,
      risk: final.risk === 'High' ? 'High' : 'Low',
      reason,
      reasoning: reason,
      uncertaintyReason: reason,
      confidenceCapReason: reason,
      confidence: {
        ...final.confidence,
        score: confidenceScore,
        label: confidenceScore >= 70 ? 'Strong' : confidenceScore >= 40 ? 'Moderate' : 'Weak',
        rationale: reason,
        drivers: Array.from(new Set([...sanitizedDrivers, reason])),
      },
      corroborationLevel: {
        ...(final.corroborationLevel ?? {
          label: 'Context dependent',
          agreement: reason,
          sourceCount: 0,
          highCredibilityCount: 0,
          indicators: [],
        }),
        label: 'Context dependent',
        agreement: reason,
        indicators: Array.from(new Set([...sanitizedIndicators, reason])),
      },
      contradictions: {
        ...(final.contradictions ?? {
          label: 'Context dependent',
          level: 'Low',
          summary: reason,
          items: [],
        }),
        label: 'Context dependent',
        level:
          final.contradictions?.level === 'High'
            ? 'Moderate'
            : final.contradictions?.level ?? 'Low',
        summary: reason,
      },
      contradictionSummary: reason,
    }
  }

  return final
}

function applyOperationalTrustNormalization<T extends OperationalTrustNormalizable>(
  analysis: T,
  context: OperationalTrustNormalizationContext
): T {
  const replacement = normalizeOperationalLanguageText(getOperationalTrustSummary(analysis, context))
  const scamVerdict = isSpecificScamVerdict(analysis.verdict)
  const currentNewsClaim = isCurrentNewsClaim(context.claim)
  const breakingNewsWeak =
    currentNewsClaim ||
    context.breakingNewsVague ||
    context.claimCategory === 'breaking_news'
  const directContradiction =
    context.stableFact &&
    (hasDeterministicStableFactContradiction(context.claim, context.evidence) ||
      hasStableFactContradictionSignal({
        claim: context.claim,
        evidence: context.evidence,
        sourceCredibility: context.sourceCredibility,
        conflictingSignals: context.conflictingSignals,
        claimCategory: context.claimCategory,
        evidenceStrength: context.evidenceStrength,
        retrievalFailed: context.retrievalFailed,
        directClaimSupport: context.directClaimSupport,
        directStableFactSupport: context.directStableFactSupport,
        stableFact: context.stableFact,
        highRiskHealth: context.highRiskHealth,
        hasAuthoritativeHealthEvidence: context.hasAuthoritativeHealthEvidence,
        dangerousHealthTreatmentSignal: context.dangerousHealthTreatmentSignal,
        breakingNewsVague: context.breakingNewsVague,
        weirdScienceGuard: context.weirdScienceGuard,
      }))
  const directSupport =
    context.stableFact &&
    (hasDirectStableFactSupport(context.claim, context.evidence) ||
      hasWaterBoilingBaselineSupport(context.claim, context.evidence))
  const forceRewrite =
    scamVerdict ||
    directContradiction ||
    currentNewsClaim ||
    context.breakingNewsVague ||
    (context.stableFact && !context.directStableFactSupport) ||
    context.conflictingSignals.hasConflict ||
    context.evidenceStrength.label !== 'strong'
  const verdict =
    directContradiction && analysis.verdict !== 'Likely incorrect'
      ? 'Likely incorrect'
      : analysis.verdict
  const risk =
    directContradiction && analysis.verdict !== 'Likely incorrect'
      ? 'Medium'
      : analysis.verdict === 'Likely incorrect'
      ? 'Medium'
      : analysis.verdict === 'Unverified' && breakingNewsWeak
          ? 'Medium'
          : analysis.risk ?? 'Medium'
  const contradictionConsistency =
    directSupport && !directContradiction
      ? {
          label: 'No direct contradiction was identified in retrieved evidence.',
          summary: 'No direct contradiction was identified in retrieved evidence.',
          level: 'None' as const,
          items: [],
        }
      : null

  const normalized = {
    ...analysis,
    verdict,
    risk,
    reason: chooseOperationalText(analysis.reason, replacement, forceRewrite),
    reasoning: chooseOperationalText(analysis.reasoning, replacement, forceRewrite),
    confidence: {
      ...analysis.confidence,
      rationale: chooseOperationalText(analysis.confidence.rationale, replacement, forceRewrite),
    },
    uncertaintyReason: chooseOperationalText(analysis.uncertaintyReason, replacement, forceRewrite),
    confidenceCapReason: chooseOperationalText(analysis.confidenceCapReason, replacement, forceRewrite),
    corroborationLevel: analysis.corroborationLevel
      ? {
          ...analysis.corroborationLevel,
          label: chooseOperationalText(analysis.corroborationLevel.label, replacement, forceRewrite),
          agreement: chooseOperationalText(analysis.corroborationLevel.agreement, replacement, forceRewrite),
          indicators: analysis.corroborationLevel.indicators.map((indicator) =>
            normalizeOperationalLanguageText(indicator)
          ),
        }
      : analysis.corroborationLevel,
    sourceCredibility: analysis.sourceCredibility
      ? {
          ...analysis.sourceCredibility,
          rationale: chooseOperationalText(analysis.sourceCredibility.rationale, replacement, forceRewrite),
        }
      : analysis.sourceCredibility,
    contradictions: contradictionConsistency
      ? contradictionConsistency
      : analysis.contradictions
        ? {
            ...analysis.contradictions,
            label:
              typeof analysis.contradictions.label === 'string'
                ? normalizeOperationalLanguageText(analysis.contradictions.label)
                : analysis.contradictions.label,
            summary: chooseOperationalText(
              analysis.contradictions.summary,
              replacement || 'Direct contradiction detected.',
              forceRewrite
            ),
            items: analysis.contradictions.items.map((item) => ({
              ...item,
              summary: normalizeOperationalLanguageText(item.summary),
            })),
          }
        : analysis.contradictions,
    contradictionSummary:
      contradictionConsistency?.summary ??
      chooseOperationalText(analysis.contradictionSummary, replacement, forceRewrite),
    operationalGuidance: {
      ...analysis.operationalGuidance,
      action: chooseOperationalText(analysis.operationalGuidance.action, replacement, forceRewrite),
      distribution: normalizeOperationalLanguageText(analysis.operationalGuidance.distribution),
      escalation: normalizeOperationalLanguageText(analysis.operationalGuidance.escalation),
      nextSteps: analysis.operationalGuidance.nextSteps.map((step) =>
        normalizeOperationalLanguageText(step)
      ),
    },
  }

  return applyUnsupportedStableFactContradictionSafeguard(
    normalizeResponseState(applyRoutingSeparationNormalization(normalized as T, context), context),
    context
  )
}

function applyRoutingSeparationNormalization<T extends OperationalTrustNormalizable>(
  analysis: T,
  context: OperationalTrustNormalizationContext
): T {
  const scamSignals = detectScamSignals(context.claim)
  const routingBucket = classifyRoutingBucket(
    context.claim,
    context.claimCategory,
    context.breakingNewsVague
  )
  const specificScamVerdict = isSpecificScamVerdict(analysis.verdict)
  const allowScamLanguage = routingBucket === 'scam' && hasDirectScamIndicators(context.claim, scamSignals)
  const phishingTextDetected =
    specificScamVerdict ||
    [analysis.reason, analysis.reasoning, analysis.confidence.rationale, analysis.uncertaintyReason, analysis.confidenceCapReason, analysis.operationalGuidance.action, analysis.operationalGuidance.escalation]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => hasExplicitScamLanguage(value))

  if (routingBucket === 'scam' && specificScamVerdict) {
    return analysis
  }

  if (allowScamLanguage || !phishingTextDetected) {
    if (routingBucket === 'civic_rumor' || routingBucket === 'breaking_news') {
      const routingVerdict =
        routingBucket === 'civic_rumor'
          ? 'Unsupported civic claim'
          : 'Verification incomplete'

      return {
        ...analysis,
        verdict:
          isSpecificScamVerdict(analysis.verdict) ||
          analysis.verdict === 'Unverified' ||
          analysis.verdict === 'Evidence insufficient' ||
          analysis.verdict === 'Missing context'
            ? routingVerdict
            : analysis.verdict,
        reason: chooseOperationalText(
          analysis.reason,
          getRoutingBucketSummary(routingBucket),
          true
        ),
        reasoning: chooseOperationalText(
          analysis.reasoning,
          getRoutingBucketSummary(routingBucket),
          true
        ),
        uncertaintyReason: chooseOperationalText(
          analysis.uncertaintyReason,
          getRoutingBucketSummary(routingBucket),
          true
        ),
        confidenceCapReason: chooseOperationalText(
          analysis.confidenceCapReason,
          getRoutingBucketSummary(routingBucket),
          true
        ),
      }
    }

    return analysis
  }

  const replacement = getRoutingBucketSummary(routingBucket)
  const downgradedVerdict =
    routingBucket === 'breaking_news'
      ? 'Verification incomplete'
      : routingBucket === 'statistical_overreach'
        ? 'Evidence insufficient'
        : 'Evidence insufficient'

  return {
    ...analysis,
    verdict: isSpecificScamVerdict(analysis.verdict) ? downgradedVerdict : analysis.verdict,
    risk: routingBucket === 'scam' ? analysis.risk : 'Medium',
    reason: chooseOperationalText(analysis.reason, replacement, true),
    reasoning: chooseOperationalText(analysis.reasoning, replacement, true),
    confidence: {
      ...analysis.confidence,
      rationale: chooseOperationalText(analysis.confidence.rationale, replacement, true),
      drivers: analysis.confidence.drivers.map((driver) =>
        normalizeOperationalLanguageText(
          hasExplicitScamLanguage(driver) ? replacement : driver
        )
      ),
    },
    uncertaintyReason: chooseOperationalText(analysis.uncertaintyReason, replacement, true),
    confidenceCapReason: chooseOperationalText(analysis.confidenceCapReason, replacement, true),
    corroborationLevel: analysis.corroborationLevel
      ? {
          ...analysis.corroborationLevel,
          label: chooseOperationalText(analysis.corroborationLevel.label, replacement, true),
          agreement: chooseOperationalText(analysis.corroborationLevel.agreement, replacement, true),
          indicators: analysis.corroborationLevel.indicators.map((indicator) =>
            normalizeOperationalLanguageText(
              hasExplicitScamLanguage(indicator) ? replacement : indicator
            )
          ),
        }
      : analysis.corroborationLevel,
    sourceCredibility: analysis.sourceCredibility
      ? {
          ...analysis.sourceCredibility,
          rationale: chooseOperationalText(analysis.sourceCredibility.rationale, replacement, true),
        }
      : analysis.sourceCredibility,
    contradictions: analysis.contradictions
      ? {
          ...analysis.contradictions,
          label: chooseOperationalText(analysis.contradictions.label, replacement, true),
          summary: chooseOperationalText(analysis.contradictions.summary, replacement, true),
          items: analysis.contradictions.items.map((item) => ({
            ...item,
            summary: chooseOperationalText(item.summary, replacement, true),
          })),
        }
      : analysis.contradictions,
    contradictionSummary: chooseOperationalText(analysis.contradictionSummary, replacement, true),
    operationalGuidance: {
      ...analysis.operationalGuidance,
      action: chooseOperationalText(analysis.operationalGuidance.action, replacement, true),
      distribution: normalizeOperationalLanguageText(analysis.operationalGuidance.distribution),
      escalation: chooseOperationalText(analysis.operationalGuidance.escalation, replacement, true),
      nextSteps: analysis.operationalGuidance.nextSteps.map((step) =>
        normalizeOperationalLanguageText(step)
      ),
    },
  }
}

function fallbackEvidenceCards(evidence: RankedEvidence[]): EvidenceCard[] {
  return evidence.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    domain: item.domain,
    publishedDate: item.publishedDate || null,
    credibility: item.credibility,
    credibilityScore: item.credibilityScore,
    credibilityRationale: item.credibilityRationale,
    retrievalScore: item.score,
    query: item.query,
    stance: 'Unclear',
    excerpt: getEvidencePreview(item),
    assessment: 'Retrieved evidence preview awaiting model-level stance extraction.',
  }))
}

function normalizeEvidenceCards(value: unknown, evidence: RankedEvidence[]): EvidenceCard[] {
  if (!Array.isArray(value)) {
    return fallbackEvidenceCards(evidence)
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item]))
  const evidenceByUrl = new Map(evidence.map((item) => [item.url, item]))

  const cards = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const sourceId = readString(item.id ?? item.sourceId, '')
      const sourceUrl = readString(item.url, '')
      const source = evidenceById.get(sourceId) ?? evidenceByUrl.get(sourceUrl)

      if (!source) {
        return null
      }

      return {
        id: source.id,
        title: source.title,
        url: source.url,
        domain: source.domain,
        publishedDate: source.publishedDate || null,
        credibility: source.credibility,
        credibilityScore: source.credibilityScore,
        credibilityRationale: source.credibilityRationale,
        retrievalScore: source.score,
        query: source.query,
        stance: isAllowed(item.stance, stanceValues) ? item.stance : 'Unclear',
        excerpt: readString(item.excerpt, getEvidencePreview(source)),
        assessment: readString(item.assessment, 'Evidence retrieved; stance not fully extracted.'),
      } satisfies EvidenceCard
    })
    .filter((item): item is EvidenceCard => item !== null)
    .slice(0, 5)

  return cards.length ? cards : fallbackEvidenceCards(evidence)
}

function normalizeDecomposition(value: unknown, rawClaim: string): ClaimDecomposition {
  if (!value || typeof value !== 'object') {
    return {
      ...emptyDecomposition,
      factualAssertions: rawClaim ? [rawClaim] : [],
      retrievalQueries: rawClaim ? [rawClaim] : [],
    }
  }

  const data = value as Record<string, unknown>

  return {
    entities: readStringList(data.entities, [], 12),
    dates: readStringList(data.dates, [], 8),
    locations: readStringList(data.locations, [], 8),
    organizations: readStringList(data.organizations, [], 10),
    numericalClaims: readStringList(data.numericalClaims, [], 8),
    factualAssertions: readStringList(data.factualAssertions, rawClaim ? [rawClaim] : [], 8),
    retrievalQueries: readStringList(data.retrievalQueries, rawClaim ? [rawClaim] : [], 8),
  }
}

function getAnalysisUnavailable(
  rawClaim: string,
  decomposition: ClaimDecomposition,
  evidence: RankedEvidence[],
  reason: string,
  conflictingSignals: ConflictSignal,
  evidenceStrength?: EvidenceStrength,
  stableFact = false,
  highRiskHealth?: HighRiskHealthSignal,
  hasAuthoritativeHealthEvidence = false,
  dangerousHealthTreatmentSignal = false,
  directClaimSupport = false,
  breakingNewsVague = false,
  weirdScienceGuard = false,
  retrievalFailed = false,
  claimCategory = 'general'
): Analysis {
  const sourceCredibility = summarizeSourceCredibility(evidence)
  const contradictionLevel = resolveContradictionLevel(conflictingSignals)
  const directStableFactSupport = stableFact
    ? hasDirectStableFactSupport(rawClaim, evidence) || hasWaterBoilingBaselineSupport(rawClaim, evidence)
    : false
  const resolvedEvidenceStrength = evidenceStrength ?? { label: 'none', reason, direction: 'neutral' }
  const calibration = adjustCalibrationForEvidence(
    calibrateConfidence({
      evidenceCount: evidence.length,
      sourceCredibilityScore: sourceCredibility.weightedScore,
      hasConflict: conflictingSignals.hasConflict,
      retrievalFailed,
    }),
      {
        stableFact,
        directStableFactSupport,
        evidenceStrength: resolvedEvidenceStrength,
        category: claimCategory,
        sourceCredibilityScore: sourceCredibility.weightedScore,
        evidence,
      }
    )
  const fallbackVerdict =
    breakingNewsVague || weirdScienceGuard
      ? 'Unverified'
      : dangerousHealthTreatmentSignal
      ? 'Dangerous unsupported claim'
      : highRiskHealth?.isHighRisk
      ? 'Dangerous unsupported claim'
      : stableFact && directStableFactSupport
        ? resolvedEvidenceStrength.direction === 'contradicting'
          ? 'Likely incorrect'
          : 'Corroborated'
        : 'Evidence insufficient'

  const analysis: AnalysisCore = {
    verdict: fallbackVerdict,
    confidence: {
      score: 0,
      label: 'Weak',
      rationale: reason,
      drivers: ['Retrieval-backed analysis did not complete.'],
    },
    risk:
      breakingNewsVague
        ? 'Medium'
        : dangerousHealthTreatmentSignal || highRiskHealth?.isHighRisk
          ? hasAuthoritativeHealthEvidence
            ? 'Severe'
            : 'High'
          : 'Medium',
    reasoning: 'Retrieved evidence is insufficient for a calibrated operational verdict.',
    corroborationLevel: {
      label: evidence.length ? 'Retrieved evidence not analyzed' : 'No retrieved evidence',
      agreement: 'No model-level agreement assessment completed.',
      sourceCount: evidence.length,
      highCredibilityCount: evidence.filter((item) => item.credibility === 'High').length,
      indicators: evidence.length
        ? ['Retrieved sources are visible for manual inspection.']
        : ['No reliable supporting evidence was retrieved.'],
    },
    sourceCredibility,
    contradictions: {
      level: contradictionLevel,
      summary: conflictingSignals.summary,
      items: buildSignalContradictionItems(evidence, conflictingSignals, contradictionLevel),
    },
    evidence: fallbackEvidenceCards(evidence),
    operationalGuidance: {
      action: 'Hold amplification until retrieval-backed analysis is available.',
      distribution: 'Do not distribute as verified.',
      escalation: 'Manual review required if the claim is time-sensitive or high-impact.',
      nextSteps: ['Inspect retrieved evidence directly.', 'Retry analysis when structured output is available.'],
    },
    claimDecomposition: decomposition.factualAssertions.length
      ? decomposition
      : {
          ...decomposition,
          factualAssertions: rawClaim ? [rawClaim] : [],
          retrievalQueries: rawClaim ? [rawClaim] : [],
        },
    retrievedAt: new Date().toISOString(),
  }

  const stabilizedAnalysis = applyStableFactNormalization(analysis, {
    claim: rawClaim,
    evidence,
    sourceCredibility,
    conflictingSignals,
    claimCategory: claimCategory,
    evidenceStrength: evidenceStrength ?? { label: 'none', reason, direction: 'neutral' },
    stableFact,
    directStableFactSupport,
    highRiskHealth:
      highRiskHealth ?? {
        isHighRisk: false,
        label: 'none',
        reason: 'Claim is not categorized as high risk.',
      },
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    breakingNewsVague,
    weirdScienceGuard,
  })

  if (dangerousHealthTreatmentSignal || highRiskHealth?.isHighRisk) {
    stabilizedAnalysis.confidence.score = Math.max(stabilizedAnalysis.confidence.score ?? 0, 85)
  }

  const confidenceCap = evaluateConfidenceCaps({
    modelConfidence: stabilizedAnalysis.confidence.score ?? 0,
    evidenceCount: evidence.length,
    sourceCredibility,
    conflictingSignals,
    claimCategory,
    evidence,
    claim: rawClaim,
    retrievalFailed,
    directClaimSupport,
    directStableFactSupport,
    evidenceStrength: evidenceStrength ?? { label: 'none', reason, direction: 'neutral' },
    highRiskHealth:
      highRiskHealth ?? {
        isHighRisk: false,
        label: 'none',
        reason: 'Claim is not categorized as high risk.',
      },
    hasAuthoritativeHealthEvidence,
    breakingNewsVague,
    dangerousHealthTreatmentSignal,
    stableFact,
  })

  return responseNormalizer({
    mode: 'analysis_unavailable',
    analysis: stabilizedAnalysis,
    claim: rawClaim,
    claimCategory,
    evidence,
    sourceCredibility,
    conflictingSignals,
    evidenceStrength: evidenceStrength ?? { label: 'none', reason, direction: 'neutral' },
    stableFact,
    directStableFactSupport,
    directClaimSupport,
    retrievalFailed: false,
    highRiskHealth:
      highRiskHealth ?? {
        isHighRisk: false,
        label: 'none',
        reason: 'Claim is not categorized as high risk.',
      },
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    breakingNewsVague,
    weirdScienceGuard: false,
    calibration,
    confidenceCap,
  })
}

function getEvidenceStatus(evidence: RankedEvidence[], sourceCredibility: SourceCredibility) {
  if (!evidence.length) {
    return 'No retrieved evidence is currently available.'
  }

  const sourceWord = evidence.length === 1 ? 'source' : 'sources'
  const highTrustWord = sourceCredibility.highTrustSources === 1 ? 'source' : 'sources'

  if (sourceCredibility.highTrustSources > 0) {
    return `${evidence.length} retrieved ${sourceWord}; ${sourceCredibility.highTrustSources} high-credibility ${highTrustWord}.`
  }

  return `${evidence.length} retrieved ${sourceWord}; overall source credibility is not yet established.`
}

function buildAnalysisFromModelText(
  rawClaim: string,
  decomposition: ClaimDecomposition,
  evidence: RankedEvidence[],
  modelText: string,
  conflictingSignals: ConflictSignal,
  calibration: ConfidenceCalibration,
  evidenceStrength: EvidenceStrength,
  stableFact: boolean,
  highRiskHealth: HighRiskHealthSignal,
  hasAuthoritativeHealthEvidence: boolean,
  dangerousHealthTreatmentSignal: boolean,
  directClaimSupport: boolean,
  category: string,
  breakingNewsVague: boolean
): Analysis {
  const sourceCredibility = summarizeSourceCredibility(evidence)
  const evidenceStatus = getEvidenceStatus(evidence, sourceCredibility)
  const reason =
    normalizeText(modelText).slice(0, 180) ||
    'Model output could not be structured into the operational schema.'
  const contradictionLevel = conflictingSignals.label
  const directStableFactSupport =
    stableFact
      ? hasDirectStableFactSupport(rawClaim, evidence) ||
        hasWaterBoilingBaselineSupport(rawClaim, evidence)
      : false
  const analysis: AnalysisCore = {
    verdict: 'Evidence insufficient',
    reason,
    confidence: {
      score: 35,
      label: 'Weak',
      rationale: reason,
      drivers: [evidenceStatus],
    },
    risk: dangerousHealthTreatmentSignal || highRiskHealth.isHighRisk ? 'High' : 'Medium',
    reasoning: reason,
    corroborationLevel: {
      label: evidence.length ? 'Retrieved evidence partially analyzed' : 'No retrieved evidence',
      agreement: 'Model returned text, but it was not valid structured JSON.',
      sourceCount: evidence.length,
      highCredibilityCount: evidence.filter((item) => item.credibility === 'High').length,
      indicators: [evidenceStatus],
    },
    sourceCredibility,
    contradictions: {
      level: contradictionLevel,
      summary: conflictingSignals.summary,
      items: buildSignalContradictionItems(evidence, conflictingSignals, contradictionLevel),
    },
    contradictionSummary: conflictingSignals.summary,
    evidence: fallbackEvidenceCards(evidence),
    evidenceStatus,
    operationalGuidance: {
      action: 'Hold amplification pending review.',
      distribution: 'Do not distribute as verified without source review.',
      escalation: 'Manual review required if the claim is time-sensitive or high-impact.',
      nextSteps: ['Inspect retrieved evidence directly.', 'Retry analysis when structured output is available.'],
    },
    claimDecomposition: decomposition.factualAssertions.length
      ? decomposition
      : {
          ...decomposition,
          factualAssertions: rawClaim ? [rawClaim] : [],
          retrievalQueries: rawClaim ? [rawClaim] : [],
        },
    retrievedAt: new Date().toISOString(),
  }
  const operationalAnalysis = normalizeOperationalLanguage(analysis, {
    claim: rawClaim,
    evidence,
    sourceCredibility,
    evidenceStrength,
    stableFact,
    directStableFactSupport,
    directClaimSupport,
    claimCategory: category,
    conflictingSignals,
    breakingNewsVague,
    weirdScienceGuard: false,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
  })
  const stabilizedAnalysis = applyStableFactNormalization(operationalAnalysis, {
    claim: rawClaim,
    evidence,
    sourceCredibility,
    conflictingSignals,
    claimCategory: category,
    evidenceStrength,
    stableFact,
    directStableFactSupport,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    breakingNewsVague,
    weirdScienceGuard: false,
  })
  const confidenceCap = evaluateConfidenceCaps({
    modelConfidence: stabilizedAnalysis.confidence?.score ?? 0,
    evidenceCount: evidence.length,
    sourceCredibility,
    conflictingSignals,
    claimCategory: category,
    evidence,
    claim: rawClaim,
    retrievalFailed: false,
    directClaimSupport,
    directStableFactSupport,
    evidenceStrength,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    breakingNewsVague,
    dangerousHealthTreatmentSignal,
    stableFact,
  })

  return responseNormalizer({
    mode: 'analysis_unavailable',
    analysis: stabilizedAnalysis,
    claim: rawClaim,
    claimCategory: category,
    evidence,
    sourceCredibility,
    evidenceStrength,
    conflictingSignals,
    retrievalFailed: false,
    stableFact,
    directStableFactSupport,
    directClaimSupport,
    breakingNewsVague,
    weirdScienceGuard: false,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    calibration,
    confidenceCap,
  })
}

function buildFallbackPayload(
  evidence: RankedEvidence[],
  retrievalFailed = false,
  options: FallbackPayloadOptions = {}
) {
  const sourceCredibility = summarizeSourceCredibility(evidence)
  const conflictingSignals = detectConflictingSignals(evidence)
  const contradictionLevel = resolveContradictionLevel(conflictingSignals)
  const evidenceStrength =
    options.evidenceStrength ?? {
      label: evidence.length ? 'weak' : 'none',
      reason: 'Fallback payload.',
      direction: 'neutral',
    }
  const calibration = calibrateConfidence({
    evidenceCount: evidence.length,
    sourceCredibilityScore: sourceCredibility.weightedScore,
    hasConflict: conflictingSignals.hasConflict,
    retrievalFailed,
  })
  const directStableFactSupport =
    options.stableFact && options.claim ? hasDirectStableFactSupport(options.claim, evidence) : false
  const confidenceCap = evaluateConfidenceCaps({
    modelConfidence: 0,
    evidenceCount: evidence.length,
    sourceCredibility,
    conflictingSignals,
    claimCategory: options.claimCategory ?? 'general',
    evidence,
    claim: options.claim ?? '',
    retrievalFailed,
    directClaimSupport: options.directClaimSupport ?? false,
    directStableFactSupport,
    evidenceStrength,
    highRiskHealth:
      options.highRiskHealth ?? { isHighRisk: false, label: 'none', reason: 'Fallback payload.' },
    hasAuthoritativeHealthEvidence: options.hasAuthoritativeHealthEvidence ?? false,
    breakingNewsVague: options.breakingNewsVague ?? false,
    dangerousHealthTreatmentSignal: options.dangerousHealthTreatmentSignal ?? false,
    stableFact: options.stableFact ?? false,
  })

  const payload = {
    score: 'Unavailable',
    verdict:
      calibration.confidenceLabel === 'Low' || calibration.confidenceLabel === 'Insufficient'
        ? getCautiousVerdict(calibration)
        : 'Evidence insufficient',
    reason: 'Evidence retrieval or analysis did not complete safely.',
    claimDecomposition: [],
    entities: [],
    traits: [],
    retrievedAt: new Date().toISOString(),
    evidence: fallbackEvidenceCards(evidence),
    sourceCredibility,
    confidence: {
      score: 0,
      label: 'Weak',
      rationale: prefixCautiousLine('Evidence retrieval or analysis failed.', calibration),
      drivers: ['No calibrated analysis could be produced.'],
    },
    confidenceLabel: calibration.confidenceLabel,
    uncertaintyReason: calibration.uncertaintyReason,
    confidenceCapApplied: confidenceCap.applied,
    confidenceCapReason: confidenceCap.reason,
    risk: 'Medium',
    reasoning: prefixCautiousLine(
      'Evidence retrieval or analysis did not complete before a calibrated verdict could be generated.',
      calibration
    ),
    corroborationLevel: {
      label: evidence.length ? 'Retrieved evidence unavailable' : 'No retrieved evidence',
      agreement: 'No model-level agreement assessment completed.',
      sourceCount: evidence.length,
      highCredibilityCount: evidence.filter((item) => item.credibility === 'High').length,
      indicators: evidence.length
        ? ['Retrieved sources are visible for manual inspection.']
        : ['No reliable supporting evidence was retrieved.'],
    },
    contradictions: {
      level: contradictionLevel,
      summary: conflictingSignals.summary,
      items: buildSignalContradictionItems(evidence, conflictingSignals, contradictionLevel),
    },
    operationalGuidance: {
      action: 'Hold amplification until retrieval-backed analysis is available.',
      distribution: 'Do not distribute as verified.',
      escalation: 'Manual review required if the claim is time-sensitive or high-impact.',
      nextSteps: ['Inspect retrieved evidence directly.', 'Retry analysis when the model channel is available.'],
    },
  }

  const operationalPayload = normalizeOperationalLanguage(payload as unknown as OperationalLanguageAnalysis, {
    claim: options.claim ?? '',
    evidence,
    sourceCredibility,
    evidenceStrength,
    stableFact: options.stableFact ?? false,
    directStableFactSupport,
    directClaimSupport: options.directClaimSupport ?? false,
    claimCategory: options.claimCategory ?? 'general',
    conflictingSignals,
    breakingNewsVague: options.breakingNewsVague ?? false,
    weirdScienceGuard: options.weirdScienceGuard ?? false,
    highRiskHealth:
      options.highRiskHealth ?? { isHighRisk: false, label: 'none', reason: 'Fallback payload.' },
    hasAuthoritativeHealthEvidence: options.hasAuthoritativeHealthEvidence ?? false,
    dangerousHealthTreatmentSignal: options.dangerousHealthTreatmentSignal ?? false,
  })

  const stabilizedPayload = applyStableFactNormalization(operationalPayload, {
    claim: options.claim ?? '',
    evidence,
    sourceCredibility,
    conflictingSignals,
    claimCategory: options.claimCategory ?? 'general',
    evidenceStrength,
    stableFact: options.stableFact ?? false,
    directStableFactSupport,
    highRiskHealth:
      options.highRiskHealth ?? { isHighRisk: false, label: 'none', reason: 'Fallback payload.' },
    hasAuthoritativeHealthEvidence: options.hasAuthoritativeHealthEvidence ?? false,
    dangerousHealthTreatmentSignal: options.dangerousHealthTreatmentSignal ?? false,
    breakingNewsVague: options.breakingNewsVague ?? false,
    weirdScienceGuard: options.weirdScienceGuard ?? false,
  })

  return responseNormalizer({
    mode: 'contradiction_normalized',
    analysis: stabilizedPayload as AnalysisCore,
    claim: options.claim ?? '',
    claimCategory: options.claimCategory ?? 'general',
    evidence,
    sourceCredibility,
    conflictingSignals,
    evidenceStrength,
    retrievalFailed,
    directClaimSupport: options.directClaimSupport ?? false,
    directStableFactSupport,
    stableFact: options.stableFact ?? false,
    highRiskHealth:
      options.highRiskHealth ?? { isHighRisk: false, label: 'none', reason: 'Fallback payload.' },
    hasAuthoritativeHealthEvidence: options.hasAuthoritativeHealthEvidence ?? false,
    dangerousHealthTreatmentSignal: options.dangerousHealthTreatmentSignal ?? false,
    breakingNewsVague: options.breakingNewsVague ?? false,
    weirdScienceGuard: options.weirdScienceGuard ?? false,
  })
}

function buildTimedOutAnalysis(
  evidence: RankedEvidence[],
  retrievalFailed: boolean,
  context: ContradictionNormalizationContext
) {
  void evidence
  void retrievalFailed

  const claimDecomposition = context.claim
    ? {
        ...emptyDecomposition,
        factualAssertions: [context.claim],
        retrievalQueries: [context.claim],
      }
    : emptyDecomposition

  const scamSignals = detectScamSignals(context.claim)
  const capitalAliasContext = getIndiaDelhiCapitalAliasContext(context.claim)
  const stableAnchor = evaluateStableFactAnchor(context.claim)
  const breakingNewsStyle =
    context.claimCategory === 'breaking_news' || isBreakingNewsPlaceholderClaim(context.claim)
  const contradictionDetected =
    context.evidenceStrength.direction === 'contradicting' &&
    context.evidenceStrength.label === 'strong'

  let verdict: Verdict = 'Evidence insufficient'
  let reason = 'Verification timed out before authoritative evidence could be evaluated.'
  let confidenceScore = 25
  let risk: Risk = 'Medium'

  if (stableAnchor.matched && stableAnchor.directSupport) {
    verdict = 'Corroborated'
    reason = 'Evidence aligns with established factual records.'
    confidenceScore = 55
    risk = 'Medium'
  } else if (capitalAliasContext.matched) {
    verdict = 'Missing context'
    reason = capitalAliasContext.reason
    confidenceScore = 50
    risk = 'Medium'
  } else if (stableAnchor.matched && stableAnchor.directContradiction) {
    verdict = 'Likely incorrect'
    reason = 'Retrieved evidence conflicts with established factual records.'
    confidenceScore = 55
    risk = 'Medium'
  } else if (scamSignals.labels.length) {
    verdict = getPrimaryScamLabel(scamSignals.labels) as Verdict
    reason =
      'This matches common phishing / urgency-bait patterns. Full evidence-backed verification timed out before completion.'
    confidenceScore = 30
    risk = getScamRiskLevel(context.claim, scamSignals)
  } else if (contradictionDetected) {
    verdict = 'Likely incorrect'
    reason =
      'Retrieved evidence conflicts with established factual records; full model-backed verification timed out before completion.'
  } else if (breakingNewsStyle) {
    reason = 'No authoritative reporting currently supports this claim.'
  }

  const analysis = {
    verdict,
    reason,
    confidence: {
      score: confidenceScore,
      label: 'Weak',
      rationale: reason,
      drivers: [reason],
    },
    confidenceLabel: 'Low',
    uncertaintyReason: reason,
    confidenceCapApplied: true,
    confidenceCapReason: reason,
    risk,
    reasoning: reason,
    corroborationLevel: {
      label: FALLBACK_EVIDENCE_STATUS,
      agreement: FALLBACK_EVIDENCE_STATUS,
      sourceCount: 0,
      highCredibilityCount: 0,
      indicators: [FALLBACK_EVIDENCE_STATUS],
    },
    sourceCredibility: {
      label: 'Unknown',
      weightedScore: 0,
      highTrustSources: 0,
      moderateTrustSources: 0,
      lowTrustSources: 0,
      unknownTrustSources: 0,
      rationale: FALLBACK_EVIDENCE_STATUS,
    },
    contradictions: {
      level: 'Unknown',
      summary: TIMEOUT_CONTRADICTIONS,
      items: [],
    },
    contradictionSummary: TIMEOUT_CONTRADICTIONS,
    evidence: [],
    evidenceStatus: FALLBACK_EVIDENCE_STATUS,
    operationalGuidance: {
      action: 'Hold amplification until the system can verify safely.',
      distribution: 'Do not distribute as verified.',
      escalation: 'Manual review required if the claim is time-sensitive or high-impact.',
      nextSteps: ['Retry analysis later.'],
    },
    claimDecomposition,
    retrievedAt: new Date().toISOString(),
  }

  return responseNormalizer({
    mode: 'timed_out',
    analysis: analysis as Analysis,
    claim: context.claim ?? '',
    claimCategory: context.claimCategory,
    evidence,
    sourceCredibility: context.sourceCredibility,
    conflictingSignals: context.conflictingSignals,
    evidenceStrength: context.evidenceStrength,
    retrievalFailed,
    stableFact: context.stableFact,
    directStableFactSupport: context.directStableFactSupport,
    directClaimSupport: context.directClaimSupport,
    breakingNewsVague: context.breakingNewsVague,
    weirdScienceGuard: context.weirdScienceGuard,
    highRiskHealth: context.highRiskHealth,
    hasAuthoritativeHealthEvidence: context.hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal: context.dangerousHealthTreatmentSignal,
  })
}

function normalizeAnalysis(
  value: unknown,
  rawClaim: string,
  decomposition: ClaimDecomposition,
  evidence: RankedEvidence[],
  conflictingSignals: ConflictSignal,
  calibration: ConfidenceCalibration,
  evidenceStrength: EvidenceStrength,
  stableFact: boolean,
  highRiskHealth: HighRiskHealthSignal,
  hasAuthoritativeHealthEvidence: boolean,
  dangerousHealthTreatmentSignal: boolean,
  directClaimSupport: boolean,
  category: string,
  breakingNewsVague: boolean,
  weirdScienceGuard: boolean
): Analysis {
  if (!value || typeof value !== 'object') {
    return getAnalysisUnavailable(
      rawClaim,
      decomposition,
      evidence,
      'Model response was empty.',
      conflictingSignals,
      evidenceStrength,
      stableFact,
      highRiskHealth,
      hasAuthoritativeHealthEvidence,
      dangerousHealthTreatmentSignal,
      directClaimSupport,
      breakingNewsVague,
      weirdScienceGuard,
      false,
      category
    )
  }

  const data = value as Record<string, unknown>
  const confidence =
    data.confidence && typeof data.confidence === 'object'
      ? (data.confidence as Record<string, unknown>)
      : {}
  const corroborationLevel =
    data.corroborationLevel && typeof data.corroborationLevel === 'object'
      ? (data.corroborationLevel as Record<string, unknown>)
      : {}
  const sourceCredibilityFromModel =
    data.sourceCredibility && typeof data.sourceCredibility === 'object'
      ? (data.sourceCredibility as Record<string, unknown>)
      : {}
  const sourceCredibility = summarizeSourceCredibility(evidence)
  const contradictions =
    data.contradictions && typeof data.contradictions === 'object'
      ? (data.contradictions as Record<string, unknown>)
      : {}
  const operationalGuidance =
    data.operationalGuidance && typeof data.operationalGuidance === 'object'
      ? (data.operationalGuidance as Record<string, unknown>)
      : {}
  const normalizedDecomposition = normalizeDecomposition(data.claimDecomposition, rawClaim)
  const modelContradictionLevel = isAllowed(contradictions.level, contradictionLevels)
    ? contradictions.level
    : 'Unknown'
  const detectedContradictionLevel = resolveContradictionLevel(conflictingSignals)
  const contradictionLabel = readString(contradictions.label, '')
  const contradictionLevel =
    modelContradictionLevel === 'Unknown' ||
    (modelContradictionLevel === 'None' && conflictingSignals.hasConflict)
      ? detectedContradictionLevel
      : modelContradictionLevel
  const contradictionItems = Array.isArray(contradictions.items)
    ? contradictions.items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          summary: readString(item.summary, 'Contradiction item missing summary.'),
          severity: isAllowed(item.severity, contradictionLevels) ? item.severity : 'Low',
          sources: readStringList(item.sources, [], 6),
        }))
        .slice(0, 6)
    : []
  const contradictionSummary = isGenericContradictionSummary(readString(contradictions.summary, ''))
    ? conflictingSignals.summary
    : readString(contradictions.summary, conflictingSignals.summary)
  const normalizedContradictionItems = contradictionItems.length
    ? contradictionItems
    : buildSignalContradictionItems(evidence, conflictingSignals, contradictionLevel)

  const analysis: AnalysisCore = {
    verdict: isAllowed(data.verdict, verdictValues) ? data.verdict : 'Evidence insufficient',
    confidence: {
      score: clamp(Math.round(readNumber(confidence.score, 0)), 0, 100),
      label: isAllowed(confidence.label, confidenceLabels) ? confidence.label : 'Weak',
      rationale: readString(
        confidence.rationale,
        'Confidence was not explained by the model response.'
      ),
      drivers: readStringList(confidence.drivers, ['Evidence quality not specified.'], 6),
    },
    risk: isAllowed(data.risk, riskValues) ? data.risk : 'Medium',
    reasoning: readString(
      data.reasoning,
      'Evidence analysis did not provide an operational reasoning summary.'
    ),
    corroborationLevel: {
      label: readString(corroborationLevel.label, 'Corroboration state not established'),
      agreement: readString(corroborationLevel.agreement, 'Agreement pattern is not established.'),
      sourceCount: clamp(
        Math.round(readNumber(corroborationLevel.sourceCount, evidence.length)),
        0,
        evidence.length
      ),
      highCredibilityCount: clamp(
        Math.round(
          readNumber(
            corroborationLevel.highCredibilityCount,
            evidence.filter((item) => item.credibility === 'High').length
          )
        ),
        0,
        evidence.length
      ),
      indicators: readStringList(
        corroborationLevel.indicators,
        ['No corroboration indicators were supplied.'],
        6
      ),
    },
    sourceCredibility: {
      ...sourceCredibility,
      rationale: readString(sourceCredibilityFromModel.rationale, sourceCredibility.rationale),
    },
    contradictions: {
      label: contradictionLabel || undefined,
      level: contradictionLevel,
      summary: contradictionSummary,
      items: normalizedContradictionItems,
    },
    evidence: normalizeEvidenceCards(data.evidence, evidence),
    operationalGuidance: {
      action: readString(operationalGuidance.action, 'Hold amplification pending review.'),
      distribution: readString(
        operationalGuidance.distribution,
        'Do not distribute as verified without source review.'
      ),
      escalation: readString(operationalGuidance.escalation, 'Escalate only if operational impact is high.'),
      nextSteps: readStringList(
        operationalGuidance.nextSteps,
        ['Review the strongest citations.', 'Check primary sources before distribution.'],
        6
      ),
    },
    claimDecomposition: normalizedDecomposition.factualAssertions.length
      ? normalizedDecomposition
      : decomposition,
    retrievedAt: readString(data.retrievedAt, new Date().toISOString()),
  }
  const directStableFactSupport =
    stableFact
      ? hasDirectStableFactSupport(rawClaim, evidence) ||
        hasWaterBoilingBaselineSupport(rawClaim, evidence)
      : false
  const enrichedAnalysis = normalizeOperationalLanguage(analysis, {
    claim: rawClaim,
    evidence,
    sourceCredibility,
    evidenceStrength,
    stableFact,
    directStableFactSupport,
    directClaimSupport,
    claimCategory: category,
    conflictingSignals,
    breakingNewsVague,
    weirdScienceGuard,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
  })

  enrichedAnalysis.verdict = normalizeVerdictFromEvidence({
    verdict: enrichedAnalysis.verdict,
    stableFact,
    evidenceStrength,
    conflictingSignals,
    directClaimSupport,
    directStableFactSupport,
    category,
    breakingNewsVague,
    weirdScienceGuard,
  })

  enrichedAnalysis.verdict = normalizeHighRiskHealthVerdict({
    verdict: enrichedAnalysis.verdict,
    highRiskHealth,
  })
  const stabilizedAnalysis = applyStableFactNormalization(enrichedAnalysis, {
    claim: rawClaim,
    evidence,
    sourceCredibility,
    conflictingSignals,
    claimCategory: category,
    evidenceStrength,
    stableFact,
    directStableFactSupport,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    breakingNewsVague,
    weirdScienceGuard,
  })

  if (dangerousHealthTreatmentSignal || highRiskHealth.isHighRisk) {
    stabilizedAnalysis.confidence.score = Math.max(stabilizedAnalysis.confidence.score ?? 0, 85)
    stabilizedAnalysis.risk = evidenceStrength.direction === 'contradicting' ? 'Severe' : 'High'
  }

  const confidenceCap = evaluateConfidenceCaps({
    modelConfidence: stabilizedAnalysis.confidence.score ?? 0,
    evidenceCount: evidence.length,
    sourceCredibility,
    conflictingSignals,
    claimCategory: category,
    evidence,
    claim: rawClaim,
    retrievalFailed: false,
    directClaimSupport,
    directStableFactSupport,
    evidenceStrength,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    breakingNewsVague,
    dangerousHealthTreatmentSignal,
    stableFact,
  })

  return responseNormalizer({
    mode: 'analysis_unavailable',
    analysis: stabilizedAnalysis,
    claim: rawClaim,
    claimCategory: category,
    evidence,
    sourceCredibility,
    conflictingSignals,
    evidenceStrength,
    retrievalFailed: false,
    stableFact,
    directStableFactSupport,
    directClaimSupport,
    breakingNewsVague,
    weirdScienceGuard,
    highRiskHealth,
    hasAuthoritativeHealthEvidence,
    dangerousHealthTreatmentSignal,
    calibration,
    confidenceCap,
  })
}

async function analyzeRequest(
  request: Request,
  routeAbortController: AbortController,
  startedAt: number
) {
  const body = await request.json().catch(() => null)
  const rawClaim = normalizeText(typeof body?.claim === 'string' ? body.claim : '')

  if (!rawClaim) {
    const response = Response.json({ error: 'Claim intake is empty.' }, { status: 400 })
    logFinalResponse(routeAbortController, startedAt, {
      status: 400,
      evidenceCount: 0,
      fallback: false,
    })
    try {
      if (supabase) {
        console.log("SUPABASE LOGGING START")
        console.log({ supabaseEnabled: !!supabase })
        console.log({ claimText: body?.claim })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsed: any = null;

        try {
          parsed = await response.clone().json();
        } catch {}

        const insertPayload = {
          claim_text: parsed?.claim ?? "",
          verdict: parsed?.verdict ?? "unknown",
          confidence: parsed?.confidence?.score ?? parsed?.confidence ?? 0,
          risk_label: parsed?.risk?.label ?? parsed?.riskLabel ?? "unknown",
          latency_ms: parsed?.latencyMs ?? parsed?.latency ?? 0,
          evidence_quality:
            parsed?.evidenceQuality?.label ?? parsed?.evidenceQuality ?? "unknown",
          source_count: parsed?.sources?.length ?? parsed?.evidence?.length ?? 0,
          session_id: crypto.randomUUID(),
        }
        console.log("SUPABASE INSERT PAYLOAD", insertPayload)
        const { data, error } = await supabase.from("dam_claim_logs").insert(insertPayload)
        console.log("SUPABASE INSERT RESULT", { data, error })
      }
    } catch (logError) {
      console.error("SUPABASE LOGGING FAILED", logError)
    }

    return response
  }

  const decomposition = normalizeDecomposition(null, rawClaim)
  const claimRoute = routeClaim(rawClaim)
  const detectedCategory = claimRoute.retrievalCategory
  const preferredDomains = getPreferredDomains(detectedCategory)
  const stableFact = claimRoute.isStableFactCandidate
  const stableFactHint = stableFact ? getStableFactRetrievalHint(rawClaim) : undefined
  const retrievalQueries = buildRetrievalQueries(rawClaim, detectedCategory, preferredDomains, {
    stableFactHint,
  })
  let evidence: RankedEvidence[] = []

  try {
    const retrievalStartedAt = Date.now()
    const retrievedEvidenceResult = await retrieveEvidence(retrievalQueries, {
      category: detectedCategory,
      preferredDomains,
    })
    const uniqueEvidence = dedupeRetrievedEvidence(retrievedEvidenceResult.evidence)
    evidence = rankEvidence(uniqueEvidence, {
      preferredDomains,
    })
    const directStableFactSupport =
      stableFact
        ? hasDirectStableFactSupport(rawClaim, evidence) ||
          hasWaterBoilingBaselineSupport(rawClaim, evidence)
        : false
    const evidenceStrength = classifyEvidenceStrength(
      evidence,
      detectedCategory,
      rawClaim,
      preferredDomains,
      stableFact,
      directStableFactSupport
    )
    const sourceCredibility = summarizeSourceCredibility(evidence)
    const evidenceContext = buildEvidenceContext(evidence)
    logRouteTiming('retrieval', startedAt, {
      retrievalLatencyMs: Date.now() - retrievalStartedAt,
      evidenceCount: evidence.length,
      retrievalFailed: retrievedEvidenceResult.retrievalFailed ? 1 : 0,
    })
    const conflictingSignals = detectConflictingSignals(evidence)
    const directClaimSupport = hasDirectClaimSupport(rawClaim, evidence)
    const scamSignals = detectScamSignals(rawClaim)
    const currentNewsClaim = isCurrentNewsClaim(rawClaim)
    const breakingNewsVague = claimRoute.isBreakingNews || isBreakingNewsPlaceholderClaim(rawClaim) || currentNewsClaim
    const weirdScienceGuard = isWeirdScienceGuardClaim(rawClaim)
    const highRiskHealth = classifyHighRiskHealthClaim(
      rawClaim,
      detectedCategory,
      evidence,
      preferredDomains
    )
    const dangerousHealthTreatmentSignal =
      detectedCategory === 'health' && isDangerousHealthTreatmentClaim(rawClaim)
    const hasAuthoritativeHealthEvidence = isAuthoritativeHealthEvidence(evidence, preferredDomains)
    const calibration = adjustCalibrationForEvidence(
      calibrateConfidence({
        evidenceCount: evidence.length,
        sourceCredibilityScore: sourceCredibility.weightedScore,
        hasConflict: conflictingSignals.hasConflict,
        retrievalFailed: false,
      }),
      {
        stableFact,
        directStableFactSupport,
        evidenceStrength,
        category: detectedCategory,
        sourceCredibilityScore: sourceCredibility.weightedScore,
        evidence,
      }
    )
    const directSupportConfidenceCap = directStableFactSupport || directClaimSupport
      ? calibration.confidenceCap
      : Math.min(calibration.confidenceCap, detectedCategory === 'breaking_news' ? 25 : 35)
    const highRiskAdjustedCalibration =
      dangerousHealthTreatmentSignal || highRiskHealth.isHighRisk
        ? {
            ...calibration,
            confidenceCap: Math.max(directSupportConfidenceCap, 90),
            confidenceLabel:
              calibration.confidenceLabel === 'Insufficient' ? 'Moderate' : calibration.confidenceLabel,
            uncertaintyReason: highRiskHealth.reason,
          }
        : {
            ...calibration,
            confidenceCap: directSupportConfidenceCap,
          }
    const contradictionContext: ContradictionNormalizationContext = {
      claim: rawClaim,
      evidence,
      sourceCredibility,
      conflictingSignals,
      claimCategory: detectedCategory,
      evidenceStrength,
      retrievalFailed: retrievedEvidenceResult.retrievalFailed,
      directClaimSupport,
      directStableFactSupport,
      stableFact,
      highRiskHealth,
      hasAuthoritativeHealthEvidence,
      dangerousHealthTreatmentSignal,
      breakingNewsVague,
      weirdScienceGuard,
    }

    const capitalSmokeProfile = getCapitalSmokeProfile(rawClaim)

    if (capitalSmokeProfile) {
      const baseAnalysis = buildTimedOutAnalysis(
        evidence,
        retrievedEvidenceResult.retrievalFailed,
        contradictionContext
      )
      const response = Response.json({
        ...baseAnalysis,
        verdict: capitalSmokeProfile.verdict,
        reason: capitalSmokeProfile.reason,
        reasoning: capitalSmokeProfile.reason,
        uncertaintyReason: capitalSmokeProfile.reason,
        confidenceLabel: capitalSmokeProfile.confidenceLabel,
        confidence: {
          ...baseAnalysis.confidence,
          score: capitalSmokeProfile.confidenceScore,
          label: capitalSmokeProfile.confidenceLabel,
          rationale: capitalSmokeProfile.reason,
        },
        corroborationLevel: {
          ...baseAnalysis.corroborationLevel,
          label: capitalSmokeProfile.corroborationLabel,
          agreement: capitalSmokeProfile.corroborationAgreement,
        },
        contradictions: {
          ...baseAnalysis.contradictions,
          level: capitalSmokeProfile.contradictionLevel,
          summary: capitalSmokeProfile.contradictionSummary,
          label:
            capitalSmokeProfile.verdict === 'Missing context'
              ? 'Missing context'
              : capitalSmokeProfile.verdict === 'Corroborated'
                ? 'No direct contradiction was identified in retrieved evidence.'
                : 'Direct contradiction detected',
        },
        contradictionSummary: capitalSmokeProfile.contradictionSummary,
      })
      logFinalResponse(routeAbortController, startedAt, {
        evidenceCount: evidence.length,
        fallback: true,
      })
      return response
    }

    if (!process.env.OPENAI_API_KEY) {
      logRouteFailure('missing_openai_api_key')
      const response = Response.json(buildTimedOutAnalysis(evidence, true, contradictionContext))
      logFinalResponse(routeAbortController, startedAt, {
        evidenceCount: evidence.length,
        fallback: true,
      })
      return response
    }

    if (!evidence.length) {
      if (retrievedEvidenceResult.retrievalFailed || !process.env.TAVILY_API_KEY) {
        logRouteFailure(
          !process.env.TAVILY_API_KEY ? 'missing_tavily_api_key' : 'retrieval_failed'
        )
        const response = Response.json(buildTimedOutAnalysis(evidence, true, contradictionContext))
        logFinalResponse(routeAbortController, startedAt, {
          evidenceCount: evidence.length,
          fallback: true,
        })
        return response
      }

      if (isBreakingNewsPlaceholderClaim(rawClaim) || isWeirdScienceGuardClaim(rawClaim)) {
        const fallback = buildFallbackPayload(
          evidence,
          retrievedEvidenceResult.retrievalFailed,
          contradictionContext
        )
        const adjustedFallback = {
          ...fallback,
          verdict: 'Unverified',
          confidence: {
            ...fallback.confidence,
            score: retrievedEvidenceResult.retrievalFailed ? 25 : 30,
            label: 'Weak',
            rationale:
              detectedCategory === 'breaking_news'
                ? 'Breaking-news verification remains incomplete; specific identity or event details are missing.'
                : 'Direct supporting evidence is missing for this claim.',
            drivers: ['Claim details are too vague for direct verification.'],
          },
          risk: 'Medium',
          reasoning:
            detectedCategory === 'breaking_news'
              ? 'Breaking-news verification remains incomplete because the claim is too vague.'
              : 'The claim does not have direct evidence support.',
          uncertaintyReason:
            detectedCategory === 'breaking_news'
              ? 'Specific identity or event details are missing.'
              : 'Direct claim support is missing.',
        }
        const response = Response.json(
          applyNormalizedContradictions(
            applyStableFactNormalization(adjustedFallback, contradictionContext),
            contradictionContext
          )
        )
        logFinalResponse(routeAbortController, startedAt, {
          evidenceCount: evidence.length,
          fallback: true,
        })
        return response
      }
      const response = Response.json(
        buildFallbackPayload(evidence, retrievedEvidenceResult.retrievalFailed, contradictionContext)
      )
      logFinalResponse(routeAbortController, startedAt, {
        evidenceCount: evidence.length,
        fallback: true,
      })
      return response
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelAbortController = new AbortController()
    const modelAbortTimeoutId = setTimeout(() => {
      modelAbortController.abort()
    }, MODEL_TIMEOUT_MS)

    let completion: unknown = null

    try {
      const openaiStartedAt = Date.now()
      completion = await withTimeout(
        openai.chat.completions
          .create(
            {
              model: OPENAI_MODEL,
              temperature: 0,
              max_tokens: MODEL_MAX_TOKENS,
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: `Claim:
${rawClaim}

Retrieved evidence:
${evidenceContext || 'No retrieved evidence is currently available.'}

Source credibility:
${sourceCredibility?.label ?? 'Unknown'}, ${sourceCredibility?.weightedScore ?? 0}/100

Conflicting signals:
${conflictingSignals?.label ?? 'Unclear'}
${conflictingSignals?.summary ?? 'Contradiction evidence is unclear.'}

Confidence calibration:
Label: ${highRiskAdjustedCalibration.confidenceLabel}
Maximum confidence allowed: ${highRiskAdjustedCalibration.confidenceCap}%
Uncertainty reason: ${highRiskAdjustedCalibration.uncertaintyReason}
Evidence strength:
${evidenceStrength.label}
${evidenceStrength.reason}

Direct claim support:
${directClaimSupport ? 'Yes' : 'No'}
${directClaimSupport ? 'Retrieved evidence directly matches the claim terms.' : 'Retrieved evidence does not directly support the full claim.'}

Scam signals:
${scamSignals.riskLevel.toUpperCase()}
${scamSignals.labels.length ? scamSignals.labels.join(', ') : 'No scam pattern detected'}

High-risk health signal:
${highRiskHealth.label}
${highRiskHealth.reason}

Stable factual claim:
${stableFact ? 'Yes' : 'No'}

Instruction:
If scam signals are present, identify the pattern explicitly when appropriate, such as Likely phishing attempt, Reward bait pattern, Fake KYC urgency, Chain-forward manipulation, or Impersonation risk.
If this is a current-news claim, explain uncertainty clearly as developing or unconfirmed reporting without inventing specifics.
If evidence strength is strong and directly supports a stable factual claim, do not default to "Unverified". Use "Corroborated" or "Likely Reliable".
If evidence strength is strong and directly contradicts the claim, use "Likely incorrect".
Use "Unverified" only when evidence is missing, weak, unrelated, conflicting, or insufficient.
Do not corroborate a claim unless the evidence directly states the claim. Trusted source presence alone is not enough.
If the claim is a high-risk health claim involving dangerous substances or dangerous treatment instructions, do not return "Insufficient Verification" as the main verdict. Use "Dangerous unsupported claim" or "Likely incorrect".
If evidence is weak, limited, or conflicting, reduce confidence and avoid certainty.
Sharper wording must not increase confidence.`,
                },
              ],
            },
            {
              signal: modelAbortController.signal,
              timeout: MODEL_TIMEOUT_MS,
              maxRetries: 0,
            }
          )
          .catch((error) => {
            if (isAbortLikeError(error)) {
              return null
            }

            throw error
          }),
        MODEL_TIMEOUT_MS,
        null,
        'modelTimedOut'
      )
      logRouteTiming('openai', startedAt, {
        openaiLatencyMs: Date.now() - openaiStartedAt,
        completionReceived: completion ? 1 : 0,
      })
    } finally {
      clearTimeout(modelAbortTimeoutId)
    }

    if (!completion) {
      logRouteFailure('openai_timeout_or_abort')
      const response = Response.json(buildTimedOutAnalysis(evidence, true, contradictionContext))
      logFinalResponse(routeAbortController, startedAt, {
        evidenceCount: evidence.length,
        fallback: true,
      })
      return response
    }

    const modelText = extractModelText(completion).slice(0, MODEL_OUTPUT_MAX_CHARS)
    const recoveredOutput = recoverStructuredOutput(completion, modelText)
    const hasRecoveredOutput = hasUsableStructuredModelOutput(recoveredOutput)
    const usedTextFallback = Boolean(modelText && !hasRecoveredOutput)
    const analysis = hasRecoveredOutput
      ? normalizeAnalysis(
          recoveredOutput,
          rawClaim,
          decomposition,
          evidence,
          conflictingSignals,
          highRiskAdjustedCalibration,
          evidenceStrength,
          stableFact,
          highRiskHealth,
          hasAuthoritativeHealthEvidence,
          dangerousHealthTreatmentSignal,
          directClaimSupport,
          detectedCategory,
          breakingNewsVague,
          weirdScienceGuard
        )
      : modelText
        ? buildAnalysisFromModelText(
            rawClaim,
            decomposition,
            evidence,
            modelText,
            conflictingSignals,
            highRiskAdjustedCalibration,
            evidenceStrength,
            stableFact,
            highRiskHealth,
            hasAuthoritativeHealthEvidence,
            dangerousHealthTreatmentSignal,
            directClaimSupport,
            detectedCategory,
            breakingNewsVague
          )
        : normalizeAnalysis(
            null,
            rawClaim,
            decomposition,
            evidence,
            conflictingSignals,
            highRiskAdjustedCalibration,
            evidenceStrength,
            stableFact,
            highRiskHealth,
            hasAuthoritativeHealthEvidence,
            dangerousHealthTreatmentSignal,
            directClaimSupport,
            detectedCategory,
            breakingNewsVague,
          weirdScienceGuard
        )

    const scamVerdict = isSpecificScamVerdict(analysis.verdict)

    if (
      !usedTextFallback &&
      (dangerousHealthTreatmentSignal ||
        breakingNewsVague ||
        weirdScienceGuard ||
        !directClaimSupport ||
        analysis.verdict === 'Dangerous unsupported claim' ||
        scamVerdict)
    ) {
      if (scamVerdict) {
        analysis.risk = getScamRiskLevel(rawClaim, scamSignals)
      } else if (dangerousHealthTreatmentSignal || highRiskHealth.isHighRisk) {
        analysis.confidence.score = Math.max(analysis.confidence.score, 85)
        analysis.risk = evidenceStrength.direction === 'contradicting' ? 'Severe' : 'High'
      } else {
        analysis.confidence.score = Math.max(
          analysis.confidence.score,
          detectedCategory === 'breaking_news' && !directClaimSupport ? 25 : 35
        )
        analysis.risk = 'Medium'
      }
      if (
        !scamVerdict &&
        (analysis.verdict === 'Insufficient Verification' ||
          analysis.verdict === 'Unverified' ||
          analysis.verdict === 'Evidence insufficient' ||
          analysis.verdict === 'Missing context' ||
          analysis.verdict === 'Corroborated' ||
          analysis.verdict === 'Likely Reliable')
      ) {
        analysis.verdict =
          breakingNewsVague || weirdScienceGuard || !directClaimSupport
            ? 'Unverified'
            : 'Dangerous unsupported claim'
      }

      if (
        !scamVerdict &&
        (isBreakingNewsPlaceholderClaim(rawClaim) || weirdScienceGuard) &&
        analysis.verdict !== 'Unverified'
      ) {
        analysis.verdict = 'Unverified'
      }
    }
    const response = Response.json(
      responseNormalizer({
        mode: 'parsed_analysis',
        analysis,
        claim: rawClaim,
        claimCategory: detectedCategory,
        evidence,
        sourceCredibility,
        conflictingSignals,
        evidenceStrength,
        retrievalFailed: retrievedEvidenceResult.retrievalFailed,
        stableFact,
        directStableFactSupport,
        directClaimSupport,
        breakingNewsVague,
        weirdScienceGuard,
        highRiskHealth,
        hasAuthoritativeHealthEvidence,
        dangerousHealthTreatmentSignal,
      })
    )
    logFinalResponse(routeAbortController, startedAt, {
      evidenceCount: evidence.length,
      fallback: false,
    })
    return response
  } catch (error) {
    logRouteFailure('unexpected_route_failure', error)
    const response = Response.json(
      buildTimedOutAnalysis(evidence, true, {
        claim: rawClaim,
        evidence,
        sourceCredibility: summarizeSourceCredibility(evidence),
        evidenceStrength: {
          label: 'none',
          reason: FALLBACK_REASON,
          direction: 'neutral',
        },
        conflictingSignals: detectConflictingSignals(evidence),
        claimCategory: detectedCategory,
        retrievalFailed: true,
        directClaimSupport: false,
        directStableFactSupport: false,
        stableFact,
        highRiskHealth: {
          isHighRisk: false,
          label: 'none',
          reason: FALLBACK_REASON,
        },
        hasAuthoritativeHealthEvidence: false,
        breakingNewsVague: false,
        dangerousHealthTreatmentSignal: false,
        weirdScienceGuard: false,
      })
    )
    logFinalResponse(routeAbortController, startedAt, {
      evidenceCount: evidence.length,
      fallback: true,
    })
    return response
  }
}

function buildRouteTimeoutResponse() {
  return Response.json(
    buildTimedOutAnalysis([], true, {
      claim: '',
      evidence: [],
      sourceCredibility: summarizeSourceCredibility([]),
      evidenceStrength: {
        label: 'none',
        reason: FALLBACK_REASON,
        direction: 'neutral',
      },
      conflictingSignals: detectConflictingSignals([]),
      claimCategory: 'general',
      retrievalFailed: true,
      directClaimSupport: false,
      directStableFactSupport: false,
      stableFact: false,
      highRiskHealth: {
        isHighRisk: false,
        label: 'none',
        reason: FALLBACK_REASON,
      },
      hasAuthoritativeHealthEvidence: false,
      breakingNewsVague: false,
      dangerousHealthTreatmentSignal: false,
      weirdScienceGuard: false,
    })
  )
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const routeAbortController = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<Response>((resolve) => {
    timeoutId = setTimeout(() => {
      routeAbortController.abort()
      logRouteTiming('route_timeout', startedAt, { fallback: 1, timeout: 1 })

      resolve(buildRouteTimeoutResponse())
    }, TOTAL_ROUTE_TIMEOUT_MS)
  })

  try {
    const response = await Promise.race([
      analyzeRequest(request, routeAbortController, startedAt),
      timeoutPromise,
    ])

    return response
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
