'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import { AdminMetricsGate, MetricCard, SectionHeading, SummaryList } from '@/app/admin/_components/AdminShell'
import type {
  AiHqOutputType,
  AiHqPriority,
  AiHqRunRequest,
  AiHqRunResponse,
  AiHqStoredRun,
  AiHqTaskType,
} from '@/lib/ai-hq/types'

const SESSION_STORAGE_KEY = 'dam_admin_password'
const AI_HQ_HISTORY_STORAGE_KEY = 'dam-ai-hq-runs-v1'
const MAX_STORED_RUNS = 20

const TASK_TYPE_OPTIONS: Array<{ value: AiHqTaskType; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'feature_build', label: 'Feature build' },
  { value: 'bug_fix', label: 'Bug fix' },
  { value: 'failure_analysis', label: 'Failure analysis' },
  { value: 'research', label: 'Research' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'yc_application', label: 'YC application' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'content', label: 'Content' },
  { value: 'admin_dashboard', label: 'Admin dashboard' },
]

const PRIORITY_OPTIONS: Array<{ value: AiHqPriority; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const OUTPUT_TYPE_OPTIONS: Array<{ value: AiHqOutputType; label: string }> = [
  { value: 'full_workflow', label: 'Full workflow' },
  { value: 'codex_prompt', label: 'Codex prompt' },
  { value: 'claude_review_prompt', label: 'Claude review prompt' },
  { value: 'decision_memo', label: 'Decision memo' },
  { value: 'implementation_plan', label: 'Implementation plan' },
  { value: 'research_report', label: 'Research report' },
]

const shellGridStyle = {
  display: 'grid',
  gap: 16,
} as const

const formGridStyle = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} as const

const buttonRowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 12,
} as const

const secondaryButtonStyle = {
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#f5f7fa',
  fontSize: 13,
  fontWeight: 600,
  padding: '12px 16px',
  cursor: 'pointer',
} as const

const helperTextStyle = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 12,
  lineHeight: 1.6,
} as const

const outputPanelStyle = {
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#f5f7fa',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
} as const

const textareaStyle = {
  minHeight: 180,
  resize: 'vertical' as const,
} as const

type FormState = AiHqRunRequest
type ActionStatus = {
  kind: 'copy' | 'download' | 'history'
  label: string
}

function readApiErrorMessage(payload: AiHqRunResponse | { error?: { message?: string } } | null) {
  if (payload && 'error' in payload && payload.error?.message) {
    return payload.error.message
  }

  return 'DAM AI HQ pipeline request failed.'
}

function getInitialFormState(): FormState {
  return {
    task: '',
    taskType: 'auto',
    priority: 'auto',
    outputType: 'full_workflow',
  }
}

function isStoredRun(value: unknown): value is AiHqStoredRun {
  if (!value || typeof value !== 'object') {
    return false
  }

  const input = value as Partial<AiHqStoredRun>

  return (
    typeof input.runId === 'string' &&
    typeof input.createdAt === 'string' &&
    typeof input.task === 'string' &&
    typeof input.taskType === 'string' &&
    typeof input.priority === 'string' &&
    typeof input.outputType === 'string' &&
    typeof input.finalOutput === 'string' &&
    typeof input.codexPrompt === 'string' &&
    typeof input.claudeReviewPrompt === 'string' &&
    Array.isArray(input.risks) &&
    Array.isArray(input.metricsToTrack) &&
    typeof input.nextAction === 'string'
  )
}

function readStoredRuns() {
  if (typeof window === 'undefined') {
    return [] as AiHqStoredRun[]
  }

  try {
    const rawValue = window.localStorage.getItem(AI_HQ_HISTORY_STORAGE_KEY)

    if (!rawValue) {
      return [] as AiHqStoredRun[]
    }

    const parsed = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsed)) {
      return [] as AiHqStoredRun[]
    }

    return parsed.filter(isStoredRun).slice(0, MAX_STORED_RUNS)
  } catch {
    return [] as AiHqStoredRun[]
  }
}

function writeStoredRuns(runs: AiHqStoredRun[]) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      AI_HQ_HISTORY_STORAGE_KEY,
      JSON.stringify(runs.slice(0, MAX_STORED_RUNS))
    )
  } catch {}
}

function buildStoredRun(task: string, result: AiHqRunResponse): AiHqStoredRun {
  return {
    ...result,
    createdAt: new Date().toISOString(),
    task,
  }
}

function buildSafeMarkdownFilename(prefix: string, runId: string) {
  const normalizedRunId = runId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `${prefix}-${normalizedRunId}.md`
}

function slugifyTask(task: string, limit = 64) {
  const normalized = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalized.length <= limit) {
    return normalized || 'dam-ai-hq-task'
  }

  return normalized.slice(0, limit).replace(/-+$/g, '') || 'dam-ai-hq-task'
}

function formatIsoDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return parsed.toISOString().slice(0, 10)
}

function escapeMarkdownText(value: string) {
  return value.replace(/```/g, '``\\`')
}

function extractMarkdownSection(markdown: string, heading: string) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`)
  const match = markdown.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function extractPromptSection(prompt: string, label: string) {
  const pattern = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n[A-Z][^\\n]*:\\n|$)`)
  const match = prompt.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function buildArtifactFilename(task: string, suffix: 'codex-task' | 'claude-review', runId: string, createdAt: string) {
  const date = formatIsoDate(createdAt)
  const slug = slugifyTask(task)
  return `${date}-${slug}-${suffix}-${runId}.md`
}

function buildCodexTaskArtifact(run: AiHqStoredRun) {
  const taskSpecificFocus = extractMarkdownSection(run.finalOutput, 'Task-Specific Focus')
  const implementationPlan = extractMarkdownSection(run.finalOutput, 'Implementation Plan')

  return `# Codex Task: ${escapeMarkdownText(run.task)}

## Date
${formatIsoDate(run.createdAt)}

## Run ID
${run.runId}

## Goal
${escapeMarkdownText(run.task)}

## Context
Generated from DAM AI HQ.

Task type:
${run.taskType}

Priority:
${run.priority}

Output type:
${run.outputType}

## Requirements
${taskSpecificFocus || escapeMarkdownText(run.codexPrompt)}

## Do not touch
- DAM analyzer logic unless explicitly required
- claim verification logic unless explicitly required
- source ranking logic unless explicitly required
- Supabase schema
- production database logic
- external AI API behavior
- deployment configuration

## Implementation plan
${implementationPlan || escapeMarkdownText(run.codexPrompt)}

## Validation checklist
- Run targeted lint/typecheck for changed files
- Run npm run build
- Validate task-specific expected behavior
- Confirm no unrelated DAM core logic changed
- Confirm copy/download/history behavior if relevant

## Expected output
- Files changed
- Validation notes
- Residual risks
- Safety confirmation

## Rollback plan
Revert the changed files for this task if the implementation causes regressions.
`
}

function buildClaudeReviewArtifact(run: AiHqStoredRun) {
  const taskSpecificExpectations = extractPromptSection(run.claudeReviewPrompt, 'Task-specific expectations')

  return `# Claude Review Request: ${escapeMarkdownText(run.task)}

## Date
${formatIsoDate(run.createdAt)}

## Run ID
${run.runId}

## Original task
${escapeMarkdownText(run.task)}

## Task classification
- Task type: ${run.taskType}
- Priority: ${run.priority}
- Output type: ${run.outputType}

## Files to inspect
Ask reviewer to inspect files changed by Codex.

## Review objectives
Review the implementation for:
- correctness
- bugs
- TypeScript issues
- UX mismatch
- security/privacy risk
- regression risk
- overengineering
- missing tests
- whether DAM analyzer logic was touched unnecessarily
- whether claim verification/source ranking logic was touched unnecessarily

## Task-specific expectations
${taskSpecificExpectations || escapeMarkdownText(run.claudeReviewPrompt)}

## Required output
Return:
1. Approval status
2. Blocking issues
3. Non-blocking issues
4. UX problems
5. Security/admin-access concerns
6. Missing tests
7. Recommended fixes
8. Final verdict
`
}

function shortenTaskPreview(task: string, limit = 88) {
  const trimmed = task.trim().replace(/\s+/g, ' ')

  if (trimmed.length <= limit) {
    return trimmed
  }

  return `${trimmed.slice(0, limit - 3)}...`
}

function formatRunTimestamp(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time'
  }

  return parsed.toLocaleString()
}

function CopyButton({
  label,
  value,
  onCopied,
}: {
  label: string
  value: string
  onCopied: (label: string) => void
}) {
  return (
    <button
      type="button"
      style={secondaryButtonStyle}
      onClick={async () => {
        if (!value.trim()) {
          return
        }

        await navigator.clipboard.writeText(value)
        onCopied(label)
      }}
    >
      {label}
    </button>
  )
}

function DownloadButton({
  label,
  filename,
  value,
  onDownloaded,
}: {
  label: string
  filename: string
  value: string
  onDownloaded: (label: string) => void
}) {
  return (
    <button
      type="button"
      style={secondaryButtonStyle}
      onClick={() => {
        if (!value.trim()) {
          return
        }

        const blob = new Blob([value], { type: 'text/markdown;charset=utf-8' })
        const downloadUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = downloadUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(downloadUrl)
        onDownloaded(label)
      }}
    >
      {label}
    </button>
  )
}

function AiHqWorkspace({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [form, setForm] = useState<FormState>(getInitialFormState)
  const [result, setResult] = useState<AiHqRunResponse | null>(null)
  const [currentRun, setCurrentRun] = useState<AiHqStoredRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<AiHqStoredRun[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null)

  const taskCharacterCount = form.task.trim().length
  const hasFinalOutput = Boolean(result?.finalOutput.trim())
  const hasCodexPrompt = Boolean(result?.codexPrompt.trim())
  const hasClaudeReviewPrompt = Boolean(result?.claudeReviewPrompt.trim())
  const hasArtifactData = Boolean(currentRun?.task.trim() && result?.runId)
  const previewMetrics = useMemo(
    () => [
      {
        label: 'Task characters',
        value: String(taskCharacterCount),
        note: 'Very long tasks are trimmed safely on the server.',
      },
      {
        label: 'Task type',
        value: form.taskType === 'auto' ? 'Auto' : form.taskType.replace(/_/g, ' '),
        note: 'Auto uses simple keyword routing in V1.',
      },
      {
        label: 'Output type',
        value: form.outputType.replace(/_/g, ' '),
        note: 'All responses still return full structured output.',
      },
    ],
    [form.outputType, form.taskType, taskCharacterCount]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRecentRuns(readStoredRuns())
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  function saveRunToHistory(nextStoredRun: AiHqStoredRun) {
    setRecentRuns((current) => {
      const deduped = current.filter((run) => run.runId !== nextStoredRun.runId)
      const nextRuns = [nextStoredRun, ...deduped].slice(0, MAX_STORED_RUNS)
      writeStoredRuns(nextRuns)
      return nextRuns
    })
  }

  async function handleSubmit() {
    setActionStatus(null)
    setErrorMessage('')

    const password =
      typeof window === 'undefined' ? '' : window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? ''

    if (!password) {
      setErrorMessage('Admin session is missing. Re-open the admin dashboard and authenticate again.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/ai-hq/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(form),
        cache: 'no-store',
      })

      const payload = (await response.json().catch(() => null)) as
        | AiHqRunResponse
        | { error?: { message?: string } }
        | null

      if (response.status === 401) {
        onUnauthorized()
        return
      }

      if (!response.ok || !payload || !('runId' in payload)) {
        throw new Error(readApiErrorMessage(payload))
      }

      const nextStoredRun = buildStoredRun(form.task, payload)
      saveRunToHistory(nextStoredRun)

      startTransition(() => {
        setResult(payload)
        setCurrentRun(nextStoredRun)
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to run the DAM AI HQ pipeline right now.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setForm(getInitialFormState())
    setResult(null)
    setCurrentRun(null)
    setActionStatus(null)
    setErrorMessage('')
  }

  function reopenStoredRun(run: AiHqStoredRun) {
    setForm((current) => ({
      ...current,
      task: run.task,
      taskType: run.taskType,
      priority: run.priority,
      outputType: run.outputType,
    }))
    setResult({
      runId: run.runId,
      taskType: run.taskType,
      priority: run.priority,
      outputType: run.outputType,
      finalOutput: run.finalOutput,
      codexPrompt: run.codexPrompt,
      claudeReviewPrompt: run.claudeReviewPrompt,
      risks: run.risks,
      metricsToTrack: run.metricsToTrack,
      nextAction: run.nextAction,
    })
    setCurrentRun(run)
    setActionStatus({
      kind: 'history',
      label: 'Previous run restored',
    })
  }

  function deleteStoredRun(runId: string) {
    setRecentRuns((current) => {
      const nextRuns = current.filter((run) => run.runId !== runId)
      writeStoredRuns(nextRuns)
      return nextRuns
    })
    setActionStatus({
      kind: 'history',
      label: 'Run removed from history',
    })
  }

  function clearAllHistory() {
    setRecentRuns([])
    writeStoredRuns([])
    setActionStatus({
      kind: 'history',
      label: 'Run history cleared',
    })
  }

  return (
    <section style={shellGridStyle}>
      <section className="dam-admin-card dam-admin-section">
        <SectionHeading
          id="ai-hq-runner"
          eyebrow="Internal workflow runner"
          title="DAM AI HQ Admin"
          description="Enter a DAM task once and get a deterministic V1 workflow output for planning, implementation, and review."
          badge={<span className="dam-admin-badge">Safe V1</span>}
        />
        <section className="dam-admin-mini-grid">
          {previewMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              note={metric.note}
              emphasize={metric.label === 'Task characters' && taskCharacterCount > 8000}
            />
          ))}
        </section>
        <SummaryList
          title="Task input"
          description="This V1 uses local deterministic routing and prompt templates. It does not call external AI services."
        >
          <div style={shellGridStyle}>
            <label className="dam-admin-auth-form__label" htmlFor="ai-hq-task">
              Task
            </label>
            <textarea
              id="ai-hq-task"
              className="dam-admin-auth-form__input"
              style={textareaStyle}
              value={form.task}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  task: event.target.value,
                }))
              }
              placeholder="Describe the DAM task, goal, or problem you want the AI HQ workflow to structure."
            />
            <p style={helperTextStyle}>
              Empty input and tasks under 5 characters are rejected. Oversized tasks are trimmed safely for V1 processing.
            </p>
            <div style={formGridStyle}>
              <label className="dam-admin-auth-form__label">
                Task type
                <select
                  className="dam-admin-auth-form__input"
                  value={form.taskType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taskType: event.target.value as AiHqTaskType,
                    }))
                  }
                >
                  {TASK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dam-admin-auth-form__label">
                Priority
                <select
                  className="dam-admin-auth-form__input"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as AiHqPriority,
                    }))
                  }
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dam-admin-auth-form__label">
                Output type
                <select
                  className="dam-admin-auth-form__input"
                  value={form.outputType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outputType: event.target.value as AiHqOutputType,
                    }))
                  }
                >
                  {OUTPUT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={buttonRowStyle}>
              <button
                type="button"
                className="dam-admin-action-button dam-admin-action-button--primary"
                onClick={() => {
                  void handleSubmit()
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Running pipeline...' : 'Run pipeline'}
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={resetForm} disabled={isSubmitting}>
                Clear / reset
              </button>
            </div>
            {errorMessage ? <div className="dam-admin-alert">{errorMessage}</div> : null}
            {actionStatus ? (
              <p style={helperTextStyle}>
                {actionStatus.kind === 'copy'
                  ? `${actionStatus.label} copied.`
                  : actionStatus.kind === 'download'
                    ? `${actionStatus.label} downloaded.`
                    : `${actionStatus.label}.`}
              </p>
            ) : null}
          </div>
        </SummaryList>
      </section>

      <section className="dam-admin-card dam-admin-section">
        <SectionHeading
          id="ai-hq-output"
          eyebrow="Structured output"
          title="Final workflow output"
          description="The final panel includes classification, implementation guidance, review guidance, risks, metrics, and next action."
          badge={
            result ? <span className="dam-admin-badge">{result.taskType.replace(/_/g, ' ')}</span> : undefined
          }
        />
        <section className="dam-admin-mini-grid">
          <MetricCard
            label="Resolved priority"
            value={result ? result.priority : 'No run yet'}
            note="Auto priority resolves from simple V1 keyword rules."
          />
          <MetricCard
            label="Output mode"
            value={result ? result.outputType.replace(/_/g, ' ') : 'No run yet'}
            note="Returned with the full deterministic response shape."
          />
          <MetricCard
            label="Run ID"
            value={result ? result.runId.slice(0, 18) : 'No run yet'}
            note="Useful for local debugging or future logging."
          />
        </section>
        <SummaryList
          title="Final output markdown"
          description="This is the primary V1 workflow result. It can be copied into DAM AI HQ documents or used directly."
        >
          <div style={shellGridStyle}>
            {hasFinalOutput && result ? (
              <div style={buttonRowStyle}>
                <CopyButton
                  label="Copy final output"
                  value={result.finalOutput}
                  onCopied={(label) => setActionStatus({ kind: 'copy', label })}
                />
                <DownloadButton
                  label="Download final output .md"
                  filename={buildSafeMarkdownFilename('dam-ai-hq-final-output', result.runId)}
                  value={result.finalOutput}
                  onDownloaded={(label) => setActionStatus({ kind: 'download', label })}
                />
              </div>
            ) : null}
            <pre style={outputPanelStyle}>
              {result?.finalOutput || 'Run the pipeline to generate the final DAM AI HQ output.'}
            </pre>
          </div>
        </SummaryList>
        <div style={formGridStyle}>
          <SummaryList
            title="Codex prompt"
            description="Implementation-ready prompt for the next build step."
          >
            <div style={shellGridStyle}>
              {hasCodexPrompt && result ? (
                <div style={buttonRowStyle}>
                  <CopyButton
                    label="Copy Codex prompt"
                    value={result.codexPrompt}
                    onCopied={(label) => setActionStatus({ kind: 'copy', label })}
                  />
                  {hasArtifactData && currentRun ? (
                    <DownloadButton
                      label="Download Codex task file"
                      filename={buildArtifactFilename(currentRun.task, 'codex-task', result.runId, currentRun.createdAt)}
                      value={buildCodexTaskArtifact(currentRun)}
                      onDownloaded={(label) => setActionStatus({ kind: 'download', label })}
                    />
                  ) : null}
                  <DownloadButton
                    label="Download Codex prompt .md"
                    filename={buildSafeMarkdownFilename('dam-ai-hq-codex-prompt', result.runId)}
                    value={result.codexPrompt}
                    onDownloaded={(label) => setActionStatus({ kind: 'download', label })}
                  />
                </div>
              ) : null}
              <pre style={outputPanelStyle}>
                {result?.codexPrompt || 'No Codex prompt yet.'}
              </pre>
            </div>
          </SummaryList>
          <SummaryList
            title="Claude review prompt"
            description="Review-focused prompt for correctness, regressions, and unnecessary surface area."
          >
            <div style={shellGridStyle}>
              {hasClaudeReviewPrompt && result ? (
                <div style={buttonRowStyle}>
                  <CopyButton
                    label="Copy Claude review prompt"
                    value={result.claudeReviewPrompt}
                    onCopied={(label) => setActionStatus({ kind: 'copy', label })}
                  />
                  {hasArtifactData && currentRun ? (
                    <DownloadButton
                      label="Download Claude review file"
                      filename={buildArtifactFilename(currentRun.task, 'claude-review', result.runId, currentRun.createdAt)}
                      value={buildClaudeReviewArtifact(currentRun)}
                      onDownloaded={(label) => setActionStatus({ kind: 'download', label })}
                    />
                  ) : null}
                  <DownloadButton
                    label="Download Claude review prompt .md"
                    filename={buildSafeMarkdownFilename('dam-ai-hq-claude-review-prompt', result.runId)}
                    value={result.claudeReviewPrompt}
                    onDownloaded={(label) => setActionStatus({ kind: 'download', label })}
                  />
                </div>
              ) : null}
              <pre style={outputPanelStyle}>
                {result?.claudeReviewPrompt || 'No Claude review prompt yet.'}
              </pre>
            </div>
          </SummaryList>
        </div>
      </section>

      <section className="dam-admin-card dam-admin-section">
        <SectionHeading
          id="ai-hq-history"
          eyebrow="Local run history"
          title="Recent runs"
          description="Recent DAM AI HQ runs are stored in browser localStorage so they can be reopened after refresh without rerunning the pipeline."
          badge={
            <span className="dam-admin-badge">
              {recentRuns.length} saved
            </span>
          }
        />
        {recentRuns.length ? (
          <div style={shellGridStyle}>
            <div style={buttonRowStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={clearAllHistory}>
                Clear all history
              </button>
            </div>
            <div style={shellGridStyle}>
              {recentRuns.map((run) => (
                <SummaryList
                  key={run.runId}
                  title={shortenTaskPreview(run.task)}
                  description={`${run.taskType.replace(/_/g, ' ')} • ${run.priority} • ${run.outputType.replace(/_/g, ' ')}`}
                >
                  <div style={shellGridStyle}>
                    <div style={shellGridStyle}>
                      <p style={helperTextStyle}>Created: {formatRunTimestamp(run.createdAt)}</p>
                      <p style={helperTextStyle}>Run ID: {run.runId}</p>
                    </div>
                    <div style={buttonRowStyle}>
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => reopenStoredRun(run)}
                      >
                        Reopen / view
                      </button>
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => deleteStoredRun(run.runId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </SummaryList>
              ))}
            </div>
          </div>
        ) : (
          <SummaryList
            title="No local history yet"
            description="Run the DAM AI HQ pipeline to create saved local entries that survive refresh."
          >
            <p style={helperTextStyle}>
              Saved runs stay in this browser only and can be reopened, copied, and downloaded later.
            </p>
          </SummaryList>
        )}
      </section>
    </section>
  )
}

export default function AdminAiHqPage() {
  return (
    <AdminMetricsGate
      title="DAM AI HQ Admin"
      description="Structured internal workflow runner for DAM tasks, planning, implementation briefs, and review prompts."
      render={(_metrics, gateState) => <AiHqWorkspace onUnauthorized={gateState.logout} />}
    />
  )
}

