/**
 * Stage 177.2b — stay params parse SSOT (dates + guests) for discovery contract.
 */

import { toListingDate } from '@/lib/listing-date'

export const DISCOVERY_GUESTS_MIN = 1
export const DISCOVERY_GUESTS_MAX = 99

/**
 * @param {string | null | undefined} raw
 * @returns {{ value: number | null, invalid: boolean }}
 */
export function normalizeDiscoveryGuests(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { value: null, invalid: false }
  }
  const n = parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < DISCOVERY_GUESTS_MIN || n > DISCOVERY_GUESTS_MAX) {
    return { value: null, invalid: true }
  }
  return { value: n, invalid: false }
}

/**
 * @param {{ checkIn?: string | null, checkOut?: string | null }} stay
 * @returns {boolean}
 */
export function hasValidDiscoveryStayDateRange(stay) {
  const checkIn = stay?.checkIn
  const checkOut = stay?.checkOut
  return Boolean(checkIn && checkOut && String(checkIn) < String(checkOut))
}

/**
 * @param {{ checkIn?: string | null, checkOut?: string | null }} stay
 * @returns {boolean}
 */
export function computeSkipPriceBecauseCalendar(stay) {
  return hasValidDiscoveryStayDateRange(stay)
}

/**
 * @param {URLSearchParams} sp
 * @returns {{
 *   checkIn: string | null,
 *   checkOut: string | null,
 *   hasValidDateRange: boolean,
 * }}
 */
export function normalizeDiscoveryStayDates(sp) {
  const rawCheckIn = sp.get('checkIn')
  const rawCheckOut = sp.get('checkOut')
  const normalizedCheckIn = toListingDate(rawCheckIn)
  const normalizedCheckOut = toListingDate(rawCheckOut)
  const hasValidDateRange = Boolean(
    normalizedCheckIn &&
      normalizedCheckOut &&
      normalizedCheckIn < normalizedCheckOut,
  )

  return {
    checkIn: hasValidDateRange ? normalizedCheckIn : null,
    checkOut: hasValidDateRange ? normalizedCheckOut : null,
    hasValidDateRange,
  }
}

/**
 * @param {URLSearchParams} sp
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} draft
 */
export function parseDiscoveryStayParams(sp, draft) {
  const dates = normalizeDiscoveryStayDates(sp)
  draft.stay.checkIn = dates.checkIn
  draft.stay.checkOut = dates.checkOut

  const checkInTime = sp.get('checkInTime')
  draft.stay.checkInTime = checkInTime && String(checkInTime).trim() ? String(checkInTime).trim() : null

  const checkOutTime = sp.get('checkOutTime')
  draft.stay.checkOutTime =
    checkOutTime && String(checkOutTime).trim() ? String(checkOutTime).trim() : null

  draft.stay.softAvailability = sp.get('softAvailability') !== '0'

  const guestsRaw = sp.get('guests')
  if (guestsRaw != null && guestsRaw !== '') {
    const guests = normalizeDiscoveryGuests(guestsRaw)
    if (guests.invalid) {
      draft.stay._guestsInvalid = true
    } else if (guests.value != null) {
      draft.stay.guests = guests.value
    }
  }
}
