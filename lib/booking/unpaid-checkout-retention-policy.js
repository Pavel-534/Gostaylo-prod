/**
 * Wave H1 — pure unpaid checkout nudge policy (no PushService / i18n deps).
 */

const DEFAULT_NUDGE_DELAY_MINUTES = 10
const DEFAULT_MIN_REMAINING_MINUTES = 5

/**
 * @returns {number}
 */
export function resolveUnpaidCheckoutNudgeDelayMinutes() {
  const raw = Number(process.env.UNPAID_CHECKOUT_NUDGE_DELAY_MINUTES)
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw)
  return DEFAULT_NUDGE_DELAY_MINUTES
}

/**
 * @returns {number}
 */
export function resolveUnpaidCheckoutNudgeMinRemainingMinutes() {
  const raw = Number(process.env.UNPAID_CHECKOUT_NUDGE_MIN_REMAINING_MINUTES)
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw)
  return DEFAULT_MIN_REMAINING_MINUTES
}

/**
 * @param {string | number | null | undefined} bookingId
 */
export function unpaidCheckoutDeepLink(bookingId) {
  if (bookingId == null || bookingId === '') return '/checkout'
  return `/checkout/${encodeURIComponent(String(bookingId))}`
}

/**
 * @param {{
 *   status?: string | null,
 *   metadata?: object | null,
 *   paymentInitiatedAt?: string | null,
 *   createdAt?: string | null,
 *   expiresAtIso?: string | null,
 *   nowMs?: number,
 *   delayMinutes?: number,
 *   minRemainingMinutes?: number,
 * }} args
 */
export function evaluateUnpaidCheckoutNudgeEligibility(args = {}) {
  const status = String(args.status || '').toUpperCase()
  if (status !== 'AWAITING_PAYMENT') {
    return { ok: false, reason: 'status' }
  }
  const meta = args.metadata && typeof args.metadata === 'object' ? args.metadata : {}
  if (meta.unpaid_checkout_nudge_sent_at) {
    return { ok: false, reason: 'already_sent' }
  }

  const nowMs = Number.isFinite(args.nowMs) ? args.nowMs : Date.now()
  const expiresAtIso = args.expiresAtIso || meta.checkout_hold_expires_at || null
  if (!expiresAtIso) {
    return { ok: false, reason: 'no_hold' }
  }
  const expiryMs = Date.parse(String(expiresAtIso))
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    return { ok: false, reason: 'hold_expired' }
  }

  const minRemaining =
    args.minRemainingMinutes != null
      ? Math.max(1, Math.floor(Number(args.minRemainingMinutes)))
      : resolveUnpaidCheckoutNudgeMinRemainingMinutes()
  if (expiryMs - nowMs < minRemaining * 60_000) {
    return { ok: false, reason: 'hold_almost_over' }
  }

  const delayMinutes =
    args.delayMinutes != null
      ? Math.max(1, Math.floor(Number(args.delayMinutes)))
      : resolveUnpaidCheckoutNudgeDelayMinutes()

  const anchorIso =
    args.paymentInitiatedAt ||
    meta.paymentInitiatedAt ||
    meta.payment_initiated_at ||
    args.createdAt ||
    null
  if (!anchorIso) {
    return { ok: false, reason: 'no_anchor' }
  }
  const anchorMs = Date.parse(String(anchorIso))
  if (!Number.isFinite(anchorMs)) {
    return { ok: false, reason: 'bad_anchor' }
  }
  if (nowMs - anchorMs < delayMinutes * 60_000) {
    return { ok: false, reason: 'too_early' }
  }

  return { ok: true, expiresAtIso: String(expiresAtIso), anchorIso: String(anchorIso) }
}

/**
 * @param {{ bookingId: string, listingTitle?: string }} args
 */
export function buildUnpaidCheckoutPushData({ bookingId, listingTitle = '—' }) {
  const link = unpaidCheckoutDeepLink(bookingId)
  return {
    listing: listingTitle || '—',
    bookingId: String(bookingId || ''),
    link,
    url: link,
    deepLink: link,
  }
}
