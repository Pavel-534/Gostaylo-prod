/**
 * E2E: бронь на тур с фиксированным guestsCount — проверка формулы price × гости.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { BookingService } from '@/lib/services/booking.service'
import { PricingService } from '@/lib/services/pricing.service'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'

const FIXTURE_TAG = `${E2E_TEST_DATA_TAG} [E2E_TOUR_MATH_FIXTURE]`

function isoAddDays(yyyyMmDd, deltaDays) {
  const d = new Date(`${yyyyMmDd}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {{ partnerEmail: string, renterEmail: string, guestsCount?: number }} opts
 */
export async function createTourBookingMathFixture({
  partnerEmail,
  renterEmail,
  guestsCount: rawGuests = 3,
}) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 3)

  const pe = String(partnerEmail || '').toLowerCase().trim()
  const re = String(renterEmail || '').toLowerCase().trim()
  if (!pe || !re) {
    throw new Error('partnerEmail and renterEmail required')
  }

  const { data: partnerProfile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name')
    .ilike('email', pe)
    .maybeSingle()

  if (pErr || !partnerProfile?.id) {
    throw new Error(`Partner profile not found for email ${partnerEmail}`)
  }

  const { data: renterProfile, error: rErr } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name,phone')
    .ilike('email', re)
    .maybeSingle()

  if (rErr || !renterProfile?.id) {
    throw new Error(`Renter profile not found for email ${renterEmail}`)
  }

  const { data: toursCat, error: cErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', 'tours')
    .maybeSingle()

  if (cErr || !toursCat?.id) {
    throw new Error('Category tours not found in DB')
  }

  const { data: tourListings, error: lErr } = await supabaseAdmin
    .from('listings')
    .select('id,base_price_thb,max_capacity')
    .eq('owner_id', partnerProfile.id)
    .eq('category_id', toursCat.id)
    .limit(10)

  if (lErr || !tourListings?.length) {
    throw new Error('No tour listing for E2E partner — add a listing in category tours')
  }

  const listing = tourListings.find((l) => Math.max(1, parseInt(l.max_capacity, 10) || 1) >= guestsCount)
  if (!listing) {
    throw new Error(`No tour listing with max_capacity >= ${guestsCount}`)
  }

  const listingId = listing.id
  const basePriceThb = parseFloat(listing.base_price_thb) || 0
  if (!(basePriceThb > 0)) {
    throw new Error('Tour listing base_price_thb must be > 0')
  }

  const partnerId = partnerProfile.id
  const renterId = renterProfile.id
  const guestName =
    [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() ||
    `${E2E_TEST_DATA_TAG} E2E Guest`
  const guestEmail = renterProfile.email || re
  const guestPhone = String(renterProfile.phone || '').replace(/\D/g, '').slice(0, 15) || '0000000000'

  const start = new Date()
  start.setUTCDate(start.getUTCDate() + 80)
  const baseCheckIn = start.toISOString().slice(0, 10)

  let lastError = 'unknown'
  for (let w = 0; w < 48; w++) {
    const checkIn = isoAddDays(baseCheckIn, w * 5)
    const checkOut = isoAddDays(checkIn, 1)
    const p1 = await PricingService.calculateBookingPrice(
      listingId,
      checkIn,
      checkOut,
      basePriceThb,
      { listingCategorySlug: 'tours', guestsCount: 1 },
    )
    const pN = await PricingService.calculateBookingPrice(
      listingId,
      checkIn,
      checkOut,
      basePriceThb,
      { listingCategorySlug: 'tours', guestsCount },
    )
    if (p1.error || pN.error) {
      lastError = pN.error || p1.error || 'pricing precalc failed'
      continue
    }

    const flatTotalThb = Math.round(basePriceThb * guestsCount)
    if (pN.totalPrice !== flatTotalThb) {
      lastError = 'date window: tour total !== round(base_price_thb × guests)'
      continue
    }

    const result = await BookingService.createBooking({
      listingId,
      renterId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests: FIXTURE_TAG,
      currency: 'THB',
      guestsCount,
      clientQuotedSubtotalThb: Math.round(pN.totalPrice),
    })

    if (!result.error && result.booking?.id) {
      const priceThb = parseFloat(result.booking.price_thb) || 0
      if (priceThb !== pN.totalPrice) {
        throw new Error(
          `Tour math drift: booking price_thb=${priceThb} vs PricingService=${pN.totalPrice}`,
        )
      }
      return {
        bookingId: result.booking.id,
        listingId,
        basePriceThb,
        guestsCount,
        priceThb,
        singleGuestPricingTotal: p1.totalPrice,
        expectedTotalThb: pN.totalPrice,
      }
    }
    lastError = result.error || 'createBooking failed'
  }

  throw new Error(`Tour booking math fixture failed after retries: ${lastError}`)
}
