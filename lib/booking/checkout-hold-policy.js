/**
 * Stage 175.4 — checkout hold deadline SSOT (shared by cron + payment/initiate).
 */
import {
  isChatInvoiceCheckoutBooking,
  resolveInvoicePaymentExpiresAtIso,
  addMinutesToIso,
} from '@/lib/booking/payment-window-policy.js'

const DEFAULT_TTL_MINUTES = 30

/**
 * @returns {number}
 */
export function resolveCheckoutHoldTtlMinutes() {
  const raw = Number(process.env.CHECKOUT_HOLD_TTL_MINUTES)
  if (Number.isFinite(raw) && raw >= 5) return Math.floor(raw)
  return DEFAULT_TTL_MINUTES
}

/**
 * Anchor for generic checkout hold: latest payment-intent start, else booking created_at.
 * @param {object} booking
 * @param {string|null|undefined} intentStartedAt
 */
export function resolveCheckoutHoldAnchorIso(booking, intentStartedAt) {
  const candidates = [intentStartedAt, booking?.created_at]
    .map((v) => (v != null && String(v).trim() !== '' ? String(v) : null))
    .filter(Boolean)
  if (!candidates.length) return null
  return candidates.sort().at(-1)
}

/**
 * Hard deadline for AWAITING_PAYMENT occupancy.
 * Chat-invoice path: invoice `expires_at` (minute/second precision).
 * @param {object} params
 * @param {object|null} [params.booking]
 * @param {object|null} [params.invoice]
 * @param {string|null} [params.intentStartedAt]
 * @param {string|null} [params.intentExpiresAt]
 * @param {number} [params.defaultTtlMinutes]
 * @returns {string|null}
 */
export function resolveCheckoutHoldExpiresAtIso({
  booking,
  invoice = null,
  intentStartedAt = null,
  intentExpiresAt = null,
  defaultTtlMinutes = resolveCheckoutHoldTtlMinutes(),
}) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const chatInvoiceBooking = isChatInvoiceCheckoutBooking(booking) || Boolean(invoice)

  if (chatInvoiceBooking) {
    const fromInvoice = invoice ? resolveInvoicePaymentExpiresAtIso(invoice) : null
    if (fromInvoice) return fromInvoice

    const cached =
      meta.checkout_hold_expires_at ||
      meta.chat_invoice_expires_at ||
      intentExpiresAt ||
      null
    if (cached) return String(cached)
  }

  const anchorIso = resolveCheckoutHoldAnchorIso(booking, intentStartedAt)
  if (!anchorIso) return null
  return addMinutesToIso(anchorIso, Math.max(5, defaultTtlMinutes))
}

/**
 * @param {object} params
 * @param {object} params.booking
 * @param {object|null} [params.invoice]
 * @param {string|null} [params.intentStartedAt]
 * @param {string|null} [params.intentExpiresAt]
 * @param {number} [params.nowMs]
 * @param {number} [params.defaultTtlMinutes]
 * @returns {boolean}
 */
export function isCheckoutHoldExpired({
  booking,
  invoice = null,
  intentStartedAt = null,
  intentExpiresAt = null,
  nowMs = Date.now(),
  defaultTtlMinutes = resolveCheckoutHoldTtlMinutes(),
}) {
  const expiresIso = resolveCheckoutHoldExpiresAtIso({
    booking,
    invoice,
    intentStartedAt,
    intentExpiresAt,
    defaultTtlMinutes,
  })
  if (!expiresIso) return false
  const expiryMs = Date.parse(String(expiresIso))
  if (!Number.isFinite(expiryMs)) return false
  return expiryMs <= nowMs
}
