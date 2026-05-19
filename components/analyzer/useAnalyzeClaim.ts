'use client'

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  getDamSessionSignalMetadata,
  getDamTelemetryMetadata,
  getOrCreateDamSessionId,
  sendDamSessionEndEvent,
  sendDamTrackEvent,
} from '@/lib/analytics'
import {
  type Analysis,
  type Indicator,
  type ReportMeta,
  MAX_CLAIM_LENGTH,
  createTraceId,
  fallbackAnalysis,
  formatTimestamp,
  getClaimTraits,
  getEvidenceIndicators,
  getScopeLabel,
  normalizeAnalysis,
} from './analyzerData'

export type AnalyzeClaimViewModel = {
  claim: string
  analysis: Analysis | null
  error: string
  loading: boolean
  loadingStage: number
  reportMeta: ReportMeta | null
  trimmedClaim: string
  remainingCharacters: number
  activeAnalysis: Analysis
  confidence: number
  confidenceLabel: string
  displayScope: string
  indicators: Indicator[]
  claimTraits: string[]
  contradictionCount: number
  resetReportOnEdit: (value: string) => void
  runExampleClaim: (value: string) => Promise<void>
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  trackLandingCtaClick: (buttonLabel: string) => void
}

const processingStageCount = 5

export function useAnalyzeClaim(): AnalyzeClaimViewModel {
  const [claim, setClaim] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null)
  const sessionIdRef = useRef('')
  const sessionStartedAtRef = useRef(0)
  const sessionEndSentRef = useRef(false)

  const trimmedClaim = claim.trim()
  const remainingCharacters = MAX_CLAIM_LENGTH - claim.length
  const activeAnalysis = analysis ?? fallbackAnalysis
  const confidence = analysis ? activeAnalysis.confidence.score : 0
  const confidenceLabel = analysis ? activeAnalysis.confidence.label : 'Awaiting signal'
  const displayScope = getScopeLabel(analysis)
  const indicators = analysis ? getEvidenceIndicators(activeAnalysis) : []
  const claimTraits = analysis ? getClaimTraits(activeAnalysis) : []
  const contradictionCount = analysis ? activeAnalysis.contradictions.items.length : 0

  useEffect(() => {
    if (!loading) {
      return
    }

    const stageTimer = window.setInterval(() => {
      setLoadingStage((stage) => Math.min(stage + 1, processingStageCount - 1))
    }, 620)

    return () => window.clearInterval(stageTimer)
  }, [loading])

  useEffect(() => {
    const sessionId = getOrCreateDamSessionId()
    sessionIdRef.current = sessionId
    sessionStartedAtRef.current = Date.now()
    sessionEndSentRef.current = false

    sendDamTrackEvent({
      event_name: 'app_open_click',
      session_id: sessionId,
      metadata: getDamSessionSignalMetadata(sessionId, {
        page: 'home',
      }),
    })
  }, [])

  useEffect(() => {
    function sendSessionEnd() {
      if (sessionEndSentRef.current) {
        return
      }

      sessionEndSentRef.current = true

      const sessionId = sessionIdRef.current || getOrCreateDamSessionId()
      const startedAt = sessionStartedAtRef.current || Date.now()

      sendDamSessionEndEvent({
        event_name: 'app_session_end',
        session_id: sessionId,
        metadata: getDamSessionSignalMetadata(sessionId, {
          duration_ms: Math.max(Date.now() - startedAt, 0),
          page: 'home',
        }),
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        sendSessionEnd()
      }
    }

    window.addEventListener('beforeunload', sendSessionEnd)
    window.addEventListener('pagehide', sendSessionEnd)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', sendSessionEnd)
      window.removeEventListener('pagehide', sendSessionEnd)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sendSessionEnd()
    }
  }, [])

  function getCurrentSessionId() {
    if (!sessionIdRef.current) {
      sessionIdRef.current = getOrCreateDamSessionId()
    }

    return sessionIdRef.current
  }

  function trackLandingCtaClick(buttonLabel: string) {
    sendDamTrackEvent({
      event_name: 'landing_cta_click',
      session_id: getCurrentSessionId(),
      metadata: getDamTelemetryMetadata({
        button_label: buttonLabel,
        page: 'home',
      }),
    })
  }

  async function checkClaim(nextClaimValue?: string, source: 'real' | 'example' = 'real') {
    if (loading) {
      return
    }

    const claimToAnalyze = (nextClaimValue ?? claim).trim()

    if (!claimToAnalyze) {
      setAnalysis(null)
      setReportMeta(null)
      setError('Claim intake is empty.')
      return
    }

    if (typeof nextClaimValue === 'string') {
      setClaim(nextClaimValue)
    }

    setLoadingStage(0)
    setLoading(true)
    setError('')
    setAnalysis(null)
    setReportMeta({
      traceId: createTraceId(),
      timestamp: formatTimestamp(new Date()),
    })

    try {
      const sessionId = getCurrentSessionId()

      if (source === 'real') {
        sendDamTrackEvent({
          event_name: 'real_claim_submit',
          session_id: sessionId,
          metadata: getDamSessionSignalMetadata(sessionId, {
            page: 'home',
          }),
        })
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: claimToAnalyze, session_id: sessionId }),
      })

      const text = await response.text()

      if (!response.ok) {
        const payload = text ? JSON.parse(text) : null
        throw new Error(
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : 'Analyze request failed'
        )
      }

      setAnalysis(normalizeAnalysis(JSON.parse(text)))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Analysis channel unavailable. Hold distribution and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function resetReportOnEdit(value: string) {
    setClaim(value)
    setError('')
    setAnalysis(null)
    setReportMeta(null)
  }

  async function runExampleClaim(value: string) {
    sendDamTrackEvent({
      event_name: 'example_claim_click',
      session_id: getCurrentSessionId(),
      metadata: getDamTelemetryMetadata({
        page: 'home',
      }),
    })

    await checkClaim(value, 'example')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void checkClaim()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void checkClaim()
    }
  }

  return {
    claim,
    analysis,
    error,
    loading,
    loadingStage,
    reportMeta,
    trimmedClaim,
    remainingCharacters,
    activeAnalysis,
    confidence,
    confidenceLabel,
    displayScope,
    indicators,
    claimTraits,
    contradictionCount,
    resetReportOnEdit,
    runExampleClaim,
    handleSubmit,
    handleKeyDown,
    trackLandingCtaClick,
  }
}
