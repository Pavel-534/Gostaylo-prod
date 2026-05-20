/**
 * Global product constants (SSOT) — shared slugs, payment display, booking statuses.
 * Keep this module free of server-only imports.
 */

export const GOSTAYLO_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5'

export const DEFAULT_CHECKOUT_ALLOWED_METHODS = Object.freeze(['CARD', 'MIR', 'CRYPTO'])

/** «Транспорт» в каталоге/БД — алиасы URL: `lib/listing-category-slug` */
export const TRANSPORT_CATEGORY_DB_SLUG = 'vehicles'

/**
 * Коды статусов брони (клиент + shared).
 * SSOT переходов: `lib/booking/status-transitions.js`.
 * Бейджи/цвета: `lib/booking/booking-status-display.js`.
 */
export const BOOKING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  INQUIRY: 'INQUIRY',
  CONFIRMED: 'CONFIRMED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  PAID_ESCROW: 'PAID_ESCROW',
  CHECKED_IN: 'CHECKED_IN',
  THAWED: 'THAWED',
  READY_FOR_PAYOUT: 'READY_FOR_PAYOUT',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  DECLINED: 'DECLINED',
})

/** Все коды из enum (без UI-only DECLINED) — parity с server SSOT (P1-7). */
export const BOOKING_STATUS_CODES = Object.freeze(
  Object.values(BOOKING_STATUS).filter((s) => s !== BOOKING_STATUS.DECLINED),
)

/** Статусы в пайплайне эскроу / выплат (для фильтров и подсказок). */
export const BOOKING_ESCROW_PIPELINE_STATUSES = Object.freeze([
  BOOKING_STATUS.PAID_ESCROW,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.THAWED,
  BOOKING_STATUS.READY_FOR_PAYOUT,
])

/** Terminal or paid: hide «Pay now» / host pay affordances in chat. */
export const NO_PAY_TRAVEL_STATUSES = new Set([
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.REFUNDED,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.PAID,
  BOOKING_STATUS.PAID_ESCROW,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.THAWED,
  BOOKING_STATUS.READY_FOR_PAYOUT,
  BOOKING_STATUS.AWAITING_PAYMENT,
])

/** Renter cannot cancel from checkout (matches legacy guard). */
export const RENTER_CHECKOUT_NO_CANCEL_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'DECLINED',
])
