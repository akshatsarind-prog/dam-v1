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

export type AdminRetentionMetrics = {
  uniqueSessions: number
  returningSessions: number
  returnRate: number | null
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
  recentClaims: AdminClaimRecord[]
  lowConfidenceClaims: AdminClaimRecord[]
  slowestClaims: AdminClaimRecord[]
  error: AdminApiError | null
}
