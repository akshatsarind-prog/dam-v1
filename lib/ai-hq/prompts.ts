import type {
  AiHqOutputType,
  AiHqResolvedPriority,
  AiHqResolvedTaskType,
} from '@/lib/ai-hq/types'

export const MASTER_ROUTER_PROMPT = `# DAM AI HQ Master Router

Classify a DAM task into one primary task type and return:
- task_type
- priority
- agents_to_run
- output_needed
- risk_level
- approval_required
- recommended_next_file

Allowed task types:
- feature_build
- bug_fix
- failure_analysis
- research
- distribution
- analytics
- yc_application
- strategy
- content
- admin_dashboard`

export const FINAL_OUTPUT_TEMPLATE = `# Final DAM AI HQ Output

## Verdict

## Task Classification

## Why This Matters

## Recommended Agents

## Task-Specific Focus

## Implementation Plan

## Safety Constraints

## Codex Prompt

## Claude Review Prompt

## Metrics To Track

## Risks

## Next Action`

type PromptTemplateInput = {
  task: string
  taskType: AiHqResolvedTaskType
  priority: AiHqResolvedPriority
  outputType: AiHqOutputType
  implementationPlan: string[]
  taskSpecificDetails: string[]
  safetyConstraints: string[]
  validationFocus: string[]
  approvalWarnings: string[]
}

export function buildCodexPromptTemplate({
  task,
  taskType,
  priority,
  outputType,
  implementationPlan,
  taskSpecificDetails,
  safetyConstraints,
  validationFocus,
  approvalWarnings,
}: PromptTemplateInput) {
  const plan = implementationPlan.map((step, index) => `${index + 1}. ${step}`).join('\n')
  const details =
    taskSpecificDetails.length > 0
      ? taskSpecificDetails.map((detail) => `- ${detail}`).join('\n')
      : '- No extra task-specific details provided.'
  const safetyBlock = safetyConstraints.map((constraint) => `- ${constraint}`).join('\n')
  const validationBlock =
    validationFocus.length > 0
      ? validationFocus.map((item) => `- ${item}`).join('\n')
      : '- Validate the main requested behavior and likely edge cases.'
  const approvalBlock = approvalWarnings.length
    ? `\nApproval constraints:\n${approvalWarnings.map((warning) => `- ${warning}`).join('\n')}\n`
    : ''

  return `Implement this DAM task safely inside the existing codebase.

Task:
${task}

Task type: ${taskType}
Priority: ${priority}
Requested output: ${outputType}

Requirements:
- Keep changes isolated to the smallest safe surface area.
- Preserve existing analyzer, claim verification, and source-ranking behavior unless the task explicitly requires otherwise.
- Add clear loading, error, and empty states where relevant.
- Prefer deterministic behavior over hidden automation.
- Add or update tests when behavior changes.

Task-specific implementation details:
${details}

Safety constraints:
${safetyBlock}

Validation focus:
${validationBlock}${approvalBlock}
Implementation plan:
${plan}

Deliver:
- Working code
- Validation notes
- Files changed
- Residual risks`
}

export function buildClaudeReviewPromptTemplate({
  task,
  taskType,
  priority,
  outputType,
  implementationPlan,
  taskSpecificDetails,
  safetyConstraints,
  validationFocus,
  approvalWarnings,
}: PromptTemplateInput) {
  const plan = implementationPlan.map((step, index) => `${index + 1}. ${step}`).join('\n')
  const details =
    taskSpecificDetails.length > 0
      ? taskSpecificDetails.map((detail) => `- ${detail}`).join('\n')
      : '- No extra task-specific details provided.'
  const safetyBlock = safetyConstraints.map((constraint) => `- ${constraint}`).join('\n')
  const validationBlock =
    validationFocus.length > 0
      ? validationFocus.map((item) => `- ${item}`).join('\n')
      : '- Validate the requested behavior and likely edge cases.'
  const approvalBlock = approvalWarnings.length
    ? `\nApproval constraints to verify:\n${approvalWarnings.map((warning) => `- ${warning}`).join('\n')}\n`
    : ''

  return `Review this DAM task implementation with a strict code-review mindset.

Original task:
${task}

Task type: ${taskType}
Priority: ${priority}
Requested output: ${outputType}

Task-specific expectations:
${details}

Safety constraints to preserve:
${safetyBlock}

Planned implementation:
${plan}${approvalBlock}

Check for:
- correctness
- bugs
- TypeScript issues
- UX mismatch
- security/privacy risk
- regression risk
- overengineering
- missing tests
- whether DAM analyzer logic was touched unnecessarily

Validation focus:
${validationBlock}

Required output:
- approval status
- blocking issues
- non-blocking issues
- recommended fixes
- final verdict`
}
