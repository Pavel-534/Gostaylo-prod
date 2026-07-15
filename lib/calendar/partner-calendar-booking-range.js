import { addDays, format, parseISO } from 'date-fns'

/**
 * Full stay range for a booking visible on the partner master calendar.
 * @param {Record<string, { status?: string, bookingId?: string }>} availability
 * @param {string[]} datesSorted
 * @param {string | number} bookingId
 * @returns {{ checkIn: string, checkOut: string } | null}
 */
export function resolvePartnerBookingStayRange(availability, datesSorted, bookingId) {
  if (!availability || !Array.isArray(datesSorted) || bookingId == null) return null
  const bid = String(bookingId)
  let firstNight = null
  let lastNight = null
  for (const d of datesSorted) {
    const cell = availability[d]
    if (cell?.status === 'BOOKED' && String(cell.bookingId) === bid) {
      if (!firstNight || d < firstNight) firstNight = d
      if (!lastNight || d > lastNight) lastNight = d
    }
  }
  if (!firstNight || !lastNight) return null
  try {
    return {
      checkIn: firstNight,
      checkOut: format(addDays(parseISO(lastNight), 1), 'yyyy-MM-dd'),
    }
  } catch {
    return { checkIn: firstNight, checkOut: null }
  }
}

/**
 * Checkout date (exclusive end) for a booking night visible on the partner master calendar.
 * @deprecated Prefer {@link resolvePartnerBookingStayRange}
 */
export function resolvePartnerBookingCheckOutDate(availability, datesSorted, checkInDate, bookingId) {
  const range = resolvePartnerBookingStayRange(availability, datesSorted, bookingId)
  return range?.checkOut ?? null
}
