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

export type CurrentOfficeHolderRole =
  | 'president'
  | 'vice_president'
  | 'prime_minister'
  | 'chief_minister'
  | 'governor'
  | 'ceo'
  | 'head'
  | 'leader'

export type CurrentOfficeHolderMatch = {
  matched: boolean
  role: CurrentOfficeHolderRole | null
  subject: string | null
  target: string | null
}

export type ClaimRoute = {
  category: ClaimCategory
  retrievalCategory: RetrievalCategory
  isScamLike: boolean
  isCivicRumor: boolean
  isBreakingNews: boolean
  isStableFactCandidate: boolean
  isCurrentOfficeHolder: boolean
  isHealthClaim: boolean
  isFinanceClaim: boolean
  isStatisticalClaim: boolean
  isQuoteClaim: boolean
  isAdversarialClaim: boolean
  routingReason: string
}

export type PersonDeathProfile = {
  matched: boolean
  fullName: string | null
  surname: string | null
  aliasSignals: string[]
}

export type ExamClaimProfile = {
  matched: boolean
  examFamily: 'ugc_net' | 'net' | 'neet' | 'csir_net' | 'jee' | null
  canonicalQuery: string | null
  queryTokens: string[]
  institutionalSignals: string[]
}

export type IdentityThreatProfile = {
  matched: boolean
  authority: 'aadhaar' | null
  queryTokens: string[]
  threatSignals: string[]
}

export type MedicineRumorProfile = {
  matched: boolean
  canonicalQuery: string | null
  medicineTokens: string[]
  concernSignals: string[]
  requiresP500Specificity: boolean
}

export type ProductLaunchProfile = {
  matched: boolean
  organization: string | null
  productTokens: string[]
  launchSignals: string[]
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
  'dead',
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
  'paracetamol',
  'tablet',
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

const EXAM_LEAK_CUES = [
  'exam',
  'paper leak',
  'paper leaked',
  'paper was leaked',
  'question paper',
  'nta',
  'cbi',
  'cancelled',
  'canceled',
  'investigation',
  'integrity',
  'telegram',
  'darknet',
] as const

const KARPATHY_ALIAS_SIGNALS = [
  'karpathy',
  'openai',
  'tesla',
  'stanford',
  'eureka labs',
  'anthropic',
] as const

const CURRENT_OFFICE_HOLDER_ROLE_PATTERNS: Array<{
  role: CurrentOfficeHolderRole
  patterns: RegExp[]
}> = [
  {
    role: 'vice_president',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+vice\s+president\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+vice\s+president\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'prime_minister',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+prime\s+minister\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+prime\s+minister\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'chief_minister',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+chief\s+minister\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+chief\s+minister\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'president',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+president\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+president\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'governor',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+governor\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+governor\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'ceo',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+(?:ceo|chief\s+executive\s+officer)\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+(?:ceo|chief\s+executive\s+officer)\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'head',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+head\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+head\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
  {
    role: 'leader',
    patterns: [
      /\b(?:[a-z][a-z.'-]*\s+){0,6}is\s+the\s+current\s+leader\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
      /\bcurrent\s+leader\s+of\s+([a-z0-9&.,' -]{2,80})\b/i,
    ],
  },
] as const

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeOfficeHolderEntity(value: string | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim().replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '')
  return normalized || null
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

export function getPersonDeathProfile(claim: string): PersonDeathProfile {
  const normalized = normalizeText(claim)
  const deathLike = /\b(dead|death|died|dies|passed away|killed)\b/.test(normalized)

  if (!deathLike) {
    return {
      matched: false,
      fullName: null,
      surname: null,
      aliasSignals: [],
    }
  }

  const nameSegmentMatch =
    normalized.match(/\b([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){1,2})\s+is\s+(?:dead|died|dies|killed)\b/) ??
    normalized.match(/\b([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){1,2})\s+(?:dead|died|dies|passed away|killed)\b/) ??
    normalized.match(/\b(?:dead|death of|died)\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){1,3})\b/)

  const fullName = nameSegmentMatch?.[1]?.trim() ?? null
  const fullNameTokens = fullName?.split(/\s+/).filter(Boolean) ?? []
  const surname = fullNameTokens.length >= 2 ? fullNameTokens[fullNameTokens.length - 1] : null
  const aliasSignals =
    fullName === 'andrej karpathy'
      ? [...KARPATHY_ALIAS_SIGNALS]
      : surname
        ? [surname]
        : []

  return {
    matched: Boolean(fullName && surname),
    fullName,
    surname,
    aliasSignals,
  }
}

export function getExamClaimProfile(claim: string): ExamClaimProfile {
  const normalized = normalizeText(claim)
  const leakLike =
    hasAnySignal(normalized, Array.from(EXAM_LEAK_CUES)) ||
    /\b(leak|leaked|leaking|postponed|cancelled|canceled|compromised)\b/.test(normalized)

  if (!leakLike) {
    return {
      matched: false,
      examFamily: null,
      canonicalQuery: null,
      queryTokens: [],
      institutionalSignals: [],
    }
  }

  let examFamily: ExamClaimProfile['examFamily'] = null
  let canonicalQuery: string | null = null
  let queryTokens: string[] = []

  if (/\b(csir[\s-]*net)\b/.test(normalized)) {
    examFamily = 'csir_net'
    canonicalQuery = 'CSIR NET'
    queryTokens = ['csir net', 'csir', 'net']
  } else if (/\b(ugc[\s-]*net)\b/.test(normalized)) {
    examFamily = 'ugc_net'
    canonicalQuery = 'UGC NET'
    queryTokens = ['ugc net', 'ugc-net', 'ugc', 'net']
  } else if (/\bneet\b/.test(normalized)) {
    examFamily = 'neet'
    canonicalQuery = 'NEET'
    queryTokens = ['neet']
  } else if (/\bjee\b/.test(normalized)) {
    examFamily = 'jee'
    canonicalQuery = 'JEE'
    queryTokens = ['jee']
  } else if (/\bnet\b/.test(normalized) && /\b(paper|exam|ugc|nta|cbi|leak|leaked|cancelled|canceled|investigation)\b/.test(normalized)) {
    examFamily = 'net'
    canonicalQuery = 'UGC NET'
    queryTokens = ['ugc net', 'ugc-net', 'net']
  }

  if (!examFamily) {
    return {
      matched: false,
      examFamily: null,
      canonicalQuery: null,
      queryTokens: [],
      institutionalSignals: [],
    }
  }

  const institutionalSignals = ['nta', 'cbi']
  if (examFamily === 'ugc_net' || examFamily === 'net' || examFamily === 'csir_net') {
    institutionalSignals.unshift('ugc')
  }

  return {
    matched: true,
    examFamily,
    canonicalQuery,
    queryTokens,
    institutionalSignals,
  }
}

export function getIdentityThreatProfile(claim: string): IdentityThreatProfile {
  const normalized = normalizeText(claim)
  const aadhaarLike = /\b(aadhaar|aadhar|uidai|myaadhaar)\b/.test(normalized)
  const threatSignals = [
    'verify',
    'verification',
    'update',
    'kyc',
    'blocked',
    'deactivated',
    'deactivate',
    'suspended',
    'suspend',
    'today',
    'tonight',
    'link',
  ].filter((signal) => normalized.includes(signal))

  if (!aadhaarLike || threatSignals.length < 2) {
    return {
      matched: false,
      authority: null,
      queryTokens: [],
      threatSignals: [],
    }
  }

  return {
    matched: true,
    authority: 'aadhaar',
    queryTokens: ['aadhaar', 'uidai', 'myaadhaar'],
    threatSignals,
  }
}

export function getMedicineRumorProfile(claim: string): MedicineRumorProfile {
  const normalized = normalizeText(claim)
  const medicineTokens = ['paracetamol', 'acetaminophen', 'p-500', 'p/500', 'p 500', 'p500'].filter((token) =>
    normalized.includes(token)
  )
  const concernSignals = [
    'virus',
    'machupo',
    'warning',
    'whatsapp',
    'message',
    'fake',
    'hoax',
    'rumor',
    'rumour',
    'viral message',
    'fake news',
  ].filter((signal) => normalized.includes(signal))
  const requiresP500Specificity = /\bp[\s/-]?500\b/.test(normalized)

  if (!medicineTokens.length || !concernSignals.length) {
    return {
      matched: false,
      canonicalQuery: null,
      medicineTokens: [],
      concernSignals: [],
      requiresP500Specificity: false,
    }
  }

  return {
    matched: true,
    canonicalQuery: requiresP500Specificity
      ? 'paracetamol P-500 contains Machupo virus fake news'
      : 'paracetamol virus WhatsApp rumor fact check',
    medicineTokens,
    concernSignals,
    requiresP500Specificity,
  }
}

export function getProductLaunchProfile(claim: string): ProductLaunchProfile {
  const normalized = normalizeText(claim)
  const openAiLike = /\bopenai\b/.test(normalized)
  const gpt6Like = /\bgpt[\s-]?6\b/.test(normalized)
  const launchSignals = [
    'launch',
    'launched',
    'release',
    'released',
    'public',
    'publicly',
    'today',
    'announced',
  ].filter((signal) => normalized.includes(signal))

  if (!openAiLike || !gpt6Like || !launchSignals.length) {
    return {
      matched: false,
      organization: null,
      productTokens: [],
      launchSignals: [],
    }
  }

  return {
    matched: true,
    organization: 'openai',
    productTokens: ['gpt-6', 'gpt 6', 'gpt6', 'openai'],
    launchSignals,
  }
}

export function detectCurrentOfficeHolderClaim(claim: string): CurrentOfficeHolderMatch {
  const normalized = normalizeText(claim)

  if (!normalized || !normalized.includes('current')) {
    return {
      matched: false,
      role: null,
      subject: null,
      target: null,
    }
  }

  for (const entry of CURRENT_OFFICE_HOLDER_ROLE_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = claim.match(pattern)

      if (!match) {
        continue
      }

      const fullMatch = normalizeOfficeHolderEntity(match[0])
      const target = normalizeOfficeHolderEntity(match[1])
      const subjectMatch = fullMatch?.match(
        /^(.*?)\s+is\s+the\s+current\s+(?:vice\s+president|prime\s+minister|chief\s+minister|president|governor|ceo|chief\s+executive\s+officer|head|leader)\s+of\b/i
      )
      const subject = normalizeOfficeHolderEntity(subjectMatch?.[1])

      return {
        matched: Boolean(target),
        role: entry.role,
        subject,
        target,
      }
    }
  }

  return {
    matched: false,
    role: null,
    subject: null,
    target: null,
  }
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

  if (detectCurrentOfficeHolderClaim(claim).matched) {
    return false
  }

  if (getExamClaimProfile(claim).matched) {
    return false
  }

  if (getMedicineRumorProfile(claim).matched || getProductLaunchProfile(claim).matched) {
    return false
  }

  if (hasAnySignal(normalized, Array.from(STABLE_FACT_NEGATIVE_SIGNALS))) {
    return false
  }

  return hasAnySignal(normalized, Array.from(STABLE_FACT_POSITIVE_SIGNALS)) || /\b(18|19|20)\d{2}\b/.test(normalized)
}

function isHealthClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(HEALTH_CUES)) || getMedicineRumorProfile(claim).matched
}

function isFinanceClaim(claim: string) {
  const normalized = normalizeText(claim)
  return hasAnySignal(normalized, Array.from(FINANCE_CUES))
}

function isScamLikeClaim(claim: string) {
  const normalized = normalizeText(claim)
  const identityThreatProfile = getIdentityThreatProfile(claim)

  if (!normalized) {
    return false
  }

  if (identityThreatProfile.matched) {
    return true
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
  const examClaim = getExamClaimProfile(claim)
  const identityThreatProfile = getIdentityThreatProfile(claim)
  const medicineRumorProfile = getMedicineRumorProfile(claim)

  if (hasAnySignal(normalized, Array.from(SCAM_SIGNAL_CUES))) {
    return 'scam'
  }

  if (identityThreatProfile.matched) {
    return 'scam'
  }

  if (examClaim.matched) {
    return 'government'
  }

  if (medicineRumorProfile.matched) {
    return 'health'
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
  const examClaim = getExamClaimProfile(claim)

  if (detectCurrentOfficeHolderClaim(claim).matched) {
    return 'general'
  }

  if (isScamLikeClaim(claim)) {
    return 'scam'
  }

  if (isBreakingNewsClaim(claim)) {
    return 'breaking_news'
  }

  if (examClaim.matched) {
    return 'civic_rumor'
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
  const officeHolderMatch = detectCurrentOfficeHolderClaim(claim)

  return {
    category,
    retrievalCategory,
    isScamLike: category === 'scam',
    isCivicRumor: !officeHolderMatch.matched && (category === 'civic_rumor' || retrievalCategory === 'government'),
    isBreakingNews: category === 'breaking_news',
    isStableFactCandidate: category === 'stable_fact',
    isCurrentOfficeHolder: officeHolderMatch.matched,
    isHealthClaim: category === 'health' || retrievalCategory === 'health',
    isFinanceClaim: category === 'finance' || retrievalCategory === 'finance',
    isStatisticalClaim: category === 'statistics',
    isQuoteClaim: category === 'quote',
    isAdversarialClaim: category === 'adversarial',
    routingReason: normalized
      ? officeHolderMatch.matched
        ? 'Current office-holder or current leadership claim was detected.'
        : getRoutingReason(category, retrievalCategory)
      : 'Empty claim input falls back to general routing.',
  }
}

export function isValidClaimCategory(value: string): value is ClaimCategory {
  return CLAIM_CATEGORIES.includes(value as ClaimCategory)
}

export function isValidRetrievalCategory(value: string): value is RetrievalCategory {
  return RETRIEVAL_CATEGORIES.includes(value as RetrievalCategory)
}
