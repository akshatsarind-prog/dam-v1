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

type EmailCaptureVariantConfig = {
  variant: string
  claimCategory: string
  summary: string
  title: string
  description: string
  buttonLabel: string
}

const DEFAULT_EMAIL_CAPTURE_PRIVACY_NOTE =
  'No spam. Used only for DAM alerts and product updates.'

const EMAIL_CAPTURE_VARIANTS: Record<string, EmailCaptureVariantConfig> = {
  scam_alerts: {
    variant: 'scam_alerts',
    claimCategory: 'scam',
    summary: 'Scam alerts and suspicious-message updates',
    title: 'Get scam alerts like this',
    description: 'Leave your email to get updates when DAM detects new scam patterns.',
    buttonLabel: 'Get scam alerts',
  },
  health_alerts: {
    variant: 'health_alerts',
    claimCategory: 'health',
    summary: 'Health misinformation alerts',
    title: 'Get health claim alerts like this',
    description: 'Leave your email to get updates when DAM detects risky health misinformation.',
    buttonLabel: 'Get health claim alerts',
  },
  civic_alerts: {
    variant: 'civic_alerts',
    claimCategory: 'civic',
    summary: 'Civic rumor and notice alerts',
    title: 'Get civic claim alerts like this',
    description: 'Leave your email to get updates on civic rumors, fake notices, and public-claim confusion.',
    buttonLabel: 'Get civic alerts',
  },
  statistic_alerts: {
    variant: 'statistic_alerts',
    claimCategory: 'statistics',
    summary: 'Misleading statistic alerts',
    title: 'Get statistic alerts like this',
    description:
      'Leave your email to get updates when DAM detects misleading charts, numbers, or research claims.',
    buttonLabel: 'Get statistic alerts',
  },
  uncertainty_alerts: {
    variant: 'uncertainty_alerts',
    claimCategory: 'breaking_news',
    summary: 'Developing-claim and uncertainty updates',
    title: 'Get claim-check updates like this',
    description: 'Leave your email to get updates when DAM detects fast-moving claims that are still unverified.',
    buttonLabel: 'Get claim-check updates',
  },
  dam_alerts: {
    variant: 'dam_alerts',
    claimCategory: 'general',
    summary: 'Claim-check and trust updates',
    title: 'Get trust updates like this',
    description:
      'Leave your email to get updates on suspicious claims, forwards, and misinformation patterns DAM is seeing.',
    buttonLabel: 'Get trust updates',
  },
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function uniqueItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function cleanDisplayText(value: string) {
  return value
    .replace(/\bverifcation\b/gi, 'verification')
    .replace(/\baccomodate\b/gi, 'accommodate')
    .replace(/\brecieve\b/gi, 'receive')
    .replace(/\bfic\b/gi, 'fix')
}

function cleanDisplayItems(items: string[]) {
  return items.map((item) => cleanDisplayText(item))
}

function toListItems(items: string[]) {
  return uniqueItems(cleanDisplayItems(items)).map<ResultV2ListItem>((text, index) => ({
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

  if (/\b(otp|kyc|bank|refund|account|login|password|credential|link|payment|upi|reward|gift|phish|impersonat\w*)\b/.test(subject)) {
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
    return cleanDisplayText(FALLBACK_REASON)
  }

  const action = analysis.operationalGuidance?.action?.trim()
  if (action) {
    return cleanDisplayText(action)
  }

  const contradictionSummary = analysis.contradictions?.summary?.trim()
  if (contradictionSummary) {
    return cleanDisplayText(contradictionSummary)
  }

  const reasoning = analysis.reasoning?.trim()
  if (reasoning) {
    return cleanDisplayText(truncateText(reasoning, 180))
  }

  return cleanDisplayText(FALLBACK_REASON)
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

function countMatches(value: string, patterns: readonly RegExp[]) {
  return patterns.reduce((count, pattern) => (pattern.test(value) ? count + 1 : count), 0)
}

function classifyEmailCaptureVariant({
  claim,
  analysis,
  evidenceQuality,
  mainProblems,
}: {
  claim: string
  analysis?: Analysis | null
  evidenceQuality: string
  mainProblems: ResultV2ListItem[]
}) {
  const summaryText = [
    claim,
    analysis?.verdict ?? '',
    analysis?.risk ?? '',
    analysis?.reasoning ?? '',
    analysis?.operationalGuidance?.action ?? '',
    analysis?.operationalGuidance?.distribution ?? '',
    analysis?.operationalGuidance?.escalation ?? '',
    analysis?.operationalGuidance?.nextSteps?.join(' ') ?? '',
    analysis?.contradictions?.summary ?? '',
    analysis?.confidence?.drivers?.join(' ') ?? '',
    evidenceQuality,
    ...mainProblems.map((item) => item.text),
  ]
    .join(' ')
    .toLowerCase()

  const detectedClaimType = getDetectedClaimType(claim, analysis)
  const scamScore = countMatches(summaryText, [
    /\bscam\b/i,
    /\bkyc\b/i,
    /\botp\b/i,
    /\bbank(?:ing)?\b/i,
    /\baccount\b/i,
    /\bwallet\b/i,
    /\bdebit card\b/i,
    /\bcredit card\b/i,
    /\bupi\b/i,
    /\bphish(?:ing)?\b/i,
    /\bcredential\b/i,
    /\blogin\b/i,
    /\bpassword\b/i,
    /\bpayment\b/i,
    /\brefund\b/i,
    /\bimpersonat(?:e|ion)\b/i,
    /\brbi\b/i,
  ])

  if (
    [
      'Fake KYC urgency',
      'Credential harvesting pattern',
      'Likely phishing attempt',
      'Impersonation risk',
      'Suspicious payment extraction',
      'Payment extraction pattern',
      'Reward bait pattern',
      'Suspicious link behavior',
      'Guaranteed-return scam pattern',
    ].includes(analysis?.verdict ?? '') ||
    (
      detectedClaimType === 'Scam or account-security claim' &&
      (scamScore > 0 || analysis?.risk === 'High' || analysis?.risk === 'Severe')
    ) ||
    scamScore > 1
  ) {
    return EMAIL_CAPTURE_VARIANTS.scam_alerts
  }

  const civicScore = countMatches(summaryText, [
    /\bcivic\b/i,
    /\bgovernment\b/i,
    /\bminister\b/i,
    /\belection\b/i,
    /\bvote\b/i,
    /\baadha(?:a)?r\b/i,
    /\bnotice\b/i,
    /\bscheme\b/i,
    /\bparliament\b/i,
    /\bprime minister\b/i,
    /\bchief minister\b/i,
    /\bunsupported civic claim\b/i,
  ])

  if (
    [
      'Unsupported civic claim',
      'Fake government notice',
    ].includes(analysis?.verdict ?? '') ||
    civicScore > 0
  ) {
    return EMAIL_CAPTURE_VARIANTS.civic_alerts
  }

  if (
    countMatches(summaryText, [
      /\bhealth\b/i,
      /\bmedical\b/i,
      /\bdoctor\b/i,
      /\bhospital\b/i,
      /\bvaccine\b/i,
      /\btreatment\b/i,
      /\bmedicine\b/i,
      /\bcure\b/i,
      /\bdisease\b/i,
      /\bsymptom\b/i,
      /\bvirus\b/i,
    ]) > 0
  ) {
    return EMAIL_CAPTURE_VARIANTS.health_alerts
  }

  const statisticsScore = countMatches(summaryText, [
    /\bstatistics?\b/i,
    /\bnumber(?:s)?\b/i,
    /\bdata\b/i,
    /\bpercent(?:age)?\b/i,
    /\bsurvey\b/i,
    /\bresearch\b/i,
    /\bstudy\b/i,
    /\bgraph\b/i,
    /\bchart\b/i,
    /\bsample\b/i,
  ])

  if (statisticsScore > 0) {
    return EMAIL_CAPTURE_VARIANTS.statistic_alerts
  }

  const breakingScore = countMatches(summaryText, [
    /\bbreaking\b/i,
    /\bdeveloping\b/i,
    /\bheadline\b/i,
    /\bnews\b/i,
    /\balert\b/i,
    /\btoday\b/i,
    /\btomorrow\b/i,
    /\blive\b/i,
    /\bunverified\b/i,
    /\bverification incomplete\b/i,
    /\bevidence insufficient\b/i,
  ])

  if (breakingScore > 1) {
    return EMAIL_CAPTURE_VARIANTS.uncertainty_alerts
  }

  return EMAIL_CAPTURE_VARIANTS.dam_alerts
}

function buildMainProblems(claim: string, analysis?: Analysis | null) {
  if (!analysis) {
    return toListItems([cleanDisplayText(FALLBACK_PROBLEM)])
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
  const emailCaptureVariant = classifyEmailCaptureVariant({
    claim: trimmedClaim,
    analysis,
    evidenceQuality,
    mainProblems,
  })
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
      eyebrow: 'Post-result alerts',
      summary: emailCaptureVariant.summary,
      title: emailCaptureVariant.title,
      description: cleanDisplayText(emailCaptureVariant.description),
      buttonLabel: cleanDisplayText(emailCaptureVariant.buttonLabel),
      privacyNote: cleanDisplayText(DEFAULT_EMAIL_CAPTURE_PRIVACY_NOTE),
      variant: emailCaptureVariant.variant,
      claimCategory: emailCaptureVariant.claimCategory,
      sourceResultType: 'post_result_adaptive_capture',
      riskLabel: analysis?.risk,
      verdict: analysis?.verdict,
      reuseExistingSignup: true,
    },
  }
}
