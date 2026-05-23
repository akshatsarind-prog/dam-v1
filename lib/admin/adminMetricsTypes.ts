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
  bestAttributedSourceByClaims: CampaignPerformance | null
  bestAttributedSourceByClaimsPerSession: CampaignPerformance | null
  attributedClaims: number
  unattributedClaims: number
  attributionCoverageRate: number | null
  topReferrers: AdminReferrerRecord[]
}

export type AdminFunnelStageStatus = 'tracked' | 'manual' | 'not_tracked'
export type AdminFunnelStageScope =
  | 'manual_baseline'
  | 'supabase_page_views'
  | 'supabase_sessions'
  | 'supabase_claims'
  | 'supabase_signups'
  | 'unavailable'

export type AdminFunnelStage = {
  key: string
  label: string
  count: number | null
  status: AdminFunnelStageStatus
  manualBaseline: boolean
  sourceLabel: string
  scope: AdminFunnelStageScope
  conversionFromPrevious: number | null
  isComparableToPrevious: boolean
  comparabilityLabel: string
  comparabilityReason: string | null
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
  bestAttributedSource: CampaignPerformance | null
  attributionCoverageRate: number | null
  dataQualityNote: string
  trustNotes: string[]
  limitations: string[]
  hasComparableConversionChain: boolean
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

export type AdminTrendDirection = 'up' | 'down' | 'flat' | 'no_data'

export type AdminTrendSignal = {
  currentCount: number
  previousCount: number
  delta: number
  direction: AdminTrendDirection
  summary: string
}

export type AdminDailySnapshot = {
  claimsToday: number
  sessionsToday: number
  emailsToday: number
  returningSessionsToday: number
  averageLatencyMs: number | null
  topSourceToday: string | null
  topCategoryToday: AdminClaimCategory | null
}

export type AdminGrowthSignals = {
  bestTrafficSourceByClaims: CampaignPerformance | null
  bestTrafficSourceByEmails: EmailSourceBreakdownRecord | null
  unattributedTrafficPercentage: number | null
  repeatSessionTrend: AdminTrendSignal
  claimSubmissionsTrend: AdminTrendSignal
}

export type AdminProductSignals = {
  mostTestedCategory: AdminCategoryBreakdownRecord | null
  lowestConfidenceCategory: AdminCategoryBreakdownRecord | null
  slowestCategory: AdminCategoryBreakdownRecord | null
  recentHighIntentSessions: AdminHighIntentSessionRecord[]
  sessionsWithMultipleClaims: number
}

export type AdminLowConfidenceCluster = {
  category: AdminClaimCategory
  count: number
  averageConfidence: number
}

export type AdminReliabilitySignals = {
  slowestClaims: AdminClaimRecord[]
  claimsOver8Seconds: number
  missingAttributionRows: number
  unknownVerdictRows: number
  unknownRiskRows: number
  emptyClaimTextRows: number
  lowConfidenceClusters: AdminLowConfidenceCluster[]
}

export type AdminAutomationIntelligence = {
  dailySnapshot: AdminDailySnapshot
  growthSignals: AdminGrowthSignals
  productSignals: AdminProductSignals
  reliabilitySignals: AdminReliabilitySignals
  recommendations: OperatorRecommendation[]
  recommendedNextAction: OperatorRecommendation | null
}

export type AdminLifetimeStage =
  | 'Exploration'
  | 'Early Signal Validation'
  | 'Activation Optimization'
  | 'Retention Discovery'
  | 'Early Habit Formation'

export type AdminValueShare = {
  label: string
  count: number
  percentage: number | null
}

export type AdminDeviceSplit = {
  mobile: number
  tablet: number
  desktop: number
  unknown: number
}

export type AdminTimelinePoint = {
  day: string
  visitors: number
  sessions: number
  claims: number
  emails: number
}

export type AdminSessionSummary = {
  sessionId: string
  visitorId: string | null
  source: string | null
  campaign: string | null
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  claimCount: number
  durationMs: number | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  emailCaptured: boolean
}

export type AdminKeywordSignal = {
  label: string
  count: number
}

export type AdminFlowSummary = {
  label: string
  count: number
}

export type AdminTimelineMilestone = {
  label: string
  at: string | null
  detail: string
}

export type AdminVercelAnalyticsBreakdown = {
  label: string
  value: number
  percentage: number | null
}

export type AdminVercelEndpointAttempt = {
  label: string
  endpoint: string
  httpStatus: number | null
  classification:
    | 'success'
    | 'forbidden'
    | 'not_found'
    | 'not_configured'
    | 'unsupported'
    | 'error'
    | 'skipped'
  safeErrorMessage: string
}

export type AdminVercelDiagnostics = {
  hasAccessToken: boolean
  hasProjectId: boolean
  hasTeamId: boolean
  projectLinked: boolean
  projectApiStatus: 'accessible' | 'forbidden' | 'not_found' | 'not_configured' | 'error'
  analyticsEndpointAttempts: AdminVercelEndpointAttempt[]
  finalConclusion: string
}

export type AdminVercelAnalyticsSnapshot = {
  configured: boolean
  connected: boolean
  projectLinked: boolean
  hasWebAnalytics: boolean
  hasData: boolean
  visitors: number | null
  pageViews: number | null
  bounceRate: number | null
  topPages: AdminVercelAnalyticsBreakdown[]
  topReferrers: AdminVercelAnalyticsBreakdown[]
  countries: AdminVercelAnalyticsBreakdown[]
  devices: AdminVercelAnalyticsBreakdown[]
  dateRangeLabel: string
  since: string | null
  until: string | null
  unavailableReason: string | null
  sourceLabel: string
  diagnostics: AdminVercelDiagnostics
}

export type AdminLifetimeSnapshot = {
  totalVisitors: number | null
  totalSessions: number
  totalPageViews: number
  totalClaimSubmissions: number
  totalRepeatSessions: number
  returningSessionRate: number | null
  totalEmailCaptures: number | null
  averageClaimsPerSession: number
  averageLatencyMs: number
  medianLatencyMs: number | null
  highestLatencyEverMs: number | null
  mostActiveDay: AdminTimelinePoint | null
  mostActiveSource: string | null
  mostTestedCategory: AdminClaimCategory | null
  totalCountriesReached: number | null
  mobileVsDesktopSplit: AdminDeviceSplit | null
  totalAttributedCampaigns: number
  totalOperationalDays: number | null
  currentDamStage: AdminLifetimeStage
}

export type AdminLifetimeGrowthIntelligence = {
  visitorGrowthTrend: AdminTrendSignal
  claimGrowthTrend: AdminTrendSignal
  repeatSessionTrend: AdminTrendSignal
  emailCaptureTrend: AdminTrendSignal
  topAcquisitionChannels: AdminTrafficSourceRecord[]
  bestConvertingSources: AdminTrafficSourceRecord[]
  worstConvertingSources: AdminTrafficSourceRecord[]
  unattributedTrafficPercentage: number | null
  biggestGrowthBottleneck: string
  timeline: AdminTimelinePoint[]
}

export type AdminLifetimeBehaviorIntelligence = {
  claimsPerSessionDistribution: AdminValueShare[]
  firstTimeSessions: number
  repeatSessions: number
  averageTimeBeforeFirstClaimMs: number | null
  mostCommonUserFlow: AdminFlowSummary | null
  highIntentSessionPatterns: string[]
  repeatUserPatterns: string[]
  exampleClaimUsageRate: number | null
  mobileVsDesktopEngagement: AdminDeviceSplit | null
  longestSessions: AdminSessionSummary[]
  highestClaimDepthSessions: AdminSessionSummary[]
  mostValuableBehavioralSignal: string
}

export type AdminLifetimeTrustProductIntelligence = {
  topClaimCategories: AdminCategoryBreakdownRecord[]
  lowestConfidenceCategory: AdminCategoryBreakdownRecord | null
  highestLatencyCategory: AdminCategoryBreakdownRecord | null
  scamVsMisinformationDistribution: AdminValueShare[]
  lowConfidenceTrend: AdminTrendSignal
  sourceEvidenceDistribution: AdminValueShare[]
  mostCommonSuspiciousKeywords: AdminKeywordSignal[]
  recurringMisinformationThemes: AdminKeywordSignal[]
  recurringScamThemes: AdminKeywordSignal[]
  currentUserIntent: string
}

export type AdminLifetimeReliabilityIntelligence = {
  averageLatencyMs: number
  medianLatencyMs: number | null
  highestLatencyEverMs: number | null
  latencyDistribution: AdminValueShare[]
  claimsOver8Seconds: number
  slowestClaimsEver: AdminClaimRecord[]
  unknownVerdictRows: number
  unknownRiskRows: number
  emptyClaimRows: number
  attributionFailures: number
  operationalUptimeIndicator: string | null
  vercelFunctionHealth: string | null
  deploymentCount: number | null
  currentReliabilityStatus: string
}

export type AdminLifetimeStrategicRecommendations = {
  topNextActions: OperatorRecommendation[]
  highestLeverageProductFix: string
  highestLeverageGrowthAction: string
  highestLeverageRetentionAction: string
  biggestAnalyticsBlindSpot: string
  biggestOperationalRisk: string
  strongestCurrentSignal: string
}

export type AdminLifetimeDataCoverage = {
  trackedVisitors: number | null
  trackedSessions: number
  trackedPageViewEvents: number
  trackedAppOpenEvents: number
  eventRowsTotal: number
  eventRowsWithVisitorId: number
  eventRowsWithDeviceType: number
  eventRowsWithReferrer: number
  eventRowsWithLandingPath: number
  eventRowsWithAnyUtm: number
  claimRowsTotal: number
  claimRowsWithVisitorId: number
  claimRowsWithAttribution: number
  attributionCoverageRate: number | null
  vercelConnected: boolean
  vercelVisitorsAvailable: boolean
  vercelPageViewsAvailable: boolean
  vercelBounceRateAvailable: boolean
  vercelUnavailableReason: string | null
  trafficTruthStatus: string
  deviceSplitSource: string
  mismatchSummary: string
}

export type AdminLifetimeTimeline = {
  milestones: AdminTimelineMilestone[]
  hasEnoughHistoricalData: boolean
}

export type AdminLifetimeIntelligence = {
  snapshot: AdminLifetimeSnapshot
  growth: AdminLifetimeGrowthIntelligence
  behavior: AdminLifetimeBehaviorIntelligence
  trustProduct: AdminLifetimeTrustProductIntelligence
  reliability: AdminLifetimeReliabilityIntelligence
  strategy: AdminLifetimeStrategicRecommendations
  dataCoverage: AdminLifetimeDataCoverage
  timeline: AdminLifetimeTimeline
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
  automationIntelligence: AdminAutomationIntelligence
  vercelAnalytics: AdminVercelAnalyticsSnapshot
  lifetimeIntelligence: AdminLifetimeIntelligence
  error: AdminApiError | null
}
