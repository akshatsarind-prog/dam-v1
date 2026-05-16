export type Verdict =
  | 'Corroborated'
  | 'Likely Reliable'
  | 'Likely incorrect'
  | 'Mixed Evidence'
  | 'Insufficient Verification'
  | 'High Risk Claim'
  | 'Escalation Recommended'
  | 'Dangerous unsupported claim'
  | 'Unverified'
  | 'Evidence insufficient'
  | 'Missing context'
  | 'Unsupported civic claim'
  | 'Verification incomplete'
  | 'Fake KYC urgency'
  | 'Credential harvesting pattern'
  | 'Likely phishing attempt'
  | 'Impersonation risk'
  | 'Suspicious payment extraction'
  | 'Payment extraction pattern'
  | 'Reward bait pattern'
  | 'Chain-forward manipulation'
  | 'Suspicious link behavior'
  | 'Guaranteed-return scam pattern'

export type ConfidenceLabel = 'Weak' | 'Moderate' | 'Strong'
export type Risk = 'Low' | 'Medium' | 'High' | 'Severe'
export type IndicatorState = 'stable' | 'watch' | 'critical'
export type CredibilityLabel = 'High' | 'Moderate' | 'Low' | 'Unknown'
export type ContradictionLevel = 'None' | 'Low' | 'Moderate' | 'High' | 'Unknown'
export type EvidenceStance = 'Supports' | 'Contradicts' | 'Contextualizes' | 'Unclear'

export type ClaimDecomposition = {
  entities: string[]
  dates: string[]
  locations: string[]
  organizations: string[]
  numericalClaims: string[]
  factualAssertions: string[]
  retrievalQueries: string[]
}

export type Confidence = {
  score: number
  label: ConfidenceLabel
  rationale: string
  drivers: string[]
}

export type SourceCredibility = {
  label: CredibilityLabel
  weightedScore: number
  highTrustSources: number
  moderateTrustSources: number
  lowTrustSources: number
  unknownTrustSources: number
  rationale: string
}

export type EvidenceCard = {
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

export type CorroborationLevel = {
  label: string
  agreement: string
  sourceCount: number
  highCredibilityCount: number
  indicators: string[]
}

export type Contradiction = {
  summary: string
  severity: ContradictionLevel
  sources: string[]
}

export type ContradictionSummary = {
  level: ContradictionLevel
  summary: string
  items: Contradiction[]
}

export type OperationalGuidance = {
  action: string
  distribution: string
  escalation: string
  nextSteps: string[]
}

export type Analysis = {
  verdict: Verdict
  confidence: Confidence
  risk: Risk
  reasoning: string
  corroborationLevel: CorroborationLevel
  sourceCredibility: SourceCredibility
  contradictions: ContradictionSummary
  evidence: EvidenceCard[]
  operationalGuidance: OperationalGuidance
  claimDecomposition: ClaimDecomposition
  retrievedAt: string
}

export type Indicator = {
  label: string
  value: string
  state: IndicatorState
}

export type ReportMeta = {
  traceId: string
  timestamp: string
}

export type ExampleClaimDomain = {
  id: string
  label: string
  claims: string[]
}

export const MAX_CLAIM_LENGTH = 1200

const EXAMPLE_CLAIM_SESSION_STORAGE_KEY = 'dam_example_claims_by_domain'

const emptyDecomposition: ClaimDecomposition = {
  entities: [],
  dates: [],
  locations: [],
  organizations: [],
  numericalClaims: [],
  factualAssertions: [],
  retrievalQueries: [],
}

export const fallbackAnalysis: Analysis = {
  verdict: 'Insufficient Verification',
  confidence: {
    score: 0,
    label: 'Weak',
    rationale: 'No retrieval-backed analysis has been generated.',
    drivers: ['Awaiting retrieved evidence.'],
  },
  risk: 'Medium',
  reasoning:
    'Analysis is limited because the evidence intelligence layer did not return a calibrated report.',
  corroborationLevel: {
    label: 'Pending retrieval',
    agreement: 'No source agreement has been evaluated.',
    sourceCount: 0,
    highCredibilityCount: 0,
    indicators: ['No retrieved evidence available.'],
  },
  sourceCredibility: {
    label: 'Unknown',
    weightedScore: 0,
    highTrustSources: 0,
    moderateTrustSources: 0,
    lowTrustSources: 0,
    unknownTrustSources: 0,
    rationale: 'No sources have been ranked.',
  },
  contradictions: {
    level: 'Unknown',
    summary: 'Contradiction analysis has not run.',
    items: [],
  },
  evidence: [],
  operationalGuidance: {
    action: 'Hold amplification until evidence is retrieved and analyzed.',
    distribution: 'Do not distribute as verified.',
    escalation: 'Manual review if the claim is urgent or high-impact.',
    nextSteps: ['Submit a claim for retrieval-backed analysis.'],
  },
  claimDecomposition: emptyDecomposition,
  retrievedAt: '',
}

export const riskStyles: Record<Risk, string> = {
  Low: 'risk-low',
  Medium: 'risk-medium',
  High: 'risk-high',
  Severe: 'risk-high',
}

const verdictValues: Verdict[] = [
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
]

const confidenceLabels: ConfidenceLabel[] = ['Weak', 'Moderate', 'Strong']
const riskValues: Risk[] = ['Low', 'Medium', 'High', 'Severe']
const credibilityLabels: CredibilityLabel[] = ['High', 'Moderate', 'Low', 'Unknown']
const contradictionLevels: ContradictionLevel[] = ['None', 'Low', 'Moderate', 'High', 'Unknown']
const stanceValues: EvidenceStance[] = ['Supports', 'Contradicts', 'Contextualizes', 'Unclear']

const corroboratedHeadline = 'Evidence supports this claim.'
const contradictionHeadline = 'Evidence directly contradicts this claim.'
const credentialHarvestingHeadline = 'Credential harvesting risk detected.'
const paymentExtractionHeadline = 'Suspicious payment extraction pattern detected.'
const rewardBaitHeadline = 'Reward-bait scam pattern detected.'
const guaranteedReturnHeadline = 'Guaranteed-return scam pattern detected.'
const forwardingHeadline = 'Manipulative forwarding behavior detected.'
const impersonationHeadline = 'Authority impersonation risk detected.'
const verificationIncompleteHeadline = 'Verification remains incomplete.'
const civicRumorHeadline = 'No authoritative support identified.'
const mixedEvidenceHeadline = 'Retrieved sources diverge or only partially align.'
const riskReviewHeadline = 'Evidence posture requires review before release.'
const insufficientEvidenceHeadline = 'Evidence is not strong enough to verify.'

export const processingStages = [
  'Decomposing claim',
  'Retrieving evidence',
  'Ranking source credibility',
  'Checking contradictions',
  'Calibrating verdict',
]

export const flowSteps = [
  {
    number: '01',
    title: 'Claim Decomposition',
    body: 'Extract entities, dates, organizations, numerical claims, and factual assertions for retrieval.',
  },
  {
    number: '02',
    title: 'Evidence Retrieval',
    body: 'Collect official, news, scientific, corroborating, and contradicting source material.',
  },
  {
    number: '03',
    title: 'Calibrated Verdict',
    body: 'Convert corroboration, source credibility, and contradictions into an operational posture.',
  },
]

export const useCases = [
  'Breaking-news moderation',
  'Executive response review',
  'Campaign narrative triage',
  'Community trust operations',
]

export const productSignals = [
  'Evidence Citations',
  'Source Credibility',
  'Corroboration Level',
  'Contradiction Summary',
]

export const exampleClaimDomains: ExampleClaimDomain[] = [
  {
    id: 'scam-kyc',
    label: 'Scam / KYC',
    claims: [
      'Your bank account will be frozen today unless you complete KYC through this link immediately.',
      'The RBI has ordered all wallet users to re-verify PAN details before midnight or lose access.',
      'A customer-care agent texted saying my UPI will stop working unless I confirm my Aadhaar now.',
      'This message says my salary account is under review and needs urgent video KYC in the next hour.',
      'An SMS claims my debit card will be blocked unless I update KYC using a shortened link.',
      'A payment app notification says dormant accounts must verify identity again to avoid suspension.',
      'Someone claiming to be from the bank asked me to install a KYC update app to keep my account active.',
      'This WhatsApp note says senior citizens must complete emergency e-KYC today to keep pension payments coming.',
      'A caller said my mobile banking is flagged and only an immediate KYC form can prevent closure.',
      'A message claims the government has started surprise KYC checks and non-compliant accounts will be locked.',
    ],
  },
  {
    id: 'whatsapp-forward',
    label: 'WhatsApp Forward',
    claims: [
      'Forward this to 15 people or your account may be marked inactive by tonight.',
      'This viral message says schools will shut for a week because of a secret government order.',
      'A WhatsApp forward claims police are stopping random people and checking phones for a new rule.',
      'This message says a famous brand is giving away free recharge if you forward it to your groups.',
      'A community forward says a major supermarket is secretly closing branches tomorrow morning.',
      'This chain message claims a dangerous gang is targeting delivery workers in every city this week.',
      'The forward says a new tax will be deducted automatically from all digital payments starting tomorrow.',
      'A viral note claims the city water supply will be poisoned unless residents boil all water tonight.',
      'This message says WhatsApp itself will start charging monthly unless users share the notice widely.',
      'A family-group forward claims all ATMs in the district will stop cash service for two days.',
    ],
  },
  {
    id: 'health-claim',
    label: 'Health Claim',
    claims: [
      'Drinking hot salt water every morning can flush viruses out of the body within a day.',
      'A post says microwaved food causes immediate toxin buildup that standard tests do not detect.',
      'This claim says one spoon of castor oil can reverse severe joint pain in 24 hours.',
      'A viral reel claims common cough syrup is now banned because it secretly damages the liver.',
      'This message says hospitals are hiding that papaya leaf juice cures dengue within hours.',
      'A post claims smartphone radiation is the main reason for sudden headaches in children.',
      'This note says inhaling steam with herbal oil can permanently clear lung infection at home.',
      'A voice note claims diabetes medicines can be stopped if you drink bitter gourd juice for one week.',
      'A social post says sunscreen causes more skin cancer than direct sunlight.',
      'This claim says a simple kitchen spice mixture can dissolve kidney stones without medical treatment.',
    ],
  },
  {
    id: 'political-civic-rumor',
    label: 'Political / Civic Rumor',
    claims: [
      'A post says voter ID cards from one neighborhood have been quietly canceled before the next election.',
      'This message claims the city has imposed a hidden curfew but is avoiding public announcement.',
      'A rumor says one community will be denied government benefits under a new district order.',
      'This claim says a new law allows police to seize phones during public gatherings without notice.',
      'A viral post says bus services are being cut in selected wards for political reasons.',
      'This message claims a state agency has told local shops to remove certain language signboards.',
      'A post says the election date was secretly shifted and only insiders know the new schedule.',
      'This claim says schools will require parents to submit citizenship records next month.',
      'A community rumor says new property documents will be invalid unless renewed under a political scheme.',
      'This message claims a government office has stopped accepting applications from one caste group.',
    ],
  },
  {
    id: 'breaking-news',
    label: 'Breaking News',
    claims: [
      'Posts are saying a major bridge in the city has collapsed this morning.',
      'A message claims a senior minister has just resigned after an overnight raid.',
      'People are sharing that a large fire has broken out at the main railway station.',
      'This claim says a well-known actor has been detained at the airport right now.',
      'A viral update says mobile networks will be suspended tonight because of an emergency.',
      'Several posts claim a school bus accident has happened on the highway this afternoon.',
      'This message says the airport has been shut after a security threat was found.',
      'A post claims a popular payments app has stopped working nationwide in the last hour.',
      'This breaking alert says a city hospital has been evacuated after a gas leak.',
      'People are sharing that a top court has issued an immediate ban on app-based deliveries.',
    ],
  },
  {
    id: 'manipulated-statistic',
    label: 'Manipulated Statistic',
    claims: [
      'A chart says youth unemployment doubled in just three months across the entire country.',
      'This post claims 90 percent of local businesses have already closed because of one new policy.',
      'A graphic says one city accounts for half of all cybercrime cases in the nation.',
      'This claim says hospital admissions rose by 300 percent after the rollout of a new food product.',
      'A viral infographic says most students now fail public exams because of digital learning.',
      'This post claims electric scooters are involved in 70 percent of all road accidents downtown.',
      'A statistic card says online scams grew ten times in one month after a telecom update.',
      'This chart claims the district lost one-third of its drinking water supply this year alone.',
      'A post says crime fell to almost zero in neighborhoods covered by one private surveillance company.',
      'This message claims half the city now pays income tax on UPI transfers.',
    ],
  },
  {
    id: 'fake-government-notice',
    label: 'Fake Government Notice',
    claims: [
      'A notice says all residents must register their SIM cards again at the district office this week.',
      'This circular claims the central government has ordered mandatory biometric checks at ration shops tomorrow.',
      'A PDF says shopkeepers need a new emergency trade pass within 48 hours to avoid fines.',
      'This notice claims all landlords must submit tenant photos to a new police portal by Friday.',
      'A message says pension payments will stop unless beneficiaries download a new government verification app.',
      'This order claims every family must update household income details through a WhatsApp number.',
      'A poster says the municipality has banned street vending after 6 PM starting tonight.',
      'This claim says every vehicle owner must carry a new pollution slip format from next week.',
      'A circulating letter says schools need a special district permit to operate summer classes.',
      'This notice claims property taxes must now be paid only through a newly launched portal link.',
    ],
  },
  {
    id: 'crypto-investment-scam',
    label: 'Crypto / Investment Scam',
    claims: [
      'A Telegram group promises guaranteed 3 percent daily returns from a new AI trading coin.',
      'This message says an insider crypto presale will triple money within one week with zero risk.',
      'A post claims a government-backed token is launching quietly before public listing tomorrow.',
      'This investment channel says small deposits can be auto-multiplied overnight through a regulated bot.',
      'A viral ad promises fixed monthly returns from bitcoin mining without any market downside.',
      'This message says a celebrity-backed coin will be officially endorsed after the first 10,000 signups.',
      'A WhatsApp invite claims verified users can double funds through a short-term staking loophole.',
      'This post says a private exchange is offering protected profits if you invest before midnight.',
      'A crypto influencer claims one new token cannot fall because whales already locked the supply.',
      'This message says a limited VIP pool can recover previous trading losses with one final deposit.',
    ],
  },
  {
    id: 'ai-misinformation',
    label: 'AI-generated Misinformation',
    claims: [
      'A video appears to show a public official admitting the shortage was planned.',
      'An audio clip sounds like a police officer warning of a cover-up in the city.',
      'This image claims to show a flood at the airport from just a few hours ago.',
      'A clip appears to show a news anchor confirming a nationwide app ban before sunrise.',
      'This video looks like a celebrity endorsing an investment plan with guaranteed returns.',
      'An audio note sounds like a hospital doctor urging people to avoid a common vaccine.',
      'This image appears to show soldiers deployed inside a local college campus tonight.',
      'A reel looks like a minister announcing free cash transfers to selected phone numbers.',
      'This clip appears to show a judge privately revealing the result of a pending case.',
      'An audio recording sounds like a bank executive asking customers to move funds immediately.',
    ],
  },
  {
    id: 'community-rumor',
    label: 'Community Rumor',
    claims: [
      'Neighbors are saying a local grocery owner was caught mixing harmful powder into flour.',
      'This rumor says a well-known tuition center is about to shut down after a secret inspection.',
      'A local post claims stray dogs in one colony were deliberately poisoned overnight.',
      'People are sharing that the apartment water tanks have tested unsafe but management is hiding it.',
      'This message says thieves are marking front doors in the neighborhood before night break-ins.',
      'A community rumor claims the main vegetable market will close for hygiene violations tomorrow.',
      'This post says one neighborhood clinic was sealed after fake medicines were discovered inside.',
      'A local forward claims school buses are using unlicensed drivers this week.',
      'Residents are saying a new mobile tower is causing sudden illness in nearby homes.',
      'This rumor says the area park will be demolished without public notice for a private project.',
    ],
  },
]

function getExampleClaimStorage() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = window.sessionStorage.getItem(EXAMPLE_CLAIM_SESSION_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number[]>) : {}
  } catch {
    return {}
  }
}

function setExampleClaimStorage(value: Record<string, number[]>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(EXAMPLE_CLAIM_SESSION_STORAGE_KEY, JSON.stringify(value))
  } catch {}
}

export function getRandomExampleClaimForSession(domainId: string) {
  const domain = exampleClaimDomains.find((item) => item.id === domainId)

  if (!domain) {
    return null
  }

  const stored = getExampleClaimStorage()
  const usedIndexes = Array.isArray(stored[domainId])
    ? stored[domainId].filter(
        (value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < domain.claims.length
      )
    : []
  const availableIndexes = domain.claims
    .map((_, index) => index)
    .filter((index) => !usedIndexes.includes(index))
  const pool = availableIndexes.length ? availableIndexes : domain.claims.map((_, index) => index)
  const selectedIndex = pool[Math.floor(Math.random() * pool.length)]

  stored[domainId] = availableIndexes.length ? [...usedIndexes, selectedIndex] : [selectedIndex]
  setExampleClaimStorage(stored)

  return domain.claims[selectedIndex]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function createTraceId() {
  const stamp = Date.now().toString(36).toUpperCase()
  const fragment = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DAM-${stamp}-${fragment}`
}

export function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && verdictValues.includes(value as Verdict)
}

function isRisk(value: unknown): value is Risk {
  return typeof value === 'string' && riskValues.includes(value as Risk)
}

function isConfidenceLabel(value: unknown): value is ConfidenceLabel {
  return typeof value === 'string' && confidenceLabels.includes(value as ConfidenceLabel)
}

function isCredibilityLabel(value: unknown): value is CredibilityLabel {
  return typeof value === 'string' && credibilityLabels.includes(value as CredibilityLabel)
}

function isContradictionLevel(value: unknown): value is ContradictionLevel {
  return typeof value === 'string' && contradictionLevels.includes(value as ContradictionLevel)
}

function isEvidenceStance(value: unknown): value is EvidenceStance {
  return typeof value === 'string' && stanceValues.includes(value as EvidenceStance)
}

function readString(value: unknown, fallbackValue: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallbackValue
}

function readNumber(value: unknown, fallbackValue: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallbackValue
}

function readStringList(value: unknown, fallbackValue: string[], limit = 8) {
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

function readObject(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeDecomposition(value: unknown): ClaimDecomposition {
  const data = readObject(value)

  return {
    entities: readStringList(data.entities, []),
    dates: readStringList(data.dates, []),
    locations: readStringList(data.locations, []),
    organizations: readStringList(data.organizations, []),
    numericalClaims: readStringList(data.numericalClaims, []),
    factualAssertions: readStringList(data.factualAssertions, []),
    retrievalQueries: readStringList(data.retrievalQueries, []),
  }
}

function normalizeEvidence(value: unknown): EvidenceCard[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: readString(item.id, 'E--'),
      title: readString(item.title, 'Untitled source'),
      url: readString(item.url, ''),
      domain: readString(item.domain, 'unknown'),
      publishedDate: typeof item.publishedDate === 'string' ? item.publishedDate : null,
      credibility: isCredibilityLabel(item.credibility) ? item.credibility : 'Unknown',
      credibilityScore: clamp(Math.round(readNumber(item.credibilityScore, 0)), 0, 100),
      credibilityRationale: readString(
        item.credibilityRationale,
        'No source credibility rationale supplied.'
      ),
      retrievalScore: clamp(readNumber(item.retrievalScore, 0), 0, 1),
      query: readString(item.query, 'Retrieval query unavailable'),
      stance: isEvidenceStance(item.stance) ? item.stance : 'Unclear',
      excerpt: readString(item.excerpt, 'No retrieved preview available.'),
      assessment: readString(item.assessment, 'No evidence assessment supplied.'),
    }))
    .filter((item) => item.url)
}

export function normalizeAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') {
    return fallbackAnalysis
  }

  const data = value as Record<string, unknown>
  const confidence = readObject(data.confidence)
  const corroborationLevel = readObject(data.corroborationLevel)
  const sourceCredibility = readObject(data.sourceCredibility)
  const contradictions = readObject(data.contradictions)
  const operationalGuidance = readObject(data.operationalGuidance)
  const contradictionItems = Array.isArray(contradictions.items)
    ? contradictions.items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          summary: readString(item.summary, 'No contradiction detail supplied.'),
          severity: isContradictionLevel(item.severity) ? item.severity : 'Unknown',
          sources: readStringList(item.sources, []),
        }))
    : []

  return {
    verdict: isVerdict(data.verdict) ? data.verdict : fallbackAnalysis.verdict,
    confidence: {
      score: clamp(Math.round(readNumber(confidence.score, 0)), 0, 100),
      label: isConfidenceLabel(confidence.label) ? confidence.label : 'Weak',
      rationale: readString(confidence.rationale, fallbackAnalysis.confidence.rationale),
      drivers: readStringList(confidence.drivers, fallbackAnalysis.confidence.drivers),
    },
    risk: isRisk(data.risk) ? data.risk : fallbackAnalysis.risk,
    reasoning: readString(data.reasoning, fallbackAnalysis.reasoning),
    corroborationLevel: {
      label: readString(corroborationLevel.label, fallbackAnalysis.corroborationLevel.label),
      agreement: readString(
        corroborationLevel.agreement,
        fallbackAnalysis.corroborationLevel.agreement
      ),
      sourceCount: Math.max(0, Math.round(readNumber(corroborationLevel.sourceCount, 0))),
      highCredibilityCount: Math.max(
        0,
        Math.round(readNumber(corroborationLevel.highCredibilityCount, 0))
      ),
      indicators: readStringList(
        corroborationLevel.indicators,
        fallbackAnalysis.corroborationLevel.indicators
      ),
    },
    sourceCredibility: {
      label: isCredibilityLabel(sourceCredibility.label) ? sourceCredibility.label : 'Unknown',
      weightedScore: clamp(Math.round(readNumber(sourceCredibility.weightedScore, 0)), 0, 100),
      highTrustSources: Math.max(0, Math.round(readNumber(sourceCredibility.highTrustSources, 0))),
      moderateTrustSources: Math.max(
        0,
        Math.round(readNumber(sourceCredibility.moderateTrustSources, 0))
      ),
      lowTrustSources: Math.max(0, Math.round(readNumber(sourceCredibility.lowTrustSources, 0))),
      unknownTrustSources: Math.max(
        0,
        Math.round(readNumber(sourceCredibility.unknownTrustSources, 0))
      ),
      rationale: readString(sourceCredibility.rationale, fallbackAnalysis.sourceCredibility.rationale),
    },
    contradictions: {
      level: isContradictionLevel(contradictions.level) ? contradictions.level : 'Unknown',
      summary: readString(contradictions.summary, fallbackAnalysis.contradictions.summary),
      items: contradictionItems,
    },
    evidence: normalizeEvidence(data.evidence),
    operationalGuidance: {
      action: readString(operationalGuidance.action, fallbackAnalysis.operationalGuidance.action),
      distribution: readString(
        operationalGuidance.distribution,
        fallbackAnalysis.operationalGuidance.distribution
      ),
      escalation: readString(
        operationalGuidance.escalation,
        fallbackAnalysis.operationalGuidance.escalation
      ),
      nextSteps: readStringList(
        operationalGuidance.nextSteps,
        fallbackAnalysis.operationalGuidance.nextSteps
      ),
    },
    claimDecomposition: normalizeDecomposition(data.claimDecomposition),
    retrievedAt: readString(data.retrievedAt, ''),
  }
}

export function getIndicatorStateForRisk(risk: Risk): IndicatorState {
  if (risk === 'Severe' || risk === 'High') {
    return 'critical'
  }

  if (risk === 'Medium') {
    return 'watch'
  }

  return 'stable'
}

function getIndicatorStateForCredibility(label: CredibilityLabel): IndicatorState {
  if (label === 'High') {
    return 'stable'
  }

  if (label === 'Moderate' || label === 'Unknown') {
    return 'watch'
  }

  return 'critical'
}

export function getIndicatorStateForContradiction(level: ContradictionLevel): IndicatorState {
  if (level === 'None' || level === 'Low') {
    return 'stable'
  }

  if (level === 'Moderate' || level === 'Unknown') {
    return 'watch'
  }

  return 'critical'
}

function getIndicatorStateForConfidence(label: ConfidenceLabel): IndicatorState {
  if (label === 'Strong') {
    return 'stable'
  }

  if (label === 'Moderate') {
    return 'watch'
  }

  return 'critical'
}

export function getEvidenceIndicators(analysis: Analysis): Indicator[] {
  return [
    {
      label: 'Corroboration',
      value: analysis.corroborationLevel.label,
      state:
        analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable'
          ? 'stable'
          : analysis.verdict === 'Mixed Evidence'
            ? 'watch'
            : 'critical',
    },
    {
      label: 'Source Credibility',
      value: `${analysis.sourceCredibility.label} / ${analysis.sourceCredibility.weightedScore}`,
      state: getIndicatorStateForCredibility(analysis.sourceCredibility.label),
    },
    {
      label: 'Contradictions',
      value: analysis.contradictions.level,
      state: getIndicatorStateForContradiction(analysis.contradictions.level),
    },
    {
      label: 'Evidence Density',
      value: `${analysis.corroborationLevel.sourceCount} sources`,
      state:
        analysis.corroborationLevel.sourceCount >= 4
          ? 'stable'
          : analysis.corroborationLevel.sourceCount >= 2
            ? 'watch'
            : 'critical',
    },
    {
      label: 'Confidence',
      value: `${analysis.confidence.label} / ${analysis.confidence.score}%`,
      state: getIndicatorStateForConfidence(analysis.confidence.label),
    },
    {
      label: 'Distribution Risk',
      value: analysis.risk,
      state: getIndicatorStateForRisk(analysis.risk),
    },
  ]
}

export function getScopeLabel(analysis: Analysis | null) {
  if (!analysis) {
    return 'Awaiting evidence'
  }

  const decomposition = analysis.claimDecomposition
  const primary =
    decomposition.organizations[0] ||
    decomposition.entities[0] ||
    decomposition.locations[0] ||
    decomposition.factualAssertions[0]

  return primary || 'General claim'
}

export function getClaimTraits(analysis: Analysis) {
  return [
    ...analysis.claimDecomposition.organizations,
    ...analysis.claimDecomposition.entities,
    ...analysis.claimDecomposition.locations,
    ...analysis.claimDecomposition.dates,
    ...analysis.claimDecomposition.numericalClaims,
  ].slice(0, 12)
}

export function getCredibilityClass(label: CredibilityLabel) {
  if (label === 'High') {
    return 'cred-high'
  }

  if (label === 'Low') {
    return 'cred-low'
  }

  return 'cred-medium'
}

export function getStanceClass(stance: EvidenceStance) {
  if (stance === 'Supports') {
    return 'stance-supports'
  }

  if (stance === 'Contradicts') {
    return 'stance-contradicts'
  }

  return 'stance-context'
}

export function getVerdictBadgeClass(verdict: Verdict) {
  if (verdict === 'Corroborated' || verdict === 'Likely Reliable') {
    return 'verdict-true'
  }

  if (
    verdict === 'Mixed Evidence' ||
    verdict === 'Insufficient Verification' ||
    verdict === 'Unverified' ||
    verdict === 'Evidence insufficient' ||
    verdict === 'Missing context' ||
    verdict === 'Verification incomplete'
  ) {
    return 'verdict-uncertain'
  }

  return 'verdict-false'
}

function normalizeHeadlineText(value: string) {
  return value.toLowerCase()
}

function hasHeadlinePhrase(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase))
}

export function getOperationalHeadline(analysis: Analysis | null) {
  if (!analysis) {
    return insufficientEvidenceHeadline
  }

  const verdictText = normalizeHeadlineText(analysis.verdict)
  const contradictionText = normalizeHeadlineText(analysis.contradictions.summary)
  const actionText = normalizeHeadlineText(analysis.operationalGuidance.action)
  const distributionText = normalizeHeadlineText(analysis.operationalGuidance.distribution)
  const escalationText = normalizeHeadlineText(analysis.operationalGuidance.escalation)
  const corroborationText = normalizeHeadlineText(analysis.corroborationLevel.agreement)
  const evidenceText = [
    verdictText,
    contradictionText,
    actionText,
    distributionText,
    escalationText,
    corroborationText,
    ...analysis.corroborationLevel.indicators.map(normalizeHeadlineText),
    ...analysis.confidence.drivers.map(normalizeHeadlineText),
  ].join(' ')

  if (
    analysis.verdict === 'Likely incorrect' ||
    analysis.contradictions.level === 'High' ||
    hasHeadlinePhrase(evidenceText, ['direct contradiction detected'])
  ) {
    return contradictionHeadline
  }

  if (
    analysis.verdict === 'Fake KYC urgency' ||
    analysis.verdict === 'Credential harvesting pattern' ||
    hasHeadlinePhrase(evidenceText, ['credential harvesting pattern', 'fake kyc urgency'])
  ) {
    return credentialHarvestingHeadline
  }

  if (
    analysis.verdict === 'Suspicious payment extraction' ||
    analysis.verdict === 'Payment extraction pattern' ||
    hasHeadlinePhrase(evidenceText, ['suspicious payment extraction', 'payment extraction pattern'])
  ) {
    return paymentExtractionHeadline
  }

  if (
    analysis.verdict === 'Reward bait pattern' ||
    hasHeadlinePhrase(evidenceText, ['reward bait pattern'])
  ) {
    return rewardBaitHeadline
  }

  if (
    analysis.verdict === 'Guaranteed-return scam pattern' ||
    hasHeadlinePhrase(evidenceText, ['guaranteed-return scam pattern'])
  ) {
    return guaranteedReturnHeadline
  }

  if (
    analysis.verdict === 'Chain-forward manipulation' ||
    hasHeadlinePhrase(evidenceText, ['chain-forward manipulation'])
  ) {
    return forwardingHeadline
  }

  if (
    analysis.verdict === 'Impersonation risk' ||
    analysis.verdict === 'Likely phishing attempt' ||
    analysis.verdict === 'Suspicious link behavior' ||
    hasHeadlinePhrase(evidenceText, [
      'impersonation risk',
      'likely phishing attempt',
      'suspicious link behavior',
    ])
  ) {
    return impersonationHeadline
  }

  if (
    analysis.verdict === 'Unverified' ||
    analysis.verdict === 'Verification incomplete' ||
    hasHeadlinePhrase(evidenceText, ['verification incomplete'])
  ) {
    return verificationIncompleteHeadline
  }

  if (
    analysis.verdict === 'Unsupported civic claim' ||
    hasHeadlinePhrase(evidenceText, ['authoritative support missing'])
  ) {
    return civicRumorHeadline
  }

  if (
    analysis.verdict === 'High Risk Claim' ||
    analysis.verdict === 'Escalation Recommended' ||
    analysis.verdict === 'Dangerous unsupported claim'
  ) {
    return riskReviewHeadline
  }

  if (
    analysis.verdict === 'Corroborated' ||
    analysis.verdict === 'Likely Reliable' ||
    (analysis.contradictions.level === 'None' && analysis.corroborationLevel.sourceCount > 0)
  ) {
    return corroboratedHeadline
  }

  if (analysis.verdict === 'Mixed Evidence') {
    return mixedEvidenceHeadline
  }

  if (
    analysis.verdict === 'Insufficient Verification' ||
    analysis.verdict === 'Evidence insufficient' ||
    analysis.verdict === 'Missing context'
  ) {
    return insufficientEvidenceHeadline
  }

  return insufficientEvidenceHeadline
}
