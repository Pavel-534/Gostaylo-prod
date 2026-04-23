/**
 * Global product constants (SSOT) — shared slugs, payment display, booking statuses.
 * Keep this module free of server-only imports.
 */

export const GOSTAYLO_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5'

export const DEFAULT_CHECKOUT_ALLOWED_METHODS = Object.freeze(['CARD', 'MIR', 'CRYPTO'])

/** «Транспорт» в каталоге/БД — алиасы URL: `lib/listing-category-slug` */
export const TRANSPORT_CATEGORY_DB_SLUG = 'vehicles'

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  INQUIRY: 'INQUIRY',
  CONFIRMED: 'CONFIRMED',
  PAID: 'PAID',
  PAID_ESCROW: 'PAID_ESCROW',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  DECLINED: 'DECLINED',
})

/** Terminal or paid: hide «Pay now» / host pay affordances in chat. */
export const NO_PAY_TRAVEL_STATUSES = new Set([
  'CANCELLED',
  'REFUNDED',
  'COMPLETED',
  'PAID',
  'PAID_ESCROW',
])

/** Renter cannot cancel from checkout (matches legacy guard). */
export const RENTER_CHECKOUT_NO_CANCEL_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'DECLINED',
])
