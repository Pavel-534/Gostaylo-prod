/**
 * Standard (non-inquiry) booking creation.
 * Stage 2.1 — вынесено из booking.service.js
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '../pricing.service';
import { mapPublicImageUrls } from '@/lib/public-image-url';
import { buildBookingPricingSnapshot } from '@/lib/booking-pricing-snapshot';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { recordCriticalSignal, logStructured } from '@/lib/critical-telemetry.js';
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
import { MarketingNotificationsService } from '@/lib/services/marketing-notifications.service';
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot';

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
    forceStatus,
  } = bookingData;

  const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 1);

  const finalRenterId = renterId || null;
  const targetStatus = String(forceStatus || 'PENDING').toUpperCase() === 'CONFIRMED'
    ? 'CONFIRMED'
    : 'PENDING';

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('*, owner:profiles!owner_id(id, email, first_name, last_name, phone, telegram_id, custom_commission_rate)')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return { error: 'Listing not found' };
  }

  const listingCategorySlug = await resolveListingCategorySlug(listing.category_id);
  const listingTimeZone = resolveListingTimeZoneFromMetadata(listing.metadata);
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
  let promoFlashSale = false;

  if (promoCode) {
    const promoResult = await PricingService.validatePromoCode(promoCode, priceThb, {
      listingOwnerId: listing.owner_id,
      listingId,
    });
    if (promoResult.valid) {
      promoExtraDiscountThb = promoResult.discountAmount;
      discountAmount += promoResult.discountAmount;
      priceThb = promoResult.newTotal;
      promoCodeUsed = promoCode.toUpperCase();
      promoFlashSale = Boolean(promoResult.flashSale);
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
    {
      ...(promoCodeUsed ? { promoCodeUsed, promoExtraDiscountThb, promoFlashSale } : {}),
      taxRate: feeSplit.taxRatePercent ?? 0,
      taxAmountThb: feeSplit.taxAmountThb ?? 0,
    },
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
    tax_rate_percent: feeSplit.taxRatePercent ?? 0,
    tax_amount_thb: feeSplit.taxAmountThb ?? 0,
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

  const checkInDb = normalizeBookingInstantForDb(checkIn, listingTimeZone) || checkIn;
  const checkOutDb = normalizeBookingInstantForDb(checkOut, listingTimeZone) || checkOut;

  const bookingInsertPayload = {
    listing_id: listingId,
    renter_id: finalRenterId,
    partner_id: listing.owner_id,
    status: targetStatus,
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
  };

  const { data: atomicRows, error: atomicError } = await supabaseAdmin.rpc(
    'create_booking_atomic_v1',
    {
      p_listing_id: bookingInsertPayload.listing_id,
      p_renter_id: bookingInsertPayload.renter_id,
      p_partner_id: bookingInsertPayload.partner_id,
      p_status: bookingInsertPayload.status,
      p_check_in: bookingInsertPayload.check_in,
      p_check_out: bookingInsertPayload.check_out,
      p_price_thb: bookingInsertPayload.price_thb,
      p_currency: bookingInsertPayload.currency,
      p_price_paid: bookingInsertPayload.price_paid,
      p_exchange_rate: bookingInsertPayload.exchange_rate,
      p_commission_thb: bookingInsertPayload.commission_thb,
      p_commission_rate: bookingInsertPayload.commission_rate,
      p_applied_commission_rate: bookingInsertPayload.applied_commission_rate,
      p_partner_earnings_thb: bookingInsertPayload.partner_earnings_thb,
      p_taxable_margin_amount: bookingInsertPayload.taxable_margin_amount,
      p_rounding_diff_pot: bookingInsertPayload.rounding_diff_pot,
      p_net_amount_local: bookingInsertPayload.net_amount_local,
      p_listing_currency: bookingInsertPayload.listing_currency,
      p_guest_name: bookingInsertPayload.guest_name,
      p_guest_phone: bookingInsertPayload.guest_phone,
      p_guest_email: bookingInsertPayload.guest_email,
      p_special_requests: bookingInsertPayload.special_requests,
      p_guests_count: bookingInsertPayload.guests_count,
      p_promo_code_used: bookingInsertPayload.promo_code_used,
      p_discount_amount: bookingInsertPayload.discount_amount,
      p_pricing_snapshot: bookingInsertPayload.pricing_snapshot,
      p_metadata: bookingInsertPayload.metadata,
      p_requested_guests: guestsCount,
      p_listing_tz: listingTimeZone,
    },
  );

  if (atomicError) {
    void notifySystemAlert(
      `🧾 <b>Критическая ошибка: не удалось создать бронирование (БД)</b>\n` +
        `<code>${escapeSystemAlertHtml(atomicError.message)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
    );
    if (
      String(atomicError.message || '').includes('VEHICLE_INTERVAL_CONFLICT') ||
      String(atomicError.message || '').includes('DATES_CONFLICT')
    ) {
      return {
        error: 'Dates not available',
        code: 'DATES_CONFLICT',
        conflictingBookings: [{ reason: 'INSUFFICIENT_CAPACITY' }],
      };
    }
    return { error: atomicError.message };
  }

  const atomic = Array.isArray(atomicRows) ? atomicRows[0] : null;
  if (!atomic?.ok) {
    if (atomic?.conflict_code === 'DATES_CONFLICT') {
      return {
        error: 'Dates not available',
        code: 'DATES_CONFLICT',
        conflictingBookings: [{ reason: 'INSUFFICIENT_CAPACITY' }],
      };
    }
    return { error: atomic?.conflict_code || 'Atomic booking failed' };
  }

  const { data: booking, error: bookingFetchError } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', atomic.booking_id)
    .single();

  if (bookingFetchError || !booking) {
    return { error: bookingFetchError?.message || 'Booking insert verification failed' };
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

  if (promoFlashSale && finalRenterId) {
    void MarketingNotificationsService.notifyGuestFlashSaleBookingCongrats({
      renterId: String(finalRenterId),
      listingTitle: listing.title ? String(listing.title) : null,
    })
  }

  logStructured({
    module: 'BookingService',
    stage: 'createBooking_success',
    bookingId: booking.id,
    listingId,
    renterId: finalRenterId || null,
    status: booking.status,
    taxRatePercent: feeSplit.taxRatePercent ?? 0,
    taxAmountThb: feeSplit.taxAmountThb ?? 0,
  })

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
      taxRatePercent: feeSplit.taxRatePercent ?? 0,
      taxAmountThb: feeSplit.taxAmountThb ?? 0,
    },
  };
}
