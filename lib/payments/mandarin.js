/**
 * Mandarin / CARD_INTL transport (Stage 200.70).
 * Isolated GET verify + idempotency helpers — no escrow/ledger.
 *
 * Env:
 * - MANDARIN_API_KEY
 * - MANDARIN_CARD_INTL_ENDPOINT (create session POST)
 * - MANDARIN_API_BASE (optional GET base; else derived from endpoint)
 * - MANDARIN_PAYMENT_GET_URL (optional template with `{id}`)
 * - MANDARIN_PAYMENT_VERIFY=`0` to skip server GET (emergency rollback; not for prod soft-launch)
 */

/** Stage 200.75 — bound hung PSP calls. */
const MANDARIN_FETCH_TIMEOUT_MS = 10_000

function isFetchAbortError(err) {
  const name = String(err?.name || '')
  return name === 'AbortError' || name === 'TimeoutError'
}

function trimSlash(s) {
  return String(s || '').trim().replace(/\/$/, '')
}

/**
 * Derive API base from create endpoint (`…/payments` → parent).
 * @param {string} endpoint
 */
export function deriveMandarinApiBase(endpoint) {
  const u = trimSlash(endpoint)
  if (!u) return ''
  if (u.endsWith('/payments')) return u.slice(0, -'/payments'.length)
  try {
    const parsed = new URL(u)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length > 0) {
      parts.pop()
      parsed.pathname = parts.length ? `/${parts.join('/')}` : ''
      return trimSlash(parsed.toString())
    }
  } catch {
    /* ignore */
  }
  return u
}

export function getMandarinConfig() {
  const apiKey = String(process.env.MANDARIN_API_KEY || '').trim()
  const createEndpoint = String(process.env.MANDARIN_CARD_INTL_ENDPOINT || '').trim()
  const apiBase =
    trimSlash(process.env.MANDARIN_API_BASE) || deriveMandarinApiBase(createEndpoint)
  return {
    apiKey,
    createEndpoint,
    apiBase,
    configured: Boolean(apiKey && (apiBase || createEndpoint)),
  }
}

/** When `0`, webhook skips Mandarin GET (HMAC + amount only). Default: verify when configured. */
export function isMandarinPaymentVerifyEnabled() {
  return String(process.env.MANDARIN_PAYMENT_VERIFY || '1').trim() !== '0'
}

/**
 * @param {string} paymentId
 * @returns {string | null}
 */
export function resolveMandarinPaymentGetUrl(paymentId) {
  const id = String(paymentId || '').trim()
  if (!id) return null
  const template = String(process.env.MANDARIN_PAYMENT_GET_URL || '').trim()
  if (template) {
    return template.includes('{id}')
      ? template.replace(/\{id\}/g, encodeURIComponent(id))
      : `${trimSlash(template)}/${encodeURIComponent(id)}`
  }
  const { apiBase, createEndpoint } = getMandarinConfig()
  const base = apiBase || deriveMandarinApiBase(createEndpoint)
  if (!base) return null
  return `${base}/payments/${encodeURIComponent(id)}`
}

/**
 * Stable Idempotency-Key for create session (Stage 200.70).
 * Prefer persisted metadata; else deterministic `pi-{intent.id}` (no randomUUID).
 *
 * @param {object | null | undefined} intent
 * @returns {{ key: string, generated: boolean }}
 */
export function resolveMandarinIdempotencyKey(intent) {
  const meta = intent?.metadata && typeof intent.metadata === 'object' ? intent.metadata : {}
  const fromRoot = meta.mandarin_idempotency_key
  if (fromRoot != null && String(fromRoot).trim()) {
    return { key: String(fromRoot).trim(), generated: false }
  }
  const payload = meta.provider_payload
  const fromPayload =
    payload && typeof payload === 'object' ? payload.mandarin_idempotency_key : null
  if (fromPayload != null && String(fromPayload).trim()) {
    return { key: String(fromPayload).trim(), generated: false }
  }
  const intentId = String(intent?.id || '').trim()
  if (!intentId) {
    return { key: `pi-unknown-${Date.now()}`, generated: true }
  }
  return { key: `pi-${intentId}`, generated: true }
}

/**
 * GET payment from Mandarin (or Mandarin-compatible) API.
 * Expected JSON (flexible): status/paid, amount (+ currency), metadata.booking_id / payment_intent_id.
 *
 * @param {string} paymentId
 */
export async function getMandarinPayment(paymentId) {
  const { apiKey, configured } = getMandarinConfig()
  if (!configured || !apiKey) {
    return { ok: false, code: 'MANDARIN_NOT_CONFIGURED' }
  }
  const url = resolveMandarinPaymentGetUrl(paymentId)
  if (!url) {
    return { ok: false, code: 'MANDARIN_GET_URL_UNAVAILABLE' }
  }

  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(MANDARIN_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    if (isFetchAbortError(err)) {
      return { ok: false, code: 'MANDARIN_TIMEOUT', error: err?.message || 'timeout' }
    }
    return { ok: false, code: 'MANDARIN_NETWORK_ERROR', error: err?.message || 'network_error' }
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      code: 'MANDARIN_GET_FAILED',
      httpStatus: res.status,
      provider: json,
    }
  }

  const status = String(
    json.status || json.paymentStatus || json.result?.status || json.state || '',
  ).toLowerCase()
  const paid =
    json.paid === true ||
    json.success === true ||
    status === 'succeeded' ||
    status === 'paid' ||
    status === 'captured'

  let amountValue = null
  let currency = null
  if (json.amount != null && typeof json.amount === 'object') {
    amountValue = json.amount.value != null ? Number(json.amount.value) : null
    currency = json.amount.currency || null
  } else if (json.amount != null) {
    amountValue = Number(json.amount)
    currency = json.currency || json.acquirer_currency || null
  }

  const metadata =
    (json.metadata && typeof json.metadata === 'object' && json.metadata) ||
    (json.meta && typeof json.meta === 'object' && json.meta) ||
    {}

  return {
    ok: true,
    status,
    paid,
    amount: amountValue,
    currency: currency ? String(currency).toUpperCase() : null,
    metadata,
    raw: json,
  }
}
