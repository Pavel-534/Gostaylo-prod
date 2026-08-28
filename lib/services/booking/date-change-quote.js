/**
 * Stage 202.14 — read-only date-change / extension price quote (old / new / delta).
 * Does not mutate bookings or ledger. Reuses PDP quote stack (PricingService + fee engine).
 */

import { computeListingBookingQuote } from '@/lib/services/booking/booking-quote.js'
import { expectedPaymentIntentAmountThbFromBooking } from '@/lib/services/booking/checkout-promo-amounts.js'
import { checkAvailability } from '@/lib/services/booking/inquiry.service.js'
import { resolveCheckoutChargeTotalThb } from '@/lib/pricing/price-truth.js'
import {
  nightsBetweenStay,
  resolveDateChangeMode,
} from '@/lib/services/booking/date-change-quote-helpers.js'

export { nightsBetweenStay, resolveDateChangeMode } from '@/lib/services/booking/date-change-quote-helpers.js'

/**
 * Locked guest total already on the booking (intent amount when set).
 * @param {object} booking
 */
export function resolveBookingLockedGuestTotalThb(booking) {
  const fromIntent = expectedPaymentIntentAmountThbFromBooking(booking)
  if (Number.isFinite(fromIntent) && fromIntent > 0) return fromIntent
  const fromCols = resolveCheckoutChargeTotalThb(booking)
  return Number.isFinite(fromCols) && fromCols > 0 ? fromCols : 0
}

/**
 * @param {object} booking — row from BookingService.getBookingById (or equivalent)
 * @param {{ checkIn?: string, checkOut?: string, guestsCount?: number, currency?: string }} params
 */
export async function computeDateChangeQuoteForBooking(booking, params = {}) {
  if (!booking?.id || !booking?.listing_id) {
    return { ok: false, error: 'booking_required', code: 'INVALID_INPUT' }
  }

  const currentCheckIn = booking.check_in
  const currentCheckOut = booking.check_out
  if (!currentCheckIn || !currentCheckOut) {
    return { ok: false, error: 'booking_missing_dates', code: 'INVALID_BOOKING' }
  }

  const proposedCheckIn = String(params.checkIn || params.check_in || currentCheckIn).trim()
  const proposedCheckOut = String(params.checkOut || params.check_out || '').trim()
  if (!proposedCheckOut) {
    return { ok: false, error: 'checkOut required', code: 'INVALID_INPUT' }
  }

  const mode = resolveDateChangeMode({
    currentCheckIn,
    currentCheckOut,
    proposedCheckIn,
    proposedCheckOut,
  })
  if (mode === 'invalid') {
    return { ok: false, error: 'Invalid date range', code: 'INVALID_DATES' }
  }

  const guestsCount = Math.max(
    1,
    parseInt(String(params.guestsCount ?? params.guests ?? booking.guests_count ?? 1), 10) || 1,
  )
  const currency = String(params.currency || booking.currency || 'THB').toUpperCase()

  const currentNights = nightsBetweenStay(currentCheckIn, currentCheckOut)
  const proposedNights = nightsBetweenStay(proposedCheckIn, proposedCheckOut)
  const oldGuestTotalThb = resolveBookingLockedGuestTotalThb(booking)
  const oldSubtotalThb = Math.round(Number(booking.price_thb || booking.priceThb || 0) || 0)

  let availability = { available: true, conflictCount: 0 }
  if (mode !== 'unchanged') {
    const avail = await checkAvailability(booking.listing_id, proposedCheckIn, proposedCheckOut, {
      excludeBookingId: booking.id,
      requestedGuests: guestsCount,
    })
    availability = {
      available: avail.available === true,
      conflictCount: Array.isArray(avail.conflictingBookings) ? avail.conflictingBookings.length : 0,
      error: avail.error || null,
    }
  }

  const newQuote = await computeListingBookingQuote({
    listingId: booking.listing_id,
    checkIn: proposedCheckIn,
    checkOut: proposedCheckOut,
    guestsCount,
    currency,
  })

  if (newQuote.error) {
    return {
      ok: false,
      error: newQuote.error,
      code: newQuote.code || 'QUOTE_FAILED',
      mode,
      availability,
    }
  }

  const newGuestTotalThb = Math.round(Number(newQuote.guestTotalThb) || 0)
  const newSubtotalThb = Math.round(Number(newQuote.subtotalThb) || 0)
  const deltaGuestTotalThb = newGuestTotalThb - oldGuestTotalThb
  const deltaSubtotalThb = newSubtotalThb - oldSubtotalThb

  return {
    ok: true,
    applySupported: false,
    mode,
    bookingId: String(booking.id),
    status: String(booking.status || ''),
    listingId: String(booking.listing_id),
    current: {
      checkIn: currentCheckIn,
      checkOut: currentCheckOut,
      nights: currentNights,
      guestTotalThb: oldGuestTotalThb,
      subtotalThb: oldSubtotalThb,
    },
    proposed: {
      checkIn: proposedCheckIn,
      checkOut: proposedCheckOut,
      nights: proposedNights,
      guestTotalThb: newGuestTotalThb,
      subtotalThb: newSubtotalThb,
      pricingEngineV2Active: newQuote.pricingEngineV2Active === true,
      roundingMode: newQuote.roundingMode || null,
    },
    deltaGuestTotalThb,
    deltaSubtotalThb,
    /** Suggested invoice / capture amount for extension (guest payable delta). */
    suggestedChargeThb: Math.max(0, deltaGuestTotalThb),
    availability,
  }
}
