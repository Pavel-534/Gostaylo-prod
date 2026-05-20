/**
 * Booking statuses that occupy nights on the calendar and block new bookings.
 * SSOT: `lib/booking/status-transitions.js` (Stage 108.1).
 */

export {
  OCCUPYING_BOOKING_STATUSES,
  occupyingStatusesInFilter,
  isOccupyingBookingStatus,
} from '@/lib/booking/status-transitions.js'
