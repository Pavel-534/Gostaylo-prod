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
]

/** PostgREST `status=in.(...)` fragment */
export function occupyingStatusesInFilter() {
  return OCCUPYING_BOOKING_STATUSES.join(',')
}
