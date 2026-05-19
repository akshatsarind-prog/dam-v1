'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type {
  AdminApiError,
  AdminCategoryIntelligence,
  AdminClaimCategory,
  AdminClaimRecord,
  AdminFunnelMetrics,
  AdminFunnelStage,
  AdminMetricsResponse,
  AdminRetentionMetrics,
  RiskLabelBreakdown,
  VerdictBreakdown,
} from '@/lib/admin/adminMetricsTypes'

const SESSION_STORAGE_KEY = 'dam_admin_password'

type AdminCategorizedClaimRecord = AdminCategoryIntelligence['topCategoryClaims'][number]

type DashboardStatus = 'locked' | 'loading' | 'ready' | 'error'

type DashboardState = {
  status: DashboardStatus
  password: string
  metrics: AdminMetricsResponse | null
  errorMessage: string
}

const emptyFunnel: AdminFunnelMetrics = {
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

const emptyRetention: AdminRetentionMetrics = {
  uniqueSessions: 0,
  returningSessions: 0,
  returnRate: null,
  multiDayUsers: 0,
  averageClaimsPerUser: 0,
  averageTimeBetweenSessionsMs: null,
  exampleToRealConversionRate: null,
  topReferrers: [],
}

const emptyCategoryIntelligence: AdminCategoryIntelligence = {
  categoryBreakdown: [],
  mostTestedCategory: null,
  highestLatencyCategory: null,
  lowestConfidenceCategory: null,
  emailConversionByCategory: {
    available: false,
    message: 'Not linkable yet.',
  },
  topCategoryClaims: [],
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

function formatDurationCompact(value: number | null) {
  if (value === null) {
    return 'Not enough repeat data'
  }

  const totalMinutes = Math.round(value / 60000)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function formatRate(value: number | null) {
  if (value === null) {
    return 'Not tracked yet'
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function formatCategoryLabel(category: AdminClaimCategory) {
  switch (category) {
    case 'social_rumor':
      return 'Social Rumor'
    default:
      return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  }
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

function buildCategoryAnalysis(categoryIntelligence: AdminCategoryIntelligence) {
  const lines: string[] = []
  const mostTested = categoryIntelligence.mostTestedCategory
  const highestLatency = categoryIntelligence.highestLatencyCategory
  const lowestConfidence = categoryIntelligence.lowestConfidenceCategory

  if (mostTested) {
    lines.push(
      `Users are mostly testing ${formatCategoryLabel(mostTested.category)} claims (${formatRate(mostTested.percentage)} of categorized usage).`
    )
  }

  if (highestLatency) {
    lines.push(
      `${formatCategoryLabel(highestLatency.category)} is operationally slowest at ${formatLatency(highestLatency.averageLatencyMs)} average latency.`
    )
  }

  if (lowestConfidence) {
    lines.push(
      `${formatCategoryLabel(lowestConfidence.category)} has the weakest average confidence at ${lowestConfidence.averageConfidence.toFixed(1)}.`
    )
  }

  if (!categoryIntelligence.emailConversionByCategory.available) {
    lines.push('Email conversion by category is not linkable yet.')
  }

  const dominantCategory = mostTested?.category ?? null

  if (dominantCategory === 'scam' || dominantCategory === 'crypto') {
    lines.push('Current usage pattern looks scam-heavy rather than general exploration.')
  } else if (
    dominantCategory &&
    ['health', 'political', 'government', 'statistics', 'social_rumor'].includes(dominantCategory)
  ) {
    lines.push('Current usage pattern looks misinformation-heavy across public narrative claims.')
  } else if (dominantCategory) {
    lines.push('Current usage pattern still looks general-curiosity-heavy.')
  }

  return lines.length ? lines : ['No categorized claims are available yet.']
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
                        maxWidth: 420,
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

function CategorizedClaimsTable({ claims }: { claims: AdminCategorizedClaimRecord[] }) {
  return (
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
          minWidth: 980,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            {['Created', 'Category', 'Verdict', 'Confidence', 'Risk', 'Latency', 'Claim'].map((label) => (
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
                <tr key={`${claim.createdAt ?? 'unknown'}-${claim.claimText}-${claim.category}-${index}`}>
                  <td
                    style={{
                      padding: '13px 14px',
                      borderBottom: '1px solid var(--line)',
                      color: 'var(--muted)',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDateTime(claim.createdAt)}
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)' }}>
                    <span style={badgeStyle}>{formatCategoryLabel(claim.category)}</span>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)' }}>
                    <span style={badgeStyle}>{claim.verdict}</span>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ ...badgeStyle, ...confidenceTone }}>{claim.confidence}</span>
                  </td>
                  <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ ...badgeStyle, ...riskTone }}>{claim.riskLabel}</span>
                  </td>
                  <td
                    style={{
                      padding: '13px 14px',
                      borderBottom: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 800,
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
                      maxWidth: 420,
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
                colSpan={7}
                style={{
                  padding: 16,
                  color: 'var(--muted)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                No categorized claims yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
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
  const appToClaimRate = conversionCards.find((item) => item.key === 'app_to_claim')?.rate ?? null
  const reachToLandingRate =
    conversionCards.find((item) => item.key === 'reach_to_landing')?.rate ?? null
  const claimToEmailRate =
    conversionCards.find((item) => item.key === 'claim_to_email')?.rate ?? null

  const analysisLines: string[] = []

  if (biggestDropOff) {
    analysisLines.push(`Biggest drop-off is ${biggestDropOff.label} at ${formatRate(biggestDropOff.rate)}.`)
  }

  if (strongestStage) {
    analysisLines.push(`Strongest retained stage is ${strongestStage.label} at ${formatRate(strongestStage.rate)}.`)
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
            Read-only stage counts and conversion signals from the existing admin metrics API.
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
        <div style={{ display: 'grid', gap: 8 }}>
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
                  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--quiet)', fontSize: 18 }}>
                    ↓
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
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
                  ...cardStyle,
                  minHeight: 122,
                  padding: 14,
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
                  {item.label}
                </span>
                <strong
                  style={{
                    fontSize: 'clamp(22px, 3vw, 30px)',
                    lineHeight: 1.02,
                    color: item.isTracked ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  {formatRate(item.rate)}
                </strong>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
                  {item.isTracked ? 'Derived from tracked or manual stage counts.' : 'Not tracked yet.'}
                </p>
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
              Automatic analysis
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

function RetentionIntelligence({ retention }: { retention: AdminRetentionMetrics }) {
  const exampleToRealRate = retention.exampleToRealConversionRate
  const repeatUsageExists = retention.returningSessions > 0
  const onboardingConverts = exampleToRealRate !== null && exampleToRealRate >= 0.2
  const habitFormationLabel =
    retention.returnRate !== null && retention.returnRate >= 0.25 && retention.multiDayUsers > 0
      ? 'Early habit formation is emerging.'
      : retention.returningSessions > 0 || retention.multiDayUsers > 0
        ? 'Some repeat usage exists, but habit formation is still early.'
        : 'Usage still looks curiosity-driven.'

  const analysisLines = [
    repeatUsageExists
      ? `Repeat usage exists: ${formatCount(retention.returningSessions)} returning sessions have already come back.`
      : 'Repeat usage has not clearly emerged yet.',
    exampleToRealRate === null
      ? 'Onboarding to real usage is not measurable yet because example-to-real conversion data is still sparse.'
      : onboardingConverts
        ? 'Onboarding is converting into real behavior; example users are moving into live claim checks.'
        : 'Onboarding is not yet converting strongly into real behavior.',
    habitFormationLabel,
  ]

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
            Retention Intelligence
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.02 }}>
            Retention Intelligence
          </h2>
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            Anonymous repeat-usage, trust depth, onboarding quality, and early habit signals.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        {[
          {
            label: 'Unique sessions',
            value: formatCount(retention.uniqueSessions),
            note: 'Anonymous session ids observed',
          },
          {
            label: 'Returning sessions',
            value: formatCount(retention.returningSessions),
            note: 'Same session id seen again after 30+ minutes',
          },
          {
            label: 'Return rate',
            value: formatRate(retention.returnRate),
            note: 'Returning sessions / unique sessions',
          },
          {
            label: 'Multi-day users',
            value: formatCount(retention.multiDayUsers),
            note: 'Active on different UTC dates',
          },
          {
            label: 'Avg claims per user',
            value: retention.averageClaimsPerUser.toFixed(retention.averageClaimsPerUser >= 10 ? 1 : 2),
            note: 'Total claims / unique sessions',
          },
          {
            label: 'Avg time between sessions',
            value: formatDurationCompact(retention.averageTimeBetweenSessionsMs),
            note: 'Average gap for returning visits',
          },
          {
            label: 'Example -> real conversion',
            value: formatRate(retention.exampleToRealConversionRate),
            note: 'Sessions with example usage that later submit real claims',
          },
        ].map((card) => (
          <article
            key={card.label}
            style={{
              ...cardStyle,
              minHeight: 138,
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
            <strong
              style={{
                fontSize: 'clamp(24px, 3.2vw, 34px)',
                lineHeight: 1.02,
                color:
                  card.value === 'Not tracked yet' || card.value === 'Not enough repeat data'
                    ? 'var(--muted)'
                    : 'var(--text)',
              }}
            >
              {card.value}
            </strong>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
              {card.note}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        <article
          style={{
            border: '1px solid var(--line)',
            background: '#0c0c0e',
            padding: 16,
          }}
        >
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Automatic analysis
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

        <article
          style={{
            border: '1px solid var(--line)',
            background: '#0c0c0e',
            padding: 16,
          }}
        >
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Top referrers
          </p>
          <div
            style={{
              display: 'grid',
              gap: 1,
              border: '1px solid var(--line)',
              background: 'var(--line)',
            }}
          >
            {retention.topReferrers.length ? (
              retention.topReferrers.map((item) => (
                <div
                  key={item.referrer}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 13px',
                    background: '#0c0c0e',
                  }}
                >
                  <strong
                    style={{
                      color: 'var(--text)',
                      fontSize: 13,
                      lineHeight: 1.35,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.referrer}
                  </strong>
                  <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 800 }}>
                    {formatCount(item.sessionCount)}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: 14,
                  background: '#0c0c0e',
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                Referrer telemetry has not accumulated yet.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

function CategoryIntelligenceSection({
  categoryIntelligence,
}: {
  categoryIntelligence: AdminCategoryIntelligence
}) {
  const analysisLines = buildCategoryAnalysis(categoryIntelligence)
  const topCategoryClaims = categoryIntelligence.topCategoryClaims.slice(0, 10)

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
            Category Intelligence
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.02 }}>
            Category Intelligence
          </h2>
          <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            Derived category patterns from existing claim logs only. This does not affect DAM analysis.
          </p>
        </div>
        <span
          style={{
            ...badgeStyle,
            borderColor: 'rgba(214, 38, 38, 0.58)',
            background: 'rgba(214, 38, 38, 0.16)',
            color: '#ffb1b1',
          }}
        >
          New
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: 'Most tested category',
            value: categoryIntelligence.mostTestedCategory
              ? formatCategoryLabel(categoryIntelligence.mostTestedCategory.category)
              : 'No data',
            note: categoryIntelligence.mostTestedCategory
              ? `${formatCount(categoryIntelligence.mostTestedCategory.count)} claims (${formatRate(categoryIntelligence.mostTestedCategory.percentage)})`
              : 'No categorized claims yet.',
          },
          {
            label: 'Highest latency category',
            value: categoryIntelligence.highestLatencyCategory
              ? formatCategoryLabel(categoryIntelligence.highestLatencyCategory.category)
              : 'No data',
            note: categoryIntelligence.highestLatencyCategory
              ? `${formatLatency(categoryIntelligence.highestLatencyCategory.averageLatencyMs)} average latency`
              : 'No categorized claims yet.',
          },
          {
            label: 'Lowest confidence category',
            value: categoryIntelligence.lowestConfidenceCategory
              ? formatCategoryLabel(categoryIntelligence.lowestConfidenceCategory.category)
              : 'No data',
            note: categoryIntelligence.lowestConfidenceCategory
              ? `${categoryIntelligence.lowestConfidenceCategory.averageConfidence.toFixed(1)} average confidence`
              : 'No categorized claims yet.',
          },
          {
            label: 'Email conversion by category',
            value: categoryIntelligence.emailConversionByCategory.available ? 'Available' : 'Not linkable yet',
            note: categoryIntelligence.emailConversionByCategory.message,
          },
        ].map((card) => (
          <article
            key={card.label}
            style={{
              ...cardStyle,
              minHeight: 138,
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
            <strong
              style={{
                fontSize: 'clamp(24px, 3.2vw, 34px)',
                lineHeight: 1.02,
                color: card.value === 'No data' || card.value === 'Not linkable yet' ? 'var(--muted)' : 'var(--text)',
              }}
            >
              {card.value}
            </strong>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
              {card.note}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <article
          style={{
            border: '1px solid var(--line)',
            background: '#0c0c0e',
            padding: 16,
          }}
        >
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Category breakdown
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', background: '#0a0a0c' }}>
            <table
              style={{
                width: '100%',
                minWidth: 620,
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  {['Category', 'Claims', '%', 'Avg latency', 'Avg confidence'].map((label) => (
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
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryIntelligence.categoryBreakdown.length ? (
                  categoryIntelligence.categoryBreakdown.map((row) => (
                    <tr key={row.category}>
                      <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)' }}>
                        <span style={badgeStyle}>{formatCategoryLabel(row.category)}</span>
                      </td>
                      <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                        {formatCount(row.count)}
                      </td>
                      <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                        {formatRate(row.percentage)}
                      </td>
                      <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                        {formatLatency(row.averageLatencyMs)}
                      </td>
                      <td style={{ padding: '13px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                        {row.averageConfidence.toFixed(1)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: 16,
                        color: 'var(--muted)',
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      No categorized claims yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article
          style={{
            border: '1px solid var(--line)',
            background: '#0c0c0e',
            padding: 16,
          }}
        >
          <p className="system-label" style={{ marginBottom: 10 }}>
            <span aria-hidden="true" />
            Operational read
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

      <div>
        <p className="system-label" style={{ marginBottom: 10 }}>
          <span aria-hidden="true" />
          Recent categorized claims
        </p>
        <CategorizedClaimsTable claims={topCategoryClaims} />
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

  const loadMetrics = useCallback(
    async (
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
    },
    [handleUnauthorized]
  )

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

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
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

  const showDashboard =
    state.status === 'ready' || (state.status === 'loading' && Boolean(state.metrics))

  const metrics = state.metrics
  const funnel = metrics?.funnel ?? emptyFunnel
  const retention = metrics?.retention ?? emptyRetention
  const categoryIntelligence = metrics?.categoryIntelligence ?? emptyCategoryIntelligence

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
              <button type="submit" style={primaryButtonStyle} disabled={state.status === 'loading'}>
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
                    Read-only visibility into claim volume, latency, confidence, category patterns,
                    funnel health, and retention signals without opening Supabase.
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
              {metrics?.error?.code === 'misconfigured' ? (
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
                  value: formatCount(metrics?.totalClaims ?? 0),
                  note: 'All logged analyzer responses',
                },
                {
                  label: 'Claims today',
                  value: formatCount(metrics?.claimsToday ?? 0),
                  note: 'Rows created since local midnight',
                },
                {
                  label: 'Average latency',
                  value: formatLatency(metrics?.averageLatencyMs ?? 0),
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

            <FunnelIntelligence funnel={funnel} />
            <RetentionIntelligence retention={retention} />
            <CategoryIntelligenceSection categoryIntelligence={categoryIntelligence} />

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              <BreakdownList
                title="Verdict breakdown"
                items={metrics?.verdictBreakdown ?? []}
                itemLabel={(item) => (item as VerdictBreakdown).verdict}
              />
              <BreakdownList
                title="Risk label breakdown"
                items={metrics?.riskLabelBreakdown ?? []}
                itemLabel={(item) => (item as RiskLabelBreakdown).riskLabel}
              />
            </section>

            <ClaimsTable
              title="Recent claims"
              subtitle="Latest 20 claim log rows from the admin metrics API."
              claims={metrics?.recentClaims ?? []}
            />
            <ClaimsTable
              title="Low-confidence claims"
              subtitle="Latest 20 claims where logged confidence is below 60."
              claims={metrics?.lowConfidenceClaims ?? []}
            />
            <ClaimsTable
              title="Slowest claims"
              subtitle="Top 10 rows ordered by highest logged latency."
              claims={metrics?.slowestClaims ?? []}
            />
          </>
        ) : null}
      </div>
    </main>
  )
}
