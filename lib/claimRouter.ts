// Single source of truth for top-level claim routing only.
// Keep scam labels, stable-fact anchors, confidence caps, and contradiction
// handling out of this module.

export type ClaimCategory =
  | 'scam'
  | 'stable_fact'
  | 'breaking_news'
  | 'civic_rumor'
  | 'health'
  | 'finance'
  | 'statistics'
  | 'quote'
  | 'adversarial'
  | 'general'

export type RetrievalCategory =
  | 'health'
  | 'finance'
  | 'science'
  | 'government'
  | 'breaking_news'
  | 'scam'
  | 'general'

export type ClaimRoute = {
  category: ClaimCategory
  retrievalCategory: RetrievalCategory
  isScamLike: boolean
  isCivicRumor: boolean
  isBreakingNews: boolean
  isStableFactCandidate: boolean
  isHealthClaim: boolean
  isFinanceClaim: boolean
  isStatisticalClaim: boolean
  isQuoteClaim: boolean
  isAdversarialClaim: boolean
  routingReason: string
}

const CLAIM_CATEGORIES: ClaimCategory[] = [
  'scam',
  'stable_fact',
  'breaking_news',
  'civic_rumor',
  'health',
  'finance',
  'statistics',
  'quote',
  'adversarial',
  'general',
]

const RETRIEVAL_CATEGORIES: RetrievalCategory[] = [
  'health',
  'finance',
  'science',
  'government',
  'breaking_news',
  'scam',
  'general',
]

const SCAM_SIGNAL_CUES = [
  'kyc update',
  'e-kyc',
  'account will be blocked',
  'bank account blocked',
  'account suspension',
  'otp',
  'pin',
  'password',
  'whatsapp registration link',
  'forward this message',
  'forward to 10 people',
  'click this link',
  'registration link',
  'verification link',
  'share with 10 people',
  'free reward',
  'free iphone',
  'reward',
  'prize',
  'lottery',
  'cashback',
  'government reward',
  'government relief',
  'relief payment',
  'subsidy',
  'whatsapp',
  'telegram',
  'share this',
  'missed calls',
  'unknown number',
  'phishing',
  'scam',
  'impersonation',
  'rbi',
  'bank',
  'government',
  'police',
  'courier',
  'amazon',
  'flipkart',
  'platform',
  'virus is spreading',
] as const

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

const BREAKING_NEWS_CUES = [
  'today',
  'latest',
  'breaking',
  'just announced',
  'announced today',
  'update',
  'confirmed today',
  'died',
  'death',
  'explosion',
  'attack',
  'earthquake',
  'crash',
  'launched',
  'war',
  'lockdown',
  'cyberattack',
  'blast',
  'shooting',
  'election update',
  'celebrity death',
  'disaster',
  'happened today',
  'this morning',
  'this evening',
  'yesterday',
  'tonight',
  'emergency',
] as const

const BREAKING_NEWS_PLACEHOLDER_PATTERNS = [
  /\bactor\s+x\b/i,
  /\bperson\s+x\b/i,
  /\bcelebrity\s+x\b/i,
  /\bpolitician\s+x\b/i,
  /\bsomeone\b/i,
  /\bunnamed\b/i,
] as const

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

const STABLE_FACT_POSITIVE_SIGNALS = [
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
] as const

const HEALTH_CUES = [
  'health',
  'medical',
  'medicine',
  'doctor',
  'hospital',
  'vaccine',
  'cancer',
  'cure',
  'treatment',
  'symptom',
  'disease',
  'infection',
  'who',
  'cdc',
  'nih',
  'covid',
  'viral',
] as const

const FINANCE_CUES = [
  'bank',
  'rbi',
  'central bank',
  'finance',
  'financial',
  'inflation',
  'interest rate',
  'stock',
  'market',
  'economy',
  'currency',
  'loan',
  'gdp',
  'gross domestic product',
  'imf',
  'world bank',
] as const

const STATISTICAL_CUES = [
  '%',
  'statistics',
  'statistic',
  'survey',
  'study',
  'data',
  'dataset',
  'figure',
  'figures',
  'percent',
  'percentage',
  'rate',
  'rates',
  'poll',
  'sample',
  'average',
  'median',
  'experts agree',
] as const

const QUOTE_CUES = ['"', 'quote', 'said', 'stated', 'according to'] as const

const ADVERSARIAL_CUES = [
  'ignore previous',
  'ignore all previous',
  'disregard previous',
  'override instructions',
  'system prompt',
  'developer message',
  'jailbreak',
  'prompt injection',
  'act as',
  'bypass',
] as const

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function includesSignal(text: string, signal: string) {
  if (signal.includes(' ')) {
    return text.includes(signal)
  }

  return new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
}

function hasAnySignal(text: string, signals: readonly string[]) {
  return signals.some((signal) => includesSignal(text, signal))
}

function isQuoteClaim(claim: string) {
  const normalized = normalizeText(claim)
  return /["“”‘’]/.test(claim) || hasAnySignal(normalized, Array.from(QUOTE_CUES))
}

function isStatisticsClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(STATISTICAL_CUES))
}

function isAdversarialClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(ADVERSARIAL_CUES))
}

function isBreakingNewsClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(BREAKING_NEWS_CUES)) || BREAKING_NEWS_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(claim))
}

function isCivicRumorClaim(claim: string) {
  const normalized = normalizeText(claim)

  if (!normalized) {
    return false
  }

  return CIVIC_RUMOR_CUES.some((cue) =>
    cue.includes(' ') ? normalized.includes(cue) : new RegExp(`\\b${cue}\\b`).test(normalized)
  )
}

function isStableFactCandidate(claim: string) {
  const normalized = normalizeText(claim)

  if (!normalized) {
    return false
  }

  if (hasAnySignal(normalized, Array.from(STABLE_FACT_NEGATIVE_SIGNALS))) {
    return false
  }

  return hasAnySignal(normalized, Array.from(STABLE_FACT_POSITIVE_SIGNALS)) || /\b(18|19|20)\d{2}\b/.test(normalized)
}

function isHealthClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(HEALTH_CUES))
}

function isFinanceClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(FINANCE_CUES))
}

function isScamLikeClaim(claim: string) {
  const normalized = normalizeText(claim)

  if (!normalized) {
    return false
  }

  const isCivicLike =
    isCivicRumorClaim(claim) &&
    !/\b(otp|pin|cvv|password|kyc|payment|refund|upi|cashback|reward|lottery|telegram|crypto|guaranteed|double[s]?\s+money|daily profit|forward this|share this|blocked|verify immediately|update kyc|account will be blocked)\b/.test(
      normalized
    )
  const isBreakingNewsLike =
    isBreakingNewsClaim(claim) &&
    !/\b(otp|pin|cvv|password|kyc|payment|refund|upi|cashback|reward|lottery|telegram|crypto|guaranteed|double[s]?\s+money|daily profit|forward this|share this|blocked|verify immediately|update kyc|account will be blocked)\b/.test(
      normalized
    )

  if (isCivicLike || isBreakingNewsLike) {
    return false
  }

  if (
    /\b(kyc|e-kyc|kyc update|update kyc|kyc expired|kyc will expire|account will be blocked|bank account blocked|account suspension|verify immediately|update your account)\b/.test(
      normalized
    ) ||
    /\b(otp|pin|password|cvv|bank details|card details|login details|verification code)\b/.test(
      normalized
    ) ||
    /\b(bank verification|account verification|verify account|verify your bank|sbi|hdfc|icici|axis bank|bank employee|bank official)\b/.test(
      normalized
    ) ||
    /\b(upi|refund|processing fee|release fee|customs payment|customs fee|payment link|payment request|collect payment|pay fee|refund link|fee payment)\b/.test(
      normalized
    ) ||
    /\b(reward|prize|lottery|cashback|gift|giveaway|free money|free iphone|free iPhone|first users?)\b/.test(
      normalized
    ) ||
    /\b(telegram|crypto|trading|investment)\b/.test(normalized) &&
      (/\b(guaranteed|assured|fixed)\s+(?:daily\s+)?(?:returns?|profit|income|earnings)\b/.test(normalized) ||
        /\b(?:20|30|50|100)%\s+(?:daily\s+)?(?:profit|returns?|income|earnings)\b/.test(normalized) ||
        /\b(double your money|crypto profit guarantee|guaranteed crypto profit)\b/.test(normalized)) ||
    /\b(forward this(?: message)?|share this(?: message)?|forward to \d+|share with \d+ people|share in groups?|send to \d+ people|send to groups?)\b/.test(
      normalized
    ) ||
    /\b(rbi|reserve bank|bank|government|ministry|police|courier|amazon|flipkart|whatsapp|telegram|facebook|instagram|google|microsoft|apple|platform)\b.*\b(link|form|registration|whatsapp|telegram|otp|payment|update)\b/.test(
      normalized
    ) ||
    /\b(parcel|package|shipment|delivery|courier)\b.*\b(stuck|held|blocked|pending|issue|problem|release|pay)\b/.test(
      normalized
    ) ||
    /\b(government relief|relief payment|subsidy|benefit|cash assistance|aid payment)\b.*\b(link|whatsapp|registration|form)\b/.test(
      normalized
    ) ||
    /\b(urgent|urgently|immediately|today|tonight|last chance|act now|within \d+ (?:minutes|hours|days)|deadline|expires today|will be blocked|will expire|cyber cell|police notice)\b/.test(
      normalized
    ) ||
    /\b(whatsapp registration link|registration link|verification link|signup link|click this link|tap this link|open this link|fill this form now)\b/.test(
      normalized
    ) ||
    /\b(?:bit\.ly|tinyurl\.com?|t\.co|goo\.gl|lnk\.to|cutt\.ly|rb\.gy|rebrand\.ly|shorturl)\b/.test(
      normalized
    ) ||
    /\b(https?:\/\/[^\s]+)\b/.test(normalized)
  ) {
    return true
  }

  return /\b(phishing|scam|impersonation)\b/.test(normalized)
}

function detectRetrievalCategory(claim: string): RetrievalCategory {
  const normalized = normalizeText(claim)

  if (hasAnySignal(normalized, Array.from(SCAM_SIGNAL_CUES))) {
    return 'scam'
  }

  if (hasAnySignal(normalized, Array.from(BREAKING_NEWS_CUES))) {
    return 'breaking_news'
  }

  if (hasAnySignal(normalized, Array.from(HEALTH_CUES))) {
    return 'health'
  }

  if (hasAnySignal(normalized, Array.from(FINANCE_CUES))) {
    return 'finance'
  }

  if (/\b(nasa|esa|space|moon|mars|rocket|scientific|science|physics|chemistry|biology|water boils)\b/.test(normalized)) {
    return 'science'
  }

  if (
    /\b(government|govt|ministry|parliament|official|pib|policy|prime minister|president|court|election|law|public notice)\b/.test(
      normalized
    )
  ) {
    return 'government'
  }

  return 'general'
}

function getRoutingReason(category: ClaimCategory, retrievalCategory: RetrievalCategory) {
  switch (category) {
    case 'scam':
      return 'High-risk fraud or phishing cues were detected.'
    case 'stable_fact':
      return 'The claim looks like a settled factual assertion.'
    case 'breaking_news':
      return 'Current-event wording requires breaking-news handling.'
    case 'civic_rumor':
      return 'Government or civic rumor framing was detected.'
    case 'health':
      return 'Health-related wording was detected.'
    case 'finance':
      return 'Finance-related wording was detected.'
    case 'statistics':
      return 'Statistical wording was detected.'
    case 'quote':
      return 'Quotation or attribution wording was detected.'
    case 'adversarial':
      return 'Prompt-injection or instruction-override language was detected.'
    case 'general':
    default:
      return `Routing falls back to ${retrievalCategory}.`
  }
}

function getRouteCategory(claim: string): ClaimCategory {
  if (isScamLikeClaim(claim)) {
    return 'scam'
  }

  if (isBreakingNewsClaim(claim)) {
    return 'breaking_news'
  }

  if (isCivicRumorClaim(claim)) {
    return 'civic_rumor'
  }

  if (isStableFactCandidate(claim)) {
    return 'stable_fact'
  }

  if (isHealthClaim(claim)) {
    return 'health'
  }

  if (isFinanceClaim(claim)) {
    return 'finance'
  }

  if (isStatisticsClaim(claim)) {
    return 'statistics'
  }

  if (isQuoteClaim(claim)) {
    return 'quote'
  }

  if (isAdversarialClaim(claim)) {
    return 'adversarial'
  }

  return 'general'
}

export function routeClaim(claim: string): ClaimRoute {
  const retrievalCategory = detectRetrievalCategory(claim)
  const category = getRouteCategory(claim)
  const normalized = normalizeText(claim)

  return {
    category,
    retrievalCategory,
    isScamLike: category === 'scam',
    isCivicRumor: category === 'civic_rumor' || retrievalCategory === 'government',
    isBreakingNews: category === 'breaking_news',
    isStableFactCandidate: category === 'stable_fact',
    isHealthClaim: category === 'health' || retrievalCategory === 'health',
    isFinanceClaim: category === 'finance' || retrievalCategory === 'finance',
    isStatisticalClaim: category === 'statistics',
    isQuoteClaim: category === 'quote',
    isAdversarialClaim: category === 'adversarial',
    routingReason: normalized
      ? getRoutingReason(category, retrievalCategory)
      : 'Empty claim input falls back to general routing.',
  }
}

export function isValidClaimCategory(value: string): value is ClaimCategory {
  return CLAIM_CATEGORIES.includes(value as ClaimCategory)
}

export function isValidRetrievalCategory(value: string): value is RetrievalCategory {
  return RETRIEVAL_CATEGORIES.includes(value as RetrievalCategory)
}
