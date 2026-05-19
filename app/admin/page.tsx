'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type {
  AdminApiError,
  AdminClaimRecord,
  AdminFunnelMetrics,
  AdminFunnelStage,
  AdminMetricsResponse,
  RiskLabelBreakdown,
  VerdictBreakdown,
} from '@/lib/admin/adminMetricsTypes'

const SESSION_STORAGE_KEY = 'dam_admin_password'

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

const shellStyle = {
  paddingBottom: 48,
} as const

const headerWrapStyle = {
  width: 'min(1180px, calc(100% - 48px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  paddingTop: 26,
} as const

const contentWrapStyle = {
  width: 'min(1180px, calc(100% - 48px))',
  position: 'relative',
  zIndex: 1,
  margin: '0 auto',
  display: 'grid',
  gap: 16,
  paddingTop: 28,
} as const

const cardStyle = {
  border: '1px solid var(--line)',
  background: 'rgba(17, 17, 20, 0.94)',
  boxShadow: 'var(--shadow)',
} as const

const sectionStyle = {
  ...cardStyle,
  padding: 18,
} as const

const buttonBaseStyle = {
  minHeight: 42,
  padding: '0 14px',
  border: '1px solid var(--line)',
  background: '#0c0c0e',
  color: 'var(--text)',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'background-color 180ms ease, border-color 180ms ease, opacity 180ms ease',
} as const

const primaryButtonStyle = {
  ...buttonBaseStyle,
  border: '1px solid var(--red-line)',
  background: 'var(--red)',
  color: '#ffffff',
  boxShadow: '0 0 22px rgba(214, 38, 38, 0.18)',
} as const

const secondaryButtonStyle = {
  ...buttonBaseStyle,
} as const

const inputStyle = {
  width: '100%',
  minHeight: 48,
  border: '1px solid var(--line)',
  background: '#080809',
  color: 'var(--text)',
  padding: '0 14px',
  outline: 'none',
  font: 'inherit',
  fontSize: 14,
} as const

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '6px 8px',
  border: '1px solid var(--line)',
  background: 'rgba(255, 255, 255, 0.045)',
  color: 'var(--text)',
  fontSize: 10,
  fontWeight: 850,
  lineHeight: 1,
  textTransform: 'uppercase' as const,
} as const

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  return parsed.toLocaleString()
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatNullableCount(value: number | null) {
  return value === null ? 'Not tracked yet' : formatCount(value)
}

function formatLatency(value: number) {
  return `${Math.round(value)} ms`
}

function formatRate(value: number | null) {
  if (value === null) {
    return 'Not tracked yet'
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function calculateRate(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null
  }

  return numerator / denominator
}

function getFunnelStageTone(stage: AdminFunnelStage) {
  if (stage.status === 'tracked') {
    return {
      borderColor: 'rgba(255, 255, 255, 0.2)',
      background: 'rgba(255, 255, 255, 0.07)',
      color: '#ffffff',
      label: 'Tracked',
    }
  }

  if (stage.status === 'manual') {
    return {
      borderColor: 'rgba(214, 38, 38, 0.32)',
      background: 'rgba(214, 38, 38, 0.07)',
      color: '#f1b1b1',
      label: 'Manual baseline',
    }
  }

  return {
    borderColor: 'rgba(214, 38, 38, 0.58)',
    background: 'rgba(214, 38, 38, 0.15)',
    color: '#ffb1b1',
    label: 'Not tracked yet',
  }
}

function getConfidenceTone(confidence: number) {
  if (confidence < 60) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.58)',
      background: 'rgba(214, 38, 38, 0.15)',
      color: '#ffb1b1',
    }
  }

  if (confidence < 80) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.32)',
      background: 'rgba(214, 38, 38, 0.07)',
      color: '#e7bcbc',
    }
  }

  return {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.07)',
    color: '#ffffff',
  }
}

function getRiskTone(riskLabel: string) {
  const normalized = riskLabel.toLowerCase()

  if (normalized.includes('high') || normalized.includes('severe')) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.58)',
      background: 'rgba(214, 38, 38, 0.15)',
      color: '#ffb1b1',
    }
  }

  if (normalized.includes('medium')) {
    return {
      borderColor: 'rgba(214, 38, 38, 0.32)',
      background: 'rgba(214, 38, 38, 0.07)',
      color: '#e7bcbc',
    }
  }

  return {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.07)',
    color: '#ffffff',
  }
}

function BreakdownList({
  title,
  items,
  itemLabel,
}: {
  title: string
  items: VerdictBreakdown[] | RiskLabelBreakdown[]
  itemLabel: (item: VerdictBreakdown | RiskLabelBreakdown) => string
}) {
  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Breakdown
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.04 }}>
            {title}
          </h2>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 1,
          border: '1px solid var(--line)',
          background: 'var(--line)',
        }}
      >
        {items.length ? (
          items.map((item) => (
            <div
              key={`${itemLabel(item)}-${item.count}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 13px',
                background: '#0c0c0e',
              }}
            >
              <strong style={{ fontSize: 13, lineHeight: 1.35 }}>{itemLabel(item)}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 800 }}>
                {formatCount(item.count)}
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: 14, background: '#0c0c0e', color: 'var(--muted)', fontSize: 13 }}>
            No records yet.
          </div>
        )}
      </div>
    </section>
  )
}

function ClaimsTable({
  title,
  subtitle,
  claims,
}: {
  title: string
  subtitle: string
  claims: AdminClaimRecord[]
}) {
  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Claim logs
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.04 }}>
            {title}
          </h2>
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>
        <span style={{ ...badgeStyle, color: 'var(--muted)' }}>{formatCount(claims.length)} rows</span>
      </div>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--line)',
          background: '#0c0c0e',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 920,
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              {['Created', 'Verdict', 'Confidence', 'Risk', 'Latency', 'Claim'].map((label) => (
                <th
                  key={label}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--line)',
                    color: 'var(--quiet)',
                    fontSize: 10,
                    fontWeight: 850,
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: 0,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.length ? (
              claims.map((claim, index) => {
                const confidenceTone = getConfidenceTone(claim.confidence)
                const riskTone = getRiskTone(claim.riskLabel)

                return (
                  <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${index}`}>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        color: 'var(--muted)',
                        fontSize: 12,
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDateTime(claim.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        verticalAlign: 'top',
                      }}
                    >
                      <span style={badgeStyle}>{claim.verdict}</span>
                    </td>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        verticalAlign: 'top',
                      }}
                    >
                      <span style={{ ...badgeStyle, ...confidenceTone }}>{claim.confidence}</span>
                    </td>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        verticalAlign: 'top',
                      }}
                    >
                      <span style={{ ...badgeStyle, ...riskTone }}>{claim.riskLabel}</span>
                    </td>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        color: 'var(--text)',
                        fontSize: 12,
                        fontWeight: 800,
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatLatency(claim.latencyMs)}
                    </td>
                    <td
                      style={{
                        padding: '13px 14px',
                        borderBottom: '1px solid var(--line)',
                        color: 'var(--muted)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        minWidth: 280,
                      }}
                    >
                      {claim.claimText || 'No claim text logged.'}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 16,
                    color: 'var(--muted)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  No claims available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FunnelIntelligence({ funnel }: { funnel: AdminFunnelMetrics }) {
  const stages = [
    { key: 'distributed', stage: funnel.distributed },
    { key: 'landingVisitors', stage: funnel.landingVisitors },
    { key: 'appVisitors', stage: funnel.appVisitors },
    { key: 'claimSubmissions', stage: funnel.claimSubmissions },
    { key: 'emailCaptures', stage: funnel.emailCaptures },
  ] as const

  const conversionCards = [
    {
      key: 'reach_to_landing',
      label: 'Reach -> Landing',
      from: funnel.distributed,
      to: funnel.landingVisitors,
    },
    {
      key: 'landing_to_app',
      label: 'Landing -> App',
      from: funnel.landingVisitors,
      to: funnel.appVisitors,
    },
    {
      key: 'app_to_claim',
      label: 'App -> Claim',
      from: funnel.appVisitors,
      to: funnel.claimSubmissions,
    },
    {
      key: 'claim_to_email',
      label: 'Claim -> Email',
      from: funnel.claimSubmissions,
      to: funnel.emailCaptures,
    },
    {
      key: 'reach_to_claim',
      label: 'Reach -> Claim',
      from: funnel.distributed,
      to: funnel.claimSubmissions,
    },
    {
      key: 'reach_to_app',
      label: 'Reach -> App',
      from: funnel.distributed,
      to: funnel.appVisitors,
    },
  ].map((item) => ({
    ...item,
    rate: calculateRate(item.to.count, item.from.count),
    usesManual: item.from.manualBaseline || item.to.manualBaseline,
    isTracked:
      item.from.status !== 'not_tracked' &&
      item.to.status !== 'not_tracked' &&
      item.from.count !== null &&
      item.to.count !== null,
  }))

  const adjacentConversions = conversionCards.filter((item) =>
    ['reach_to_landing', 'landing_to_app', 'app_to_claim', 'claim_to_email'].includes(item.key)
  )
  const adjacentAvailable = adjacentConversions.filter((item) => item.rate !== null)
  const biggestDropOff = adjacentAvailable.length
    ? [...adjacentAvailable].sort((left, right) => (left.rate ?? 0) - (right.rate ?? 0))[0]
    : null
  const strongestStage = adjacentAvailable.length
    ? [...adjacentAvailable].sort((left, right) => (right.rate ?? 0) - (left.rate ?? 0))[0]
    : null
  const appToClaim = conversionCards.find((item) => item.key === 'app_to_claim') ?? null
  const reachToLanding = conversionCards.find((item) => item.key === 'reach_to_landing') ?? null
  const claimToEmail = conversionCards.find((item) => item.key === 'claim_to_email') ?? null
  const appToClaimRate = appToClaim?.rate ?? null
  const reachToLandingRate = reachToLanding?.rate ?? null
  const claimToEmailRate = claimToEmail?.rate ?? null

  const analysisLines: string[] = []

  if (biggestDropOff) {
    analysisLines.push(
      `Biggest drop-off is ${biggestDropOff.label} at ${formatRate(biggestDropOff.rate)}.`
    )
  }

  if (strongestStage) {
    analysisLines.push(
      `Strongest retained stage is ${strongestStage.label} at ${formatRate(strongestStage.rate)}.`
    )
  }

  if (appToClaimRate !== null && appToClaimRate < 0.4) {
    analysisLines.push('Activation friction likely exists between app visit and claim submission.')
  }

  if (reachToLandingRate !== null && reachToLandingRate >= 0.1) {
    analysisLines.push('Distribution hook is working; reach is converting into landing traffic.')
  }

  if (claimToEmailRate === null) {
    analysisLines.push('Identity conversion is not fully tracked yet.')
  }

  if (!analysisLines.length) {
    analysisLines.push('Funnel coverage is partial; more tracked stages will sharpen conversion analysis.')
  }

  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Funnel Intelligence
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.02 }}>
            Funnel Intelligence
          </h2>
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            Raw stage counts on the left, conversion behavior and diagnostic reads on the right.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 8,
          }}
        >
          {stages.map((item, index) => {
            const tone = getFunnelStageTone(item.stage)

            return (
              <div key={item.key} style={{ display: 'grid', gap: 8 }}>
                <article
                  style={{
                    border: '1px solid var(--line)',
                    background: '#0c0c0e',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          display: 'block',
                          color: 'var(--quiet)',
                          fontSize: 10,
                          fontWeight: 850,
                          textTransform: 'uppercase',
                        }}
                      >
                        Stage {index + 1}
                      </span>
                      <h3
                        style={{
                          margin: '10px 0 0',
                          fontSize: 'clamp(18px, 2vw, 24px)',
                          lineHeight: 1.12,
                        }}
                      >
                        {item.stage.label}
                      </h3>
                    </div>
                    <span style={{ ...badgeStyle, ...tone }}>{tone.label}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'end',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 'clamp(26px, 4vw, 38px)',
                        lineHeight: 1,
                        color: item.stage.count === null ? 'var(--muted)' : 'var(--text)',
                      }}
                    >
                      {formatNullableCount(item.stage.count)}
                    </strong>
                    <span style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
                      {item.stage.manualBaseline
                        ? 'manualBaseline: true'
                        : item.stage.status === 'tracked'
                          ? 'Read-only metric'
                          : 'Not tracked yet'}
                    </span>
                  </div>
                </article>
                {index < stages.length - 1 ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      color: 'var(--quiet)',
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >
                    ↓
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
            alignContent: 'start',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {conversionCards.map((item) => (
              <article
                key={item.key}
                style={{
                  border: '1px solid var(--line)',
                  background: '#0c0c0e',
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    color: 'var(--quiet)',
                    fontSize: 10,
                    fontWeight: 850,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.label}
                </span>
                <strong
                  style={{
                    fontSize: 'clamp(22px, 3vw, 32px)',
                    lineHeight: 1,
                    color: item.rate === null ? 'var(--muted)' : 'var(--text)',
                  }}
                >
                  {formatRate(item.rate)}
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      ...badgeStyle,
                      ...(item.isTracked
                        ? {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255, 255, 255, 0.07)',
                            color: '#ffffff',
                          }
                        : item.rate === null
                          ? {
                              borderColor: 'rgba(214, 38, 38, 0.58)',
                              background: 'rgba(214, 38, 38, 0.15)',
                              color: '#ffb1b1',
                            }
                          : {
                              borderColor: 'rgba(214, 38, 38, 0.32)',
                              background: 'rgba(214, 38, 38, 0.07)',
                              color: '#f1b1b1',
                            }),
                    }}
                  >
                    {item.rate === null
                      ? 'Not tracked yet'
                      : item.usesManual
                        ? 'Uses manual baseline'
                        : 'Tracked'}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <article
            style={{
              border: '1px solid var(--line)',
              background: '#0c0c0e',
              padding: 16,
            }}
          >
            <p className="system-label" style={{ marginBottom: 10 }}>
              <span aria-hidden="true" />
              Funnel analysis
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {analysisLines.map((line) => (
                <div
                  key={line}
                  style={{
                    padding: '12px 13px',
                    border: '1px solid var(--line)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--muted)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default function AdminPage() {
  const [state, setState] = useState<DashboardState>(() => {
    if (typeof window !== 'undefined') {
      const savedPassword = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

      if (savedPassword) {
        return {
          status: 'loading',
          password: savedPassword,
          metrics: null,
          errorMessage: '',
        }
      }
    }

    return {
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: '',
    }
  })

  const lowConfidenceCount = state.metrics?.lowConfidenceClaims.length ?? 0
  const slowestClaimLatency = state.metrics?.slowestClaims[0]?.latencyMs ?? 0

  const handleUnauthorized = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setState({
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: 'Wrong password. Try again.',
    })
  }, [])

  const loadMetrics = useCallback(async (
    password: string,
    options?: { persist?: boolean; showLoadingState?: boolean }
  ) => {
    if (options?.showLoadingState !== false) {
      setState((current) => ({
        ...current,
        status: 'loading',
        password,
        errorMessage: '',
      }))
    }

    try {
      const response = await fetch('/api/admin/metrics', {
        method: 'GET',
        headers: {
          'x-admin-password': password,
        },
        cache: 'no-store',
      })

      const payload = (await response.json().catch(() => null)) as
        | AdminMetricsResponse
        | { error?: AdminApiError | null }
        | null

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok || !payload || !('generatedAt' in payload)) {
        throw new Error(payload?.error?.message || 'Admin metrics request failed.')
      }

      if (options?.persist !== false && typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, password)
      }

      setState({
        status: 'ready',
        password,
        metrics: payload,
        errorMessage: '',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load admin metrics right now.'

      setState((current) => ({
        ...current,
        status: current.metrics ? 'ready' : 'error',
        errorMessage: message,
      }))
    }
  }, [handleUnauthorized])

  useEffect(() => {
    if (state.status !== 'loading' || !state.password || state.metrics) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadMetrics(state.password, {
        persist: false,
        showLoadingState: false,
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadMetrics, state.metrics, state.password, state.status])

  const lastUpdatedLabel = state.metrics?.generatedAt
    ? formatDateTime(state.metrics.generatedAt)
    : 'Not loaded'

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!state.password.trim()) {
      setState((current) => ({
        ...current,
        errorMessage: 'Enter the admin password.',
      }))
      return
    }

    void loadMetrics(state.password.trim())
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    setState({
      status: 'locked',
      password: '',
      metrics: null,
      errorMessage: '',
    })
  }

  const showDashboard = state.status === 'ready' || (state.status === 'loading' && Boolean(state.metrics))

  return (
    <main className="dam-shell" style={shellStyle}>
      <div style={headerWrapStyle}>
        <header
          className="dam-header"
          style={{
            height: 'auto',
            minHeight: 72,
            padding: '14px 0',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Link className="dam-mark" href="/" aria-label="Return to DAM home">
              DAM
            </Link>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span style={{ ...badgeStyle, color: 'var(--muted)' }}>Private admin</span>
            {showDashboard ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void loadMetrics(state.password, {
                      persist: false,
                    })
                  }
                  style={secondaryButtonStyle}
                  disabled={state.status === 'loading'}
                >
                  {state.status === 'loading' ? 'Refreshing...' : 'Refresh'}
                </button>
                <button type="button" onClick={handleLogout} style={secondaryButtonStyle}>
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </header>
      </div>

      <div style={contentWrapStyle}>
        {!showDashboard ? (
          <section
            style={{
              ...sectionStyle,
              width: 'min(100%, 520px)',
              margin: '0 auto',
              padding: 22,
            }}
          >
            <p className="system-label" style={{ marginBottom: 12 }}>
              <span aria-hidden="true" />
              Founder dashboard
            </p>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 48px)', lineHeight: 0.98 }}>
              Private DAM analytics
            </h1>
            <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: 15, lineHeight: 1.58 }}>
              Enter the admin password to read live metrics from the existing admin API. This is
              basic protection only.
            </p>
            <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: 12, marginTop: 20 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 800 }}>
                  Admin password
                </span>
                <input
                  type="password"
                  value={state.password}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      password: event.target.value,
                      errorMessage: '',
                    }))
                  }
                  style={inputStyle}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={state.status === 'loading'}
              >
                {state.status === 'loading' ? 'Checking access...' : 'Open dashboard'}
              </button>
            </form>
            {state.errorMessage ? (
              <p className="form-error" style={{ marginTop: 12 }}>
                {state.errorMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {showDashboard ? (
          <>
            <section style={sectionStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'space-between',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <p className="system-label" style={{ marginBottom: 10 }}>
                    <span aria-hidden="true" />
                    Admin telemetry
                  </p>
                  <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4vw, 52px)', lineHeight: 0.96 }}>
                    DAM founder dashboard
                  </h1>
                  <p
                    style={{
                      margin: '12px 0 0',
                      color: 'var(--muted)',
                      fontSize: 14,
                      lineHeight: 1.55,
                    }}
                  >
                    Read-only visibility into claim volume, latency, confidence, and operational
                    risk labels without opening Supabase.
                  </p>
                </div>
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <span style={{ ...badgeStyle, color: 'var(--muted)' }}>
                    Last updated: {lastUpdatedLabel}
                  </span>
                  {state.status === 'loading' ? (
                    <span style={{ ...badgeStyle, borderColor: 'var(--red-line)', color: '#f1b1b1' }}>
                      Refreshing live metrics
                    </span>
                  ) : null}
                </div>
              </div>
              {state.metrics?.error?.code === 'misconfigured' ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: 15,
                    border: '1px solid var(--red-line)',
                    background: 'var(--red-soft)',
                    color: '#ffb1b1',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Admin metrics are not configured. Check Supabase env vars.
                </div>
              ) : null}
              {state.errorMessage ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    border: '1px solid rgba(214, 38, 38, 0.36)',
                    background: 'rgba(214, 38, 38, 0.08)',
                    color: '#f1b1b1',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {state.errorMessage}
                </div>
              ) : null}
            </section>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {[
                {
                  label: 'Total claims',
                  value: formatCount(state.metrics?.totalClaims ?? 0),
                  note: 'All logged analyzer responses',
                },
                {
                  label: 'Claims today',
                  value: formatCount(state.metrics?.claimsToday ?? 0),
                  note: 'Rows created since local midnight',
                },
                {
                  label: 'Average latency',
                  value: formatLatency(state.metrics?.averageLatencyMs ?? 0),
                  note: 'Mean `latency_ms`',
                },
                {
                  label: 'Low-confidence count',
                  value: formatCount(lowConfidenceCount),
                  note: 'Latest 20 rows under 60 confidence',
                },
                {
                  label: 'Slowest claim latency',
                  value: formatLatency(slowestClaimLatency),
                  note: 'Top row from slowest claims',
                },
              ].map((card) => (
                <article
                  key={card.label}
                  style={{
                    ...cardStyle,
                    minHeight: 140,
                    padding: 16,
                    display: 'grid',
                    alignContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--quiet)',
                      fontSize: 10,
                      fontWeight: 850,
                      textTransform: 'uppercase',
                    }}
                  >
                    {card.label}
                  </span>
                  <strong style={{ fontSize: 'clamp(26px, 4vw, 40px)', lineHeight: 1 }}>
                    {card.value}
                  </strong>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
                    {card.note}
                  </p>
                </article>
              ))}
            </section>

            <FunnelIntelligence
              funnel={
                state.metrics?.funnel ?? {
                  distributed: {
                    label: 'Reached / Distributed',
                    count: null,
                    status: 'not_tracked',
                    manualBaseline: false,
                  },
                  landingVisitors: {
                    label: 'Landing visitors',
                    count: null,
                    status: 'not_tracked',
                    manualBaseline: false,
                  },
                  appVisitors: {
                    label: 'App visitors / sessions',
                    count: null,
                    status: 'not_tracked',
                    manualBaseline: false,
                  },
                  claimSubmissions: {
                    label: 'Claim submissions',
                    count: null,
                    status: 'not_tracked',
                    manualBaseline: false,
                  },
                  emailCaptures: {
                    label: 'Email captures / signups',
                    count: null,
                    status: 'not_tracked',
                    manualBaseline: false,
                  },
                }
              }
            />

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              <BreakdownList
                title="Verdict breakdown"
                items={state.metrics?.verdictBreakdown ?? []}
                itemLabel={(item) => (item as VerdictBreakdown).verdict}
              />
              <BreakdownList
                title="Risk label breakdown"
                items={state.metrics?.riskLabelBreakdown ?? []}
                itemLabel={(item) => (item as RiskLabelBreakdown).riskLabel}
              />
            </section>

            <ClaimsTable
              title="Recent claims"
              subtitle="Latest 20 claim log rows from the admin metrics API."
              claims={state.metrics?.recentClaims ?? []}
            />
            <ClaimsTable
              title="Low-confidence claims"
              subtitle="Latest 20 claims where logged confidence is below 60."
              claims={state.metrics?.lowConfidenceClaims ?? []}
            />
            <ClaimsTable
              title="Slowest claims"
              subtitle="Top 10 rows ordered by highest logged latency."
              claims={state.metrics?.slowestClaims ?? []}
            />
          </>
        ) : null}
      </div>
    </main>
  )
}
