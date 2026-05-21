/**
 * Server escrow/payout subset. Полный список кодов — `lib/config/app-constants.js` BOOKING_STATUS.
 * Наборы для фильтров — `lib/booking/status-sets.js`.
 * Переходы — `lib/booking/status-transitions.js` (CHECKED_IN ≠ THAWED).
 */
export const BookingStatus = {
  PENDING: 'PENDING',
  INQUIRY: 'INQUIRY',
  CONFIRMED: 'CONFIRMED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  PAID_ESCROW: 'PAID_ESCROW',
  CHECKED_IN: 'CHECKED_IN',
  THAWED: 'THAWED',
  READY_FOR_PAYOUT: 'READY_FOR_PAYOUT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
}

export const PayoutStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
}

export const PAYOUT_HOUR = 18
export const ESCROW_THAW_DAYS = 1
export const PAYOUT_CRON_CONCURRENCY = 5
