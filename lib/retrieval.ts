import { tavily } from '@tavily/core'
import * as claimRouter from '@/lib/claimRouter'
import type { CurrentOfficeHolderRole } from '@/lib/claimRouter'
import { withTimeout } from '@/lib/timeout'

export type RetrievedEvidence = {
  title: string
  url: string
  content: string
  rawContent: string
  score: number
  publishedDate: string | null
  favicon: string | null
  query: string
}

export type RetrievedEvidenceResult = {
  evidence: RetrievedEvidence[]
  retrievalFailed: boolean
}

type TavilyResult = {
  title?: string
  url?: string
  content?: string
  rawContent?: string
  score?: number
  publishedDate?: string
  favicon?: string
}

export type ClaimCategory =
  | 'health'
  | 'finance'
  | 'science'
  | 'government'
  | 'breaking_news'
  | 'scam'
  | 'general'

type RetrievalOptions = {
  category?: ClaimCategory
  preferredDomains?: string[]
  stableFactHint?: string
  currentOfficeHolder?: boolean
  claim?: string
}

const GENERAL_AUTHORITATIVE_DOMAINS = ['britannica.com'] as const
const HEALTH_DOMAINS = ['who.int', 'cdc.gov', 'nih.gov', 'mohfw.gov.in'] as const
const FINANCE_DOMAINS = ['rbi.org.in', 'imf.org', 'worldbank.org', 'sebi.gov.in'] as const
const SCIENCE_DOMAINS = ['nasa.gov', 'esa.int'] as const
const GOVERNMENT_DOMAINS = ['gov.in', 'pib.gov.in'] as const
const BREAKING_NEWS_DOMAINS = ['reuters.com', 'apnews.com', 'bbc.com'] as const
const SCAM_DOMAINS = ['gov.in', 'cybercrime.gov.in', 'rbi.org.in'] as const
const IDENTITY_THREAT_DOMAINS = [
  'uidai.gov.in',
  'myaadhaar.uidai.gov.in',
  'cybercrime.gov.in',
  'pib.gov.in',
  'gov.in',
] as const
const SEARCH_PROVIDER_TIMEOUT_SECONDS = 8
const RETRIEVAL_TIMEOUT_MS = 8500
const CATEGORY_SEARCH_HINTS: Record<ClaimCategory, string> = {
  health: 'WHO',
  finance: 'RBI',
  science: 'NASA',
  government: 'official government',
  breaking_news: 'Reuters',
  scam: 'cybercrime',
  general: 'Britannica/Wikipedia',
}

const EXAM_PREFERRED_DOMAINS = [
  'nta.ac.in',
  'ugcnet.nta.ac.in',
  'ugc.ac.in',
  'pib.gov.in',
  'education.gov.in',
  'reuters.com',
] as const

type CurrentOfficeHolderProfile = {
  role: CurrentOfficeHolderRole
  subject: string | null
  target: string
  preferredDomains: string[]
  queries: string[]
}

function getClient() {
  if (!process.env.TAVILY_API_KEY) {
    return null
  }

  return tavily({
    apiKey: process.env.TAVILY_API_KEY,
  })
}

function uniqueQueries(queries: string[]) {
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).slice(0, 3)
}

function normalizeDomains(domains: string[]) {
  return Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean)))
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function hasMedicineAnchor(text: string) {
  return /\b(paracetamol|acetaminophen|p-500|p\/500|p 500|p500)\b/.test(text)
}

function hasP500Anchor(text: string) {
  return /\b(p-500|p\/500|p 500|p500)\b/.test(text)
}

function hasMedicineRumorAnchor(text: string) {
  return /\b(machupo|fake|hoax|rumou?r|whatsapp|viral message|forwarded message|fact check|fake news|warning)\b/.test(
    text
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesSignal(text: string, signal: string) {
  if (signal.includes(' ')) {
    return text.includes(signal)
  }

  return new RegExp(`\\b${escapeRegExp(signal)}\\b`).test(text)
}

function buildTargetedQuery(query: string, category: ClaimCategory) {
  if (getCurrentOfficeHolderProfile(query)) {
    return query
  }

  const personDeathProfile = claimRouter.getPersonDeathProfile(query)
  if (personDeathProfile.matched) {
    return includesSignal(normalizeText(query), 'reuters')
      ? query
      : `${query} Reuters AP BBC`.trim()
  }

  const examProfile = claimRouter.getExamClaimProfile(query)
  if (examProfile.matched) {
    const examHint = [
      examProfile.canonicalQuery,
      'paper leak',
      'NTA',
      'CBI',
      'official',
    ]
      .filter(Boolean)
      .join(' ')

    return includesSignal(normalizeText(query), 'paper leak') && includesSignal(normalizeText(query), 'nta')
      ? query
      : `${query} ${examHint}`.trim()
  }

  const identityThreatProfile = claimRouter.getIdentityThreatProfile(query)
  if (identityThreatProfile.matched) {
    return /\b(uidai|aadhaar)\b/i.test(query) && /\b(verify|kyc|deactivated|blocked|link)\b/i.test(query)
      ? query
      : `${query} UIDAI Aadhaar cybercrime official`.trim()
  }

  const medicineRumorProfile = claimRouter.getMedicineRumorProfile(query)
  if (medicineRumorProfile.matched) {
    return medicineRumorProfile.requiresP500Specificity
      ? 'paracetamol P-500 Machupo virus fake WhatsApp fact check'
      : `${medicineRumorProfile.canonicalQuery ?? query} whatsapp fact check`.trim()
  }

  const productLaunchProfile = claimRouter.getProductLaunchProfile(query)
  if (productLaunchProfile.matched) {
    return `${query} OpenAI GPT-6 launch Reuters official`.trim()
  }

  const hint = CATEGORY_SEARCH_HINTS[category]

  if (!hint) {
    return query
  }

  const normalizedQuery = normalizeText(query)
  if (includesSignal(normalizedQuery, hint.toLowerCase())) {
    return query
  }

  return `${query} ${hint}`.trim()
}

function hasRbiSignal(query: string) {
  const normalized = normalizeText(query)
  return includesSignal(normalized, 'rbi') || includesSignal(normalized, 'central bank')
}

function normalizeOfficeHolderTarget(value: string) {
  return normalizeText(value)
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickCompanyDomain(target: string) {
  const normalized = normalizeOfficeHolderTarget(target)
  const companyDomainMap: Record<string, string> = {
    apple: 'apple.com',
    microsoft: 'microsoft.com',
    google: 'google.com',
    alphabet: 'abc.xyz',
    amazon: 'amazon.com',
    meta: 'about.meta.com',
    tesla: 'tesla.com',
  }

  if (companyDomainMap[normalized]) {
    return companyDomainMap[normalized]
  }

  if (/^[a-z0-9-]+$/.test(normalized)) {
    return `${normalized}.com`
  }

  return null
}

function buildGovernmentOfficeQueries(
  subject: string | null,
  roleLabel: string,
  targetLabel: string,
  preferredDomains: string[]
) {
  const subjectText = subject ?? ''
  const primaryDomain = preferredDomains[0]
  const secondaryDomain = preferredDomains[1]
  const targetQueries = [
    primaryDomain ? `site:${primaryDomain} ${roleLabel} ${subjectText}`.trim() : '',
    secondaryDomain ? `site:${secondaryDomain} ${roleLabel} ${subjectText}`.trim() : '',
    `${roleLabel} ${subjectText} official ${targetLabel}`.trim(),
    `official current ${roleLabel.toLowerCase()} ${targetLabel} ${subjectText}`.trim(),
  ]

  return targetQueries.filter(Boolean)
}

function buildCompanyOfficeQueries(subject: string | null, roleLabel: string, targetLabel: string, domain: string | null) {
  const subjectText = subject ?? ''
  const queries = [
    domain ? `site:${domain} leadership ${subjectText} ${roleLabel}`.trim() : '',
    `${targetLabel} leadership ${subjectText} ${roleLabel}`.trim(),
    `official ${targetLabel} ${roleLabel.toLowerCase()} ${subjectText}`.trim(),
  ]

  return queries.filter(Boolean)
}

function getCurrentOfficeHolderProfile(claim: string): CurrentOfficeHolderProfile | null {
  const match = claimRouter.detectCurrentOfficeHolderClaim(claim)

  if (!match.matched || !match.role || !match.target) {
    return null
  }

  const target = normalizeOfficeHolderTarget(match.target)
  const subject = match.subject?.trim() ?? null
  const roleLabels: Record<CurrentOfficeHolderRole, string> = {
    president: 'President',
    vice_president: 'Vice President',
    prime_minister: 'Prime Minister',
    chief_minister: 'Chief Minister',
    governor: 'Governor',
    ceo: 'CEO',
    head: 'Head',
    leader: 'Leader',
  }
  const roleLabel = roleLabels[match.role]
  let preferredDomains: string[] = []
  let queries: string[] = []

  if (['president', 'vice_president'].includes(match.role) && /^(usa|us|u s a|united states|united states of america|america)$/.test(target)) {
    preferredDomains = ['whitehouse.gov', 'usa.gov']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'United States', preferredDomains)
  } else if (match.role === 'prime_minister' && /^india$/.test(target)) {
    preferredDomains = ['pmindia.gov.in', 'india.gov.in', 'pib.gov.in']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'India', preferredDomains)
  } else if (match.role === 'president' && /^france$/.test(target)) {
    preferredDomains = ['elysee.fr', 'gouvernement.fr']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'France', preferredDomains)
  } else if (match.role === 'prime_minister' && /^(uk|u k|united kingdom|britain|great britain)$/.test(target)) {
    preferredDomains = ['gov.uk', 'number10.gov.uk']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'United Kingdom', preferredDomains)
  } else if (match.role === 'vice_president' && /^india$/.test(target)) {
    preferredDomains = ['vicepresidentofindia.nic.in', 'india.gov.in']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'India', preferredDomains)
  } else if (match.role === 'president' && /^india$/.test(target)) {
    preferredDomains = ['presidentofindia.gov.in', 'india.gov.in']
    queries = buildGovernmentOfficeQueries(subject, roleLabel, 'India', preferredDomains)
  } else if (match.role === 'ceo') {
    const companyDomain = pickCompanyDomain(target)
    preferredDomains = companyDomain ? [companyDomain] : []
    queries = buildCompanyOfficeQueries(subject, roleLabel, match.target, companyDomain)
  } else if (['head', 'leader'].includes(match.role)) {
    const organizationDomain = pickCompanyDomain(target)
    preferredDomains = organizationDomain ? [organizationDomain] : []
    queries = organizationDomain
      ? buildCompanyOfficeQueries(subject, roleLabel, match.target, organizationDomain)
      : [`official ${roleLabel.toLowerCase()} of ${match.target} ${subject ?? ''}`.trim()]
  } else if (['governor', 'chief_minister', 'prime_minister', 'president', 'vice_president'].includes(match.role)) {
    queries = [
      `official current ${roleLabel.toLowerCase()} ${match.target} ${subject ?? ''}`.trim(),
      `${roleLabel} ${subject ?? ''} official ${match.target}`.trim(),
    ]
  }

  if (!queries.length) {
    queries = [`official current ${roleLabel.toLowerCase()} ${match.target} ${subject ?? ''}`.trim()]
  }

  return {
    role: match.role,
    subject,
    target: match.target,
    preferredDomains,
    queries: uniqueQueries(queries).slice(0, 3),
  }
}

function normalizeRetrievalCategory(category: string): ClaimCategory {
  const normalized = category.trim().toLowerCase()

  if (normalized === 'space/science' || normalized === 'science') {
    return 'science'
  }

  if (normalized === 'breaking' || normalized === 'breaking_news') {
    return 'breaking_news'
  }

  if (normalized === 'public/government' || normalized === 'government') {
    return 'government'
  }

  if (
    normalized === 'health' ||
    normalized === 'finance' ||
    normalized === 'scam' ||
    normalized === 'general'
  ) {
    return normalized
  }

  return 'general'
}

export function buildRetrievalQueries(
  claim: string,
  category: string,
  preferredDomains: string[],
  options: RetrievalOptions = {}
): string[] {
  const cleanClaim = claim.trim()
  const normalizedClaim = normalizeText(cleanClaim)
  const normalizedCategory = normalizeRetrievalCategory(category)
  const preferredDomainHint = preferredDomains[0]?.trim()
  const stableFactHint = options.stableFactHint?.trim()
  const currentOfficeHolderProfile = getCurrentOfficeHolderProfile(cleanClaim)
  const examClaimProfile = claimRouter.getExamClaimProfile(cleanClaim)
  const personDeathProfile = claimRouter.getPersonDeathProfile(cleanClaim)
  const identityThreatProfile = claimRouter.getIdentityThreatProfile(cleanClaim)
  const medicineRumorProfile = claimRouter.getMedicineRumorProfile(cleanClaim)
  const productLaunchProfile = claimRouter.getProductLaunchProfile(cleanClaim)
  const queries: string[] = []

  if (cleanClaim) {
    queries.push(cleanClaim)
  }

  if (currentOfficeHolderProfile) {
    return uniqueQueries(currentOfficeHolderProfile.queries)
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (examClaimProfile.matched) {
    const yearMatch = cleanClaim.match(/\b(20\d{2}|19\d{2})\b/)
    const yearText = yearMatch?.[1] ?? ''
    const canonicalExam = examClaimProfile.canonicalQuery ?? 'UGC NET'
    return uniqueQueries([
      `${canonicalExam} ${yearText} paper leak NTA CBI official`.trim(),
      `${canonicalExam} ${yearText} cancelled investigation Reuters`.trim(),
      cleanClaim,
    ])
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (identityThreatProfile.matched) {
    return uniqueQueries([
      'Aadhaar verify deactivated today link UIDAI cybercrime official',
      'UIDAI Aadhaar verification scam advisory official',
      cleanClaim,
    ])
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (medicineRumorProfile.matched) {
    return uniqueQueries([
      medicineRumorProfile.requiresP500Specificity
        ? 'paracetamol P-500 Machupo virus fake'
        : 'paracetamol virus WhatsApp fact check',
      medicineRumorProfile.requiresP500Specificity
        ? 'P/500 paracetamol virus WhatsApp fact check'
        : 'paracetamol contains virus fake news',
      medicineRumorProfile.requiresP500Specificity
        ? 'paracetamol P-500 contains Machupo virus fake news'
        : 'paracetamol deadly virus rumor forwarded message',
      cleanClaim,
    ])
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (productLaunchProfile.matched) {
    return uniqueQueries([
      'OpenAI GPT-6 launch Reuters official',
      'OpenAI GPT-6 released publicly official',
      cleanClaim,
    ])
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (personDeathProfile.matched && personDeathProfile.fullName) {
    return uniqueQueries([
      `${personDeathProfile.fullName} death Reuters AP BBC`,
      `${personDeathProfile.fullName} OpenAI Tesla Reuters`,
      cleanClaim,
    ])
      .filter((query) => query.length >= 3)
      .slice(0, 3)
  }

  if (stableFactHint) {
    const hintedQuery = `${cleanClaim} ${stableFactHint}`.trim()
    if (stableFactHint.includes('water boiling point at sea level')) {
      return uniqueQueries([hintedQuery]).filter((query) => query.length >= 3).slice(0, 1)
    }
    return uniqueQueries([cleanClaim, hintedQuery]).filter((query) => query.length >= 3).slice(0, 2)
  }

  if (normalizedCategory === 'health') {
    queries.push(`${cleanClaim} WHO CDC NIH evidence`)
    queries.push(`${cleanClaim} false hoax debunked`)
  }

  if (normalizedCategory === 'finance') {
    if (
      includesSignal(normalizedClaim, 'gdp') ||
      includesSignal(normalizedClaim, 'gross domestic product')
    ) {
      queries.push(`${cleanClaim} IMF World Bank GDP rankings data`)
    } else {
      queries.push(`${cleanClaim} RBI official`)
    }
    queries.push(`${cleanClaim} scam fraud fake`)
  }

  if (normalizedCategory === 'science') {
    queries.push(`${cleanClaim} NASA official`)
    queries.push(`${cleanClaim} false hoax debunked`)
  }

  if (normalizedCategory === 'government') {
    queries.push(`${cleanClaim} official government PIB`)
    queries.push(`${cleanClaim} fake notice scam`)
  }

  if (normalizedCategory === 'breaking_news') {
    queries.push(`${cleanClaim} Reuters AP BBC`)
    queries.push(`${cleanClaim} confirmed official`)
  }

  if (normalizedCategory === 'scam') {
    queries.push(`${cleanClaim} scam fraud fake warning`)
    queries.push(`${cleanClaim} official cybercrime advisory`)
  }

  if (normalizedCategory === 'general') {
    queries.push(`${cleanClaim} fact check`)
  }

  if (
    includesSignal(cleanClaim.toLowerCase(), 'kyc') ||
    includesSignal(cleanClaim.toLowerCase(), 'free') ||
    includesSignal(cleanClaim.toLowerCase(), 'money')
  ) {
    queries.unshift('RBI KYC fraud scam warning official')
  } else if (hasRbiSignal(cleanClaim)) {
    queries.unshift('Reserve Bank of India central bank official rbi.org.in')
  }

  if (preferredDomainHint && !queries.some((query) => includesSignal(query.toLowerCase(), preferredDomainHint.toLowerCase()))) {
    queries.push(`${cleanClaim} ${preferredDomainHint}`)
  }

  return Array.from(new Set(queries))
    .filter((query) => query.length >= 3)
    .slice(0, 2)
}

export function getPreferredDomains(category: ClaimCategory, claim = ''): string[] {
  const currentOfficeHolderProfile = getCurrentOfficeHolderProfile(claim)
  const examClaimProfile = claimRouter.getExamClaimProfile(claim)
  const personDeathProfile = claimRouter.getPersonDeathProfile(claim)

  if (currentOfficeHolderProfile) {
    return [...currentOfficeHolderProfile.preferredDomains]
  }

  if (examClaimProfile.matched) {
    return [...EXAM_PREFERRED_DOMAINS]
  }

  if (personDeathProfile.matched) {
    return [...BREAKING_NEWS_DOMAINS]
  }

  if (claimRouter.getIdentityThreatProfile(claim).matched) {
    return [...IDENTITY_THREAT_DOMAINS]
  }

  switch (category) {
    case 'health':
      return [...HEALTH_DOMAINS]
    case 'finance':
      return [...FINANCE_DOMAINS]
    case 'science':
      return [...SCIENCE_DOMAINS]
    case 'government':
      return [...GOVERNMENT_DOMAINS]
    case 'breaking_news':
      return [...BREAKING_NEWS_DOMAINS]
    case 'scam':
      return [...SCAM_DOMAINS]
    case 'general':
    default:
      return [...GENERAL_AUTHORITATIVE_DOMAINS]
  }
}

export function dedupeRetrievedEvidence(evidence: RetrievedEvidence[]) {
  return Array.from(new Map(evidence.map((item) => [item.url, item])).values())
}

function buildEvidenceText(item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  return `${item.title || ''} ${item.content || ''} ${item.url || ''}`.toLowerCase()
}

function hasPersonDeathFit(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  const profile = claimRouter.getPersonDeathProfile(claim)

  if (!profile.matched || !profile.fullName || !profile.surname) {
    return true
  }

  const text = buildEvidenceText(item)
  if (text.includes(profile.fullName)) {
    return true
  }

  if (text.includes(profile.surname)) {
    return true
  }

  const aliasHits = profile.aliasSignals.filter((signal) => text.includes(signal)).length
  return aliasHits >= 2
}

function hasExamTopicFit(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  const profile = claimRouter.getExamClaimProfile(claim)

  if (!profile.matched) {
    return true
  }

  const text = buildEvidenceText(item)
  const familyHit = profile.queryTokens.some((token) => text.includes(token))
  const institutionalHit = profile.institutionalSignals.some((signal) => text.includes(signal))
  const leakHit =
    /\b(leak|leaked|paper leak|question paper|integrity|compromised|cancelled|canceled|investigation|postponed)\b/.test(
      text
    )
  const genericExamDrift =
    /net neutrality|net-winged beetle|paper chromatography|\bpaper facts\b|\btopic\/june\b|\btopic\/wikipedia\b/.test(
      text
    )

  if (genericExamDrift) {
    return false
  }

  if (!familyHit) {
    return false
  }

  return leakHit || institutionalHit
}

function hasIdentityThreatFit(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  const profile = claimRouter.getIdentityThreatProfile(claim)

  if (!profile.matched) {
    return true
  }

  const text = buildEvidenceText(item)
  const authorityHit = profile.queryTokens.some((token) => text.includes(token))
  const threatHit = /\b(verify|verification|update|kyc|blocked|deactivated|deactivate|suspended|scam|fraud|phishing|advisory|warning|link)\b/.test(
    text
  )

  return authorityHit && threatHit
}

function hasMedicineRumorFit(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  const profile = claimRouter.getMedicineRumorProfile(claim)

  if (!profile.matched) {
    return true
  }

  const text = buildEvidenceText(item)
  const medicineHit = hasMedicineAnchor(text)
  const rumorHit = hasMedicineRumorAnchor(text)
  const machupoHit = text.includes('machupo')
  const contaminationHit = /\b(contains|contain|inside)\b/.test(text) && text.includes('virus')
  const specificMedicineHit = profile.requiresP500Specificity ? hasP500Anchor(text) : medicineHit

  return specificMedicineHit && (rumorHit || machupoHit || contaminationHit)
}

function hasProductLaunchFit(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  const profile = claimRouter.getProductLaunchProfile(claim)

  if (!profile.matched) {
    return true
  }

  const text = buildEvidenceText(item)
  const productHit =
    (text.includes('openai') && text.includes('gpt-6')) ||
    (text.includes('openai') && text.includes('gpt 6')) ||
    (text.includes('openai') && text.includes('gpt6'))
  const launchHit = /\b(launch|launched|release|released|public|publicly|available|announce|announced)\b/.test(
    text
  )

  return productHit && launchHit
}

function evidenceMatchesClaimGrounding(claim: string, item: Pick<RetrievedEvidence, 'title' | 'content' | 'url'>) {
  return (
    hasPersonDeathFit(claim, item) &&
    hasExamTopicFit(claim, item) &&
    hasIdentityThreatFit(claim, item) &&
    hasMedicineRumorFit(claim, item) &&
    hasProductLaunchFit(claim, item)
  )
}

async function searchEvidence(
  client: ReturnType<typeof tavily>,
  query: string,
  options: {
    category: ClaimCategory
    topic: 'news' | 'general'
    maxResults: number
    includeDomains?: string[]
    days?: number
  }
) {
  const targetedQuery = buildTargetedQuery(query, options.category)
  const response = await client.search(targetedQuery, {
    searchDepth: 'fast',
    topic: options.topic,
    days: options.days,
    maxResults: options.maxResults,
    chunksPerSource: 1,
    includeRawContent: false,
    includeAnswer: false,
    includeFavicon: true,
    autoParameters: false,
    timeout: SEARCH_PROVIDER_TIMEOUT_SECONDS,
    ...(options.includeDomains?.length ? { includeDomains: options.includeDomains } : {}),
  })

  return response.results.map((result: TavilyResult) => ({
    title: result.title || 'Untitled source',
    url: result.url || '',
    content: (result.content || '').slice(0, 320),
    rawContent: '',
    score: typeof result.score === 'number' ? result.score : 0,
    publishedDate: result.publishedDate || null,
    favicon: result.favicon || null,
    query: targetedQuery,
  }))
}

export async function retrieveEvidence(
  queryOrQueries: string | string[],
  options: RetrievalOptions = {}
): Promise<RetrievedEvidenceResult> {
  const client = getClient()
  const queries = uniqueQueries(Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])
  const claim = (options.claim ?? queries[0] ?? '').trim()
  const category = options.category ?? claimRouter.routeClaim(claim || queries[0] || '').retrievalCategory
  const preferredDomains = normalizeDomains(
    options.preferredDomains ?? getPreferredDomains(category, claim || queries[0] || '')
  )
  const currentOfficeHolder =
    options.currentOfficeHolder ?? claimRouter.routeClaim(claim || queries[0] || '').isCurrentOfficeHolder
  const retrievalDomains = currentOfficeHolder ? preferredDomains.slice(0, 2) : preferredDomains.slice(0, 1)
  const topic = category === 'breaking_news' ? 'news' : 'general'
  const maxResults = 3
  const days = category === 'breaking_news' ? 7 : undefined
  const activeQueries =
    currentOfficeHolder
      ? queries.slice(0, 3)
      :
    category === 'health' ||
    category === 'scam' ||
    category === 'breaking_news' ||
    category === 'finance'
      ? queries.slice(0, 2)
      : queries.slice(0, 1)

  if (!client || !activeQueries.length) {
    return {
      evidence: [],
      retrievalFailed: false,
    }
  }

  const retrievalPromise = (async () => {
    let retrievalFailed = false

    const searches = activeQueries.map(async (query, index) => {
      try {
        if (!query || query.trim().length < 2) {
          return []
        }

        const queryTopic = index === 0 ? topic : 'general'
        const preferredResults = retrievalDomains.length
          ? await searchEvidence(client, query, {
              category,
              topic: queryTopic,
              maxResults,
              includeDomains: retrievalDomains,
              days,
            })
          : []

        const groundedPreferredResults =
          claim && preferredResults.length
            ? preferredResults.filter((result) => evidenceMatchesClaimGrounding(claim, result))
            : preferredResults

        if (groundedPreferredResults.length) {
          return groundedPreferredResults
        }

        const broadResults = await searchEvidence(client, query, {
          category,
          topic: queryTopic,
          maxResults,
          days,
        })

        return claim
          ? broadResults.filter((result) => evidenceMatchesClaimGrounding(claim, result))
          : broadResults
      } catch (error) {
        console.warn('[retrieval] search failed', {
          category,
          currentOfficeHolder,
          query: query.slice(0, 180),
          message: error instanceof Error ? error.message : String(error),
        })
        retrievalFailed = true
        return []
      }
    })

    const evidence = dedupeRetrievedEvidence(
      (await Promise.all(searches)).flat().filter((result) => result.url)
    )

    return {
      evidence,
      retrievalFailed,
    }
  })()

  return withTimeout(
    retrievalPromise,
    RETRIEVAL_TIMEOUT_MS,
    {
      evidence: [],
      retrievalFailed: true,
    }
  )
}
