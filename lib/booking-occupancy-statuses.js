/**
 * Booking statuses that occupy nights on the calendar and block new bookings.
 * Keep in sync across partner calendar, public calendar, and availability checks.
 */
export const OCCUPYING_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  /** Funds released from escrow; guest may still be in-stay until check-out (same night model). */
  'THAWED',
]

/** PostgREST `status=in.(...)` fragment */
export function occupyingStatusesInFilter() {
  return OCCUPYING_BOOKING_STATUSES.join(',')
}
