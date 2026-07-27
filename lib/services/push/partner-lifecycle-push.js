/**
 * Wave H5 — Partner SLA / booking lifecycle FCM payload helpers (deep link + body parts).
 */

import { partnerBookingsListPath } from '@/lib/email/booking-routes.js'

const DATE_OPTS = { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' }

/**
 * @param {string | Date | null | undefined} checkIn
 * @param {string | Date | null | undefined} checkOut
 */
export function formatPartnerPushDates(checkIn, checkOut) {
  const d1 = checkIn ? new Date(checkIn).toLocaleDateString('en-GB', DATE_OPTS) : '—'
  const d2 = checkOut ? new Date(checkOut).toLocaleDateString('en-GB', DATE_OPTS) : '—'
  return `${d1} — ${d2}`
}

/**
 * Canonical partner booking deep link for FCM `data.link` / `data.url`.
 * @param {string | number | null | undefined} bookingId
 */
export function partnerBookingPushDeepLink(bookingId) {
  return partnerBookingsListPath(bookingId)
}

/**
 * @param {{
 *   booking?: { id?: string|number, check_in?: string, check_out?: string, guest_name?: string } | null,
 *   listing?: { title?: string } | null,
 *   guestName?: string | null,
 * }} args
 */
export function buildPartnerLifecyclePushData({ booking = null, listing = null, guestName = null } = {}) {
  const bookingId = booking?.id != null ? String(booking.id) : ''
  const link = partnerBookingPushDeepLink(bookingId || null)
  const guest =
    (guestName != null && String(guestName).trim()) ||
    (booking?.guest_name != null && String(booking.guest_name).trim()) ||
    '—'
  return {
    listing: listing?.title || '—',
    dates: formatPartnerPushDates(booking?.check_in, booking?.check_out),
    guest,
    bookingId,
    link,
    url: link,
    deepLink: link,
  }
}
