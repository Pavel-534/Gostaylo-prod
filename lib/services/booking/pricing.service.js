/**
 * Booking-scoped pricing_snapshot / settlement (не путать с lib/services/pricing.service.js — канон цен).
 * Stage 2.1 — вынесено из BookingService.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '../pricing.service';

export function normalizeListingCurrency(currency) {
  return String(currency || 'THB').toUpperCase().trim();
}

export function cloneBookingPricingSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {};
  return { ...snapshot };
}

export function readFeeSplitFromSnapshot(snapshot) {
  const fs = snapshot?.fee_split_v2;
  if (!fs || typeof fs !== 'object') return null;
  return {
    guestServiceFeePercent: Number(fs.guest_service_fee_percent),
    guestServiceFeeThb: Number(fs.guest_service_fee_thb),
    hostCommissionPercent: Number(fs.host_commission_percent),
    hostCommissionThb: Number(fs.host_commission_thb),
    insuranceFundPercent: Number(fs.insurance_fund_percent),
  };
}

/**
 * Attach immutable settlement section into pricing_snapshot on confirmation.
 * Re-entrant: if settlement_v3 already exists, no rewrite happens.
 */
export async function attachSettlementSnapshotForBooking(bookingId) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, partner_id, price_thb, price_paid, exchange_rate, commission_thb, commission_rate, partner_earnings_thb, applied_commission_rate, listing_currency, pricing_snapshot, taxable_margin_amount, rounding_diff_pot',
    )
    .eq('id', bookingId)
    .single();

  if (error || !booking) return { success: false, error: 'Booking not found' };

  const snapshot = cloneBookingPricingSnapshot(booking.pricing_snapshot);
  if (snapshot.settlement_v3) {
    return { success: true, skipped: true, snapshot };
  }

  const [{ data: partner }, rawRateMap] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('preferred_payout_currency, preferred_currency')
      .eq('id', booking.partner_id)
      .maybeSingle(),
    PricingService.getRawRateMap(),
  ]);

  const listingCurrency = normalizeListingCurrency(booking.listing_currency || 'THB');
  const preferredPayoutCurrency = normalizeListingCurrency(
    partner?.preferred_payout_currency || partner?.preferred_currency || 'THB',
  );

  const grossThb = Number(booking.price_thb) || 0;
  const feeSplit = readFeeSplitFromSnapshot(snapshot);
  const guestServiceFeeThb = Number.isFinite(feeSplit?.guestServiceFeeThb)
    ? feeSplit.guestServiceFeeThb
    : Number.isFinite(Number(booking.commission_thb))
      ? Number(booking.commission_thb)
      : 0;
  const hostCommissionThb = Number.isFinite(feeSplit?.hostCommissionThb)
    ? feeSplit.hostCommissionThb
    : Math.max(0, Math.round(grossThb * ((Number(booking.commission_rate) || 0) / 100)));
  const roundingDiffPotThb = Number.isFinite(Number(booking.rounding_diff_pot)) ? Number(booking.rounding_diff_pot) : 0;
  const marginThb = guestServiceFeeThb + hostCommissionThb;
  const partnerNetThb = Number.isFinite(Number(booking.partner_earnings_thb))
    ? Number(booking.partner_earnings_thb)
    : Math.max(0, grossThb - hostCommissionThb);
  const guestPaidAmountThb = Number.isFinite(Number(booking.price_paid)) && Number.isFinite(Number(booking.exchange_rate))
    ? Number(booking.price_paid) * Number(booking.exchange_rate)
    : grossThb + guestServiceFeeThb + roundingDiffPotThb;
  const taxableMarginAmountThb = Number.isFinite(Number(booking.taxable_margin_amount))
    ? Number(booking.taxable_margin_amount)
    : Math.max(0, guestPaidAmountThb - partnerNetThb);
  const appliedCommissionRate = Number.isFinite(Number(booking.applied_commission_rate))
    ? Number(booking.applied_commission_rate)
    : Number(booking.commission_rate) || 0;
  const insuranceFundPercent = Number.isFinite(feeSplit?.insuranceFundPercent)
    ? feeSplit.insuranceFundPercent
    : (await PricingService.getFeePolicy(booking.partner_id)).insuranceFundPercent;
  const insuranceReserveAmountThb = Math.round(marginThb * (insuranceFundPercent / 100) * 100) / 100;

  const [partnerNetPreferred, platformMarginListing, insuranceReserveListing, taxableMarginListing] = await Promise.all([
    PricingService.convertThbToCurrencyRaw(partnerNetThb, preferredPayoutCurrency, rawRateMap),
    PricingService.convertThbToCurrencyRaw(marginThb, listingCurrency, rawRateMap),
    PricingService.convertThbToCurrencyRaw(insuranceReserveAmountThb, listingCurrency, rawRateMap),
    PricingService.convertThbToCurrencyRaw(taxableMarginAmountThb, listingCurrency, rawRateMap),
  ]);

  snapshot.settlement_v3 = {
    immutable: true,
    created_at: new Date().toISOString(),
    listing_currency: listingCurrency,
    applied_commission_rate: appliedCommissionRate,
    partner_preferred_payout_currency: preferredPayoutCurrency,
    partner_net: {
      thb: Math.round(partnerNetThb * 100) / 100,
      preferred_currency: preferredPayoutCurrency,
      preferred_amount: Math.round(partnerNetPreferred * 100) / 100,
    },
    platform_margin: {
      thb: Math.round(marginThb * 100) / 100,
      listing_currency: listingCurrency,
      listing_amount: Math.round(platformMarginListing * 100) / 100,
    },
    insurance_reserve_amount: {
      thb: insuranceReserveAmountThb,
      listing_currency: listingCurrency,
      listing_amount: Math.round(insuranceReserveListing * 100) / 100,
      insurance_fund_percent: insuranceFundPercent,
    },
    taxable_margin_amount: {
      thb: Math.round(taxableMarginAmountThb * 100) / 100,
      listing_currency: listingCurrency,
      listing_amount: Math.round(taxableMarginListing * 100) / 100,
    },
  };

  const { error: upErr } = await supabaseAdmin.from('bookings').update({ pricing_snapshot: snapshot }).eq('id', bookingId);

  if (upErr) return { success: false, error: upErr.message };
  return { success: true, snapshot };
}
