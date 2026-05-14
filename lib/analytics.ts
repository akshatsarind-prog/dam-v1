export const DAM_SESSION_STORAGE_KEY = 'dam_session_id'

export const DAM_TRACK_EVENT_NAMES = [
  'landing_cta_click',
  'app_open_click',
  'example_claim_click',
  'app_session_end',
] as const

export type DamTrackEventName = (typeof DAM_TRACK_EVENT_NAMES)[number]

const OTP_OR_CODE_PATTERN =
  /\b(?:otp|one[-\s]?time password|verification code|security code|code)\b[\s:=-]{0,10}\d{4,6}\b/gi
const CVV_PATTERN = /\b(?:cvv|cvc|cvv2)\b[\s:=-]{0,10}\d{3,4}\b/gi
const PIN_PATTERN = /\b(?:pin|upi pin|atm pin|passcode)\b[\s:=-]{0,10}\d{4,6}\b/gi
const CARD_NUMBER_PATTERN = /\b(?:\d[ -]*?){12,19}\b/g
const PHONE_NUMBER_PATTERN =
  /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g

type TrackPayload = {
  event_name: DamTrackEventName
  session_id: string
  metadata?: Record<string, unknown>
}

type TrackTransportOptions = {
  keepalive: boolean
  useBeacon: boolean
}

export function getOrCreateDamSessionId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const existingSessionId = window.localStorage.getItem(DAM_SESSION_STORAGE_KEY)
    if (existingSessionId) {
      return existingSessionId
    }

    const nextSessionId = crypto.randomUUID()
    window.localStorage.setItem(DAM_SESSION_STORAGE_KEY, nextSessionId)
    return nextSessionId
  } catch {
    return crypto.randomUUID()
  }
}

export function redactSensitiveClaimText(text: string): string {
  return text
    .replace(OTP_OR_CODE_PATTERN, '[REDACTED]')
    .replace(CVV_PATTERN, '[REDACTED]')
    .replace(PIN_PATTERN, '[REDACTED]')
    .replace(CARD_NUMBER_PATTERN, '[REDACTED]')
    .replace(PHONE_NUMBER_PATTERN, '[REDACTED]')
}

export function sendDamTrackEvent(payload: TrackPayload) {
  sendDamTrackEventWithTransport(payload, {
    keepalive: false,
    useBeacon: false,
  })
}

export function sendDamSessionEndEvent(payload: TrackPayload) {
  sendDamTrackEventWithTransport(payload, {
    keepalive: true,
    useBeacon: true,
  })
}

function sendDamTrackEventWithTransport(payload: TrackPayload, options: TrackTransportOptions) {
  if (typeof window === 'undefined') {
    return
  }

  const body = JSON.stringify({
    event_name: payload.event_name,
    session_id: payload.session_id,
    metadata: payload.metadata ?? {},
  })

  if (options.useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const beaconResult = navigator.sendBeacon(
      '/api/track',
      new Blob([body], { type: 'application/json' })
    )

    if (beaconResult) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[dam] track event sent via beacon', {
          event_name: payload.event_name,
          session_id: payload.session_id,
          metadata: payload.metadata ?? {},
        })
      }

      return
    }
  }

  void fetch('/api/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: options.keepalive,
  }).catch(() => {})

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[dam] track event sent via fetch', {
      event_name: payload.event_name,
      session_id: payload.session_id,
      metadata: payload.metadata ?? {},
    })
  }
}
