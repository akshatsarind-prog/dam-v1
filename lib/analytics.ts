export const DAM_SESSION_STORAGE_KEY = 'dam_session_id'
export const DAM_VISITOR_STORAGE_KEY = 'dam_visitor_id'
const DAM_SESSION_FIRST_SEEN_AT_STORAGE_KEY = 'dam_session_first_seen_at'
const DAM_SESSION_LAST_SEEN_AT_STORAGE_KEY = 'dam_session_last_seen_at'
const DAM_ATTRIBUTION_FIRST_TOUCH_STORAGE_KEY = 'dam_attribution_first_touch'
const DAM_ATTRIBUTION_SESSION_STORAGE_KEY = 'dam_attribution_session'

export const DAM_TRACK_EVENT_NAMES = [
  'page_view',
  'landing_cta_click',
  'app_open_click',
  'example_claim_click',
  'real_claim_submit',
  'app_session_end',
  'campaign_page_view',
  'campaign_scam_checker_cta_click',
  'campaign_whatsapp_checker_cta_click',
  'campaign_govt_checker_cta_click',
  'email_capture_success',
] as const

export type DamTrackEventName = (typeof DAM_TRACK_EVENT_NAMES)[number]

const DAM_ATTRIBUTION_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
] as const

type DamAttributionStoragePayload = Partial<DamAttributionPayload>

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

export type DamTelemetryMetadata = Record<string, unknown> & {
  page?: string
  visitor_id?: string
  session_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  referrer?: string
  landing_path?: string
  current_path?: string
  device_type?: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  is_returning_user?: boolean
  first_seen_at?: string
  last_seen_at?: string
}

export type DamAttributionPayload = {
  visitor_id?: string
  session_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  referrer?: string
  landing_path?: string
  current_path?: string
}

function readStoredDamSessionId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const sessionStorageId = window.sessionStorage.getItem(DAM_SESSION_STORAGE_KEY)?.trim() ?? ''

    if (sessionStorageId) {
      return sessionStorageId
    }

    const legacyLocalStorageId = window.localStorage.getItem(DAM_SESSION_STORAGE_KEY)?.trim() ?? ''

    if (legacyLocalStorageId) {
      window.sessionStorage.setItem(DAM_SESSION_STORAGE_KEY, legacyLocalStorageId)
      window.localStorage.removeItem(DAM_SESSION_STORAGE_KEY)
      return legacyLocalStorageId
    }
  } catch {}

  return ''
}

export function getOrCreateDamSessionId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const existingSessionId = readStoredDamSessionId()

    if (existingSessionId) {
      return existingSessionId
    }

    const nextSessionId = crypto.randomUUID()
    window.sessionStorage.setItem(DAM_SESSION_STORAGE_KEY, nextSessionId)
    return nextSessionId
  } catch {
    return crypto.randomUUID()
  }
}

export function getOrCreateDamVisitorId() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const existingVisitorId = window.localStorage.getItem(DAM_VISITOR_STORAGE_KEY)
    if (existingVisitorId) {
      return existingVisitorId
    }

    const nextVisitorId = crypto.randomUUID()
    window.localStorage.setItem(DAM_VISITOR_STORAGE_KEY, nextVisitorId)
    return nextVisitorId
  } catch {
    return crypto.randomUUID()
  }
}

export function syncDamAttribution(
  options: {
    pathname?: string
    search?: string
    sessionId?: string
  } = {}
): DamAttributionPayload {
  if (typeof window === 'undefined') {
    return normalizeAttributionPayload({
      session_id: options.sessionId,
    })
  }

  const sessionId = options.sessionId || getOrCreateDamSessionId()
  const visitorId = getOrCreateDamVisitorId()
  const pathname = normalizePathname(options.pathname ?? window.location.pathname)
  const search = normalizeSearchString(options.search ?? window.location.search)
  const referrer = readTelemetryReferrer()
  const observedAttribution = buildObservedAttribution(
    new URLSearchParams(search),
    pathname,
    referrer
  )
  const storedFirstTouch = readStoredAttribution(
    window.localStorage,
    DAM_ATTRIBUTION_FIRST_TOUCH_STORAGE_KEY
  )
  const storedSessionAttribution = readStoredAttribution(
    window.sessionStorage,
    DAM_ATTRIBUTION_SESSION_STORAGE_KEY
  )
  const hasExplicitCampaignAttribution = hasObservedCampaignAttribution(observedAttribution)
  const sessionSeedAttribution = hasExplicitCampaignAttribution ? {} : storedSessionAttribution

  const firstTouchAttribution = normalizeAttributionPayload({
    visitor_id: visitorId,
    ...storedFirstTouch,
    ...pickAttributionFields(
      storedFirstTouch,
      observedAttribution,
      pathname
    ),
  })

  const sessionAttribution = normalizeAttributionPayload({
    visitor_id: visitorId,
    session_id: sessionId,
    ...pickAttributionFields(
      sessionSeedAttribution,
      observedAttribution,
      hasExplicitCampaignAttribution
        ? pathname
        : storedSessionAttribution.landing_path ||
        firstTouchAttribution.landing_path ||
        pathname
    ),
    current_path: pathname,
  })

  writeStoredAttribution(
    window.localStorage,
    DAM_ATTRIBUTION_FIRST_TOUCH_STORAGE_KEY,
    {
      visitor_id: firstTouchAttribution.visitor_id,
      utm_source: firstTouchAttribution.utm_source,
      utm_medium: firstTouchAttribution.utm_medium,
      utm_campaign: firstTouchAttribution.utm_campaign,
      utm_content: firstTouchAttribution.utm_content,
      utm_term: firstTouchAttribution.utm_term,
      gclid: firstTouchAttribution.gclid,
      referrer: firstTouchAttribution.referrer,
      landing_path: firstTouchAttribution.landing_path,
    }
  )
  writeStoredAttribution(
    window.sessionStorage,
    DAM_ATTRIBUTION_SESSION_STORAGE_KEY,
    sessionAttribution
  )

  return sessionAttribution
}

export function getDamAttributionPayload(
  options: {
    pathname?: string
    search?: string
    sessionId?: string
  } = {}
): DamAttributionPayload {
  return syncDamAttribution(options)
}

export function getDamTelemetryMetadata(
  overrides: DamTelemetryMetadata = {}
): DamTelemetryMetadata {
  if (typeof window === 'undefined') {
    return overrides
  }

  const sessionIdOverride =
    typeof overrides.session_id === 'string' && overrides.session_id.trim()
      ? overrides.session_id.trim()
      : undefined
  const attribution = syncDamAttribution({
    sessionId: sessionIdOverride,
  })

  return {
    visitor_id: attribution.visitor_id,
    session_id: attribution.session_id,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    gclid: attribution.gclid,
    referrer: attribution.referrer,
    landing_path: attribution.landing_path,
    current_path: attribution.current_path,
    device_type: detectDeviceType(),
    ...overrides,
  }
}

export function getDamSessionSignalMetadata(
  sessionId: string,
  overrides: DamTelemetryMetadata = {}
): DamTelemetryMetadata {
  if (typeof window === 'undefined' || !sessionId) {
    return getDamTelemetryMetadata(overrides)
  }

  syncDamAttribution({ sessionId })

  const nowIso = new Date().toISOString()

  try {
    const storedSessionId = readStoredDamSessionId()
    const existingFirstSeenAt =
      window.localStorage.getItem(DAM_SESSION_FIRST_SEEN_AT_STORAGE_KEY)?.trim() ?? ''
    const existingLastSeenAt =
      window.localStorage.getItem(DAM_SESSION_LAST_SEEN_AT_STORAGE_KEY)?.trim() ?? ''
    const isSameSession = storedSessionId === sessionId
    const firstSeenAt = isSameSession && existingFirstSeenAt ? existingFirstSeenAt : nowIso
    const lastSeenAt = isSameSession && existingLastSeenAt ? existingLastSeenAt : ''
    const isReturningUser = Boolean(isSameSession && (existingLastSeenAt || existingFirstSeenAt))

    window.localStorage.setItem(DAM_SESSION_FIRST_SEEN_AT_STORAGE_KEY, firstSeenAt)
    window.localStorage.setItem(DAM_SESSION_LAST_SEEN_AT_STORAGE_KEY, nowIso)

    return getDamTelemetryMetadata({
      is_returning_user: isReturningUser,
      first_seen_at: firstSeenAt,
      last_seen_at: lastSeenAt || undefined,
      ...overrides,
    })
  } catch {
    return getDamTelemetryMetadata(overrides)
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

function readTelemetryReferrer() {
  if (typeof document === 'undefined') {
    return 'direct'
  }

  const rawReferrer = document.referrer.trim()

  if (!rawReferrer) {
    return 'direct'
  }

  return rawReferrer
}

function detectDeviceType(): DamTelemetryMetadata['device_type'] {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }

  const userAgent = navigator.userAgent.toLowerCase()

  if (/ipad|tablet/.test(userAgent)) {
    return 'tablet'
  }

  if (/mobi|android|iphone|ipod/.test(userAgent)) {
    return 'mobile'
  }

  if (userAgent) {
    return 'desktop'
  }

  return 'unknown'
}

function normalizeSearchString(search: string) {
  if (!search) {
    return ''
  }

  return search.startsWith('?') ? search.slice(1) : search
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalizedValue = value.trim()
  return normalizedValue ? normalizedValue : undefined
}

function normalizePathname(pathname: string | undefined) {
  const normalizedPathname = normalizeOptionalString(pathname)

  if (!normalizedPathname) {
    return '/'
  }

  return normalizedPathname.startsWith('/') ? normalizedPathname : `/${normalizedPathname}`
}

function normalizeAttributionPayload(
  payload: DamAttributionStoragePayload
): DamAttributionPayload {
  return {
    visitor_id: normalizeOptionalString(payload.visitor_id),
    session_id: normalizeOptionalString(payload.session_id),
    utm_source: normalizeOptionalString(payload.utm_source),
    utm_medium: normalizeOptionalString(payload.utm_medium),
    utm_campaign: normalizeOptionalString(payload.utm_campaign),
    utm_content: normalizeOptionalString(payload.utm_content),
    utm_term: normalizeOptionalString(payload.utm_term),
    gclid: normalizeOptionalString(payload.gclid),
    referrer: normalizeOptionalString(payload.referrer),
    landing_path: normalizeOptionalString(payload.landing_path),
    current_path: normalizeOptionalString(payload.current_path),
  }
}

function readStoredAttribution(
  storage: Storage,
  key: string
): DamAttributionStoragePayload {
  try {
    const rawValue = storage.getItem(key)

    if (!rawValue) {
      return {}
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {}
    }

    return parsedValue as DamAttributionStoragePayload
  } catch {
    return {}
  }
}

function writeStoredAttribution(
  storage: Storage,
  key: string,
  payload: DamAttributionStoragePayload
) {
  try {
    storage.setItem(key, JSON.stringify(payload))
  } catch {}
}

function buildObservedAttribution(
  searchParams: URLSearchParams,
  pathname: string,
  referrer: string
) {
  const payload: DamAttributionPayload = {
    referrer: normalizeOptionalString(referrer),
    landing_path: pathname,
    current_path: pathname,
  }

  for (const key of DAM_ATTRIBUTION_QUERY_KEYS) {
    const value = searchParams.get(key)

    if (!value) {
      continue
    }

    payload[key] = value.trim()
  }

  return payload
}

function pickAttributionFields(
  existingPayload: DamAttributionStoragePayload,
  observedPayload: DamAttributionPayload,
  landingPathFallback: string
) {
  const mergedPayload: DamAttributionPayload = {
    utm_source:
      normalizeOptionalString(existingPayload.utm_source) ||
      normalizeOptionalString(observedPayload.utm_source),
    utm_medium:
      normalizeOptionalString(existingPayload.utm_medium) ||
      normalizeOptionalString(observedPayload.utm_medium),
    utm_campaign:
      normalizeOptionalString(existingPayload.utm_campaign) ||
      normalizeOptionalString(observedPayload.utm_campaign),
    utm_content:
      normalizeOptionalString(existingPayload.utm_content) ||
      normalizeOptionalString(observedPayload.utm_content),
    utm_term:
      normalizeOptionalString(existingPayload.utm_term) ||
      normalizeOptionalString(observedPayload.utm_term),
    gclid:
      normalizeOptionalString(existingPayload.gclid) ||
      normalizeOptionalString(observedPayload.gclid),
    referrer:
      normalizeOptionalString(existingPayload.referrer) ||
      normalizeOptionalString(observedPayload.referrer),
    landing_path:
      normalizeOptionalString(existingPayload.landing_path) ||
      normalizeOptionalString(observedPayload.landing_path) ||
      landingPathFallback,
  }

  return mergedPayload
}

function hasObservedCampaignAttribution(payload: DamAttributionPayload) {
  return Boolean(
    payload.utm_source ||
      payload.utm_medium ||
      payload.utm_campaign ||
      payload.utm_content ||
      payload.utm_term ||
      payload.gclid
  )
}
