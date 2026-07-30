/**
 * Stage 197.1 — Persist checkout promo onto payable booking (reprice before payment initiate).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PricingService } from '@/lib/services/pricing.service'
import { resolveBookingPricingWithEngine } from '@/lib/services/booking/pricing-engine-integration.js'
import { isBookingPayable } from '@/lib/booking/booking-status-rules'
import { normalizeListingCurrency } from '@/lib/services/booking/pricing.service'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'
import { PromoErrorCode } from '@/lib/promo/promo-error-codes'
import {
  resolveCheckoutPromoBaseSubtotalThb,
  expectedPaymentIntentAmountThbFromBooking,
} from '@/lib/services/booking/checkout-promo-amounts.js'

export {
  resolveCheckoutPromoBaseSubtotalThb,
  expectedPaymentIntentAmountThbFromBooking,
}

function readSnap(booking) {
  const s = booking?.pricing_snapshot
  return s && typeof s === 'object' ? s : {}
}

function buildPriceCalcFromSnapshot(booking, baseAfterDurationThb) {
  const snap = readSnap(booking)
  const original = Math.round(Number(snap.subtotal_before_duration_discount_thb) || 0)
  const durAmt = Math.round(Number(snap?.duration_discount?.amount_thb) || 0)
  return {
    nights: Number(snap.nights) || 0,
    originalPrice: original > 0 ? original : baseAfterDurationThb + durAmt,
    totalPrice: baseAfterDurationThb,
    durationDiscountAmount: durAmt,
    durationDiscountPercent: Number(snap?.duration_discount?.percent) || 0,
    durationDiscountMinNights: snap?.duration_discount?.min_nights_threshold ?? null,
    durationDiscountSourceKey: snap?.duration_discount?.source_key ?? null,
  }
}

/**
 * Invalidate CREATED payment intents so charge amount cannot drift after reprice.
 * @param {string} bookingId
 */
export async function invalidateCreatedPaymentIntentsForBooking(bookingId) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: true, cancelled: 0 }
    const { data, error } = await supabaseAdmin
    .from('payment_intents')
    .update({ status: 'CANCELLED' })
    .eq('booking_id', id)
    .eq('status', 'CREATED')
    .select('id')
  if (error) return { ok: false, error: error.message, cancelled: 0 }
  return { ok: true, cancelled: (data || []).length }
}

/**
 * Apply / replace promo on a payable unpaid booking and recompute fee snapshot.
 * Idempotent when the same code is already applied with matching totals.
 *
 * @param {{ booking: object, promoCode: string, listing?: object|null }} args
 */
export async function applyCheckoutPromoToBooking({ booking, promoCode, listing = null } = {}) {
  const code = String(promoCode || '').trim().toUpperCase()
  if (!code) {
    return { ok: false, error_code: PromoErrorCode.PROMO_CODE_REQUIRED, status: 400 }
  }
  if (!booking?.id) {
    return { ok: false, error: 'Booking required', status: 400 }
  }
  if (!isBookingPayable(booking.status)) {
    return {
      ok: false,
      error: 'Booking cannot be repriced in its current status',
      code: 'BOOKING_NOT_PAYABLE',
      status: 400,
    }
  }

  const existingCode = String(booking.promo_code_used || '').trim().toUpperCase()
  const baseAfterDuration = resolveCheckoutPromoBaseSubtotalThb(booking)
  if (!Number.isFinite(baseAfterDuration) || baseAfterDuration <= 0) {
    return { ok: false, error: 'Invalid booking subtotal', code: 'PRICE_MISMATCH', status: 400 }
  }

  let listingRow = listing
  if (!listingRow?.id && booking.listing_id) {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, base_price_thb, base_currency, metadata, country_code, country, city, district')
      .eq('id', booking.listing_id)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, error: 'Listing not found', status: 404 }
    }
    listingRow = data
  }
  if (!listingRow?.owner_id) {
    return { ok: false, error: 'Listing owner required', status: 400 }
  }

  const promoResult = await PricingService.validatePromoCode(code, baseAfterDuration, {
    listingOwnerId: listingRow.owner_id,
    listingId: listingRow.id || booking.listing_id,
  })
  if (!promoResult.valid) {
    return {
      ok: false,
      error_code: promoResult.error_code || PromoErrorCode.PROMO_INVALID,
      min_amount_thb: promoResult.min_amount_thb,
      status: 400,
    }
  }

  const promoExtraDiscountThb = Math.round(Number(promoResult.discountAmount) || 0)
  const priceThb = Math.round(Number(promoResult.newTotal) || 0)
  const currency = String(booking.currency || 'THB').toUpperCase()
  const priceCalc = buildPriceCalcFromSnapshot(booking, baseAfterDuration)

  const pricing = await resolveBookingPricingWithEngine({
    listing: listingRow,
    listingId: listingRow.id || booking.listing_id,
    priceThb,
    priceCalc,
    currency,
    promoCodeUsed: code,
    promoExtraDiscountThb,
    promoFlashSale: Boolean(promoResult.flashSale),
  })
  if (pricing.error) {
    return { ok: false, error: pricing.error, code: pricing.code || 'PRICE_MISMATCH', status: 400 }
  }

  const activeFeeSplit = pricing.feeSplit
  const roundedGuestTotalThb = pricing.roundedGuestTotalThb
  const roundingDiffPotThb = pricing.roundingDiffPotThb
  const pricingSnapshot = pricing.pricingSnapshot

  const snap = readSnap(booking)
  const durationDiscountThb = Math.round(Number(snap?.duration_discount?.amount_thb) || 0)
  const discountAmount = durationDiscountThb + promoExtraDiscountThb

  const listingCurrency = normalizeListingCurrency(
    listingRow.base_currency || listingRow.metadata?.base_currency || listingRow.metadata?.currency || 'THB',
  )
  const exchangeRate = await PricingService.getCheckoutRateToThb(currency, listingCurrency)
  const taxableMarginAmount = Math.max(0, roundedGuestTotalThb - activeFeeSplit.partnerEarningsThb)
  const pricePaid = roundedGuestTotalThb / exchangeRate
  const netAmountLocal = await PricingService.convertThbToCurrencyRaw(
    activeFeeSplit.partnerEarningsThb,
    listingCurrency,
  )

  const alreadySame =
    existingCode === code &&
    Math.round(Number(booking.price_thb) || 0) === priceThb &&
    Math.round(Number(booking.commission_thb) || 0) === Math.round(Number(activeFeeSplit.guestServiceFeeThb) || 0) &&
    Math.round(Number(booking.rounding_diff_pot) || 0) === Math.round(Number(roundingDiffPotThb) || 0)

  if (alreadySame) {
    return {
      ok: true,
      unchanged: true,
      booking,
      guestPayableRoundedThb: getGuestPayableRoundedThb(booking),
      promo: {
        code,
        discountAmount: promoExtraDiscountThb,
        flashSale: Boolean(promoResult.flashSale),
        promoEndsAt: promoResult.promoEndsAt || null,
        secondsRemaining: promoResult.secondsRemaining ?? null,
      },
    }
  }

  const patch = {
    price_thb: priceThb,
    price_paid: pricePaid,
    exchange_rate: exchangeRate,
    commission_thb: activeFeeSplit.guestServiceFeeThb,
    commission_rate: activeFeeSplit.hostCommissionRate,
    applied_commission_rate: activeFeeSplit.hostCommissionRate,
    partner_earnings_thb: activeFeeSplit.partnerEarningsThb,
    taxable_margin_amount: taxableMarginAmount,
    rounding_diff_pot: roundingDiffPotThb,
    net_amount_local: Math.round(netAmountLocal * 100) / 100,
    listing_currency: listingCurrency,
    promo_code_used: code,
    discount_amount: discountAmount,
    pricing_snapshot: pricingSnapshot,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('bookings')
    .update(patch)
    .eq('id', booking.id)
    .select('*')
    .maybeSingle()

  if (updErr || !updated) {
    return { ok: false, error: updErr?.message || 'Failed to update booking', status: 500 }
  }

  await invalidateCreatedPaymentIntentsForBooking(booking.id)

  return {
    ok: true,
    unchanged: false,
    booking: updated,
    guestPayableRoundedThb: getGuestPayableRoundedThb(updated),
    promo: {
      code,
      discountAmount: promoExtraDiscountThb,
      flashSale: Boolean(promoResult.flashSale),
      promoEndsAt: promoResult.promoEndsAt || null,
      secondsRemaining: promoResult.secondsRemaining ?? null,
      newTotal: priceThb,
    },
  }
}

