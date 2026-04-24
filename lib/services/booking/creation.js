/**
 * Standard (non-inquiry) booking creation.
 * Stage 2.1 — вынесено из booking.service.js
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '../pricing.service';
import { mapPublicImageUrls } from '@/lib/public-image-url';
import { buildBookingPricingSnapshot } from '@/lib/booking-pricing-snapshot';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { recordCriticalSignal } from '@/lib/critical-telemetry.js';
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button.js';
import {
  MIN_BOOKING_GUEST_TOTAL_THB,
  computeRoundedGuestTotalPot,
} from '@/lib/booking-price-integrity.js';
import { normalizeBookingInstantForDb } from '@/lib/listing-date';
import { ensureBookingConversation, checkAvailability } from './inquiry.service';
import { resolveListingCategorySlug } from './query.service';
import { normalizeListingCurrency } from './pricing.service';
import { pickCheckInInstructionsForBookingMetadata } from '@/lib/booking/booking-check-in-instructions';

export async function createBooking(bookingData) {
  const {
    listingId,
    renterId,
    checkIn,
    checkOut,
    guestName,
    guestPhone,
    guestEmail,
    specialRequests,
    currency = 'THB',
    promoCode,
    guestsCount: rawGuests,
    clientQuotedSubtotalThb,
    clientQuotedGuestTotalThb,
  } = bookingData;

  const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 1);

  const finalRenterId = renterId || null;

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('*, owner:profiles!owner_id(id, email, first_name, last_name, phone, telegram_id, custom_commission_rate)')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return { error: 'Listing not found' };
  }

  const listingCategorySlug = await resolveListingCategorySlug(listing.category_id);
  const isTourListing = listingCategorySlug === 'tours';
  const isVehicleListing = listingCategorySlug === 'vehicles';
  if (isTourListing && rawGuests == null) {
    console.warn('[BookingCreation] Tour booking without guests_count, fallback to 1');
  }
  if (isTourListing && Number(rawGuests) === 0) {
    return { error: 'Tours require guests_count >= 1' };
  }

  const maxCap = Math.max(1, parseInt(listing.max_capacity, 10) || 1);
  if (!isVehicleListing && guestsCount > maxCap) {
    return { error: `Party size exceeds listing capacity (${maxCap})` };
  }

  const availability = await checkAvailability(listingId, checkIn, checkOut, {
    guestsCount: isVehicleListing ? 1 : guestsCount,
    listingCategorySlugOverride: isVehicleListing ? 'vehicles' : undefined,
  });
  if (!availability.available) {
    return { error: 'Dates not available', conflictingBookings: availability.conflictingBookings };
  }

  const priceCalc = await PricingService.calculateBookingPrice(
    listingId,
    checkIn,
    checkOut,
    parseFloat(listing.base_price_thb),
    { listingCategorySlug, guestsCount },
  );

  if (priceCalc.error) {
    return { error: priceCalc.error };
  }

  const serverSubtotalThb = Math.round(Number(priceCalc.totalPrice));
  const quotedRaw = clientQuotedSubtotalThb;
  if (quotedRaw === undefined || quotedRaw === null) {
    return {
      error: 'Price attestation required (clientQuotedSubtotalThb)',
      code: 'PRICE_ATTESTATION_REQUIRED',
    };
  }
  const clientSubtotalThb = Math.round(Number(quotedRaw));
  if (!Number.isFinite(clientSubtotalThb) || serverSubtotalThb !== clientSubtotalThb) {
    const fraudBanMarkup = buildFraudBanReplyMarkup(finalRenterId);
    void notifySystemAlert(
      `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> createBooking (subtotal)\n` +
        `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
        `createBooking: клиентская сумма ≠ серверной\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `ожидалось THB: <b>${serverSubtotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(quotedRaw))}</b>\n` +
        `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
      fraudBanMarkup ? { reply_markup: fraudBanMarkup } : {},
    );
    recordCriticalSignal('PRICE_TAMPERING', {
      tag: '[FRAUD_DETECTION]',
      banUserId: finalRenterId || null,
      detailLines: [
        'path: createBooking',
        `listing: ${listingId}`,
        `server THB: ${serverSubtotalThb}`,
        `client THB: ${clientSubtotalThb}`,
        `renter: ${finalRenterId || '—'}`,
      ],
    });
    return { error: 'Price verification failed', code: 'PRICE_MISMATCH' };
  }

  let priceThb = priceCalc.totalPrice;
  let discountAmount = priceCalc.durationDiscountAmount || 0;
  let promoCodeUsed = null;
  let promoExtraDiscountThb = 0;

  if (promoCode) {
    const promoResult = await PricingService.validatePromoCode(promoCode, priceThb, {
      listingOwnerId: listing.owner_id,
    });
    if (promoResult.valid) {
      promoExtraDiscountThb = promoResult.discountAmount;
      discountAmount += promoResult.discountAmount;
      priceThb = promoResult.newTotal;
      promoCodeUsed = promoCode.toUpperCase();
    }
  }

  if (!Number.isFinite(Number(priceThb)) || Number(priceThb) < 0) {
    void notifySystemAlert(
      `[SECURITY_ALERT] <b>Invalid THB subtotal after pricing</b>\n` +
        `path: createBooking\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `price_thb: <code>${escapeSystemAlertHtml(String(priceThb))}</code>\n` +
        `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
    );
    return { error: 'Invalid price', code: 'PRICE_MISMATCH' };
  }

  const feeSplit = await PricingService.calculateFeeSplit(priceThb, listing.owner_id);
  const commission = {
    commissionRate: feeSplit.hostCommissionRate,
    commissionThb: feeSplit.guestServiceFeeThb,
    partnerEarnings: feeSplit.partnerEarningsThb,
    guestServiceFeePercent: feeSplit.guestServiceFeePercent,
    guestPayableThb: feeSplit.guestPayableThb,
  };
  const guestPayableThb = Math.round(Number(feeSplit.guestPayableThb) || 0);
  const roundedGuestTotalPot = computeRoundedGuestTotalPot(guestPayableThb);
  if (!roundedGuestTotalPot) {
    return { error: 'Failed to round guest payable amount', code: 'PRICE_MISMATCH' };
  }
  const { roundedGuestTotalThb, roundingDiffPotThb } = roundedGuestTotalPot;

  const quotedGuestTotalRaw = clientQuotedGuestTotalThb;
  if (quotedGuestTotalRaw !== undefined && quotedGuestTotalRaw !== null) {
    const qg = Math.round(Number(quotedGuestTotalRaw));
    if (!Number.isFinite(qg) || qg !== roundedGuestTotalThb) {
      const fraudBanMarkupGuest = buildFraudBanReplyMarkup(finalRenterId);
      void notifySystemAlert(
        `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> createBooking (guest total)\n` +
          `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
          `ожидалось итог THB (с учетом pot-rounding): <b>${roundedGuestTotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(quotedGuestTotalRaw))}</b>\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
          `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
        fraudBanMarkupGuest ? { reply_markup: fraudBanMarkupGuest } : {},
      );
      recordCriticalSignal('PRICE_TAMPERING', {
        tag: '[FRAUD_DETECTION]',
        banUserId: finalRenterId || null,
        detailLines: [
          'path: createBooking guest total',
          `listing: ${listingId}`,
          `server payable THB: ${roundedGuestTotalThb}`,
          `client THB: ${qg}`,
        ],
      });
      return { error: 'Price verification failed', code: 'PRICE_MISMATCH' };
    }
  }

  if (roundedGuestTotalThb < MIN_BOOKING_GUEST_TOTAL_THB) {
    void notifySystemAlert(
      `[SECURITY_ALERT] <b>BOOKING_MIN_TOTAL_THB</b>\n` +
        `path: createBooking\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `guest payable THB: <b>${roundedGuestTotalThb}</b> (min <b>${MIN_BOOKING_GUEST_TOTAL_THB}</b>)\n` +
        `subtotal THB: <b>${Math.round(Number(priceThb))}</b>\n` +
        `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
    );
    return {
      error: `Minimum payable total is ${MIN_BOOKING_GUEST_TOTAL_THB} THB (subtotal + service fee).`,
      code: 'BOOKING_MIN_TOTAL_THB',
    };
  }

  const pricingSnapshot = buildBookingPricingSnapshot(
    priceCalc,
    parseFloat(listing.base_price_thb),
    promoCodeUsed ? { promoCodeUsed, promoExtraDiscountThb } : {},
  );
  pricingSnapshot.fee_split_v2 = {
    immutable: true,
    guest_service_fee_percent: feeSplit.guestServiceFeePercent,
    guest_service_fee_thb: feeSplit.guestServiceFeeThb,
    host_commission_percent: feeSplit.hostCommissionRate,
    host_commission_thb: feeSplit.hostCommissionThb,
    platform_gross_revenue_thb: feeSplit.platformGrossRevenueThb,
    insurance_fund_percent: feeSplit.insuranceFundPercent,
    insurance_reserve_thb: feeSplit.insuranceReserveThb,
    guest_payable_thb: feeSplit.guestPayableThb,
    guest_payable_rounded_thb: roundedGuestTotalThb,
    rounding_diff_pot_thb: roundingDiffPotThb,
  };

  const listingCurrency = normalizeListingCurrency(
    listing.base_currency || listing.metadata?.base_currency || listing.metadata?.currency || 'THB',
  );
  const exchangeRate = await PricingService.getCheckoutRateToThb(currency, listingCurrency);
  const taxableMarginAmount = Math.max(0, roundedGuestTotalThb - feeSplit.partnerEarningsThb);
  const pricePaid = roundedGuestTotalThb / exchangeRate;
  const netAmountLocal = await PricingService.convertThbToCurrencyRaw(
    feeSplit.partnerEarningsThb,
    listingCurrency,
  );

  const availabilityRecheck = await checkAvailability(listingId, checkIn, checkOut, {
    guestsCount: isVehicleListing ? 1 : guestsCount,
    listingCategorySlugOverride: isVehicleListing ? 'vehicles' : undefined,
  });
  if (!availabilityRecheck.available) {
    return {
      error: 'Dates not available',
      conflictingBookings: availabilityRecheck.conflictingBookings,
      code: 'DATES_CONFLICT',
    };
  }

  const checkInDb = normalizeBookingInstantForDb(checkIn) || checkIn;
  const checkOutDb = normalizeBookingInstantForDb(checkOut) || checkOut;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      listing_id: listingId,
      renter_id: finalRenterId,
      partner_id: listing.owner_id,
      status: 'PENDING',
      check_in: checkInDb,
      check_out: checkOutDb,
      price_thb: priceThb,
      currency,
      price_paid: pricePaid,
      exchange_rate: exchangeRate,
      commission_thb: feeSplit.guestServiceFeeThb,
      commission_rate: feeSplit.hostCommissionRate,
      applied_commission_rate: feeSplit.hostCommissionRate,
      partner_earnings_thb: feeSplit.partnerEarningsThb,
      taxable_margin_amount: taxableMarginAmount,
      rounding_diff_pot: roundingDiffPotThb,
      net_amount_local: Math.round(netAmountLocal * 100) / 100,
      listing_currency: listingCurrency,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      special_requests: specialRequests,
      guests_count: guestsCount,
      promo_code_used: promoCodeUsed,
      discount_amount: discountAmount,
      pricing_snapshot: pricingSnapshot,
      metadata: pickCheckInInstructionsForBookingMetadata(listing),
    })
    .select()
    .single();

  if (bookingError) {
    void notifySystemAlert(
      `🧾 <b>Критическая ошибка: не удалось создать бронирование (БД)</b>\n` +
        `<code>${escapeSystemAlertHtml(bookingError.message)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
    );
    if (String(bookingError.message || '').includes('VEHICLE_INTERVAL_CONFLICT')) {
      return {
        error: 'Dates not available',
        code: 'DATES_CONFLICT',
        conflictingBookings: [{ reason: 'INSUFFICIENT_CAPACITY' }],
      };
    }
    return { error: bookingError.message };
  }

  await supabaseAdmin
    .from('listings')
    .update({ bookings_count: (listing.bookings_count || 0) + 1 })
    .eq('id', listingId);

  const conversationId = await ensureBookingConversation({
    bookingId: booking.id,
    listingId,
    listing,
    renterId: finalRenterId,
    partnerId: listing.owner_id,
    guestName,
    checkIn,
    checkOut,
    priceThb,
    pricingSnapshot,
  });

  if (!conversationId) {
    void notifySystemAlert(
      `💬 <b>Бронь создана, чат не привязан</b>\n` +
        `booking: <code>${escapeSystemAlertHtml(booking.id)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
    );
  }

  return {
    success: true,
    conversationId: conversationId || null,
    partner: listing.owner ?? null,
    booking: {
      ...booking,
      listing: {
        title: listing.title,
        district: listing.district,
        category_slug: listingCategorySlug,
        images: mapPublicImageUrls(listing.images || []),
      },
      priceBreakdown: priceCalc.priceBreakdown,
      originalPrice: priceCalc.originalPrice,
      discountedPrice: priceCalc.discountedPrice,
      durationDiscountPercent: priceCalc.durationDiscountPercent,
      commission: commission,
    },
  };
}
