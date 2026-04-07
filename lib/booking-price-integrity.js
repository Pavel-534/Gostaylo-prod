/**
 * Server-side booking price integrity (минимальный итог для гостя, согласованность с комиссией).
 * Канон: как на витрине — service fee = round(subtotal × commission_rate/100), итог гостя = subtotal + fee.
 */

/** Минимальная сумма к оплате гостем (субтотал проживания + сервисный сбор), THB */
export const MIN_BOOKING_GUEST_TOTAL_THB = 100

/**
 * @param {number} subtotalThb — price_thb после промо (субтотал проживания)
 * @param {number} commissionRatePct — процент комиссии/сервиса (как на листинге)
 * @returns {number|null}
 */
export function computeGuestPayableTotalThb(subtotalThb, commissionRatePct) {
  const s = Math.round(Number(subtotalThb))
  const r = Number(commissionRatePct)
  if (!Number.isFinite(s) || !Number.isFinite(r) || r < 0) return null
  const fee = Math.round(s * (r / 100))
  return s + fee
}
