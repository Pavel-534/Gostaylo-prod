/**
 * AUDIT_03 W3.11 — lock THB/USDT rate at crypto initiate; prefer lock on confirm.
 */

/**
 * @param {object | null | undefined} booking
 * @param {object | null | undefined} [intent]
 * @returns {number | null}
 */
export function readLockedUsdtRateThb(booking, intent = null) {
  const bMeta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const iMeta = intent?.metadata && typeof intent.metadata === 'object' ? intent.metadata : {}
  const fromBooking = Number(bMeta.usdt_rate_thb)
  if (Number.isFinite(fromBooking) && fromBooking > 0) return fromBooking
  const fromIntent = Number(iMeta.usdt_rate_thb)
  if (Number.isFinite(fromIntent) && fromIntent > 0) return fromIntent
  const payload = iMeta.provider_payload && typeof iMeta.provider_payload === 'object' ? iMeta.provider_payload : {}
  const fromPayload = Number(payload.rate_thb_per_usdt)
  if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload
  return null
}

/**
 * @param {number} rate
 * @returns {object}
 */
export function usdtRateLockMetadataPatch(rate) {
  const r = Number(rate)
  if (!Number.isFinite(r) || r <= 0) return {}
  return {
    usdt_rate_thb: r,
    usdt_rate_locked_at: new Date().toISOString(),
  }
}
