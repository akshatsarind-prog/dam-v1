// Shared AI HQ request/response types used by the admin page, API route, and pipeline.
export type AiHqTaskType =
  | 'auto'
  | 'feature_build'
  | 'bug_fix'
  | 'failure_analysis'
  | 'research'
  | 'distribution'
  | 'analytics'
  | 'yc_application'
  | 'strategy'
  | 'content'
  | 'admin_dashboard'

export type AiHqResolvedTaskType = Exclude<AiHqTaskType, 'auto'>

export type AiHqPriority = 'auto' | 'low' | 'medium' | 'high' | 'critical'

export type AiHqResolvedPriority = Exclude<AiHqPriority, 'auto'>

export type AiHqOutputType =
  | 'full_workflow'
  | 'codex_prompt'
  | 'claude_review_prompt'
  | 'decision_memo'
  | 'implementation_plan'
  | 'research_report'

export type AiHqRunRequest = {
  task: string
  taskType: AiHqTaskType
  priority: AiHqPriority
  outputType: AiHqOutputType
}

export type AiHqRunResponse = {
  runId: string
  taskType: AiHqResolvedTaskType
  priority: AiHqResolvedPriority
  outputType: AiHqOutputType
  finalOutput: string
  codexPrompt: string
  claudeReviewPrompt: string
  risks: string[]
  metricsToTrack: string[]
  nextAction: string
}

export type AiHqStoredRun = AiHqRunResponse & {
  createdAt: string
  task: string
}
