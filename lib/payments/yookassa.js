/**
 * YooKassa API v3 — isolated transport layer (Stage 130.2).
 * No DB, no escrow/ledger. Fiscal Strategy A: no receipt in createPayment.
 *
 * @see docs/YOOKASSA_BLUEPRINT_130.1.md
 */

import { randomUUID } from 'crypto'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'

const DEFAULT_API_BASE = 'https://api.yookassa.ru/v3'

function basicAuthHeader(shopId, secretKey) {
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`, 'utf8').toString('base64')}`
}

/**
 * Supports env ending with /v3 or /v3/payments (legacy).
 */
export function normalizeYookassaApiBase(raw) {
  const trimmed = String(raw || DEFAULT_API_BASE).trim().replace(/\/$/, '')
  if (trimmed.endsWith('/payments')) {
    return trimmed.slice(0, -'/payments'.length)
  }
  return trimmed || DEFAULT_API_BASE
}

export function getYookassaConfig() {
  const shopId = String(process.env.YOOKASSA_SHOP_ID || '').trim()
  const secretKey = String(process.env.YOOKASSA_SECRET_KEY || '').trim()
  const apiBase = normalizeYookassaApiBase(process.env.YOOKASSA_API_URL)
  return {
    shopId,
    secretKey,
    apiBase,
    configured: Boolean(shopId && secretKey),
  }
}

/** @see Stage 130.2 — SSOT {@link getSiteDisplayName} */
export function getBrandName() {
  return getSiteDisplayName()
}

const YOOKASSA_DESCRIPTION_MAX = 128

/**
 * Payment description for YooKassa dashboard / cardholder (Stage 130.7 KYC).
 * @param {{ brandName?: string, bookingId: string }} params
 */
export function buildYookassaPaymentDescription({ brandName, bookingId }) {
  const brand = String(brandName || getBrandName()).trim() || 'Booking'
  const id = String(bookingId || '').trim()
  const displayId = id.length > 24 ? id.slice(-12) : id
  const text = `${brand}: предоплата бронирования №${displayId}`
  return text.length > YOOKASSA_DESCRIPTION_MAX ? text.slice(0, YOOKASSA_DESCRIPTION_MAX) : text
}

/**
 * Per-booking return URL (ADR-YK-06). Priority: NEXT_PUBLIC_APP_URL via getPublicSiteUrl().
 */
export function buildReturnUrl(bookingId, intentId) {
  const base = getPublicSiteUrl()
  const b = encodeURIComponent(String(bookingId || ''))
  const i = encodeURIComponent(String(intentId || ''))
  return `${base}/checkout/${b}?intent=${i}&payment=return`
}

/**
 * SSOT metadata for webhook + GET verify.
 */
export function buildMetadata({ bookingId, paymentIntentId, amountThb, chargeSource = '' }) {
  return {
    booking_id: String(bookingId),
    bookingId: String(bookingId),
    payment_intent_id: String(paymentIntentId),
    paymentIntentId: String(paymentIntentId),
    amount_thb: String(amountThb),
    charge_source: String(chargeSource || ''),
    financial_model: '3.0',
    split_profile: 'none',
  }
}

function isValidUuidV4(value) {
  const s = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Read stable idempotence key from intent metadata (no DB writes).
 *
 * @param {object | null | undefined} intent
 * @returns {{ key: string, generated: boolean }}
 */
export function resolveIdempotenceKey(intent) {
  const meta = intent?.metadata && typeof intent.metadata === 'object' ? intent.metadata : {}
  const fromRoot = meta.yookassa_idempotence_key
  if (isValidUuidV4(fromRoot)) {
    return { key: String(fromRoot).trim(), generated: false }
  }
  const payload = meta.provider_payload
  const fromPayload =
    payload && typeof payload === 'object' ? payload.yookassa_idempotence_key : null
  if (isValidUuidV4(fromPayload)) {
    return { key: String(fromPayload).trim(), generated: false }
  }
  return { key: randomUUID(), generated: true }
}

/**
 * @param {object} input
 * @param {string} input.bookingId
 * @param {string} input.paymentIntentId
 * @param {number} input.amountRub
 * @param {number} input.amountThb
 * @param {string} input.idempotenceKey
 * @param {string} [input.returnUrl]
 * @param {string} [input.description]
 * @param {Record<string, string>} [input.metadataExtra]
 */
export async function createPayment(input) {
  const { shopId, secretKey, apiBase, configured } = getYookassaConfig()
  if (!configured) {
    return { ok: false, code: 'YOOKASSA_NOT_CONFIGURED' }
  }

  const bookingId = String(input.bookingId || '')
  const paymentIntentId = String(input.paymentIntentId || '')
  const amountRub = Number(input.amountRub)
  const amountThb = Number(input.amountThb)
  const idempotenceKey = String(input.idempotenceKey || '').trim()
  if (!bookingId || !paymentIntentId || !(amountRub > 0) || !idempotenceKey) {
    return { ok: false, code: 'YOOKASSA_INVALID_INPUT' }
  }

  const returnUrl = input.returnUrl || buildReturnUrl(bookingId, paymentIntentId)
  const brandName = getBrandName()
  const description =
    String(input.description || '').trim() ||
    buildYookassaPaymentDescription({
      brandName,
      bookingId,
    })
  const body = {
    amount: { value: amountRub.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: returnUrl },
    description,
    metadata: {
      ...buildMetadata({
        bookingId,
        paymentIntentId,
        amountThb,
        chargeSource: input.metadataExtra?.charge_source || '',
      }),
      ...(input.metadataExtra || {}),
    },
  }

  const res = await fetch(`${apiBase}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(shopId, secretKey),
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      code: 'YOOKASSA_API_ERROR',
      httpStatus: res.status,
      provider: json,
    }
  }

  return {
    ok: true,
    paymentId: json.id || null,
    confirmationUrl: json.confirmation?.confirmation_url ?? null,
    status: json.status || null,
    test: json.test === true,
    raw: json,
  }
}

/**
 * Mandatory webhook verification — fetch payment from YooKassa API.
 * @param {string} paymentId
 */
export async function getPayment(paymentId) {
  const { shopId, secretKey, apiBase, configured } = getYookassaConfig()
  if (!configured) {
    return { ok: false, code: 'YOOKASSA_NOT_CONFIGURED' }
  }
  const id = String(paymentId || '').trim()
  if (!id) {
    return { ok: false, code: 'YOOKASSA_INVALID_PAYMENT_ID' }
  }

  const res = await fetch(`${apiBase}/payments/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Authorization: basicAuthHeader(shopId, secretKey) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      code: 'YOOKASSA_GET_FAILED',
      httpStatus: res.status,
      provider: json,
    }
  }

  return {
    ok: true,
    status: String(json.status || '').toLowerCase(),
    paid: json.paid === true,
    amount: json.amount || null,
    metadata: json.metadata && typeof json.metadata === 'object' ? json.metadata : {},
    test: json.test === true,
    raw: json,
  }
}

/**
 * Format RUB amount for strict string compare (2 decimals).
 * @param {number | string} value
 */
export function formatRubAmountValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n.toFixed(2)
}
