import {
  buildClaudeReviewPromptTemplate,
  buildCodexPromptTemplate,
  FINAL_OUTPUT_TEMPLATE,
  MASTER_ROUTER_PROMPT,
} from '@/lib/ai-hq/prompts'
import type {
  AiHqOutputType,
  AiHqPriority,
  AiHqResolvedPriority,
  AiHqResolvedTaskType,
  AiHqRunResponse,
  AiHqTaskType,
} from '@/lib/ai-hq/types'

type RunAiHqPipelineInput = {
  task: string
  taskType: AiHqTaskType
  priority: AiHqPriority
  outputType: AiHqOutputType
  wasTrimmed?: boolean
}

const TASK_TYPE_RULES: Array<{
  type: AiHqResolvedTaskType
  keywords: RegExp
}> = [
  {
    type: 'bug_fix',
    keywords: /\b(bug|broken|error|failed|issue|fix)\b/i,
  },
  {
    type: 'analytics',
    keywords: /\b(analytics|metrics|funnel|retention|supabase dashboard)\b/i,
  },
  {
    type: 'distribution',
    keywords: /\b(linkedin|whatsapp|users|outreach|post|distribution)\b/i,
  },
  {
    type: 'yc_application',
    keywords: /\b(yc|application|founder story|college)\b/i,
  },
  {
    type: 'research',
    keywords: /\b(competitor|market|research|source|sources|citation|citations)\b/i,
  },
  {
    type: 'failure_analysis',
    keywords: /\b(false verdict|contradiction|hallucination|claim failure)\b/i,
  },
]

const APPROVAL_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\b(auto-deploy|deploy to production|production deploy)\b/i,
    message: 'Production deploy requires human approval and is not part of the automated V1 workflow.',
  },
  {
    pattern: /\b(auto-merge|merge to main|merge to master)\b/i,
    message: 'Merging code requires human approval and is not part of the automated V1 workflow.',
  },
  {
    pattern: /\b(delete database|delete rows|drop table|truncate table)\b/i,
    message: 'Database deletion or destructive data changes require explicit human approval.',
  },
  {
    pattern: /\b(send public post|publish post|post publicly)\b/i,
    message: 'Public posts require human approval before publishing.',
  },
  {
    pattern: /\b(send email|email users|message users)\b/i,
    message: 'User-facing email or messaging actions require human approval.',
  },
  {
    pattern: /\b(legal copy|privacy policy|privacy copy|terms of service)\b/i,
    message: 'Legal or privacy changes require human approval.',
  },
]

const CRITICAL_PRIORITY_PATTERN =
  /\b(false verdict|false contradiction|incorrect verdict|wrong verdict|verdict failure|user trust failure|trust failure|security|data loss|production broken|broken production)\b/i

const HIGH_PRIORITY_PATTERN =
  /\b(current office-holder|office-holder|president|prime minister|claim verification|source ranking|source attribution|contradiction|weak source|misinformation|hallucination|result page|ui v2|analytics|yc)\b/i

const TRUST_SENSITIVE_BUG_PATTERN =
  /\b(trust|verdict|claim verification|contradiction|hallucination|source|weak source|source attribution|misinformation)\b/i

const RESULT_SHARE_DOWNLOAD_PATTERN =
  /\b(result page|share|sharing|download|copy result|copy summary|share summary)\b/i

const BUG_FAILURE_TRUST_PATTERN =
  /\b(bug|fix|failed|failure|trust|verdict|contradiction|hallucination|weak source|source attribution|claim verification)\b/i

const ANALYTICS_DETAIL_PATTERN = /\b(analytics|metrics|funnel|retention|dashboard|telemetry|event)\b/i

const DISTRIBUTION_DETAIL_PATTERN = /\b(linkedin|whatsapp|distribution|outreach|post|cta|audience)\b/i

const YC_DETAIL_PATTERN = /\b(yc|application|founder story|market|why now|defensibility)\b/i

const ADMIN_DASHBOARD_DETAIL_PATTERN = /\b(admin|dashboard|operator|internal)\b/i

function classifyTaskType(task: string, requestedTaskType: AiHqTaskType): AiHqResolvedTaskType {
  if (requestedTaskType !== 'auto') {
    return requestedTaskType
  }

  if (/\b(admin|dashboard|internal tool|internal page|\/admin)\b/i.test(task)) {
    return 'admin_dashboard'
  }

  if (/\b(result page|ui|ux|design|layout|button|mobile)\b/i.test(task)) {
    return /\b(admin|dashboard)\b/i.test(task) ? 'admin_dashboard' : 'feature_build'
  }

  for (const rule of TASK_TYPE_RULES) {
    if (rule.keywords.test(task)) {
      return rule.type
    }
  }

  return 'strategy'
}

function classifyPriority(
  task: string,
  requestedPriority: AiHqPriority,
  resolvedTaskType: AiHqResolvedTaskType
): AiHqResolvedPriority {
  if (requestedPriority !== 'auto') {
    return requestedPriority
  }

  if (CRITICAL_PRIORITY_PATTERN.test(task)) {
    return 'critical'
  }

  if (HIGH_PRIORITY_PATTERN.test(task)) {
    return 'high'
  }

  if (
    (resolvedTaskType === 'bug_fix' || resolvedTaskType === 'failure_analysis') &&
    TRUST_SENSITIVE_BUG_PATTERN.test(task)
  ) {
    return 'high'
  }

  if (/\b(archive|cosmetic)\b/i.test(task)) {
    return 'low'
  }

  if (/\b(workflow|documentation|research|report|context)\b/i.test(task)) {
    return 'medium'
  }

  return 'medium'
}

function detectApprovalWarnings(task: string) {
  return APPROVAL_RULES.filter((rule) => rule.pattern.test(task)).map((rule) => rule.message)
}

function buildWhyThisMatters(taskType: AiHqResolvedTaskType) {
  switch (taskType) {
    case 'bug_fix':
      return 'Broken workflows slow iteration, create user confusion, and reduce trust in DAM operating quality.'
    case 'failure_analysis':
      return 'Failure analysis protects trust by preventing weak verdicts, evidence gaps, and repeated misinformation mistakes.'
    case 'analytics':
      return 'Better analytics make it possible to see retention, funnel quality, and which product work is actually moving behavior.'
    case 'distribution':
      return 'Distribution work matters only if it improves feedback loops, repeat testers, and qualified interest in DAM.'
    case 'yc_application':
      return 'YC-focused work matters when it sharpens the company narrative and ties it to real product proof.'
    case 'research':
      return 'Research matters when it improves evidence quality, source judgment, and the strategic direction of DAM.'
    case 'feature_build':
      return 'Feature work should improve clarity, trust, and operator leverage without destabilizing the core DAM product.'
    case 'content':
      return 'Content work should strengthen distribution and narrative without making claims the product cannot support.'
    case 'admin_dashboard':
      return 'Admin dashboard work should improve operator leverage and planning without touching DAM core analysis paths.'
    case 'strategy':
    default:
      return 'Strategy work matters when it narrows focus, prevents waste, and improves product and company decisions.'
  }
}

function getRecommendedAgents(taskType: AiHqResolvedTaskType) {
  switch (taskType) {
    case 'bug_fix':
      return ['Router Agent', 'Engineering Agent', 'Risk Agent', 'Claude Reviewer']
    case 'failure_analysis':
      return ['Router Agent', 'Research Agent', 'Engineering Agent', 'Risk Agent', 'Claude Reviewer']
    case 'analytics':
      return ['Router Agent', 'Strategy Agent', 'Engineering Agent', 'Claude Reviewer']
    case 'distribution':
      return ['Router Agent', 'Strategy Agent', 'Research Agent', 'Final Synthesizer']
    case 'yc_application':
      return ['Router Agent', 'Strategy Agent', 'Research Agent', 'Final Synthesizer']
    case 'research':
      return ['Router Agent', 'Research Agent', 'Risk Agent', 'Final Synthesizer']
    case 'feature_build':
      return ['Router Agent', 'Strategy Agent', 'UX Agent', 'Engineering Agent', 'Risk Agent']
    case 'content':
      return ['Router Agent', 'Strategy Agent', 'Research Agent', 'Final Synthesizer']
    case 'admin_dashboard':
      return ['Router Agent', 'UX Agent', 'Engineering Agent', 'Risk Agent', 'Claude Reviewer']
    case 'strategy':
    default:
      return ['Router Agent', 'Strategy Agent', 'Risk Agent', 'Final Synthesizer']
  }
}

function getImplementationPlan(taskType: AiHqResolvedTaskType, outputType: AiHqOutputType) {
  const shared = [
    'Clarify scope, affected surfaces, and explicit do-not-touch constraints before implementation.',
    'Build the smallest safe change that satisfies the requested workflow output.',
    'Add validation, clear empty and error states, and explicit rollback boundaries.',
    'Run lint, build, and targeted regression checks before considering the task complete.',
  ]

  switch (taskType) {
    case 'admin_dashboard':
      return [
        'Inspect the existing admin surface and reuse the current admin shell, gating, and styling patterns.',
        'Add the new admin page and any isolated helpers under the admin-specific surface only.',
        'Implement deterministic task classification and output generation before adding any external AI calls.',
        ...shared,
      ]
    case 'feature_build':
      return [
        'Define the user flow, states, and expected success criteria for the feature.',
        'Implement the minimum UI and backend changes required for the first safe version.',
        'Check mobile layout, copy clarity, and edge-case behavior before widening scope.',
        ...shared,
      ]
    case 'bug_fix':
      return [
        'Reproduce the bug and lock down expected versus actual behavior.',
        'Fix the smallest root cause without widening unrelated code paths.',
        'Add a regression guard so the same bug is harder to reintroduce.',
        ...shared,
      ]
    case 'failure_analysis':
      return [
        'Capture the exact failure case, expected verdict, and incorrect output.',
        'Trace likely evidence, retrieval, or reasoning failure points without changing unrelated logic.',
        'Add regression coverage tied to the documented failure case.',
        ...shared,
      ]
    case 'analytics':
      return [
        'Define the exact metric, event names, and source of truth before code changes.',
        'Implement the narrowest instrumentation or reporting surface needed.',
        'Validate that the dashboard output matches expected data shape and definitions.',
        ...shared,
      ]
    case 'research':
      return [
        'Define the research question and evidence standard up front.',
        'Collect the minimum credible data needed to answer the question.',
        'Turn findings into explicit product or strategy recommendations.',
        `Format the result for the requested output type: ${outputType}.`,
      ]
    case 'distribution':
      return [
        'Define audience, channel, message, and the measurable outcome.',
        'Draft the minimum viable distribution asset or experiment plan.',
        'Add a feedback and measurement loop before scaling the effort.',
        `Format the result for the requested output type: ${outputType}.`,
      ]
    case 'yc_application':
      return [
        'Define the exact YC narrative question or application section to improve.',
        'Tie the answer to product evidence, founder insight, and market urgency.',
        'Remove weak claims that are not supported by current DAM progress.',
        `Format the result for the requested output type: ${outputType}.`,
      ]
    case 'content':
      return [
        'Define the target audience and the one action the content should drive.',
        'Draft concise copy grounded in what DAM can currently support.',
        'Check for trust, overclaiming, and brand consistency risks before publishing.',
        `Format the result for the requested output type: ${outputType}.`,
      ]
    case 'strategy':
    default:
      return [
        'Frame the decision clearly, including what problem is being solved and what is out of scope.',
        'Compare the best two or three options with expected impact and risk.',
        'Pick the narrowest next step that creates learning without unnecessary build cost.',
        `Format the result for the requested output type: ${outputType}.`,
      ]
  }
}

function uniqueLines(lines: string[]) {
  return Array.from(new Set(lines))
}

function getTaskSpecificDetails(task: string, taskType: AiHqResolvedTaskType) {
  const details: string[] = []

  if (taskType === 'feature_build' && RESULT_SHARE_DOWNLOAD_PATTERN.test(task)) {
    details.push(
      'Include a share result summary suitable for user-facing sharing.',
      'Support copying the result summary directly from the UI.',
      'Scope downloads to TXT first and only mention PDF if it is already supported or intentionally scoped.',
      'Include result metadata so shared or downloaded output stays understandable.',
      'Check mobile layout for share and download controls.',
      'Handle empty, loading, and error states for share and download surfaces.',
      'Track analytics events for share, copy, and download actions.',
      'Do not change analyzer verdict logic.',
      'Do not change source-ranking logic.'
    )
  }

  if ((taskType === 'bug_fix' || taskType === 'failure_analysis') && BUG_FAILURE_TRUST_PATTERN.test(task)) {
    details.push(
      'Reproduce the issue before changing logic.',
      'Document expected versus actual behavior clearly.',
      'Call out the suspected affected logic before widening scope.',
      'Add a regression test tied to the failure.',
      'Record or update the related failure-case entry.',
      'Validate against representative claims, not just one happy path.',
      'Call out trust risk when verdict quality or source behavior is involved.',
      'Avoid broad refactors while fixing the issue.'
    )
  }

  if (taskType === 'analytics' || ANALYTICS_DETAIL_PATTERN.test(task)) {
    if (taskType === 'analytics') {
      details.push(
        'Define the metric precisely before implementation.',
        'Name the exact event names or telemetry inputs involved.',
        'State the data source or source table for each metric.',
        'Name the dashboard or reporting surface where the metric should appear.',
        'Describe how the metric will be validated against source events.',
        'Avoid inventing fake or inferred metrics.',
        'Distinguish product telemetry from external traffic references.'
      )
    }
  }

  if (taskType === 'distribution' || DISTRIBUTION_DETAIL_PATTERN.test(task)) {
    if (taskType === 'distribution') {
      details.push(
        'Define the audience precisely.',
        'Name the channel and why it fits the audience.',
        'Prepare multiple copy variants instead of one generic message.',
        'State the CTA explicitly.',
        'Define how tracking will work for the distribution effort.',
        'Include a feedback-capture path after outreach.',
        'Avoid inflated product or traction claims.'
      )
    }
  }

  if (taskType === 'yc_application' || YC_DETAIL_PATTERN.test(task)) {
    if (taskType === 'yc_application') {
      details.push(
        'Improve clarity before adding more detail.',
        'Use real traction or product evidence where available.',
        'Include the founder story only where it strengthens credibility.',
        'Explain market size concretely.',
        'State why now is true for DAM.',
        'Make defensibility concrete.',
        'Keep the answer concise and scannable.',
        'Avoid overclaiming.'
      )
    }
  }

  if (taskType === 'admin_dashboard' || ADMIN_DASHBOARD_DETAIL_PATTERN.test(task)) {
    if (taskType === 'admin_dashboard') {
      details.push(
        'Keep the work strictly admin-only in scope.',
        'Improve dashboard metric clarity for the operator, not public users.',
        'Do not change production product behavior.',
        'Include fallback states when data is missing or incomplete.',
        'Optimize for operator usefulness over visual complexity.'
      )
    }
  }

  return uniqueLines(details)
}

function getSafetyConstraints(taskType: AiHqResolvedTaskType, task: string, approvalWarnings: string[]) {
  const constraints = [
    'Keep changes isolated to the requested DAM AI HQ workflow surface.',
    'Do not modify DAM analyzer logic unless the task explicitly requires it.',
    'Do not modify claim verification logic unless the task explicitly requires it.',
    'Do not modify source-ranking logic unless the task explicitly requires it.',
  ]

  if (taskType === 'feature_build' && RESULT_SHARE_DOWNLOAD_PATTERN.test(task)) {
    constraints.push(
      'Do not alter analyzer verdict generation while adding share or download behavior.',
      'Do not alter source-ranking behavior while improving result-page UX.'
    )
  }

  if (taskType === 'admin_dashboard') {
    constraints.push('Do not change public app behavior while improving admin-only workflows.')
  }

  if (taskType === 'analytics') {
    constraints.push(
      'Do not present external traffic references as if they are the same as product telemetry.',
      'Do not invent metrics that the underlying events cannot support.'
    )
  }

  if (taskType === 'distribution' || taskType === 'yc_application') {
    constraints.push('Do not overstate traction, product capability, or market proof.')
  }

  return uniqueLines([...constraints, ...approvalWarnings])
}

function getValidationFocus(task: string, taskType: AiHqResolvedTaskType) {
  const focus: string[] = []

  if (taskType === 'feature_build' && RESULT_SHARE_DOWNLOAD_PATTERN.test(task)) {
    focus.push(
      'Verify share result summary content is user-readable.',
      'Verify copy result summary behavior works on desktop and mobile.',
      'Verify TXT download output includes useful result metadata.',
      'Verify share, copy, and download analytics events fire correctly.',
      'Verify analyzer and source-ranking behavior are unchanged.'
    )
  }

  if ((taskType === 'bug_fix' || taskType === 'failure_analysis') && BUG_FAILURE_TRUST_PATTERN.test(task)) {
    focus.push(
      'Verify expected versus actual behavior is documented.',
      'Verify the fix passes a regression test.',
      'Verify validation claims cover representative trust-sensitive cases.',
      'Verify no broad refactor was introduced.'
    )
  }

  if (taskType === 'analytics') {
    focus.push(
      'Verify metric definitions match the event source.',
      'Verify dashboard numbers reconcile with source telemetry.',
      'Verify external traffic references are labeled separately from product telemetry.'
    )
  }

  if (taskType === 'distribution') {
    focus.push(
      'Verify audience and CTA are explicit.',
      'Verify tracking and feedback capture paths are defined.',
      'Verify copy variants do not make inflated claims.'
    )
  }

  if (taskType === 'yc_application') {
    focus.push(
      'Verify the answer is concise and scannable.',
      'Verify traction and founder-story claims are supportable.',
      'Verify market, why-now, and defensibility points are concrete.'
    )
  }

  if (taskType === 'admin_dashboard') {
    focus.push(
      'Verify admin-only scope is preserved.',
      'Verify fallback states are readable.',
      'Verify the output improves operator usefulness without public behavior changes.'
    )
  }

  return uniqueLines(focus)
}

function getRisks(
  taskType: AiHqResolvedTaskType,
  approvalWarnings: string[],
  wasTrimmed: boolean | undefined
) {
  const risks = new Set<string>()

  switch (taskType) {
    case 'admin_dashboard':
      risks.add('Admin workflow sprawl can grow faster than the actual product surface if scope is not kept narrow.')
      risks.add('Weak error handling can make internal tools feel reliable when the underlying output is incomplete.')
      break
    case 'bug_fix':
      risks.add('A narrow bug fix can still cause regressions if adjacent behavior is not checked.')
      break
    case 'failure_analysis':
      risks.add('Incorrect failure analysis can hide the real cause and create false confidence.')
      risks.add('Trust can drop quickly if false verdict issues return after a claimed fix.')
      break
    case 'analytics':
      risks.add('Poor metric definitions can create false product conclusions.')
      break
    case 'distribution':
      risks.add('Distribution experiments can waste time if there is no clear audience or feedback loop.')
      break
    case 'research':
      risks.add('Low-quality sources can create bad product or trust decisions.')
      break
    case 'yc_application':
      risks.add('Narrative work can become overclaiming if it is disconnected from current product evidence.')
      break
    case 'content':
      risks.add('Public-facing content can reduce credibility if it promises more than the product supports.')
      break
    case 'feature_build':
      risks.add('Feature scope can expand quickly and create UI complexity before value is proven.')
      break
    case 'strategy':
      risks.add('Broad strategy work can delay execution if it does not end in a specific next action.')
      break
  }

  for (const warning of approvalWarnings) {
    risks.add(warning)
  }

  if (wasTrimmed) {
    risks.add('The submitted task was trimmed for safe V1 processing, so split oversized tasks before final implementation.')
  }

  return Array.from(risks)
}

function getMetricsToTrack(taskType: AiHqResolvedTaskType) {
  switch (taskType) {
    case 'admin_dashboard':
      return [
        'Time to first useful output',
        'Pipeline success rate',
        'Form submission error rate',
        'Codex prompt copy usage',
        'Claude review prompt copy usage',
      ]
    case 'feature_build':
      return ['Feature usage rate', 'Task completion rate', 'Error rate', 'User feedback volume']
    case 'bug_fix':
      return ['Bug reproduction rate', 'Regression pass rate', 'User-reported recurrence']
    case 'failure_analysis':
      return ['Failure-case regression pass rate', 'False verdict recurrence', 'Evidence quality complaints']
    case 'analytics':
      return ['Event capture rate', 'Dashboard freshness', 'Metric consistency checks']
    case 'distribution':
      return ['Outbound response rate', 'Repeat tester conversion', 'Qualified feedback count']
    case 'yc_application':
      return ['Narrative clarity score', 'Proof-point completeness', 'Application revision count']
    case 'research':
      return ['Research questions closed', 'Source quality score', 'Decision reuse rate']
    case 'content':
      return ['Content publish rate', 'Engagement quality', 'Inbound follow-up rate']
    case 'strategy':
    default:
      return ['Decision cycle time', 'Execution follow-through rate', 'Priority stability']
  }
}

function buildNextAction(taskType: AiHqResolvedTaskType, approvalWarnings: string[]) {
  if (approvalWarnings.length) {
    return 'Keep the output in planning mode, isolate any risky actions, and wait for explicit human approval before execution.'
  }

  switch (taskType) {
    case 'admin_dashboard':
      return 'Convert this output into a focused implementation task and build the isolated admin workflow surface.'
    case 'bug_fix':
      return 'Reproduce the issue locally, implement the narrowest safe fix, and add a regression check.'
    case 'failure_analysis':
      return 'Document the failure case first, then implement the smallest fix that changes the incorrect behavior.'
    case 'analytics':
      return 'Lock the metric definition before adding or changing instrumentation.'
    case 'research':
      return 'Turn the research question into a short evidence brief before deciding on build work.'
    case 'distribution':
      return 'Pick one channel, one message, and one measurable success metric before launching the experiment.'
    case 'yc_application':
      return 'Draft the YC answer with product proof points and remove any unsupported narrative claims.'
    case 'feature_build':
      return 'Write the implementation task, then build the smallest version that proves the workflow is useful.'
    case 'content':
      return 'Draft the asset, review for overclaiming, and keep publishing behind explicit human approval.'
    case 'strategy':
    default:
      return 'Choose the narrowest next step that creates real learning without expanding scope.'
  }
}

function buildVerdict(
  taskType: AiHqResolvedTaskType,
  priority: AiHqResolvedPriority,
  approvalWarnings: string[],
  wasTrimmed: boolean | undefined
) {
  const parts = [
    `Proceed with a safe V1 ${taskType.replace(/_/g, ' ')} workflow at ${priority} priority.`,
  ]

  if (approvalWarnings.length) {
    parts.push('Keep all risky actions in approval-only mode.')
  }

  if (wasTrimmed) {
    parts.push('The submitted task was trimmed for deterministic processing.')
  }

  return parts.join(' ')
}

function escapeCodeFenceContent(value: string) {
  return value.replace(/```/g, '``\\`')
}

export function runAiHqPipeline({
  task,
  taskType,
  priority,
  outputType,
  wasTrimmed = false,
}: RunAiHqPipelineInput): AiHqRunResponse {
  const resolvedTaskType = classifyTaskType(task, taskType)
  const resolvedPriority = classifyPriority(task, priority, resolvedTaskType)
  const approvalWarnings = detectApprovalWarnings(task)
  const implementationPlan = getImplementationPlan(resolvedTaskType, outputType)
  const taskSpecificDetails = getTaskSpecificDetails(task, resolvedTaskType)
  const safetyConstraints = getSafetyConstraints(resolvedTaskType, task, approvalWarnings)
  const validationFocus = getValidationFocus(task, resolvedTaskType)
  const codexPrompt = buildCodexPromptTemplate({
    task,
    taskType: resolvedTaskType,
    priority: resolvedPriority,
    outputType,
    implementationPlan,
    taskSpecificDetails,
    safetyConstraints,
    validationFocus,
    approvalWarnings,
  })
  const claudeReviewPrompt = buildClaudeReviewPromptTemplate({
    task,
    taskType: resolvedTaskType,
    priority: resolvedPriority,
    outputType,
    implementationPlan,
    taskSpecificDetails,
    safetyConstraints,
    validationFocus,
    approvalWarnings,
  })
  const metricsToTrack = getMetricsToTrack(resolvedTaskType)
  const risks = getRisks(resolvedTaskType, approvalWarnings, wasTrimmed)
  const nextAction = buildNextAction(resolvedTaskType, approvalWarnings)
  const verdict = buildVerdict(resolvedTaskType, resolvedPriority, approvalWarnings, wasTrimmed)
  const agents = getRecommendedAgents(resolvedTaskType)
  const whyThisMatters = buildWhyThisMatters(resolvedTaskType)

  const finalOutput = [
    '# Final DAM AI HQ Output',
    '',
    '## Verdict',
    verdict,
    '',
    '## Task Classification',
    `- Task type: ${resolvedTaskType}`,
    `- Priority: ${resolvedPriority}`,
    `- Output type: ${outputType}`,
    '',
    '## Why This Matters',
    whyThisMatters,
    '',
    '## Recommended Agents',
    ...agents.map((agent) => `- ${agent}`),
    '',
    '## Task-Specific Focus',
    ...(taskSpecificDetails.length
      ? taskSpecificDetails.map((detail) => `- ${detail}`)
      : ['- No extra task-specific focus was generated for this task.']),
    '',
    '## Implementation Plan',
    ...implementationPlan.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Safety Constraints',
    ...safetyConstraints.map((constraint) => `- ${constraint}`),
    '',
    '## Codex Prompt',
    '```md',
    escapeCodeFenceContent(codexPrompt),
    '```',
    '',
    '## Claude Review Prompt',
    '```md',
    escapeCodeFenceContent(claudeReviewPrompt),
    '```',
    '',
    '## Metrics To Track',
    ...metricsToTrack.map((metric) => `- ${metric}`),
    '',
    '## Risks',
    ...risks.map((risk) => `- ${risk}`),
    '',
    '## Next Action',
    nextAction,
    '',
    '<!-- reference-templates -->',
    `- Router template: ${MASTER_ROUTER_PROMPT.split('\n')[0]}`,
    `- Final output template: ${FINAL_OUTPUT_TEMPLATE.split('\n')[0]}`,
  ].join('\n')

  return {
    runId: `aihq-${crypto.randomUUID()}`,
    taskType: resolvedTaskType,
    priority: resolvedPriority,
    outputType,
    finalOutput,
    codexPrompt,
    claudeReviewPrompt,
    risks,
    metricsToTrack,
    nextAction,
  }
}
