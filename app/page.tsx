'use client'

import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'

type Verdict =
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
type ConfidenceLabel = 'Weak' | 'Moderate' | 'Strong'
type Risk = 'Low' | 'Medium' | 'High' | 'Severe'
type IndicatorState = 'stable' | 'watch' | 'critical'
type CredibilityLabel = 'High' | 'Moderate' | 'Low' | 'Unknown'
type ContradictionLevel = 'None' | 'Low' | 'Moderate' | 'High' | 'Unknown'
type EvidenceStance = 'Supports' | 'Contradicts' | 'Contextualizes' | 'Unclear'

type ClaimDecomposition = {
  entities: string[]
  dates: string[]
  locations: string[]
  organizations: string[]
  numericalClaims: string[]
  factualAssertions: string[]
  retrievalQueries: string[]
}

type Confidence = {
  score: number
  label: ConfidenceLabel
  rationale: string
  drivers: string[]
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

type OperationalGuidance = {
  action: string
  distribution: string
  escalation: string
  nextSteps: string[]
}

type Analysis = {
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

type Indicator = {
  label: string
  value: string
  state: IndicatorState
}

type ReportMeta = {
  traceId: string
  timestamp: string
}

const MAX_CLAIM_LENGTH = 1200

const emptyDecomposition: ClaimDecomposition = {
  entities: [],
  dates: [],
  locations: [],
  organizations: [],
  numericalClaims: [],
  factualAssertions: [],
  retrievalQueries: [],
}

const fallbackAnalysis: Analysis = {
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

const riskStyles: Record<Risk, string> = {
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

const processingStages = [
  'Decomposing claim',
  'Retrieving evidence',
  'Ranking source credibility',
  'Checking contradictions',
  'Calibrating verdict',
]

const flowSteps = [
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

const useCases = [
  'Breaking-news moderation',
  'Executive response review',
  'Campaign narrative triage',
  'Community trust operations',
]

const productSignals = [
  'Evidence Citations',
  'Source Credibility',
  'Corroboration Level',
  'Contradiction Summary',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function createTraceId() {
  const stamp = Date.now().toString(36).toUpperCase()
  const fragment = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DAM-${stamp}-${fragment}`
}

function formatTimestamp(date: Date) {
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

function normalizeAnalysis(value: unknown): Analysis {
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

function getIndicatorStateForRisk(risk: Risk): IndicatorState {
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

function getIndicatorStateForContradiction(level: ContradictionLevel): IndicatorState {
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

function getEvidenceIndicators(analysis: Analysis): Indicator[] {
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

function getScopeLabel(analysis: Analysis | null) {
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

function getClaimTraits(analysis: Analysis) {
  return [
    ...analysis.claimDecomposition.organizations,
    ...analysis.claimDecomposition.entities,
    ...analysis.claimDecomposition.locations,
    ...analysis.claimDecomposition.dates,
    ...analysis.claimDecomposition.numericalClaims,
  ].slice(0, 12)
}

function getCredibilityClass(label: CredibilityLabel) {
  if (label === 'High') {
    return 'cred-high'
  }

  if (label === 'Low') {
    return 'cred-low'
  }

  return 'cred-medium'
}

function getStanceClass(stance: EvidenceStance) {
  if (stance === 'Supports') {
    return 'stance-supports'
  }

  if (stance === 'Contradicts') {
    return 'stance-contradicts'
  }

  return 'stance-context'
}

function getVerdictBadgeClass(verdict: Verdict) {
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

function getOperationalHeadline(analysis: Analysis | null) {
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
    hasHeadlinePhrase(evidenceText, ['impersonation risk', 'likely phishing attempt', 'suspicious link behavior'])
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

export default function Page() {
  const [claim, setClaim] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null)

  const trimmedClaim = claim.trim()
  const remainingCharacters = MAX_CLAIM_LENGTH - claim.length
  const activeAnalysis = analysis ?? fallbackAnalysis
  const confidence = analysis ? activeAnalysis.confidence.score : 0
  const confidenceLabel = analysis ? activeAnalysis.confidence.label : 'Awaiting signal'
  const displayScope = getScopeLabel(analysis)
  const indicators = analysis ? getEvidenceIndicators(activeAnalysis) : []
  const claimTraits = analysis ? getClaimTraits(activeAnalysis) : []
  const contradictionCount = analysis ? activeAnalysis.contradictions.items.length : 0

  useEffect(() => {
    if (!loading) {
      return
    }

    const stageTimer = window.setInterval(() => {
      setLoadingStage((stage) => Math.min(stage + 1, processingStages.length - 1))
    }, 620)

    return () => window.clearInterval(stageTimer)
  }, [loading])

  async function checkClaim() {
    if (loading) {
      return
    }

    if (!trimmedClaim) {
      setAnalysis(null)
      setReportMeta(null)
      setError('Claim intake is empty.')
      return
    }

    setLoadingStage(0)
    setLoading(true)
    setError('')
    setAnalysis(null)
    setReportMeta({
      traceId: createTraceId(),
      timestamp: formatTimestamp(new Date()),
    })

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: trimmedClaim }),
      })

      const text = await response.text()

      if (!response.ok) {
        const payload = text ? JSON.parse(text) : null
        throw new Error(readString(payload?.error, 'Analyze request failed'))
      }

      setAnalysis(normalizeAnalysis(JSON.parse(text)))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Analysis channel unavailable. Hold distribution and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function resetReportOnEdit(value: string) {
    setClaim(value)
    setError('')
    setAnalysis(null)
    setReportMeta(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void checkClaim()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void checkClaim()
    }
  }

  return (
    <main className="dam-shell">
      <header className="dam-header">
        <a className="dam-mark" href="#top" aria-label="DAM V1 home">
          DAM
        </a>
        <nav className="dam-nav" aria-label="Product sections">
          <a href="#verify">Verify</a>
          <a href="#flow">Flow</a>
          <a href="#system">System</a>
        </nav>
      </header>

      <section id="top" className="dam-hero section-frame" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="system-label">
            <span aria-hidden="true" />
            DAM V1 / Evidence intelligence layer
          </p>
          <h1 id="hero-title">Information should pass through evidence.</h1>
          <p className="hero-text">
            Retrieval-first operational analysis for claims that need source-backed
            corroboration, contradiction review, and calibrated distribution control.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#verify">
              Open verification desk
            </a>
            <p>Enter submits. Shift + Enter creates a new line.</p>
          </div>
        </div>

        <aside className="hero-panel" aria-label="Live operational preview">
          <div className="panel-topline">
            <p>Operational telemetry</p>
            <span className={loading ? 'live-dot active' : 'live-dot'} aria-hidden="true" />
          </div>
          <div className="signal-stack compact">
            <div className="signal-row">
              <span>Trace ID</span>
              <strong>{reportMeta?.traceId ?? 'DAM-STANDBY'}</strong>
            </div>
            <div className="signal-row">
              <span>Evidence Scope</span>
              <strong>{displayScope}</strong>
            </div>
            <div className="signal-row">
              <span>Confidence Signal</span>
              <strong>{confidenceLabel}</strong>
            </div>
            <div className="signal-row">
              <span>Escalation Flag</span>
              <strong>{analysis ? activeAnalysis.operationalGuidance.escalation : 'Not assigned'}</strong>
            </div>
          </div>
          <div className="preview-brief">
            <p className="preview-label">System readout</p>
            <p>
              {analysis ? getOperationalHeadline(activeAnalysis) : 'Claim intake has not entered retrieval.'}
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Sources</span>
              <strong>{analysis ? activeAnalysis.corroborationLevel.sourceCount : 0}</strong>
            </div>
            <div>
              <span>Contradictions</span>
              <strong>{contradictionCount}</strong>
            </div>
            <div>
              <span>Credibility</span>
              <strong>{analysis ? activeAnalysis.sourceCredibility.weightedScore : 0}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section id="verify" className="verification-section section-frame">
        <div className="section-heading">
          <p className="system-label">
            <span aria-hidden="true" />
            Verification desk
          </p>
          <h2>Run the claim through retrieval-backed intelligence.</h2>
          <p>
            The report is driven by retrieved sources, source credibility, corroboration
            density, contradictions, and evidence-calibrated confidence.
          </p>
        </div>

        <div className="console-grid">
          <form className="claim-panel" onSubmit={handleSubmit}>
            <div className="panel-topline">
              <p>Claim Intake</p>
              <span
                id="claim-counter"
                className={remainingCharacters <= 120 ? 'counter counter-warning' : 'counter'}
              >
                {claim.length}/{MAX_CLAIM_LENGTH}
              </span>
            </div>

            <div className="intake-status-grid" aria-label="Evidence diagnostics">
              <div>
                <span>Evidence Scope</span>
                <strong>{analysis ? displayScope : 'Pending'}</strong>
              </div>
              <div>
                <span>Source Credibility</span>
                <strong>{analysis ? activeAnalysis.sourceCredibility.label : 'Pending'}</strong>
              </div>
              <div>
                <span>Corroboration</span>
                <strong>{analysis ? activeAnalysis.corroborationLevel.label : 'Pending'}</strong>
              </div>
            </div>

            <label className="sr-only" htmlFor="claim-input">
              Claim
            </label>
            <textarea
              id="claim-input"
              value={claim}
              maxLength={MAX_CLAIM_LENGTH}
              onChange={(event) => resetReportOnEdit(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste the claim exactly as it appears. Preserve source references, dates, figures, media context, and quoted language."
              className="claim-input"
              aria-describedby={error ? 'claim-error claim-counter' : 'claim-counter'}
              aria-invalid={error === 'Claim intake is empty.'}
            />

            <div className="intake-footer">
              {error ? (
                <p id="claim-error" className="form-error" role="alert">
                  {error}
                </p>
              ) : (
                <p>Exact wording improves retrieval, evidence extraction, and contradiction review.</p>
              )}
              <button type="submit" className="check-button" disabled={loading}>
                {loading ? (
                  <>
                    <span className="button-spinner" aria-hidden="true" />
                    Processing
                  </>
                ) : (
                  'Analyze claim'
                )}
              </button>
            </div>

            <div className="intake-metadata" aria-label="Input diagnostics">
              <div>
                <span>Characters</span>
                <strong>{claim.length}</strong>
              </div>
              <div>
                <span>Evidence Cards</span>
                <strong>{analysis ? activeAnalysis.evidence.length : 0}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>Retrieval</strong>
              </div>
            </div>
          </form>

          <aside className="report-panel" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <section className="report-card loading-card" aria-label="Analysis in progress">
                <div className="panel-topline">
                  <p>Intelligence Briefing</p>
                  <span className="status-badge">
                    <span className="badge-spinner" aria-hidden="true" />
                    Processing
                  </span>
                </div>
                <div className="report-meta-strip">
                  <div>
                    <span>Trace ID</span>
                    <strong>{reportMeta?.traceId ?? 'DAM-PENDING'}</strong>
                  </div>
                  <div>
                    <span>Opened</span>
                    <strong>{reportMeta?.timestamp ?? 'Pending'}</strong>
                  </div>
                  <div>
                    <span>Pipeline</span>
                    <strong>Retrieval first</strong>
                  </div>
                </div>
                <div className="loading-stage-list">
                  {processingStages.map((stage, index) => (
                    <div
                      className={
                        index < loadingStage
                          ? 'stage-row complete'
                          : index === loadingStage
                            ? 'stage-row active'
                            : 'stage-row'
                      }
                      key={stage}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <p>{stage}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : analysis ? (
              <section className="report-card report-ready">
                <div className="panel-topline">
                  <p>Intelligence Briefing</p>
                  <span className={`badge ${getVerdictBadgeClass(activeAnalysis.verdict)}`}>
                    {activeAnalysis.verdict}
                  </span>
                </div>

                <div className="report-meta-strip">
                  <div>
                    <span>Trace ID</span>
                    <strong>{reportMeta?.traceId ?? 'DAM-CLOSED'}</strong>
                  </div>
                  <div>
                    <span>Retrieved</span>
                    <strong>{reportMeta?.timestamp ?? 'Just now'}</strong>
                  </div>
                  <div>
                    <span>Evidence Scope</span>
                    <strong>{displayScope}</strong>
                  </div>
                  <div>
                    <span>Escalation Flag</span>
                    <strong>{activeAnalysis.operationalGuidance.escalation}</strong>
                  </div>
                </div>

                <div className="verdict-block">
                  <div>
                    <p>Operational Verdict</p>
                    <h3>{getOperationalHeadline(activeAnalysis)}</h3>
                  </div>
                  <span className={`risk-pill ${riskStyles[activeAnalysis.risk]}`}>
                    {activeAnalysis.risk} distribution risk
                  </span>
                </div>

                <div className="brief-grid dense">
                  <div className="brief-card">
                    <span>Confidence Signal</span>
                    <strong>{confidenceLabel}</strong>
                    <div className="confidence-track" aria-hidden="true">
                      <span style={{ width: `${confidence}%` }} />
                    </div>
                    <p>{confidence}% evidence-calibrated confidence</p>
                  </div>
                  <div className="brief-card">
                    <span>Source Credibility</span>
                    <strong>{activeAnalysis.sourceCredibility.label}</strong>
                    <p>{activeAnalysis.sourceCredibility.rationale}</p>
                  </div>
                  <div className="brief-card">
                    <span>Corroboration Level</span>
                    <strong>{activeAnalysis.corroborationLevel.sourceCount}</strong>
                    <p>{activeAnalysis.corroborationLevel.label}</p>
                  </div>
                  <div className="brief-card">
                    <span>Contradictions</span>
                    <strong>{activeAnalysis.contradictions.level}</strong>
                    <p>{activeAnalysis.contradictions.summary}</p>
                  </div>
                </div>

                <div className="report-section compact-section">
                  <h3>Reasoning</h3>
                  <p>{activeAnalysis.reasoning}</p>
                </div>

                <div className="report-section">
                  <h3>Evidence Signals</h3>
                  <div className="indicator-grid">
                    {indicators.map((indicator) => (
                      <div className={`indicator indicator-${indicator.state}`} key={indicator.label}>
                        <span>{indicator.label}</span>
                        <strong>{indicator.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-section">
                  <h3>Evidence Citations</h3>
                  <div className="evidence-card-grid">
                    {activeAnalysis.evidence.length ? (
                      activeAnalysis.evidence.map((item) => (
                        <article className="evidence-card" key={`${item.id}-${item.url}`}>
                          <div className="evidence-card-header">
                            <span>{item.id}</span>
                            <a href={item.url} target="_blank" rel="noreferrer">
                              {item.domain}
                            </a>
                          </div>
                          <h4>{item.title}</h4>
                          <div className="evidence-badges">
                            <span className={getCredibilityClass(item.credibility)}>
                              {item.credibility} credibility
                            </span>
                            <span className={getStanceClass(item.stance)}>{item.stance}</span>
                          </div>
                          <p>{item.excerpt}</p>
                          <strong>{item.assessment}</strong>
                        </article>
                      ))
                    ) : (
                      <div className="consistency-box consistency-watch">
                        <strong>No retrieved evidence cards returned.</strong>
                        <p>Hold amplification until source material is available.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="report-section split-section">
                  <div>
                    <h3>Corroboration Indicators</h3>
                    <ul className="compact-list">
                      {activeAnalysis.corroborationLevel.indicators.map((indicator) => (
                        <li key={indicator}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Confidence Drivers</h3>
                    <ul className="compact-list">
                      {activeAnalysis.confidence.drivers.map((driver) => (
                        <li key={driver}>{driver}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="report-section split-section">
                  <div>
                    <h3>Contradiction Summary</h3>
                    <div className={`consistency-box consistency-${getIndicatorStateForContradiction(activeAnalysis.contradictions.level)}`}>
                      <strong>{activeAnalysis.contradictions.summary}</strong>
                      {activeAnalysis.contradictions.items.length ? (
                        <ul className="compact-list nested-list">
                          {activeAnalysis.contradictions.items.map((item) => (
                            <li key={`${item.severity}-${item.summary}`}>
                              {item.severity}: {item.summary}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No source-level contradiction items were returned.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3>Claim Decomposition</h3>
                    <div className="trait-list">
                      {claimTraits.length ? (
                        claimTraits.map((trait) => <span key={trait}>{trait}</span>)
                      ) : (
                        <span>No extracted entities</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="report-section">
                  <h3>Operational Guidance</h3>
                  <div className={`consistency-box consistency-${getIndicatorStateForRisk(activeAnalysis.risk)}`}>
                    <strong>{activeAnalysis.operationalGuidance.action}</strong>
                    <p>{activeAnalysis.operationalGuidance.distribution}</p>
                    <p>{activeAnalysis.operationalGuidance.escalation}</p>
                  </div>
                </div>

                <div className="report-section split-section">
                  <div>
                    <h3>Next Steps</h3>
                    <ul className="compact-list">
                      {activeAnalysis.operationalGuidance.nextSteps.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Source Credibility</h3>
                    <div className="source-count-grid">
                      <div>
                        <span>High</span>
                        <strong>{activeAnalysis.sourceCredibility.highTrustSources}</strong>
                      </div>
                      <div>
                        <span>Moderate</span>
                        <strong>{activeAnalysis.sourceCredibility.moderateTrustSources}</strong>
                      </div>
                      <div>
                        <span>Low</span>
                        <strong>{activeAnalysis.sourceCredibility.lowTrustSources}</strong>
                      </div>
                      <div>
                        <span>Unknown</span>
                        <strong>{activeAnalysis.sourceCredibility.unknownTrustSources}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="report-card empty-report">
                <div className="panel-topline">
                  <p>Intelligence Briefing</p>
                  <span className="status-badge muted">Awaiting claim</span>
                </div>
                <div className="empty-system-grid">
                  <div>
                    <span>Trace ID</span>
                    <strong>DAM-STANDBY</strong>
                  </div>
                  <div>
                    <span>Source Corroboration</span>
                    <strong>Pending</strong>
                  </div>
                  <div>
                    <span>Distribution Risk</span>
                    <strong>Unassigned</strong>
                  </div>
                </div>
                <div className="empty-state">
                  <span aria-hidden="true" />
                  <h3>No briefing generated.</h3>
                  <p>
                    Submit a claim to generate operational verdict, confidence, source
                    credibility, contradiction summary, evidence citations, and guidance.
                  </p>
                </div>
              </section>
            )}
          </aside>
        </div>
      </section>

      <section id="flow" className="flow-section section-frame">
        <div className="section-heading wide restrained">
          <p className="system-label">
            <span aria-hidden="true" />
            Product flow
          </p>
          <h2>From claim intake to evidence-backed control.</h2>
        </div>
        <div className="flow-grid">
          {flowSteps.map((step) => (
            <article className="flow-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="system" className="system-section section-frame">
        <div className="system-column">
          <p className="system-label">
            <span aria-hidden="true" />
            Use cases
          </p>
          <div className="list-panel">
            {useCases.map((item) => (
              <div className="list-row" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="system-column">
          <p className="system-label">
            <span aria-hidden="true" />
            System outputs
          </p>
          <div className="list-panel">
            {productSignals.map((item) => (
              <div className="list-row" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <article className="why-card">
          <p className="system-label">
            <span aria-hidden="true" />
            Why DAM
          </p>
          <h2>Mission on the landing page. Evidence in the product.</h2>
          <p>
            DAM V1 turns tense information moments into a repeatable operational routine:
            retrieve sources, rank credibility, inspect contradictions, and decide what
            should not be amplified.
          </p>
        </article>
      </section>
    </main>
  )
}
