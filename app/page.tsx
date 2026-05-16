'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AnalyzerShell from '@/components/analyzer/AnalyzerShell'
import { DAM_SESSION_STORAGE_KEY } from '@/lib/analytics'

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
    const sessionId = window.localStorage.getItem(DAM_SESSION_STORAGE_KEY)?.trim()
    return sessionId || undefined
  } catch {
    return undefined
  }
}

function BetaSignupPortal() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const verificationSection = document.querySelector('.verification-section')

    if (!(verificationSection instanceof HTMLElement)) {
      return
    }

    const verificationSectionElement = verificationSection
    let mountNode: HTMLDivElement | null = null

    function syncPortalTarget() {
      const reportPanel = verificationSectionElement.querySelector('.report-panel')
      const hasReadyResult = Boolean(
        verificationSectionElement.querySelector('.report-card.report-ready')
      )

      if (!reportPanel || !hasReadyResult) {
        setIsVisible(false)
        setPortalTarget(null)

        if (mountNode?.isConnected) {
          mountNode.remove()
        }

        mountNode = null
        return
      }

      if (!mountNode || !mountNode.isConnected) {
        mountNode = document.createElement('div')
        mountNode.setAttribute('data-beta-signup-root', 'true')
        reportPanel.appendChild(mountNode)
      }

      setPortalTarget(mountNode)
      setIsVisible(true)
    }

    syncPortalTarget()

    const observer = new MutationObserver(() => {
      syncPortalTarget()
    })

    observer.observe(verificationSectionElement, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()

      if (mountNode?.isConnected) {
        mountNode.remove()
      }
    }
  }, [])

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
    } catch (requestError) {
      setStatus('idle')
      setError(
        requestError instanceof Error ? requestError.message : 'Signup unavailable.'
      )
    }
  }

  if (!portalTarget || !isVisible) {
    return null
  }

  return createPortal(
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
    </section>,
    portalTarget
  )
}

export default function Page() {
  return (
    <>
      <AnalyzerShell />
      <BetaSignupPortal />
    </>
  )
}
