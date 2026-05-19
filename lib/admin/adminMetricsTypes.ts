export type VerdictBreakdown = {
  verdict: string
  count: number
}

export type RiskLabelBreakdown = {
  riskLabel: string
  count: number
}

export type AdminClaimRecord = {
  createdAt: string | null
  claimText: string
  verdict: string
  confidence: number
  riskLabel: string
  latencyMs: number
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

export type AdminCategorizedClaimRecord = AdminClaimRecord & {
  category: AdminClaimCategory
}

export type AdminCategoryBreakdownRecord = {
  category: AdminClaimCategory
  count: number
  percentage: number
  averageLatencyMs: number
  averageConfidence: number
}

export type AdminCategoryEmailConversion = {
  available: boolean
  message: string
}

export type AdminCategoryIntelligence = {
  categoryBreakdown: AdminCategoryBreakdownRecord[]
  mostTestedCategory: AdminCategoryBreakdownRecord | null
  highestLatencyCategory: AdminCategoryBreakdownRecord | null
  lowestConfidenceCategory: AdminCategoryBreakdownRecord | null
  emailConversionByCategory: AdminCategoryEmailConversion
  topCategoryClaims: AdminCategorizedClaimRecord[]
}

export type AdminFunnelStageStatus = 'tracked' | 'manual' | 'not_tracked'

export type AdminFunnelStage = {
  label: string
  count: number | null
  status: AdminFunnelStageStatus
  manualBaseline: boolean
}

export type AdminFunnelMetrics = {
  distributed: AdminFunnelStage
  landingVisitors: AdminFunnelStage
  appVisitors: AdminFunnelStage
  claimSubmissions: AdminFunnelStage
  emailCaptures: AdminFunnelStage
}

export type AdminReferrerRecord = {
  referrer: string
  sessionCount: number
}

export type AdminReturningSessionRecord = {
  sessionId: string
  firstSeenAt: string | null
  lastSeenAt: string | null
  totalClaims: number
  totalEvents: number
  totalVisits: number
}

export type AdminRetentionMetrics = {
  uniqueSessions: number
  returningSessions: number
  returnRate: number | null
  returningUserRate: number | null
  firstTimeSessions: number
  repeatClaimSessions: number
  latestReturningSessions: AdminReturningSessionRecord[]
  multiDayUsers: number
  averageClaimsPerUser: number
  averageTimeBetweenSessionsMs: number | null
  exampleToRealConversionRate: number | null
  topReferrers: AdminReferrerRecord[]
}

export type AdminApiError = {
  code: 'unauthorized' | 'misconfigured' | 'unavailable' | 'unknown'
  message: string
}

export type AdminMetricsResponse = {
  generatedAt: string
  placeholder: boolean
  totalClaims: number
  claimsToday: number
  averageLatencyMs: number
  verdictBreakdown: VerdictBreakdown[]
  riskLabelBreakdown: RiskLabelBreakdown[]
  funnel: AdminFunnelMetrics
  retention: AdminRetentionMetrics
  categoryIntelligence: AdminCategoryIntelligence
  recentClaims: AdminClaimRecord[]
  lowConfidenceClaims: AdminClaimRecord[]
  slowestClaims: AdminClaimRecord[]
  error: AdminApiError | null
}
