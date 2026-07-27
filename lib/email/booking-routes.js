/**
 * Canonical in-app paths for list views with booking highlight (Stage 2.3).
 * @param {string | number | null | undefined} bookingId
 */
export function renterBookingsListPath(bookingId) {
  if (bookingId == null || bookingId === '') return '/my-bookings';
  return `/my-bookings?booking=${encodeURIComponent(String(bookingId))}`;
}

export function partnerBookingsListPath(bookingId) {
  if (bookingId == null || bookingId === '') return '/partner/bookings';
  // Wave H5: highlight=true keeps parity with guest my-bookings deep links / SW click.
  return `/partner/bookings?booking=${encodeURIComponent(String(bookingId))}&highlight=true`
}
