'use client'

import { type FormEvent, useEffect, useState } from 'react'
import {
  DAM_SESSION_STORAGE_KEY,
  getDamSessionSignalMetadata,
  getOrCreateDamSessionId,
  sendDamTrackEvent,
} from '@/lib/analytics'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const betaCardStyle = {
  marginTop: 16,
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  boxShadow: 'var(--shadow)',
  padding: 18,
} as const

const betaTitleStyle = {
  margin: 0,
  color: 'var(--text)',
  fontSize: '18px',
  fontWeight: 850,
  lineHeight: 1.2,
} as const

const betaSubtitleStyle = {
  margin: '10px 0 0',
  color: 'var(--muted)',
  fontSize: '14px',
  lineHeight: 1.55,
} as const

const betaPrivacyNoteStyle = {
  margin: '12px 0 0',
  color: 'rgba(235, 235, 240, 0.72)',
  fontSize: '12px',
  lineHeight: 1.5,
} as const

const betaFormStyle = {
  display: 'grid',
  gap: 12,
  marginTop: 16,
} as const

const betaInputStyle = {
  width: '100%',
  minHeight: 44,
  border: '1px solid var(--line)',
  background: '#080809',
  color: 'var(--text)',
  outline: 'none',
  padding: '12px 14px',
  font: 'inherit',
} as const

const betaButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 44,
  border: '1px solid var(--red-line)',
  background: 'var(--red)',
  color: '#ffffff',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 850,
  lineHeight: 1,
  padding: '0 16px',
} as const

const betaMessageStyle = {
  margin: '14px 0 0',
  color: 'var(--text)',
  fontSize: '13px',
  lineHeight: 1.45,
} as const

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getDamSessionId() {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const sessionStorageId = window.sessionStorage.getItem(DAM_SESSION_STORAGE_KEY)?.trim()

    if (sessionStorageId) {
      return sessionStorageId
    }

    const legacyLocalStorageId = window.localStorage.getItem(DAM_SESSION_STORAGE_KEY)?.trim()

    if (legacyLocalStorageId) {
      window.sessionStorage.setItem(DAM_SESSION_STORAGE_KEY, legacyLocalStorageId)
      window.localStorage.removeItem(DAM_SESSION_STORAGE_KEY)
      return legacyLocalStorageId
    }

    return undefined
  } catch {
    return undefined
  }
}

type BetaSignupCardProps = {
  title?: string
  description?: string
  buttonLabel?: string
  privacyNote?: string
  source?: string
  captureVariant?: string
  claimCategory?: string
  riskLabel?: string
  verdict?: string
  sourceResultType?: string
  hideHeading?: boolean
  variant?: 'card' | 'inline'
}

export default function BetaSignupCard({
  title = 'Want beta updates?',
  description = 'Leave your email if you want updates or want to help test DAM.',
  buttonLabel = 'Join private beta',
  privacyNote,
  source = 'result_signup',
  captureVariant,
  claimCategory,
  riskLabel,
  verdict,
  sourceResultType,
  hideHeading = false,
  variant = 'card',
}: BetaSignupCardProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [error, setError] = useState('')
  const formStyle = {
    ...betaFormStyle,
    marginTop: hideHeading ? 14 : betaFormStyle.marginTop,
  }

  useEffect(() => {
    const sessionId = getDamSessionId() ?? getOrCreateDamSessionId()

    if (!sessionId || !captureVariant) {
      return
    }

    sendDamTrackEvent({
      event_name: 'email_capture_shown',
      session_id: sessionId,
      metadata: getDamSessionSignalMetadata(sessionId, {
        page: 'home',
        source,
        email_capture_variant: captureVariant,
        claim_category: claimCategory,
        risk_label: riskLabel,
        verdict,
        source_result_type: sourceResultType,
      }),
    })
  }, [captureVariant, claimCategory, riskLabel, source, sourceResultType, verdict])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setStatus('submitting')
    setError('')

    try {
      const response = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          session_id: getDamSessionId(),
          source,
          capture_variant: captureVariant,
          source_result_type: sourceResultType,
          risk_label: riskLabel,
          claim_category: claimCategory,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : 'Signup unavailable.'
        )
      }

      setEmail(normalizedEmail)
      setStatus('success')

      const sessionId = getDamSessionId() ?? getOrCreateDamSessionId()

      sendDamTrackEvent({
        event_name: 'email_capture_submitted',
        session_id: sessionId,
        metadata: getDamSessionSignalMetadata(sessionId, {
          page: 'home',
          source,
          email_capture_variant: captureVariant,
          claim_category: claimCategory,
          risk_label: riskLabel,
          verdict,
          source_result_type: sourceResultType,
        }),
      })

      sendDamTrackEvent({
        event_name: 'email_capture_success',
        session_id: sessionId,
        metadata: getDamSessionSignalMetadata(sessionId, {
          page: 'home',
          source,
          email_capture_variant: captureVariant,
          claim_category: claimCategory,
          risk_label: riskLabel,
          verdict,
          source_result_type: sourceResultType,
        }),
      })
    } catch (requestError) {
      setStatus('idle')
      setError(
        requestError instanceof Error ? requestError.message : 'Signup unavailable.'
      )
    }
  }

  return (
    <section style={variant === 'card' ? betaCardStyle : undefined} aria-live="polite">
      {!hideHeading ? <h3 style={betaTitleStyle}>{title}</h3> : null}
      {!hideHeading ? <p style={betaSubtitleStyle}>{description}</p> : null}
      {status === 'success' ? (
        <>
          <p style={betaMessageStyle}>You&apos;re on the beta list.</p>
          {privacyNote ? <p style={betaPrivacyNoteStyle}>{privacyNote}</p> : null}
        </>
      ) : (
        <form style={formStyle} onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="dam-beta-email">
            Email address
          </label>
          <input
            id="dam-beta-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (error) {
                setError('')
              }
            }}
            style={betaInputStyle}
            aria-invalid={error ? 'true' : undefined}
          />
          <button type="submit" disabled={status === 'submitting'} style={betaButtonStyle}>
            {status === 'submitting' ? 'Submitting...' : buttonLabel}
          </button>
          {privacyNote ? <p style={betaPrivacyNoteStyle}>{privacyNote}</p> : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  )
}
