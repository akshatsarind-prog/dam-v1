import { isValidAdminPassword } from '@/lib/admin/adminAuth'
import { runAiHqPipeline } from '@/lib/ai-hq/runAiHqPipeline'
import type { AiHqRunRequest } from '@/lib/ai-hq/types'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

const MIN_TASK_LENGTH = 5
const MAX_TASK_LENGTH = 12_000

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function isTaskType(value: unknown): value is AiHqRunRequest['taskType'] {
  return (
    typeof value === 'string' &&
    [
      'auto',
      'feature_build',
      'bug_fix',
      'failure_analysis',
      'research',
      'distribution',
      'analytics',
      'yc_application',
      'strategy',
      'content',
      'admin_dashboard',
    ].includes(value)
  )
}

function isPriority(value: unknown): value is AiHqRunRequest['priority'] {
  return typeof value === 'string' && ['auto', 'low', 'medium', 'high', 'critical'].includes(value)
}

function isOutputType(value: unknown): value is AiHqRunRequest['outputType'] {
  return (
    typeof value === 'string' &&
    [
      'full_workflow',
      'codex_prompt',
      'claude_review_prompt',
      'decision_memo',
      'implementation_plan',
      'research_report',
    ].includes(value)
  )
}

export async function POST(request: Request) {
  if (!isValidAdminPassword(request)) {
    return jsonResponse(
      {
        error: {
          code: 'unauthorized',
          message: 'Invalid admin password.',
        },
      },
      401
    )
  }

  try {
    const body = (await request.json().catch(() => null)) as Partial<AiHqRunRequest> | null

    if (!body || typeof body.task !== 'string' || !isTaskType(body.taskType) || !isPriority(body.priority) || !isOutputType(body.outputType)) {
      return jsonResponse(
        {
          error: {
            code: 'invalid_request',
            message: 'Task, taskType, priority, and outputType are required and must be valid strings.',
          },
        },
        400
      )
    }

    const normalizedTask = body.task.replace(/\s+/g, ' ').trim()

    if (!normalizedTask) {
      return jsonResponse(
        {
          error: {
            code: 'invalid_task',
            message: 'Task cannot be empty.',
          },
        },
        400
      )
    }

    if (normalizedTask.length < MIN_TASK_LENGTH) {
      return jsonResponse(
        {
          error: {
            code: 'invalid_task',
            message: `Task must be at least ${MIN_TASK_LENGTH} characters long.`,
          },
        },
        400
      )
    }

    const wasTrimmed = normalizedTask.length > MAX_TASK_LENGTH
    const safeTask = wasTrimmed ? normalizedTask.slice(0, MAX_TASK_LENGTH) : normalizedTask

    const result = runAiHqPipeline({
      task: safeTask,
      taskType: body.taskType,
      priority: body.priority,
      outputType: body.outputType,
      wasTrimmed,
    })

    return jsonResponse(result)
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'DAM AI HQ pipeline is temporarily unavailable.',
        },
      },
      500
    )
  }
}
