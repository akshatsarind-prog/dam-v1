import OpenAI from 'openai'
import {
  buildRetrievalQueries,
  detectClaimCategory,
  dedupeRetrievedEvidence,
  getPreferredDomains,
  retrieveEvidence,
  type ClaimCategory,
} from '@/lib/retrieval'
import { withTimeout } from '@/lib/timeout'
import {
  detectConflictingSignals,
  rankEvidence,
  summarizeSourceCredibility,
  type ConflictSignal,
  type RankedEvidence,
} from '@/lib/sourceRanker'
import { systemPrompt } from '@/lib/systemPrompt'

export const runtime = 'nodejs'
export const maxDuration = 12

const TOTAL_ROUTE_TIMEOUT_MS = 12_000
const MODEL_TIMEOUT_MS = 7_000
const MODEL_MAX_TOKENS = 220
const MODEL_OUTPUT_MAX_CHARS = 6_000
const EVIDENCE_SNIPPET_MAX_CHARS = 320
const FALLBACK_REASON = 'The system could not complete verification safely. Please retry.'
const FALLBACK_EVIDENCE_STATUS = 'Unavailable'
const TIMEOUT_CONTRADICTIONS = 'No reliable contradiction analysis available'

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
] as const

const confidenceLabels = ['Weak', 'Moderate', 'Strong'] as const
const riskValues = ['Low', 'Medium', 'High', 'Severe'] as const
const contradictionLevels = ['None', 'Low', 'Moderate', 'High', 'Unknown'] as const
const stanceValues = ['Supports', 'Contradicts', 'Contextualizes', 'Unclear'] as const
const claimCategories = [
  'health',
  'finance',
  'science',
  'government',
  'breaking_news',
  'scam',
  'general',
] as const satisfies readonly ClaimCategory[]

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

function logModelParseFailure(label: string, error: unknown) {
  void label
  void error
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

function logRouteMetrics(startedAt: number, evidenceCount: number) {
  if (process.env.NODE_ENV === 'development') {
    console.log({
      totalLatencyMs: Date.now() - startedAt,
      evidenceCount,
    })
  }
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
  } catch (error) {
    logModelParseFailure('modelJsonParseFailed', error)
  }

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return {
        parsed: JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)),
        parseFailed: false,
      }
    } catch (error) {
      logModelParseFailure('modelJsonRecoveryFailed', error)
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
    const level = extractQuotedString(contradictionsBlock, 'level')
    const summary = extractQuotedString(contradictionsBlock, 'summary')
    const itemsBlock = extractDelimitedBlock(contradictionsBlock, 'items', '[', ']')

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
  return claimCategories.includes(value as ClaimCategory) ? (value as ClaimCategory) : 'general'
}

function hasPreferredDomainEvidence(evidence: RankedEvidence[], claimCategory: string) {
  return evidence.some((item) =>
    domainMatchesAny(
      item.domain.toLowerCase(),
      getPreferredDomains(normalizeClaimCategoryValue(claimCategory))
    )
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

function hasDirectStableLocationContradiction(input: ContradictionNormalizationInput) {
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
  const directOpposition =
    (input.evidenceStrength.label === 'strong' &&
      input.evidenceStrength.direction === 'contradicting' &&
      credibleEvidence) ||
    hasDirectStableLocationContradiction(input)

  if (!evidenceCount || (input.retrievalFailed && evidenceCount === 0)) {
    return {
      label: 'No evidence available',
      summary:
        'No retrieved sources were available, so contradiction analysis cannot be performed reliably.',
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
      label: 'No meaningful contradiction detected',
      summary: 'No meaningful contradiction detected in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  if (currentNewsClaim && !hasBreakingNewsAnchor(input.evidence)) {
    return {
      label: 'Current reporting limited',
      summary: 'Current reporting is limited or inconsistent.',
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
      label: 'No meaningful contradiction detected',
      summary: 'No meaningful contradiction detected in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  if (evidenceCount === 1) {
    return {
      label: 'Limited comparison',
      summary: 'Evidence is insufficient for strong contradiction analysis.',
      severity: 'Low',
      items: [],
    }
  }

  if ((negativeVerdict || cautiousVerdict) && input.evidenceStrength.label !== 'strong') {
    return {
      label: 'Contradiction evidence is limited',
      summary: 'Evidence is insufficient for strong contradiction analysis.',
      severity: 'Low',
      items: [],
    }
  }

  if (weakEvidence) {
    return {
      label: 'Insufficient reliable evidence',
      summary: 'Evidence is insufficient for strong contradiction analysis.',
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
      label: 'No meaningful contradiction detected',
      summary: 'No meaningful contradiction detected in retrieved evidence.',
      severity: 'None',
      items: [],
    }
  }

  return {
    label: 'Contradiction evidence is limited',
    summary:
      'Available evidence is limited, so the system cannot make a strong contradiction finding.',
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

  if (isVagueContradictionText(modelSummary) || modelLevel === 'Unknown') {
    return false
  }

  if (
    decision.label === 'No meaningful contradiction detected' ||
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

function normalizeContradictionSummary(
  input: ContradictionNormalizationInput
): NormalizedContradiction {
  const decision = buildContradictionDecision(input)
  const modelItems = normalizeContradictionItems(input.modelContradictions?.items, decision.severity)
  const fallbackItems = buildDecisionContradictionItems(input, decision)
  const keepModelSummary = shouldKeepModelContradictionSummary(input, decision)

  return {
    ...decision,
    summary: keepModelSummary
      ? readString(input.modelContradictions?.summary, decision.summary)
      : decision.summary,
    items: modelItems.length ? modelItems : fallbackItems,
  }
}

function logContradictionDiagnostics(input: {
  evidenceCount: number
  contradictionLabel: string
  contradictionSeverity: ContradictionLevel
  verdict: string
  sourceCredibility: CredibilityLabel
}) {
  void input
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

  logContradictionDiagnostics({
    evidenceCount: context.evidence.length,
    contradictionLabel: normalized.label,
    contradictionSeverity: normalized.severity,
    verdict: payload.verdict,
    sourceCredibility: context.sourceCredibility.label,
  })

  return {
    ...payload,
    contradictions: {
      level: normalized.severity,
      summary: normalized.summary,
      items: normalized.items,
    },
    contradictionSummary: normalized.summary,
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
    input.evidenceStrength.label === 'strong' &&
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

function detectScamSignals(claim: string): { riskLevel: 'low' | 'medium' | 'high'; labels: string[] } {
  const normalized = normalizeClaimText(claim)
  const labels: string[] = []
  let score = 0

  const addSignal = (pattern: RegExp, label: string, weight = 1) => {
    if (pattern.test(normalized)) {
      labels.push(label)
      score += weight
    }
  }

  addSignal(/\b(kyc|account will be blocked|blocked unless|suspend(ed)?|verify immediately)\b/, 'Fake KYC urgency', 2)
  addSignal(/\b(whatsapp|telegram|forward this|share this message|share with \d+ people|forward to \d+)\b/, 'Chain-forward manipulation', 2)
  addSignal(/\b(free money|reward|prize|lottery|gift|cashback|gift card|giveaway)\b/, 'Reward bait pattern', 2)
  addSignal(/\b(₹\d+|\d+\s*(?:rupees?|rs\.?))\b.*\b(whatsapp|telegram|link|registration)\b/, 'Reward bait pattern', 2)
  addSignal(/\b(rbi|bank|government|ministry|irs|fbi|who|bbc|reuters)\b.*\b(whatsapp|telegram|link|registration)\b/, 'Impersonation risk', 2)
  addSignal(/\b(registration link|signup link|verification link)\b.*\b(whatsapp|telegram)\b/, 'Likely phishing attempt', 2)
  addSignal(/\b(urgent|immediately|tonight|today|last chance|act now|within \d+ (?:minutes|hours|days))\b/, 'Urgent action pressure', 1)
  addSignal(/\b(account|bank account|wallet|payment)\b.*\b(blocked|frozen|suspended|disabled)\b/, 'Impersonation risk', 2)
  addSignal(/\b(crypto|bitcoin|usdt|token|airdrop|wallet)\b.*\b(giveaway|free|bonus|double)\b/, 'Crypto giveaway bait', 2)
  addSignal(/\b(?:bit\.ly|tinyurl|t\.co|goo\.gl|shorturl|lnk\.to|cutt\.ly)\b|https?:\/\/[^\s]+\b/, 'Suspicious link pattern', 1)
  addSignal(/\b(10 people|ten people|20 people|share with friends)\b/, 'Chain-forward manipulation', 1)
  addSignal(/\b(scam|phishing|fraud|otp|fake|spoof|impersonat(e|ion))\b/, 'Phishing or impersonation risk', 2)

  const riskLevel = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low'

  return {
    riskLevel,
    labels: Array.from(new Set(labels)).slice(0, 5),
  }
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
    'explosion',
    'attack',
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
    return 'Retrieved evidence directly contradicts the claim.'
  }

  if (input.verdict === 'Likely incorrect') {
    if (input.sourceCredibility.weightedScore >= 50 || input.conflictingSignals.hasConflict) {
      return 'Retrieved evidence directly contradicts the claim.'
    }

    return 'Available evidence does not support the claim.'
  }

  if (input.currentNewsClaim) {
    return input.conflictingSignals.hasConflict
      ? 'Current reporting is limited or inconsistent.'
      : 'No reliable real-time confirmation was found.'
  }

  if (input.scamSignals.riskLevel !== 'low') {
    return `${input.scamSignals.labels.join(', ') || 'Scam pattern'} detected; retrieved evidence should be treated cautiously.`
  }

  if (input.conflictingSignals.hasConflict) {
    return 'Retrieved sources contain mixed or conflicting signals.'
  }

  if (
    input.evidenceStrength.label === 'weak' ||
    input.sourceCredibility.label === 'Low' ||
    input.sourceCredibility.weightedScore < 45
  ) {
    return 'Retrieved evidence is limited or weakly related.'
  }

  if (
    (input.evidenceStrength.direction === 'supporting' &&
      (input.evidenceStrength.label === 'strong' || input.evidenceStrength.label === 'moderate') &&
      input.sourceCredibility.weightedScore >= 50) ||
    input.directStableFactSupport
  ) {
    return 'Retrieved evidence directly supports the claim.'
  }

  return 'Available evidence is insufficient for strong verification.'
}

function buildConfidenceCapReason(input: ConfidenceCapContext, cap: number) {
  const scamSignals = detectScamSignals(input.claim)
  const currentNewsClaim = isCurrentNewsClaim(input.claim)

  if (
    input.stableFact &&
    input.directStableFactSupport &&
    input.evidenceCount >= 1 &&
    (input.sourceCredibility.weightedScore >= 60 ||
      hasPreferredDomainEvidence(input.evidence, input.claimCategory)) &&
    (['High', 'Moderate'].includes(input.sourceCredibility.label) ||
      hasPreferredDomainEvidence(input.evidence, input.claimCategory)) &&
    !input.retrievalFailed &&
    !input.dangerousHealthTreatmentSignal &&
    !input.breakingNewsVague &&
    !input.conflictingSignals.hasConflict
  ) {
    return 'Stable factual claim is directly supported by credible evidence.'
  }

  if (input.retrievalFailed) {
    return 'Retrieval failed, so confidence must stay low.'
  }

  if (!input.evidenceCount) {
    return 'No evidence was retrieved.'
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
    return 'Current reporting is limited or inconsistent; no authoritative confirmation was retrieved.'
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
    return 'Retrieved evidence is weak or unrelated to the claim.'
  }

  if (input.sourceCredibility.weightedScore < 45) {
    return 'Retrieved sources are low credibility.'
  }

  if (input.conflictingSignals.hasConflict) {
    return 'Retrieved evidence contains conflicting signals.'
  }

  if (scamSignals.riskLevel !== 'low') {
    const labelText = scamSignals.labels.length ? scamSignals.labels.join(', ') : 'Scam pattern'
    return `${labelText} detected; scam or phishing claims should be framed as high risk rather than high confidence.`
  }

  return `Confidence capped at ${cap}% based on evidence quality.`
}

function applyConfidenceCaps(params: ConfidenceCapContext) {
  const currentNewsClaim = isCurrentNewsClaim(params.claim)

  if (
    params.stableFact &&
    params.directStableFactSupport &&
    params.evidenceCount >= 1 &&
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
    return 'Evidence insufficient.'
  }

  if (calibration.uncertaintyReason.includes('Only one source')) {
    return 'Missing context.'
  }

  return 'Unverified.'
}

function getCautiousVerdict(calibration: ConfidenceCalibration): Verdict {
  if (calibration.confidenceLabel === 'Insufficient') {
    return 'Evidence insufficient'
  }

  if (calibration.uncertaintyReason.includes('Only one source')) {
    return 'Missing context'
  }

  return 'Unverified'
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
    return 'Current reporting is limited or inconsistent.'
  }

  if (reason.includes('phishing') || reason.includes('fake kyc') || reason.includes('reward bait') || reason.includes('chain-forward') || reason.includes('impersonation risk')) {
    return 'Likely phishing attempt.'
  }

  if (reason.includes('weak or unrelated') || reason.includes('limited or weakly related')) {
    return 'Retrieved evidence is limited or weakly related.'
  }

  if (reason.includes('mixed or conflicting') || reason.includes('conflicting signals')) {
    return 'Retrieved sources contain mixed or conflicting signals.'
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
          : 'Unverified'
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
    .slice(0, 2)
    .map((e, i) => {
      const title = e.title || 'Untitled'
      const snippet = (e.content || e.rawContent || '').slice(0, EVIDENCE_SNIPPET_MAX_CHARS)
      const url = e.url || ''
      const credibility = e.credibility || 'unknown'

      return `Source ${i + 1}
Title: ${title}
Snippet: ${snippet}
URL: ${url}
Credibility: ${credibility}`
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
  'election',
  'elections',
  'campaign',
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
]

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

function extractStableFactSupportTerms(claim: string) {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9â‚¹%.\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length >= 3 && !COMMON_EVIDENCE_STOPWORDS.has(token))
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

  return match?.[1]?.trim() || null
}

function getEvidenceLocationHint(text: string) {
  const match = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/)
  return match?.[1]?.trim() || null
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

function hasClaimSpecificStableFactSupport(claim: string, evidence: RankedEvidence[]) {
  const normalized = normalizeClaimText(claim)

  if (/\bapollo\s*11\b/.test(normalized) || (normalized.includes('moon') && normalized.includes('1969'))) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return (
        text.includes('apollo') &&
        (text.includes('1969') ||
          text.includes('moon') ||
          text.includes('lunar landing') ||
          text.includes('humans') ||
          text.includes('astronaut'))
      )
    })
  }

  if (normalized.includes('jupiter')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return text.includes('jupiter') && text.includes('planet') && text.includes('largest')
    })
  }

  if (normalized.includes('everest')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return text.includes('everest') && (text.includes('tallest') || text.includes('highest')) && text.includes('mountain')
    })
  }

  if (normalized.includes('eiffel tower')) {
    const targetLocation = getClaimLocationTarget(claim)?.toLowerCase()

    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      const locationMatches =
        !targetLocation ||
        text.includes(targetLocation) ||
        (targetLocation === 'paris' && (text.includes('paris') || text.includes('france')))

      return text.includes('eiffel') && locationMatches
    })
  }

  if (normalized.includes('constitution') || normalized.includes('adopted')) {
    return evidence.some((item) => {
      const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
      return text.includes('constitution') && text.includes('1950')
    })
  }

  return false
}

function hasDirectStableFactSupport(claim: string, evidence: RankedEvidence[]) {
  if (!evidence.length) {
    return false
  }

  const targetLocation = getClaimLocationTarget(claim)?.toLowerCase()
  if (hasClaimSpecificStableFactSupport(claim, evidence)) {
    return true
  }

  const claimTerms = extractStableFactSupportTerms(claim).filter((term) => term.length >= 4)
  if (!claimTerms.length) {
    return false
  }

  return evidence.slice(0, 5).some((item) => {
    const text = normalizeClaimText(`${item.title || ''} ${item.content || ''}`)
    const termHits = claimTerms.filter((term) => text.includes(term))
    const supportHits = cueScore(text, SUPPORT_STANCE_CUES)
    const contradictionHits = cueScore(text, CONTRADICTION_STANCE_CUES)
    const evidenceLocation = getEvidenceLocationHint(`${item.title || ''} ${item.content || ''}`)?.toLowerCase()
    const normalizedTargetLocation = targetLocation ?? ''
    const locationMismatch =
      Boolean(targetLocation) &&
      Boolean(evidenceLocation) &&
      evidenceLocation !== targetLocation &&
      !text.includes(normalizedTargetLocation)

    if (contradictionHits > supportHits) {
      return false
    }

    if (locationMismatch) {
      return false
    }

    if (!termHits.length) {
      return false
    }

    if (claimTerms.some((term) => term === 'apollo' || term === 'jupiter' || term === 'everest' || term === 'eiffel')) {
      return termHits.length >= 2 && supportHits > 0
    }

    if (claimTerms.length >= 5) {
      return termHits.length >= 3 && supportHits > 0
    }

    return termHits.length >= 2 || supportHits > 0
  })
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
    'mount everest',
    'everest',
    'eiffel tower',
    'eiffel',
    'tower',
    'constitution',
    'constitutional',
    'adopted',
    'official',
    'government',
    'landmark',
    'geography',
    'located in',
    'tallest',
    'highest',
    'largest',
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
  preferredDomains: string[]
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
  const stableFactCredible =
    context.sourceCredibility.weightedScore >= 60 ||
    hasPreferredDomainEvidence(context.evidence, context.claimCategory)

  return (
    context.stableFact &&
    context.directStableFactSupport &&
    context.evidence.length >= 1 &&
    stableFactCredible &&
    (['High', 'Moderate'].includes(context.sourceCredibility.label) ||
      hasPreferredDomainEvidence(context.evidence, context.claimCategory)) &&
    context.evidenceStrength.label === 'strong' &&
    context.evidenceStrength.direction === 'supporting' &&
    !context.conflictingSignals.hasConflict &&
    !context.dangerousHealthTreatmentSignal &&
    !context.breakingNewsVague &&
    !context.weirdScienceGuard &&
    !context.highRiskHealth.isHighRisk &&
    context.claimCategory !== 'health' &&
    context.claimCategory !== 'finance' &&
    context.claimCategory !== 'breaking_news' &&
    context.claimCategory !== 'scam'
  )
}

function applyStableFactNormalization<T extends { verdict: string; confidence?: { score?: number; label?: string; rationale?: string; drivers?: string[] }; reason?: string; reasoning?: string }>(
  analysis: T,
  context: StableFactNormalizationContext
): T {
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
    reason: analysis.reason ?? evidenceSummary,
    confidence: {
      ...analysis.confidence,
      rationale: evidenceSummary,
      drivers: Array.from(new Set([...analysis.confidence.drivers, evidenceSummary])).slice(0, 6),
    },
    reasoning:
      currentNewsClaim || scamSignals.riskLevel !== 'low' || context.evidenceStrength.label !== 'strong'
        ? evidenceSummary
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
  const directStableFactSupport = stableFact ? hasDirectStableFactSupport(rawClaim, evidence) : false
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
        evidenceStrength: evidenceStrength ?? { label: 'none', reason, direction: 'neutral' },
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
      : evidenceStrength && stableFact && directStableFactSupport
        ? evidenceStrength.direction === 'contradicting'
          ? 'Likely incorrect'
          : 'Corroborated'
        : 'Insufficient Verification'

  const analysis: AnalysisCore = {
    verdict: fallbackVerdict,
    confidence: {
      score: 0,
      label: 'Weak',
      rationale: reason,
      drivers: ['Evidence analysis did not complete.'],
    },
    risk:
      breakingNewsVague
        ? 'Medium'
        : dangerousHealthTreatmentSignal || highRiskHealth?.isHighRisk
          ? hasAuthoritativeHealthEvidence
            ? 'Severe'
            : 'High'
          : 'Medium',
    reasoning:
      'Evidence-backed analysis is unavailable, so the claim cannot receive a calibrated operational verdict.',
    corroborationLevel: {
      label: evidence.length ? 'Retrieved evidence not analyzed' : 'No retrieved evidence',
      agreement: 'No model-level agreement assessment completed.',
      sourceCount: evidence.length,
      highCredibilityCount: evidence.filter((item) => item.credibility === 'High').length,
      indicators: evidence.length
        ? ['Retrieved sources are visible for manual inspection.']
        : ['No source material available for analysis.'],
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
      nextSteps: ['Inspect retrieved evidence directly.', 'Retry analysis when the model channel is available.'],
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

  return finalizeAnalysis(stabilizedAnalysis, calibration, confidenceCap)
}

function getEvidenceStatus(evidence: RankedEvidence[], sourceCredibility: SourceCredibility) {
  if (!evidence.length) {
    return 'No retrieved evidence available.'
  }

  const sourceWord = evidence.length === 1 ? 'source' : 'sources'
  const highTrustWord = sourceCredibility.highTrustSources === 1 ? 'source' : 'sources'

  if (sourceCredibility.highTrustSources > 0) {
    return `${evidence.length} retrieved ${sourceWord}; ${sourceCredibility.highTrustSources} high-credibility ${highTrustWord}.`
  }

  return `${evidence.length} retrieved ${sourceWord}; overall source credibility is ${sourceCredibility.label}.`
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
  const reason = normalizeText(modelText).slice(0, 180) || 'Model returned text that could not be parsed.'
  const contradictionLevel = conflictingSignals.label
  const directStableFactSupport = stableFact ? hasDirectStableFactSupport(rawClaim, evidence) : false
  const analysis: AnalysisCore = {
    verdict: 'Unverified',
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

  return finalizeAnalysis(stabilizedAnalysis, calibration, confidenceCap)
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
        : 'Unverified',
    reason: 'Evidence retrieval or analysis failed.',
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
      'Evidence retrieval or analysis failed before a calibrated verdict could be generated.',
      calibration
    ),
    corroborationLevel: {
      label: evidence.length ? 'Retrieved evidence unavailable' : 'No retrieved evidence',
      agreement: 'No model-level agreement assessment completed.',
      sourceCount: evidence.length,
      highCredibilityCount: evidence.filter((item) => item.credibility === 'High').length,
      indicators: evidence.length
        ? ['Retrieved sources are visible for manual inspection.']
        : ['No source material available for analysis.'],
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

  return applyNormalizedContradictions(stabilizedPayload, {
    claim: options.claim ?? '',
    evidence,
    sourceCredibility,
    conflictingSignals,
    claimCategory: options.claimCategory ?? 'general',
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

  return {
    verdict: 'Unable to verify reliably',
    reason: FALLBACK_REASON,
    confidence: {
      score: 25,
      label: 'Weak',
      rationale: FALLBACK_REASON,
      drivers: ['Verification could not complete safely.'],
    },
    confidenceLabel: 'Low',
    uncertaintyReason: FALLBACK_REASON,
    confidenceCapApplied: true,
    confidenceCapReason: FALLBACK_REASON,
    risk: 'Medium',
    reasoning: FALLBACK_REASON,
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
    verdict: isAllowed(data.verdict, verdictValues) ? data.verdict : 'Insufficient Verification',
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
      label: readString(corroborationLevel.label, 'Corroboration not specified'),
      agreement: readString(corroborationLevel.agreement, 'Agreement pattern not specified.'),
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
      indicators: readStringList(corroborationLevel.indicators, ['No indicators supplied.'], 6),
    },
    sourceCredibility: {
      ...sourceCredibility,
      rationale: readString(sourceCredibilityFromModel.rationale, sourceCredibility.rationale),
    },
    contradictions: {
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
  const directStableFactSupport = stableFact ? hasDirectStableFactSupport(rawClaim, evidence) : false
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

  return finalizeAnalysis(stabilizedAnalysis, calibration, confidenceCap)
}

async function analyzeRequest(
  request: Request,
  routeAbortController: AbortController,
  startedAt: number
) {
  const body = await request.json().catch(() => null)
  const rawClaim = normalizeText(typeof body?.claim === 'string' ? body.claim : '')

  if (!rawClaim) {
    if (!routeAbortController.signal.aborted) {
      logRouteMetrics(startedAt, 0)
    }
    return Response.json({ error: 'Claim intake is empty.' }, { status: 400 })
  }

  const decomposition = normalizeDecomposition(null, rawClaim)
  const detectedCategory = detectClaimCategory(rawClaim)
  const preferredDomains = getPreferredDomains(detectedCategory)
  const stableFact = isStableFactClaim(rawClaim)
  const stableFactHint = stableFact ? getStableFactRetrievalHint(rawClaim) : undefined
  const retrievalQueries = buildRetrievalQueries(rawClaim, detectedCategory, preferredDomains, {
    stableFactHint,
  })
  let evidence: RankedEvidence[] = []

  try {
    const retrievedEvidenceResult = await retrieveEvidence(retrievalQueries, {
      category: detectedCategory,
      preferredDomains,
    })
    const uniqueEvidence = dedupeRetrievedEvidence(retrievedEvidenceResult.evidence)
    evidence = rankEvidence(uniqueEvidence, {
      preferredDomains,
    })
    const evidenceStrength = classifyEvidenceStrength(
      evidence,
      detectedCategory,
      rawClaim,
      preferredDomains
    )
    const sourceCredibility = summarizeSourceCredibility(evidence)
    const evidenceContext = buildEvidenceContext(evidence)
    const conflictingSignals = detectConflictingSignals(evidence)
    const directClaimSupport = hasDirectClaimSupport(rawClaim, evidence)
    const directStableFactSupport = stableFact ? hasDirectStableFactSupport(rawClaim, evidence) : false
    const scamSignals = detectScamSignals(rawClaim)
    const currentNewsClaim = isCurrentNewsClaim(rawClaim)
    const breakingNewsVague = isBreakingNewsPlaceholderClaim(rawClaim) || currentNewsClaim
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

    if (!process.env.OPENAI_API_KEY) {
      logRouteFailure('missing_openai_api_key')
      const response = Response.json(buildTimedOutAnalysis([], true, contradictionContext))
      if (!routeAbortController.signal.aborted) {
        logRouteMetrics(startedAt, evidence.length)
      }
      return response
    }

    if (!evidence.length) {
      if (retrievedEvidenceResult.retrievalFailed || !process.env.TAVILY_API_KEY) {
        logRouteFailure(
          !process.env.TAVILY_API_KEY ? 'missing_tavily_api_key' : 'retrieval_failed'
        )
        const response = Response.json(buildTimedOutAnalysis([], true, contradictionContext))
        if (!routeAbortController.signal.aborted) {
          logRouteMetrics(startedAt, evidence.length)
        }
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
                ? 'Specific identity or event details are missing, so the claim cannot be verified.'
                : 'Direct supporting evidence is missing for this claim.',
            drivers: ['Claim details are too vague for direct verification.'],
          },
          risk: 'Medium',
          reasoning:
            detectedCategory === 'breaking_news'
              ? 'The breaking-news claim is too vague to verify reliably.'
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
        if (!routeAbortController.signal.aborted) {
          logRouteMetrics(startedAt, evidence.length)
        }
        return response
      }
      const response = Response.json(
        buildFallbackPayload(evidence, retrievedEvidenceResult.retrievalFailed, contradictionContext)
      )
      if (!routeAbortController.signal.aborted) {
        logRouteMetrics(startedAt, evidence.length)
      }
      return response
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelAbortController = new AbortController()
    const modelAbortTimeoutId = setTimeout(() => {
      modelAbortController.abort()
    }, MODEL_TIMEOUT_MS)

    let completion: unknown = null

    try {
      completion = await withTimeout(
        openai.chat.completions
          .create(
            {
              model: 'gpt-4o-mini',
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
${evidenceContext || 'No retrieved evidence available.'}

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
If evidence is weak, limited, or conflicting, reduce confidence and avoid certainty.`,
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
    } finally {
      clearTimeout(modelAbortTimeoutId)
    }

    if (!completion) {
      logRouteFailure('openai_timeout_or_abort')
      const response = Response.json(buildTimedOutAnalysis([], true, contradictionContext))
      if (!routeAbortController.signal.aborted) {
        logRouteMetrics(startedAt, evidence.length)
      }
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

    if (
      !usedTextFallback &&
      (dangerousHealthTreatmentSignal ||
        breakingNewsVague ||
        weirdScienceGuard ||
        !directClaimSupport ||
        analysis.verdict === 'Dangerous unsupported claim')
    ) {
      if (dangerousHealthTreatmentSignal || highRiskHealth.isHighRisk) {
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
        analysis.verdict === 'Insufficient Verification' ||
        analysis.verdict === 'Unverified' ||
        analysis.verdict === 'Evidence insufficient' ||
        analysis.verdict === 'Missing context' ||
        analysis.verdict === 'Corroborated' ||
        analysis.verdict === 'Likely Reliable'
      ) {
        analysis.verdict =
          breakingNewsVague || weirdScienceGuard || !directClaimSupport
            ? 'Unverified'
            : 'Dangerous unsupported claim'
      }

      if (
        (isBreakingNewsPlaceholderClaim(rawClaim) || weirdScienceGuard) &&
        analysis.verdict !== 'Unverified'
      ) {
        analysis.verdict = 'Unverified'
      }
    }

    const response = Response.json(
      applyNormalizedContradictions(
        applyStableFactNormalization(analysis, contradictionContext),
        contradictionContext
      )
    )
    if (!routeAbortController.signal.aborted) {
      logRouteMetrics(startedAt, evidence.length)
    }
    return response
  } catch (error) {
    logRouteFailure('unexpected_route_failure', error)
    const response = Response.json(
      buildTimedOutAnalysis([], true, {
        claim: rawClaim,
        evidence: [],
        sourceCredibility: summarizeSourceCredibility([]),
        evidenceStrength: {
          label: 'none',
          reason: FALLBACK_REASON,
          direction: 'neutral',
        },
        conflictingSignals: detectConflictingSignals([]),
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
    if (!routeAbortController.signal.aborted) {
      logRouteMetrics(startedAt, evidence.length)
    }
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

      if (process.env.NODE_ENV === 'development') {
        console.log({
          totalLatencyMs: Date.now() - startedAt,
          evidenceCount: 0,
        })
      }

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

