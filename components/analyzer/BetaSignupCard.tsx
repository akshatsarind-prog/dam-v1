'use client'

import { type FormEvent, useState } from 'react'
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

export default function BetaSignupCard() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [error, setError] = useState('')

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
          source: 'result_signup',
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
        event_name: 'email_capture_success',
        session_id: sessionId,
        metadata: getDamSessionSignalMetadata(sessionId, {
          page: 'home',
          source: 'result_signup',
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
    <section style={betaCardStyle} aria-live="polite">
      <h3 style={betaTitleStyle}>Want beta updates?</h3>
      <p style={betaSubtitleStyle}>
        Leave your email if you want updates or want to help test DAM.
      </p>
      {status === 'success' ? (
        <p style={betaMessageStyle}>You&apos;re on the beta list.</p>
      ) : (
        <form style={betaFormStyle} onSubmit={handleSubmit}>
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
            {status === 'submitting' ? 'Joining...' : 'Join private beta'}
          </button>
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
