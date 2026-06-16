/**
 * Standard (non-inquiry) booking creation.
 * Stage 2.1 — вынесено из booking.service.js
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '../pricing.service';
import { mapPublicImageUrls } from '@/lib/public-image-url';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { logStructured } from '@/lib/critical-telemetry.js';
import { BOOKING_STATUS } from '@/lib/config/app-constants';
import {
  gateClientSubtotalAttestation,
  gateClientGuestTotalAttestation,
} from '@/lib/services/booking/booking-price-gate.js';
import { insertBookingViaAtomicRpc } from '@/lib/services/booking/booking-atomic-insert.js';
import { normalizeBookingInstantForDb } from '@/lib/listing-date';
import { ensureBookingConversation, checkAvailability } from './inquiry.service';
import { resolveListingCategorySlug } from './query.service';
import { normalizeListingCurrency } from './pricing.service';
import { pickCheckInInstructionsForBookingMetadata } from '@/lib/booking/booking-check-in-instructions';
import { MarketingNotificationsService } from '@/lib/services/marketing-notifications.service';
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot';
import { resolveBookingPricingWithEngine } from './pricing-engine-integration.js';
import { assertTreasuryOpsAllowed } from '@/lib/treasury/treasury-ops-config.js';
import { ReferralAttributionService } from '@/lib/referral/attribution.service.js';
import { assertListingBookableForGuest } from '@/lib/listing/listing-booking-eligibility';

export async function createBooking(bookingData) {
  const pauseGate = await assertTreasuryOpsAllowed('booking');
  if (!pauseGate.allowed && !bookingData?.bypassTreasuryPause) {
    return {
      success: false,
      error: pauseGate.code || 'EMERGENCY_PAUSE',
      message: pauseGate.message,
    };
  }
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
    uiLocale,
  } = bookingData;

  const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 1);

  const finalRenterId = renterId || null;
  const targetStatus =
    String(forceStatus || BOOKING_STATUS.PENDING).toUpperCase() === BOOKING_STATUS.CONFIRMED
      ? BOOKING_STATUS.CONFIRMED
      : BOOKING_STATUS.PENDING;

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('*, owner:profiles!owner_id(id, email, first_name, last_name, phone, telegram_id, custom_commission_rate)')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return { error: 'Listing not found' };
  }

  const bookableGate = await assertListingBookableForGuest(listing);
  if (!bookableGate.ok) {
    return { error: bookableGate.error, code: bookableGate.code };
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
  const subGate = gateClientSubtotalAttestation({
    path: 'createBooking',
    listingId,
    renterId: finalRenterId,
    serverSubtotalThb,
    clientQuotedSubtotalThb,
    required: true,
  });
  if (!subGate.ok) {
    return { error: subGate.error, code: subGate.code };
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

  const pricing = await resolveBookingPricingWithEngine({
    listing,
    listingId,
    priceThb,
    priceCalc,
    currency,
    promoCodeUsed,
    promoExtraDiscountThb,
    promoFlashSale,
  });
  if (pricing.error) {
    return { error: pricing.error, code: pricing.code };
  }

  const activeFeeSplit = pricing.feeSplit;
  const roundedGuestTotalThb = pricing.roundedGuestTotalThb;
  const roundingDiffPotThb = pricing.roundingDiffPotThb;
  const pricingSnapshot = pricing.pricingSnapshot;
  const pricingEngineV2Active = pricing.pricingEngineV2Active;

  const commission = {
    commissionRate: activeFeeSplit.hostCommissionRate,
    commissionThb: activeFeeSplit.guestServiceFeeThb,
    partnerEarnings: activeFeeSplit.partnerEarningsThb,
    guestServiceFeePercent: activeFeeSplit.guestServiceFeePercent,
    guestPayableThb: activeFeeSplit.guestPayableThb,
  };

  const guestGate = gateClientGuestTotalAttestation({
    path: 'createBooking',
    listingId,
    renterId: finalRenterId,
    clientQuotedGuestTotalThb,
    guestPayableThb: activeFeeSplit.guestPayableThb,
    pricingSnapshot,
    pricingEngineV2Active,
    precomputedRoundedThb: roundedGuestTotalThb,
    enforceMinTotal: true,
  });
  if (!guestGate.ok) {
    return { error: guestGate.error, code: guestGate.code };
  }
  const attestationGuestTotalThb = guestGate.attestationGuestTotalThb;

  const listingCurrency = normalizeListingCurrency(
    listing.base_currency || listing.metadata?.base_currency || listing.metadata?.currency || 'THB',
  );
  const exchangeRate = await PricingService.getCheckoutRateToThb(currency, listingCurrency);
  const taxableMarginAmount = Math.max(0, roundedGuestTotalThb - activeFeeSplit.partnerEarningsThb);
  const pricePaid = roundedGuestTotalThb / exchangeRate;
  const netAmountLocal = await PricingService.convertThbToCurrencyRaw(
    activeFeeSplit.partnerEarningsThb,
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
    commission_thb: activeFeeSplit.guestServiceFeeThb,
    commission_rate: activeFeeSplit.hostCommissionRate,
    applied_commission_rate: activeFeeSplit.hostCommissionRate,
    partner_earnings_thb: activeFeeSplit.partnerEarningsThb,
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
    metadata: pickCheckInInstructionsForBookingMetadata(listing, { uiLocale }),
  };

  const atomicResult = await insertBookingViaAtomicRpc(bookingInsertPayload, {
    guestsCount,
    listingTimeZone,
    listingId,
  });
  if (atomicResult.error) {
    return atomicResult;
  }

  const { data: booking, error: bookingFetchError } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', atomicResult.bookingId)
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

  if (finalRenterId && booking?.id) {
    void (async () => {
      try {
        const attributionId = await ReferralAttributionService.attachBooking({
          bookingId: booking.id,
          renterId: finalRenterId,
        });
        if (attributionId) {
          const prevMeta =
            booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
          await supabaseAdmin
            .from('bookings')
            .update({
              metadata: { ...prevMeta, referral_attribution_id: attributionId },
            })
            .eq('id', booking.id);
        }
      } catch (attrErr) {
        console.warn('[BookingCreation] referral attribution:', attrErr?.message || attrErr);
      }
    })();
  }

  logStructured({
    module: 'BookingService',
    stage: 'createBooking_success',
    bookingId: booking.id,
    listingId,
    renterId: finalRenterId || null,
    status: booking.status,
    taxRatePercent: activeFeeSplit.taxRatePercent ?? 0,
    taxAmountThb: activeFeeSplit.taxAmountThb ?? 0,
    pricingEngineV2: pricingEngineV2Active,
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
      taxRatePercent: activeFeeSplit.taxRatePercent ?? 0,
      taxAmountThb: activeFeeSplit.taxAmountThb ?? 0,
    },
  };
}
