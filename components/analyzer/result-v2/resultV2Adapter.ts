import type { Analysis, ReportMeta } from '../analyzerData'
import type { ResultV2ListItem, ResultV2Tone, ResultV2ViewModel } from './resultV2Types'

type AdaptResultV2Input = {
  claim?: string
  analysis?: Analysis | null
  reportMeta?: ReportMeta | null
  displayScope?: string
}

const FALLBACK_REASON =
  'Do not act on this message until you verify it through an official channel.'

const FALLBACK_PROBLEM =
  'DAM could not identify strong warning signs from the available evidence.'

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function uniqueItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function toListItems(items: string[]) {
  return uniqueItems(items).map<ResultV2ListItem>((text, index) => ({
    id: `item-${index + 1}`,
    text,
  }))
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(value)
  })
}

function getDetectedClaimType(claim: string, analysis?: Analysis | null) {
  const subject = `${claim} ${analysis?.verdict ?? ''} ${analysis?.risk ?? ''}`.toLowerCase()

  if (/(otp|kyc|bank|refund|account|login|password|credential|link|payment|upi|reward|gift|phish|impersonat)/.test(subject)) {
    return 'Scam or account-security claim'
  }

  if (/(doctor|medical|health|hospital|vaccine|treatment|medicine|symptom|disease|cure)/.test(subject)) {
    return 'Health claim'
  }

  if (/(breaking|news|election|minister|government|vote|war|alert|headline|tomorrow|banned)/.test(subject)) {
    return 'News or public-interest claim'
  }

  if (claim.trim()) {
    return 'Forwarded message or online claim'
  }

  return undefined
}

function getTone(analysis?: Analysis | null): ResultV2Tone {
  if (!analysis) {
    return 'neutral'
  }

  if (analysis.risk === 'High' || analysis.risk === 'Severe') {
    return 'danger'
  }

  if (analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable') {
    return 'verified'
  }

  if (
    analysis.verdict === 'Mixed Evidence' ||
    analysis.verdict === 'Unverified' ||
    analysis.verdict === 'Evidence insufficient' ||
    analysis.verdict === 'Verification incomplete' ||
    analysis.verdict === 'Insufficient Verification'
  ) {
    return 'uncertain'
  }

  if (analysis.risk === 'Medium') {
    return 'caution'
  }

  return 'neutral'
}

function getToneLabel(tone: ResultV2Tone) {
  switch (tone) {
    case 'danger':
      return 'High risk'
    case 'caution':
      return 'Use caution'
    case 'verified':
      return 'Likely supported'
    case 'uncertain':
      return 'Still uncertain'
    default:
      return 'Needs review'
  }
}

function getShortReason(analysis?: Analysis | null) {
  if (!analysis) {
    return FALLBACK_REASON
  }

  const action = analysis.operationalGuidance?.action?.trim()
  if (action) {
    return action
  }

  const contradictionSummary = analysis.contradictions?.summary?.trim()
  if (contradictionSummary) {
    return contradictionSummary
  }

  const reasoning = analysis.reasoning?.trim()
  if (reasoning) {
    return truncateText(reasoning, 180)
  }

  return FALLBACK_REASON
}

function getClaimTypeActions(claimType: string | undefined) {
  switch (claimType) {
    case 'Scam or account-security claim':
      return [
        'Do not click suspicious links.',
        'Verify through the official app or website.',
        'Do not share OTPs or private details.',
        'Report or block the sender if the message keeps pushing for action.',
      ]
    case 'Health claim':
      return [
        'Do not act medically from a forward.',
        'Check official medical sources.',
        'Consult a qualified professional for personal decisions.',
      ]
    case 'News or public-interest claim':
      return [
        'Wait for reliable confirmation.',
        'Check multiple reputable sources.',
        'Avoid forwarding while uncertain.',
      ]
    default:
      return [
        'Do not act on this alone.',
        'Check the original source.',
        'Use DAM again if more evidence appears.',
      ]
  }
}

function buildMainProblems(claim: string, analysis?: Analysis | null) {
  if (!analysis) {
    return toListItems([FALLBACK_PROBLEM])
  }

  const subject =
    `${claim} ${analysis.verdict} ${analysis.reasoning} ${analysis.operationalGuidance.action}`.toLowerCase()
  const problems: string[] = []

  if (includesAny(subject, ['urgent', 'immediately', '30 minutes', 'today', 'now'])) {
    problems.push('This message uses urgency pressure to push a fast decision.')
  }

  if (includesAny(subject, ['kyc', 'otp', 'password', 'login', 'credential', 'private details', 'account'])) {
    problems.push('It asks for account access, identity details, or verification steps that should stay private.')
  }

  if (includesAny(subject, ['bank', 'rbi', 'police', 'courier', 'government', 'amazon', 'sbi'])) {
    problems.push('It leans on authority or brand trust to make the request feel legitimate.')
  }

  if (includesAny(subject, ['link', 'website', 'verify immediately', 'click'])) {
    problems.push('It pushes you toward a link or fast verification path before proper confirmation.')
  }

  if (includesAny(subject, ['medical', 'doctor', 'hospital', 'vaccine', 'treatment', 'cure', 'medicine'])) {
    problems.push('It suggests medical action without enough trustworthy support for a personal decision.')
  }

  if (includesAny(subject, ['miracle', 'instantly', 'guaranteed', 'secret remedy'])) {
    problems.push('It relies on exaggerated certainty instead of careful evidence.')
  }

  if (includesAny(subject, ['breaking', 'headline', 'alert', 'from tomorrow', 'banned', 'again'])) {
    problems.push('It reads like a breaking update, but the claim may still be moving faster than reliable confirmation.')
  }

  if (analysis.risk === 'High' || analysis.risk === 'Severe') {
    problems.push(`DAM marked this as ${analysis.risk.toLowerCase()} risk.`)
  }

  if (analysis.contradictions?.level === 'Moderate' || analysis.contradictions?.level === 'High') {
    problems.push('Retrieved evidence shows meaningful contradictions or missing support.')
  }

  if (analysis.corroborationLevel?.sourceCount === 0 || analysis.sourceCredibility?.label === 'Unknown') {
    problems.push('Available sources are limited or not strong enough to treat this as settled.')
  }

  if (problems.length < 2 && analysis.reasoning?.trim()) {
    problems.push(truncateText(analysis.reasoning.trim(), 150))
  }

  if (
    !problems.length &&
    (analysis.verdict === 'Corroborated' || analysis.verdict === 'Likely Reliable')
  ) {
    problems.push('DAM did not find strong warning signs in the available evidence.')
  }

  if (!problems.length) {
    problems.push(FALLBACK_PROBLEM)
  }

  return toListItems(problems.slice(0, 5))
}

function buildPlainTextExport(
  claim: string,
  analysis: Analysis | null | undefined,
  reportMeta: ReportMeta | null | undefined,
  displayScope: string | undefined,
  problems: ResultV2ListItem[],
  steps: ResultV2ListItem[]
) {
  const lines = [
    'DAM Result',
    '',
    `Checked message: ${claim || 'Not captured'}`,
    `Verdict: ${analysis?.verdict ?? 'Unavailable'}`,
    `Risk: ${analysis?.risk ?? 'Unavailable'}`,
    `Confidence: ${typeof analysis?.confidence?.score === 'number' ? `${analysis.confidence.score}%` : 'Unavailable'}`,
    `Trace ID: ${reportMeta?.traceId ?? 'Unavailable'}`,
    `Retrieved: ${reportMeta?.timestamp ?? analysis?.retrievedAt ?? 'Unavailable'}`,
    `Claim preview: ${displayScope ?? 'Unavailable'}`,
    '',
    'Main warning signs:',
    ...problems.map((item) => `- ${item.text}`),
    '',
    'What you should do now:',
    ...steps.map((item) => `- ${item.text}`),
  ]

  return lines.join('\n')
}

export function adaptResultToV2ViewModel({
  claim = '',
  analysis,
  reportMeta,
  displayScope,
}: AdaptResultV2Input): ResultV2ViewModel {
  const trimmedClaim = claim.trim()
  const detectedClaimType = getDetectedClaimType(trimmedClaim, analysis)
  const tone = getTone(analysis)
  const toneLabel = getToneLabel(tone)
  const mainProblems = buildMainProblems(trimmedClaim, analysis)
  const recommendedNextSteps = toListItems(getClaimTypeActions(detectedClaimType))
  const evidenceSources =
    analysis?.evidence?.map((item) => ({
      id: item.id || item.url || item.title,
      title: item.title || item.domain || 'Untitled source',
      domain: item.domain || 'Unknown source',
      url: item.url || undefined,
      stance: item.stance || undefined,
      credibility: item.credibility || undefined,
      summary: item.assessment?.trim() || item.excerpt?.trim() || 'Source details were limited.',
    })) ?? []
  const evidenceQuality =
    analysis?.sourceCredibility?.label && analysis?.corroborationLevel?.label
      ? `${analysis.sourceCredibility.label} credibility, ${analysis.corroborationLevel.label.toLowerCase()}`
      : 'Limited evidence'
  const plainTextExport = buildPlainTextExport(
    trimmedClaim,
    analysis,
    reportMeta,
    displayScope,
    mainProblems,
    recommendedNextSteps
  )

  return {
    inputRecap: {
      originalTextPreview: truncateText(trimmedClaim || 'No message captured.', 280),
      originalTextFull: trimmedClaim || undefined,
      characterCount: trimmedClaim.length,
      shortInputSummary: detectedClaimType
        ? detectedClaimType === 'Scam or account-security claim'
          ? 'Use this before forwarding, paying, or sharing personal information.'
          : detectedClaimType === 'Health claim'
            ? 'Use this before acting on health advice from a message or forward.'
            : detectedClaimType === 'News or public-interest claim'
              ? 'Use this before forwarding fast-moving public claims as fact.'
              : 'Check before you act.'
        : 'Check before you act.',
      detectedClaimType,
    },
    simpleVerdict: {
      label: analysis?.verdict ?? 'No verdict yet',
      confidence:
        typeof analysis?.confidence?.score === 'number' ? analysis.confidence.score : undefined,
      shortReason: getShortReason(analysis),
      tone,
      toneLabel,
    },
    mainProblems,
    recommendedNextSteps,
    evidence: {
      sourceCount: analysis?.corroborationLevel?.sourceCount ?? evidenceSources.length,
      evidenceQuality,
      sourceSummaries: evidenceSources,
      fallbackMessage: 'DAM did not return strong source evidence for this result.',
      compactSummary: `${analysis?.corroborationLevel?.sourceCount ?? evidenceSources.length} sources reviewed`,
    },
    technicalDetails: {
      verdictLine: analysis
        ? `${analysis.verdict} / ${analysis.risk} risk / ${analysis.confidence.label} confidence`
        : 'No technical verdict available.',
      contradictionStatus:
        analysis?.contradictions?.summary || 'No contradiction summary returned.',
      confidenceDrivers: uniqueItems(analysis?.confidence?.drivers ?? []),
      metadata: [
        { label: 'Trace ID', value: reportMeta?.traceId ?? 'Unavailable' },
        {
          label: 'Retrieved',
          value: reportMeta?.timestamp ?? analysis?.retrievedAt ?? 'Unavailable',
        },
        { label: 'Claim preview', value: displayScope ?? 'Unavailable' },
        {
          label: 'High-credibility sources',
          value: String(analysis?.corroborationLevel?.highCredibilityCount ?? 0),
        },
      ],
      compactSummary: analysis
        ? `${analysis.confidence.label} confidence, ${analysis.contradictions.level.toLowerCase()} contradictions`
        : 'Technical metadata unavailable',
    },
    share: {
      shortSummary: trimmedClaim
        ? `DAM verdict: ${analysis?.verdict ?? 'Unavailable'}. ${getShortReason(analysis)}`
        : `DAM verdict: ${analysis?.verdict ?? 'Unavailable'}.`,
      fullSummary: plainTextExport,
    },
    download: {
      plainTextExport,
    },
    review: {
      title: 'Was this useful?',
      placeholder: 'What helped, what felt unclear, or what you expected next.',
      submitLabel: 'Submit review',
      submitDisabledReason: 'Review submission is coming soon.',
    },
    emailCapture: {
      title: 'Get alerts like this',
      description: 'Get scam and suspicious-message alerts.',
      reuseExistingSignup: true,
    },
  }
}
