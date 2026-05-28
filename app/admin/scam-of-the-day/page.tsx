'use client'

import { startTransition, useEffect, useState } from 'react'
import { AdminMetricsGate, MetricCard, SectionHeading, SummaryList } from '@/app/admin/_components/AdminShell'
import type { ScamOfTheDayDraft, ScamOfTheDayStatus } from '@/lib/admin/scamOfTheDayTypes'

const gridStyle = {
  display: 'grid',
  gap: 16,
} as const

const metricsGridStyle = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
} as const

const buttonRowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 12,
} as const

const buttonStyle = {
  appearance: 'none',
  border: '1px solid rgba(165, 188, 230, 0.18)',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#f5f7fa',
  fontSize: 13,
  fontWeight: 600,
  padding: '12px 16px',
  cursor: 'pointer',
} as const

const warningStyle = {
  margin: 0,
  color: '#ffd8a8',
  fontSize: 12,
  lineHeight: 1.6,
} as const

const helperStyle = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 12,
  lineHeight: 1.6,
} as const

const bodyStyle = {
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#f5f7fa',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
} as const

type RouteResponse =
  | {
      draft: ScamOfTheDayDraft | null
    }
  | {
      error?: {
        message?: string
      }
    }

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'No data yet' : parsed.toLocaleString()
}

function readApiError(payload: RouteResponse | null, fallback: string) {
  if (payload && 'error' in payload && payload.error?.message) {
    return payload.error.message
  }

  return fallback
}

async function requestDraft(method: 'GET' | 'POST', password: string) {
  const response = await fetch('/api/admin/scam-of-the-day', {
    method,
    headers: {
      'x-admin-password': password,
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as RouteResponse | null

  if (!response.ok || !payload || !('draft' in payload)) {
    throw new Error(readApiError(payload, 'Scam of the Day request failed.'))
  }

  return payload.draft
}

async function updateDraftStatus(slug: string, status: ScamOfTheDayStatus, password: string) {
  const response = await fetch('/api/admin/scam-of-the-day', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': password,
    },
    body: JSON.stringify({ slug, status }),
  })

  const payload = (await response.json().catch(() => null)) as RouteResponse | null

  if (!response.ok || !payload || !('draft' in payload)) {
    throw new Error(readApiError(payload, 'Unable to update approval state.'))
  }

  return payload.draft
}

function ApprovalActions({
  busy,
  onStatusChange,
}: {
  busy: boolean
  onStatusChange: (status: ScamOfTheDayStatus) => void
}) {
  return (
    <div style={buttonRowStyle}>
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => onStatusChange('needs_review')}>
        Mark needs_review
      </button>
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => onStatusChange('approved')}>
        Mark approved
      </button>
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => onStatusChange('rejected')}>
        Mark rejected
      </button>
      <button
        type="button"
        style={buttonStyle}
        disabled={busy}
        onClick={() => onStatusChange('published_manually')}
      >
        Mark published_manually
      </button>
      <button type="button" style={buttonStyle} disabled={busy} onClick={() => onStatusChange('draft')}>
        Reset draft
      </button>
    </div>
  )
}

export default function AdminScamOfTheDayPage() {
  return (
    <AdminMetricsGate
      title="Scam of the Day Draft"
      description="Generate one private daily scam-pattern draft from recent DAM claim logs. This workflow never publishes automatically."
      showPageIntro
      render={(_, adminState) => (
        <ScamOfTheDayDraftPanel password={adminState.password} onUnauthorized={adminState.logout} />
      )}
    />
  )
}

function ScamOfTheDayDraftPanel({
  password,
  onUnauthorized,
}: {
  password: string
  onUnauthorized: () => void
}) {
  const [draft, setDraft] = useState<ScamOfTheDayDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!password) {
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const latestDraft = await requestDraft('GET', password)
          setDraft(latestDraft)
        } catch (loadError) {
          const message =
            loadError instanceof Error ? loadError.message : 'Unable to load latest draft.'

          if (message === 'Invalid admin password.') {
            onUnauthorized()
            return
          }

          setError(message)
        } finally {
          setLoading(false)
        }
      })()
    })
  }, [onUnauthorized, password])

  async function handleGenerate() {
    if (!password) {
      setError('Admin session is missing. Re-open the admin dashboard and authenticate again.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const nextDraft = await requestDraft('POST', password)
      setDraft(nextDraft)
      setNotice('Draft generated and saved with default status `draft`.')
    } catch (generateError) {
      const message =
        generateError instanceof Error ? generateError.message : 'Unable to generate draft.'

      if (message === 'Invalid admin password.') {
        onUnauthorized()
        return
      }

      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRefresh() {
    if (!password) {
      setError('Admin session is missing. Re-open the admin dashboard and authenticate again.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const nextDraft = await requestDraft('GET', password)
      setDraft(nextDraft)
      setNotice(nextDraft ? 'Latest draft reloaded.' : 'No draft has been generated yet.')
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Unable to reload draft.'

      if (message === 'Invalid admin password.') {
        onUnauthorized()
        return
      }

      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!draft) {
      return
    }

    setError('')
    setNotice('')

    try {
      await navigator.clipboard.writeText(draft.body)
      setNotice('Draft copied to clipboard.')
    } catch {
      setError('Unable to copy the draft to clipboard in this browser.')
    }
  }

  async function handleStatusChange(status: ScamOfTheDayStatus) {
    if (!draft || !password) {
      setError('Admin session is missing. Re-open the admin dashboard and authenticate again.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const updatedDraft = await updateDraftStatus(draft.slug, status, password)
      setDraft(updatedDraft)
      setNotice(`Internal state updated to \`${status}\`. Manual publish is still required.`)
    } catch (statusError) {
      const message =
        statusError instanceof Error ? statusError.message : 'Unable to update draft status.'

      if (message === 'Invalid admin password.') {
        onUnauthorized()
        return
      }

      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={gridStyle}>
      <SectionHeading
        id="scam-of-the-day"
        eyebrow="Editorial workflow"
        title="Scam of the Day Draft"
        description="Claims are used as pattern signals only. Public context must come from reputable sources, and publication remains manual."
      />

      <div className="dam-admin-alert dam-admin-alert--warning">
        Manual publish only. Internal approval changes draft state, but nothing here publishes, emails, or posts anywhere.
      </div>

      <div style={buttonRowStyle}>
        <button type="button" style={buttonStyle} disabled={busy} onClick={handleGenerate}>
          {busy ? 'Working...' : "Generate today's draft"}
        </button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={handleRefresh}>
          {busy ? 'Working...' : 'Refresh latest draft'}
        </button>
        <button type="button" style={buttonStyle} disabled={busy || !draft} onClick={handleCopy}>
          Copy draft
        </button>
      </div>

      {!password ? (
        <div className="dam-admin-alert">
          Admin session is missing. Re-open the admin dashboard and authenticate again.
        </div>
      ) : null}
      {error ? <div className="dam-admin-alert">{error}</div> : null}
      {notice ? <div className="dam-admin-alert dam-admin-alert--warning">{notice}</div> : null}

      <div style={metricsGridStyle}>
        <MetricCard
          label="Approval state"
          value={draft?.status ?? 'draft'}
          note="Default is draft. Approval is internal only."
          emphasize={draft?.status === 'rejected'}
        />
        <MetricCard
          label="Candidate pattern"
          value={draft?.patternName ?? (password && loading ? 'Loading...' : 'No draft yet')}
          note="Chosen from recent clustered claim signals."
        />
        <MetricCard
          label="Recent claims used"
          value={draft ? String(draft.claimCount) : '0'}
          note="Recent claim rows that matched the selected pattern."
        />
        <MetricCard
          label="Source check"
          value={draft?.sourceCheckStatus ?? 'incomplete'}
          note={draft?.sourceCheckMessage ?? 'At least two reputable sources are required before publish.'}
          emphasize={draft?.sourceCheckStatus !== 'complete'}
        />
      </div>

      {draft ? (
        <>
          <SummaryList
            title="Draft status"
            description="Internal approval gate only. Publishing must still be handled manually outside this workflow."
          >
            <p style={helperStyle}>Stored at: {draft.storagePath}</p>
            <p style={helperStyle}>Generated: {formatDateTime(draft.generatedAt)}</p>
            <p style={helperStyle}>Updated: {formatDateTime(draft.updatedAt)}</p>
            <p style={warningStyle}>{draft.sourceCheckMessage ?? 'Source check complete enough for internal review.'}</p>
            <ApprovalActions busy={busy} onStatusChange={handleStatusChange} />
          </SummaryList>

          <SummaryList
            title="Source summary"
            description="Official and reputable source support used for context only. Logged claims do not prove the public claim."
          >
            {draft.sources.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {draft.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.name}
                    </a>{' '}
                    - {source.support}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={warningStyle}>Source check incomplete — do not publish yet.</p>
            )}
          </SummaryList>

          <SummaryList
            title="Generated draft"
            description="Exact fixed editorial template, saved as markdown draft content only."
          >
            <pre style={bodyStyle}>{draft.body}</pre>
          </SummaryList>
        </>
      ) : (
        <SummaryList
          title="No draft yet"
          description="Generate today's draft to scan recent claim clusters, redact sensitive details, and save a private markdown draft."
        >
          <p style={helperStyle}>
            The generator only produces draft content and starts every file in the `draft` state.
          </p>
        </SummaryList>
      )}
    </div>
  )
}
