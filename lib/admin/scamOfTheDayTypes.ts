export const SCAM_OF_THE_DAY_STATUSES = [
  'draft',
  'needs_review',
  'approved',
  'rejected',
  'published_manually',
] as const

export type ScamOfTheDayStatus = (typeof SCAM_OF_THE_DAY_STATUSES)[number]

export type ScamSourceCheckStatus = 'complete' | 'incomplete'

export type ScamOfTheDaySource = {
  name: string
  url: string
  support: string
}

export type ScamOfTheDayDraft = {
  slug: string
  title: string
  status: ScamOfTheDayStatus
  body: string
  patternName: string
  patternKey: string
  sourceCheckStatus: ScamSourceCheckStatus
  sourceCheckMessage: string | null
  sourceCount: number
  claimCount: number
  sessionCount: number
  generatedAt: string
  updatedAt: string
  storagePath: string
  sources: ScamOfTheDaySource[]
}
