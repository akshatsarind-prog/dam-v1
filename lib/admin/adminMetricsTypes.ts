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
  recentClaims: AdminClaimRecord[]
  lowConfidenceClaims: AdminClaimRecord[]
  slowestClaims: AdminClaimRecord[]
  error: AdminApiError | null
}
