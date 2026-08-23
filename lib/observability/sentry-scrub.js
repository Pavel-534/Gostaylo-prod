/**
 * Stage 202.0 — edge-safe Sentry event scrub (no node:crypto).
 * Complements lib/logging/pii-scrub.js without importing it (Edge bundle).
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g

/** Query / request keys that must never reach Sentry. */
export const SENTRY_DENY_QUERY_KEYS = new Set([
  'token',
  'code',
  'txid',
  'tx_id',
  'intent_id',
  'intentid',
  'payment_intent',
  'paymentintent',
  'client_secret',
  'clientsecret',
  'wallet',
  'secret',
  'access_token',
  'refresh_token',
  'authorization',
  'password',
  'cookie',
  'session',
  'jwt',
])

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-supabase-auth',
])

/** Money / escrow / payout / crypto webhook paths — drop transactions + scrub URLs. */
export const SENTRY_SENSITIVE_PATH_RE =
  /\/api\/v2\/payments(?:\/|$)|\/escrow(?:\/|$)|\/payout(?:\/|$)|\/crypto(?:\/|$)|crypto[_-]?webhook|webhook.*crypto/i

/**
 * @param {string} input
 */
export function scrubSentryString(input) {
  if (input == null) return input
  let s = String(input)
  s = s.replace(EMAIL_RE, '[REDACTED_EMAIL]')
  s = s.replace(PHONE_RE, '[REDACTED_PHONE]')
  return s
}

/**
 * @param {string} urlRaw
 */
export function scrubSentryUrl(urlRaw) {
  const raw = String(urlRaw || '').trim()
  if (!raw) return raw
  try {
    const base = typeof location !== 'undefined' && location?.origin ? location.origin : 'https://local.invalid'
    const u = new URL(raw, base)
    const keys = [...u.searchParams.keys()]
    for (const key of keys) {
      if (SENTRY_DENY_QUERY_KEYS.has(String(key).toLowerCase())) {
        u.searchParams.set(key, '[REDACTED]')
      }
    }
    return scrubSentryString(u.toString())
  } catch {
    return scrubSentryString(raw)
  }
}

/**
 * @param {unknown} error
 */
export function isSentryChunkOrNavNoise(error) {
  const name = String(error?.name || '')
  const message = String(error?.message || '')
  const digest = String(error?.digest || '')
  const blob = `${name}\n${message}\n${digest}`
  return /ChunkLoadError|Loading chunk|CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|Load failed/i.test(
    blob,
  )
}

/**
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event | null | undefined} event
 * @param {{ originalException?: unknown }} [hint]
 */
export function isSentryEventChunkNoise(event, hint = {}) {
  if (isSentryChunkOrNavNoise(hint.originalException)) return true
  const values = event?.exception?.values
  if (!Array.isArray(values)) return false
  return values.some((v) =>
    /ChunkLoadError|Loading chunk|CSS chunk|dynamically imported module|Importing a module script failed/i.test(
      `${v?.type || ''} ${v?.value || ''}`,
    ),
  )
}

/**
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event | null | undefined} event
 */
export function isSensitiveSentryTransaction(event) {
  const name = String(event?.transaction || event?.request?.url || '')
  return SENTRY_SENSITIVE_PATH_RE.test(name)
}

/**
 * @param {Record<string, string> | undefined} headers
 */
function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(String(k).toLowerCase())) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = scrubSentryString(v)
    }
  }
  return out
}

/**
 * @param {import('@sentry/core').ErrorEvent | import('@sentry/types').Event} event
 */
export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return event

  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubSentryUrl(event.request.url)
    }
    if (event.request.headers) {
      event.request.headers = scrubHeaders(event.request.headers)
    }
    if (event.request.cookies) {
      event.request.cookies = '[REDACTED]'
    }
    if (event.request.data != null) {
      event.request.data = '[REDACTED_BODY]'
    }
    if (event.request.query_string) {
      if (typeof event.request.query_string === 'string') {
        event.request.query_string = scrubSentryUrl(`https://local.invalid/?${event.request.query_string}`).split('?')[1] || '[REDACTED]'
      } else if (typeof event.request.query_string === 'object') {
        /** @type {Record<string, unknown>} */
        const qs = { ...event.request.query_string }
        for (const key of Object.keys(qs)) {
          if (SENTRY_DENY_QUERY_KEYS.has(String(key).toLowerCase())) {
            qs[key] = '[REDACTED]'
          }
        }
        event.request.query_string = qs
      }
    }
  }

  if (event.user) {
    if (event.user.email) event.user.email = '[REDACTED_EMAIL]'
    if (event.user.ip_address) event.user.ip_address = '{{auto}}'
    if (event.user.username) event.user.username = scrubSentryString(String(event.user.username))
  }

  if (typeof event.message === 'string') {
    event.message = scrubSentryString(event.message)
  }

  if (Array.isArray(event.exception?.values)) {
    for (const ex of event.exception.values) {
      if (ex?.value) ex.value = scrubSentryString(ex.value)
    }
  }

  if (event.breadcrumbs && Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb?.message) crumb.message = scrubSentryString(crumb.message)
      if (crumb?.data && typeof crumb.data === 'object') {
        for (const [k, v] of Object.entries(crumb.data)) {
          if (SENTRY_DENY_QUERY_KEYS.has(String(k).toLowerCase()) || SENSITIVE_HEADER_KEYS.has(String(k).toLowerCase())) {
            crumb.data[k] = '[REDACTED]'
          } else if (typeof v === 'string') {
            crumb.data[k] = scrubSentryString(v)
          }
        }
      }
    }
  }

  return event
}
