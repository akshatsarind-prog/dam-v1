import { type RetrievedEvidence } from '@/lib/retrieval'

export type CredibilityLabel = 'High' | 'Moderate' | 'Low' | 'Unknown'

export type RankedEvidence = RetrievedEvidence & {
  id: string
  domain: string
  credibility: CredibilityLabel
  credibilityScore: number
  credibilityRationale: string
}

export type SourceCredibilitySummary = {
  label: CredibilityLabel
  weightedScore: number
  highTrustSources: number
  moderateTrustSources: number
  lowTrustSources: number
  unknownTrustSources: number
  rationale: string
}

type ContradictionLevel = 'None' | 'Low' | 'Moderate' | 'High' | 'Unknown'

export type ConflictSignal = {
  label: ContradictionLevel
  summary: string
  hasConflict: boolean
}

const HIGH_TRUST_DOMAINS = ['reuters.com', 'apnews.com', 'who.int'] as const
const HIGH_TRUST_INSTITUTION_DOMAINS = [
  'nasa.gov',
  'esa.int',
  'cdc.gov',
  'nih.gov',
  'rbi.org.in',
  'imf.org',
  'worldbank.org',
  'gov.in',
  'pib.gov.in',
  'cybercrime.gov.in',
  'mohfw.gov.in',
] as const
const MODERATE_TRUST_DOMAINS = ['bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com'] as const
const LOW_TRUST_DOMAINS = [
  'medium.com',
  'substack.com',
  'blogspot.com',
  'wordpress.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'instagram.com',
  'youtube.com',
  'reddit.com',
] as const

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
] as const

const CONTEXTUALIZING_STANCE_CUES = [
  'context',
  'background',
  'analysis',
  'timeline',
  'explains',
  'explained',
  'update',
  'review',
  'details',
  'investigation',
] as const

function extractHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function domainMatches(domain: string, candidates: readonly string[]) {
  return candidates.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
}

function normalizeDomains(domains: string[] | undefined) {
  if (!domains?.length) {
    return []
  }

  return Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean)))
}

function cueScore(text: string, cues: readonly string[]) {
  return cues.reduce((total, cue) => total + (text.includes(cue) ? 1 : 0), 0)
}

function pluralize(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function summarizeTrustMix(items: RankedEvidence[]) {
  const highTrustSources = items.filter((item) => item.credibility === 'High').length
  const moderateTrustSources = items.filter((item) => item.credibility === 'Moderate').length
  const lowTrustSources = items.filter((item) => item.credibility === 'Low').length
  const unknownTrustSources = items.filter((item) => item.credibility === 'Unknown').length

  const parts = [
    highTrustSources ? pluralize(highTrustSources, 'high-trust source') : '',
    moderateTrustSources ? pluralize(moderateTrustSources, 'moderate-trust source') : '',
    lowTrustSources ? pluralize(lowTrustSources, 'low-trust source') : '',
    unknownTrustSources ? pluralize(unknownTrustSources, 'unclassified source') : '',
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : 'no trust signal'
}

function inferEvidenceStance(item: RankedEvidence) {
  const text = `${item.title} ${item.content}`.toLowerCase()
  const supportScore = cueScore(text, SUPPORT_STANCE_CUES)
  const contradictionScore = cueScore(text, CONTRADICTION_STANCE_CUES)
  const contextualizingScore = cueScore(text, CONTEXTUALIZING_STANCE_CUES)

  if (supportScore === 0 && contradictionScore === 0 && contextualizingScore === 0) {
    return 'Unclear' as const
  }

  if (supportScore > contradictionScore && supportScore > 0) {
    return 'Supports' as const
  }

  if (contradictionScore > supportScore && contradictionScore > 0) {
    return 'Contradicts' as const
  }

  if (contextualizingScore > 0 && supportScore === 0 && contradictionScore === 0) {
    return 'Contextualizes' as const
  }

  return supportScore >= contradictionScore ? ('Supports' as const) : ('Contradicts' as const)
}

function summarizeSignalGroup(label: 'Supports' | 'Contradicts', items: RankedEvidence[]) {
  const count = items.length

  if (!count) {
    return ''
  }

  const trustMix = summarizeTrustMix(items)
  return `${pluralize(count, label === 'Supports' ? 'supporting source' : 'contradictory source')} (${trustMix})`
}

export function scoreSourceCredibility(domain: string): {
  label: CredibilityLabel
  weightedScore: number
} {
  if (!domain) {
    return {
      label: 'Unknown',
      weightedScore: 48,
    }
  }

  if (
    domainMatches(domain, HIGH_TRUST_DOMAINS) ||
    domainMatches(domain, HIGH_TRUST_INSTITUTION_DOMAINS) ||
    domain.endsWith('.gov') ||
    domain.endsWith('.gov.in') ||
    domain.endsWith('.nic.in')
  ) {
    return {
      label: 'High',
      weightedScore: 90,
    }
  }

  if (domainMatches(domain, MODERATE_TRUST_DOMAINS)) {
    return {
      label: 'Moderate',
      weightedScore: 68,
    }
  }

  if (domainMatches(domain, LOW_TRUST_DOMAINS)) {
    return {
      label: 'Low',
      weightedScore: 32,
    }
  }

  return {
    label: 'Unknown',
    weightedScore: 48,
  }
}

function credibilityRationale(label: CredibilityLabel, domain: string, preferredDomains: string[] = []) {
  if (preferredDomains.length && domainMatches(domain, preferredDomains)) {
    return 'Matches the category-targeted source list and has strong trust signals.'
  }

  if (label === 'High') {
    return domain.endsWith('.gov') ||
      domain.endsWith('.gov.in') ||
      domain.endsWith('.nic.in') ||
      domain === 'who.int'
      ? 'Official or public-interest source with high trust.'
      : 'High-trust wire or institutional source.'
  }

  if (label === 'Moderate') {
    return 'Established editorial outlet useful for corroboration.'
  }

  if (label === 'Low') {
    return 'Blog, platform, or social source requiring independent confirmation.'
  }

  return 'Source domain is not in the trust registry.'
}

export function rankEvidence(
  evidence: RetrievedEvidence[],
  options: { preferredDomains?: string[] } = {}
): RankedEvidence[] {
  const preferredDomains = normalizeDomains(options?.preferredDomains)
  const seenUrls = new Set<string>()

  const ranked = evidence
    .filter((item) => {
      const normalizedUrl = item.url.trim().toLowerCase()

      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        return false
      }

      seenUrls.add(normalizedUrl)
      return true
    })
    .map((item, index) => {
      const domain = extractHostname(item.url)
      const credibility = scoreSourceCredibility(domain)
      const preferredDomainMatch = preferredDomains.length && domainMatches(domain, preferredDomains)
      const rankingScore =
        credibility.weightedScore + item.score + (preferredDomainMatch ? 18 : 0)

      return {
        ...item,
        id: `E${String(index + 1).padStart(2, '0')}`,
        domain,
        credibility: credibility.label,
        credibilityScore: credibility.weightedScore,
        credibilityRationale: credibilityRationale(credibility.label, domain, preferredDomains),
        rankingScore,
      }
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)

  return ranked.slice(0, 5).map((item) => {
    const { rankingScore, ...rest } = item
    void rankingScore
    return rest
  })
}

export function summarizeSourceCredibility(evidence: RankedEvidence[]): SourceCredibilitySummary {
  if (!evidence.length) {
    return {
      label: 'Unknown',
      weightedScore: 0,
      highTrustSources: 0,
      moderateTrustSources: 0,
      lowTrustSources: 0,
      unknownTrustSources: 0,
      rationale: 'No retrieved sources were available for credibility evaluation.',
    }
  }

  const highTrustSources = evidence.filter((item) => item.credibility === 'High').length
  const moderateTrustSources = evidence.filter((item) => item.credibility === 'Moderate').length
  const lowTrustSources = evidence.filter((item) => item.credibility === 'Low').length
  const unknownTrustSources = evidence.filter((item) => item.credibility === 'Unknown').length
  const weightedScore = Math.round(
    evidence.reduce((total, item) => total + item.credibilityScore, 0) / evidence.length
  )

  const label: CredibilityLabel =
    weightedScore >= 80
      ? 'High'
      : weightedScore >= 60
        ? 'Moderate'
        : weightedScore >= 40
          ? 'Unknown'
          : 'Low'

  return {
    label,
    weightedScore,
    highTrustSources,
    moderateTrustSources,
    lowTrustSources,
    unknownTrustSources,
    rationale: `${evidence.length} retrieved source${evidence.length === 1 ? '' : 's'} ranked by trust category.`,
  }
}

export function detectConflictingSignals(evidence: RankedEvidence[]): ConflictSignal {
  if (!evidence.length) {
    return {
      label: 'Unknown',
      summary: 'No retrieved evidence is available to assess contradiction.',
      hasConflict: false,
    }
  }

  const supportSources = evidence.filter((item) => inferEvidenceStance(item) === 'Supports')
  const contradictionSources = evidence.filter((item) => inferEvidenceStance(item) === 'Contradicts')
  const contextualSources = evidence.filter((item) => inferEvidenceStance(item) === 'Contextualizes')
  const unclearSources = evidence.filter((item) => inferEvidenceStance(item) === 'Unclear')

  const supportWeight = supportSources.reduce((total, item) => total + item.credibilityScore, 0)
  const contradictionWeight = contradictionSources.reduce((total, item) => total + item.credibilityScore, 0)
  const totalWeight = supportWeight + contradictionWeight
  const balance = totalWeight ? 1 - Math.abs(supportWeight - contradictionWeight) / totalWeight : 0
  const hasHighTrustConflict =
    supportSources.some((item) => item.credibility === 'High') &&
    contradictionSources.some((item) => item.credibility === 'High')

  if (!supportSources.length && !contradictionSources.length) {
    if (contextualSources.length) {
      return {
        label: 'None',
        summary: `${pluralize(contextualSources.length, 'contextual source')} were retrieved; no direct contradiction was detected.`,
        hasConflict: false,
      }
    }

    if (unclearSources.length) {
      return {
        label: 'Unknown',
        summary: 'Retrieved evidence does not express a clear contradiction signal.',
        hasConflict: false,
      }
    }

    return {
      label: 'Unknown',
      summary: 'Retrieved evidence does not express a clear contradiction signal.',
      hasConflict: false,
    }
  }

  if (!contradictionSources.length) {
    const supportSummary = summarizeSignalGroup('Supports', supportSources)
    const contextualSummary = contextualSources.length
      ? ` ${pluralize(contextualSources.length, 'contextual source')} add context.`
      : ''

    return {
      label: 'None',
      summary: supportSummary
        ? `${supportSummary} ${supportSources.length === 1 ? 'supports' : 'support'} the claim and no contradictory sources were detected.${contextualSummary}`
        : `No contradictory sources were detected.${contextualSummary}`,
      hasConflict: false,
    }
  }

  if (!supportSources.length) {
    const label =
      contradictionSources.length >= 3 || contradictionWeight >= 180 || hasHighTrustConflict
        ? 'High'
        : contradictionSources.length >= 2 || contradictionWeight >= 120
          ? 'Moderate'
          : 'Low'

    return {
      label,
      summary: `${summarizeSignalGroup('Contradicts', contradictionSources)} ${
        contradictionSources.length === 1 ? 'points' : 'point'
      } against the claim${
        contextualSources.length ? `, with ${pluralize(contextualSources.length, 'contextual source')} adding context` : ''
      }.`,
      hasConflict: true,
    }
  }

  const label =
    supportSources.length === 1 && contradictionSources.length === 1 && !hasHighTrustConflict
      ? 'Low'
      : hasHighTrustConflict && balance >= 0.45
        ? 'High'
        : supportSources.length >= 2 && contradictionSources.length >= 2 && balance >= 0.45
          ? 'High'
          : supportSources.length >= 2 || contradictionSources.length >= 2 || balance >= 0.35
            ? 'Moderate'
            : 'Low'

  const supportSummary = summarizeSignalGroup('Supports', supportSources)
  const contradictionSummary = summarizeSignalGroup('Contradicts', contradictionSources)
  const contextualSummary = contextualSources.length
    ? ` ${pluralize(contextualSources.length, 'contextual source')} add context.`
    : ''
  const trustConflict = hasHighTrustConflict ? ' High-trust disagreement appears on both sides.' : ''

  return {
    label,
    summary: `${supportSummary} ${
      supportSources.length === 1 ? 'supports' : 'support'
    } the claim while ${contradictionSummary} ${
      contradictionSources.length === 1 ? 'conflicts' : 'conflict'
    } with it.${trustConflict}${contextualSummary}`,
    hasConflict: true,
  }
}

export function deriveConflictingSignals(evidence: RankedEvidence[]) {
  return detectConflictingSignals(evidence).summary
}
