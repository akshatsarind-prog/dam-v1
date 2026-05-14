export const DAM_SESSION_STORAGE_KEY = 'dam_session_id'

export const DAM_TRACK_EVENT_NAMES = [
  'landing_cta_click',
  'app_open_click',
  'example_claim_click',
  'app_session_end',
] as const

export type DamTrackEventName = (typeof DAM_TRACK_EVENT_NAMES)[number]

const URL_WITH_EMBEDDED_CREDENTIALS_PATTERN = /\bhttps?:\/\/[^/\s:@]+:[^/\s@]+@[^\s]+/gi
const URL_WITH_SENSITIVE_TOKEN_PATTERN =
  /\bhttps?:\/\/[^\s]*[?&#](?:access_token|refresh_token|token|id_token|api[_-]?key|apikey|auth(?:orization)?|signature|sig|secret|password|pass|pwd|session(?:id)?|otp)=[^&\s#]+[^\s]*/gi
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PASSWORD_PATTERN = /\b(password|passwd|pwd)\b(\s*(?:is|=|:)\s*)([^\s,;]+)/gi
const OTP_PATTERN =
  /\b(otp|one[-\s]?time password|verification code|security code|authentication code)\b(\s*(?:is|=|:|-)?\s*)(\d{4,8})\b/gi
const CVV_PATTERN = /\b(cvv|cvc|cvv2)\b(\s*(?:is|=|:|-)?\s*)(\d{3,4})\b/gi
const PIN_PATTERN = /\b(upi pin|atm pin|passcode|pin)\b(\s*(?:is|=|:|-)?\s*)(\d{4,6})\b/gi
const CARD_NUMBER_PATTERN = /\b(?:\d[ -]?){12,18}\d\b/g
const AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g
const PHONE_NUMBER_PATTERN =
  /(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{10})(?!\d)/g
const LONG_NUMERIC_IDENTIFIER_PATTERN = /(?<!\w)\d{8,}(?!\w)/g

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
  const redactedText = text
    .replace(URL_WITH_EMBEDDED_CREDENTIALS_PATTERN, '[REDACTED_URL]')
    .replace(URL_WITH_SENSITIVE_TOKEN_PATTERN, '[REDACTED_URL]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PASSWORD_PATTERN, '$1$2[REDACTED_PASSWORD]')
    .replace(OTP_PATTERN, '$1$2[REDACTED_OTP]')
    .replace(CVV_PATTERN, '$1$2[REDACTED_CVV]')
    .replace(PIN_PATTERN, '$1$2[REDACTED_PIN]')
    .replace(CARD_NUMBER_PATTERN, '[REDACTED_CARD]')
    .replace(AADHAAR_PATTERN, '[REDACTED_AADHAAR]')
    .replace(PHONE_NUMBER_PATTERN, '[REDACTED_PHONE]')
    .replace(LONG_NUMERIC_IDENTIFIER_PATTERN, '[REDACTED_ID]')

  const cleanedText = redactedText.replace(/\s+/g, ' ').trim()
  return cleanedText || '[REDACTED_EMPTY]'
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
}
