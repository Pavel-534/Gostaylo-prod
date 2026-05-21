/**
 * Booking statuses that occupy nights on the calendar and block new bookings.
 * SSOT: `lib/booking/status-sets.js` (Stage 110.2).
 */

export {
  OCCUPYING_BOOKING_STATUSES,
  occupyingStatusesInFilter,
  isOccupyingBookingStatus,
} from '@/lib/booking/status-sets.js'
