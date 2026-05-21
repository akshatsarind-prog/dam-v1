export type VerdictBreakdown = {
  verdict: string
  count: number
}

export type RiskLabelBreakdown = {
  riskLabel: string
  count: number
}

export type AdminClaimCategory =
  | 'scam'
  | 'health'
  | 'political'
  | 'government'
  | 'statistics'
  | 'social_rumor'
  | 'crypto'
  | 'other'

export type AdminHealthStatus = 'healthy' | 'watch' | 'needs_attention'

export type AdminClaimRecord = {
  createdAt: string | null
  claimText: string
  verdict: string
  confidence: number
  riskLabel: string
  latencyMs: number
  evidenceQuality: string | null
  sourceCount: number | null
  sessionId: string | null
  visitorId: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrer: string | null
  landingPath: string | null
  category: AdminClaimCategory
  attributed: boolean
}

export type ExecutiveSnapshot = {
  status: AdminHealthStatus
  totalClaims: number
  claimsToday: number
  uniqueSessions: number
  returningSessionRate: number | null
  repeatClaimSessions: number
  emailCaptures: number | null
  claimToEmailConversionRate: number | null
  averageLatencyMs: number
  p95LatencyMs: number | null
  attributedClaims: number
  unattributedClaims: number
  lastClaimAt: string | null
  lastEventAt: string | null
  eventsToday: number
}

export type CampaignPerformance = {
  source: string
  medium: string
  campaign: string
  claimSubmissions: number
  uniqueSessions: number
  uniqueVisitors: number
  claimsPerSession: number | null
  latestClaimAt: string | null
  label: string
}

export type AdminReferrerRecord = {
  referrer: string
  sessionCount: number
}

export type AdminTrafficSourceRecord = {
  source: string
  medium: string
  campaign: string
  claimSubmissions: number
  uniqueSessions: number
  uniqueVisitors: number
  eventCount: number
  ctaClicks: number
  emailCaptures: number
  claimsPerSession: number | null
  latestClaimAt: string | null
  interpretation: string
}

export type TrafficSourceIntelligence = {
  available: boolean
  note: string
  rows: AdminTrafficSourceRecord[]
  bestSourceByClaims: CampaignPerformance | null
  bestSourceByClaimsPerSession: CampaignPerformance | null
  bestCampaignByClaimSubmissions: CampaignPerformance | null
  attributedClaims: number
  unattributedClaims: number
  topReferrers: AdminReferrerRecord[]
}

export type AdminFunnelStageStatus = 'tracked' | 'manual' | 'not_tracked'

export type AdminFunnelStage = {
  key: string
  label: string
  count: number | null
  status: AdminFunnelStageStatus
  manualBaseline: boolean
  sourceLabel: string
  conversionFromPrevious: number | null
}

export type FunnelStageInsight = {
  label: string
  conversion: number | null
}

export type FunnelIntelligence = {
  stages: AdminFunnelStage[]
  biggestDropOff: FunnelStageInsight | null
  strongestRetainedStage: FunnelStageInsight | null
  bestSource: CampaignPerformance | null
  nextRecommendedAction: string
}

export type AdminHighIntentSessionRecord = {
  sessionId: string
  visitorId: string | null
  claimCount: number
  source: string | null
  campaign: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  isReturning: boolean
  emailCaptured: boolean
}

export type RetentionIntelligence = {
  uniqueSessions: number
  firstTimeSessions: number
  returningSessions: number
  returningSessionRate: number | null
  repeatClaimSessions: number
  sessionsWithTwoPlusClaims: number
  sessionsWithThreePlusClaims: number
  multiDayUsers: number
  averageClaimsPerSession: number
  averageTimePerSessionMs: number | null
  averageTimeBetweenSessionsMs: number | null
  exampleToRealConversionRate: number | null
  highIntentSessions: AdminHighIntentSessionRecord[]
  interpretation: string[]
}

export type AdminCategoryBreakdownRecord = {
  category: AdminClaimCategory
  count: number
  percentage: number
  averageConfidence: number
  averageLatencyMs: number
  averageSourceCount: number | null
  topSource: string | null
  topCampaign: string | null
  latestClaimText: string | null
  latestClaimAt: string | null
  attributedClaimCount: number
}

export type CategoryIntelligence = {
  categoryBreakdown: AdminCategoryBreakdownRecord[]
  mostTestedCategory: AdminCategoryBreakdownRecord | null
  highestLatencyCategory: AdminCategoryBreakdownRecord | null
  lowestConfidenceCategory: AdminCategoryBreakdownRecord | null
  highestSourceCampaignCategory: AdminCategoryBreakdownRecord | null
  interpretation: string[]
}

export type OperationalHealth = {
  averageLatencyMs: number
  medianLatencyMs: number | null
  p95LatencyMs: number | null
  maxLatencyMs: number | null
  claimsOver8s: number
  claimsOver12s: number
  averageSourceCount: number | null
  claimsWithZeroSources: number
  lowConfidenceClaimsCount: number
  lastClaimAt: string | null
  lastEventAt: string | null
  slowestClaims: AdminClaimRecord[]
  lowConfidenceClaims: AdminClaimRecord[]
  highRiskClaims: AdminClaimRecord[]
  claimsWithLowSources: AdminClaimRecord[]
}

export type EmailSourceBreakdownRecord = {
  source: string
  medium: string
  campaign: string
  emailCaptures: number
}

export type MaskedEmailRecord = {
  maskedEmail: string
  createdAt: string | null
  source: string | null
  campaign: string | null
}

export type EmailCaptureIntelligence = {
  totalEmails: number
  emailsToday: number
  emailsLast7Days: number
  claimToEmailConversionRate: number | null
  linkable: boolean
  note: string
  sourceBreakdown: EmailSourceBreakdownRecord[]
  latestMaskedEmails: MaskedEmailRecord[]
}

export type OperatorRecommendation = {
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export type AdminApiError = {
  code: 'unauthorized' | 'misconfigured' | 'unavailable' | 'unknown'
  message: string
}

export type AdminMetricsResponse = {
  generatedAt: string
  placeholder: boolean
  executiveSnapshot: ExecutiveSnapshot
  verdictBreakdown: VerdictBreakdown[]
  riskLabelBreakdown: RiskLabelBreakdown[]
  trafficSourceIntelligence: TrafficSourceIntelligence
  funnelIntelligence: FunnelIntelligence
  retentionIntelligence: RetentionIntelligence
  categoryIntelligence: CategoryIntelligence
  operationalHealth: OperationalHealth
  emailCaptureIntelligence: EmailCaptureIntelligence
  recentClaims: AdminClaimRecord[]
  operatorRecommendations: OperatorRecommendation[]
  error: AdminApiError | null
}
