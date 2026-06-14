/**
 * Stage 138.1 — SSOT правил гостевых действий по статусу брони (Pay CTA, вход на checkout).
 *
 * Коды статусов: `lib/config/app-constants.js` → `BOOKING_STATUS`
 * Наборы / FSM: `lib/booking/status-sets.js`, `lib/booking/status-transitions.js`
 * UI-бейджи: `lib/booking/booking-status-display.js`
 */

/** @param {unknown} status */
export function normalizeBookingStatus(status) {
  return String(status ?? '').trim().toUpperCase()
}

/** Статусы, в которых гость может (и должен) завершить оплату на `/checkout/[id]`. */
export const BOOKING_PAYABLE_STATUSES = Object.freeze(['CONFIRMED', 'AWAITING_PAYMENT'])

/**
 * Показывать ли primary CTA «Оплатить» и вести ли на checkout после instant-book.
 * @param {unknown} status
 */
export function isBookingPayable(status) {
  return BOOKING_PAYABLE_STATUSES.includes(normalizeBookingStatus(status))
}
