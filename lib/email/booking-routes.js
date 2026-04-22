/**
 * Canonical in-app paths for list views with booking highlight (Stage 2.3).
 * @param {string | number | null | undefined} bookingId
 */
export function renterBookingsListPath(bookingId) {
  if (bookingId == null || bookingId === '') return '/renter/bookings';
  return `/renter/bookings?booking=${encodeURIComponent(String(bookingId))}`;
}

export function partnerBookingsListPath(bookingId) {
  if (bookingId == null || bookingId === '') return '/partner/bookings';
  return `/partner/bookings?booking=${encodeURIComponent(String(bookingId))}`;
}
