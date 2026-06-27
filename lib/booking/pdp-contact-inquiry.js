/**
 * ADR-172 Wave 2 — PDP «Написать хозяину» с датами → inquiry SSOT.
 * Shared payload helpers for client (useListingChat / useListingBookingFlow).
 */

import { format } from 'date-fns'
import { listingYmdLocalWallTimeToUtcIso } from '@/lib/listing-date'
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot'

/**
 * @param {Date} dateObj
 * @param {string} hhmm
 * @param {string} listingTimeZone
 */
export function buildVehicleInstantIso(dateObj, hhmm, listingTimeZone) {
  if (!dateObj) return null
  const ymd = format(dateObj, 'yyyy-MM-dd')
  const t = /^\d{2}:\d{2}$/.test(String(hhmm || '')) ? String(hhmm) : '07:00'
  const [hourRaw, minuteRaw] = t.split(':')
  const hour = Math.max(0, Math.min(23, parseInt(hourRaw, 10) || 0))
  const minute = Math.max(0, Math.min(59, parseInt(minuteRaw, 10) || 0))
  return listingYmdLocalWallTimeToUtcIso(ymd, hour, minute, listingTimeZone)
}

/**
 * @param {object} params
 * @param {object} params.listing
 * @param {{ from?: Date|null, to?: Date|null }} params.dateRange
 * @param {number} params.guests
 * @param {boolean} params.isVehicleListing
 * @param {string} [params.vehicleStartTime]
 * @param {string} [params.vehicleEndTime]
 * @param {object} [params.user]
 */
export function buildPdpContactInquiryPayload({
  listing,
  dateRange,
  guests,
  isVehicleListing,
  vehicleStartTime = '07:00',
  vehicleEndTime = '07:00',
  user,
}) {
  if (!listing?.id || !dateRange?.from || !dateRange?.to) return null

  const listingTimeZone = resolveListingTimeZoneFromMetadata(listing?.metadata || {})
  const checkIn = isVehicleListing
    ? buildVehicleInstantIso(dateRange.from, vehicleStartTime, listingTimeZone)
    : format(dateRange.from, 'yyyy-MM-dd')
  const checkOut = isVehicleListing
    ? buildVehicleInstantIso(dateRange.to, vehicleEndTime, listingTimeZone)
    : format(dateRange.to, 'yyyy-MM-dd')

  const guestName = user
    ? [user.first_name || user.firstName, user.last_name || user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      user.email ||
      undefined
    : undefined

  return {
    listingId: listing.id,
    renterId: user?.id,
    checkIn,
    checkOut,
    guestsCount: Math.max(1, Number(guests) || 1),
    guestName,
    guestEmail: user?.email || undefined,
    guestPhone: user?.phone || undefined,
    currency: 'THB',
    contactInquiry: true,
  }
}

/**
 * Attach server price attestation (same contract as booking modal).
 * @param {Record<string, unknown>} payload
 * @param {object} params
 */
export async function attachPdpInquiryPriceAttestation(payload, { listing, guests, priceCalc }) {
  const next = { ...payload }
  const sub = priceCalc?.subtotalBeforeFee ?? priceCalc?.totalPrice
  if (sub != null && Number.isFinite(Number(sub))) {
    next.clientQuotedSubtotalThb = Math.round(Number(sub))
    const ft = priceCalc?.finalTotal
    if (ft != null && Number.isFinite(Number(ft))) {
      next.clientQuotedGuestTotalThb = Math.round(Number(ft))
    }
  }

  if (!listing?.id || !next.checkIn || !next.checkOut) return next

  try {
    const quoteQs = new URLSearchParams({
      checkIn: String(next.checkIn),
      checkOut: String(next.checkOut),
      guestsCount: String(guests ?? next.guestsCount ?? 1),
      currency: String(next.currency || 'THB'),
    })
    const quoteRes = await fetch(
      `/api/v2/listings/${encodeURIComponent(listing.id)}/booking-quote?${quoteQs}`,
      { cache: 'no-store' },
    )
    const quoteJson = await quoteRes.json().catch(() => ({}))
    if (quoteRes.ok && quoteJson?.success && quoteJson?.data) {
      next.clientQuotedSubtotalThb = quoteJson.data.clientQuotedSubtotalThb
      next.clientQuotedGuestTotalThb = quoteJson.data.clientQuotedGuestTotalThb
    }
  } catch {
    /* keep client-side attestation if quote unavailable */
  }

  return next
}
