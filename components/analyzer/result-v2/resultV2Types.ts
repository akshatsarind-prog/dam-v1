export type ResultV2Tone = 'danger' | 'caution' | 'verified' | 'uncertain' | 'neutral'

export type ResultV2InputRecap = {
  originalTextPreview: string
  originalTextFull?: string
  characterCount: number
  shortInputSummary: string
  detectedClaimType?: string
}

export type ResultV2SimpleVerdict = {
  label: string
  confidence?: number
  shortReason: string
  tone: ResultV2Tone
  toneLabel: string
}

export type ResultV2ListItem = {
  id: string
  text: string
}

export type ResultV2EvidenceSource = {
  id: string
  title: string
  domain: string
  url?: string
  stance?: string
  credibility?: string
  summary: string
}

export type ResultV2Evidence = {
  sourceCount: number
  evidenceQuality: string
  sourceSummaries: ResultV2EvidenceSource[]
  fallbackMessage: string
  compactSummary: string
}

export type ResultV2TechnicalDetail = {
  label: string
  value: string
}

export type ResultV2TechnicalDetails = {
  verdictLine: string
  contradictionStatus: string
  confidenceDrivers: string[]
  metadata: ResultV2TechnicalDetail[]
  compactSummary: string
}

export type ResultV2Share = {
  shortSummary: string
  fullSummary: string
}

export type ResultV2Download = {
  plainTextExport: string
}

export type ResultV2Review = {
  title: string
  placeholder: string
  submitLabel: string
  submitDisabledReason: string
}

export type ResultV2EmailCapture = {
  title: string
  description: string
  reuseExistingSignup: boolean
}

export type ResultV2ViewModel = {
  inputRecap: ResultV2InputRecap
  simpleVerdict: ResultV2SimpleVerdict
  mainProblems: ResultV2ListItem[]
  recommendedNextSteps: ResultV2ListItem[]
  evidence: ResultV2Evidence
  technicalDetails: ResultV2TechnicalDetails
  share: ResultV2Share
  download: ResultV2Download
  review: ResultV2Review
  emailCapture: ResultV2EmailCapture
}
