/**
 * SSOT guest/subtotal attestation for PDP booking (matches createBooking pricing).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PricingService } from '../pricing.service'
import { resolveListingCategorySlug } from './query.service'
import { resolveBookingPricingWithEngine } from './pricing-engine-integration.js'
import { computeAttestationGuestTotalThb } from '@/lib/booking-price-integrity.js'

/**
 * @param {{
 *   listingId: string,
 *   checkIn: string,
 *   checkOut: string,
 *   guestsCount?: number,
 *   currency?: string,
 * }} params
 */
export async function computeListingBookingQuote(params) {
  const listingId = String(params.listingId || '').trim()
  const checkIn = params.checkIn
  const checkOut = params.checkOut
  const currency = String(params.currency || 'THB').toUpperCase()
  const guestsCount = Math.max(1, parseInt(params.guestsCount, 10) || 1)

  if (!listingId || !checkIn || !checkOut) {
    return { error: 'listingId, checkIn and checkOut required', code: 'INVALID_INPUT' }
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('id, base_price_thb, owner_id, metadata, category_id, base_currency')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError || !listing) {
    return { error: 'Listing not found', code: 'NOT_FOUND' }
  }

  const listingCategorySlug = await resolveListingCategorySlug(listing.category_id)
  const priceCalc = await PricingService.calculateBookingPrice(
    listingId,
    checkIn,
    checkOut,
    parseFloat(listing.base_price_thb),
    { listingCategorySlug, guestsCount },
  )

  if (priceCalc.error) {
    return { error: priceCalc.error, code: 'PRICE_CALC_ERROR' }
  }

  const priceThb = Math.round(Number(priceCalc.totalPrice))
  const pricing = await resolveBookingPricingWithEngine({
    listing,
    listingId,
    priceThb,
    priceCalc,
    currency,
  })

  if (pricing.error) {
    return { error: pricing.error, code: pricing.code || 'PRICING_ERROR' }
  }

  const attestation = computeAttestationGuestTotalThb({
    guestPayableThb: pricing.feeSplit.guestPayableThb,
    pricingSnapshot: pricing.pricingSnapshot,
    pricingEngineV2Active: pricing.pricingEngineV2Active,
    precomputedRoundedThb: pricing.roundedGuestTotalThb,
  })

  if (!attestation) {
    return { error: 'Invalid price', code: 'PRICE_MISMATCH' }
  }

  return {
    subtotalThb: priceThb,
    guestTotalThb: attestation.totalThb,
    pricingEngineV2Active: pricing.pricingEngineV2Active === true,
    roundingMode: pricing.roundingMode,
  }
}
