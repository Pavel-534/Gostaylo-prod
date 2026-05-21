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
 * Наборы для фильтров: `lib/booking/status-sets.js`.
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

export {
  BOOKING_ESCROW_PIPELINE_STATUSES,
  NO_PAY_TRAVEL_STATUSES,
  RENTER_CHECKOUT_NO_CANCEL_STATUSES,
} from '@/lib/booking/status-sets.js'
