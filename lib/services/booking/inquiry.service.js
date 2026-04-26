/**
 * Inquiries, chat thread bootstrap, capacity / calendar checks.
 * Stage 2.1 — вынесено из booking.service.js
 */

import { supabaseAdmin } from '@/lib/supabase';
import { CalendarService } from '../calendar.service';
import { mapPublicImageUrls } from '@/lib/public-image-url';
import { buildBookingPricingSnapshot } from '@/lib/booking-pricing-snapshot';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button.js';
import { recordCriticalSignal } from '@/lib/critical-telemetry.js';
import {
  MIN_BOOKING_GUEST_TOTAL_THB,
  computeRoundedGuestTotalPot,
} from '@/lib/booking-price-integrity.js';
import { normalizeBookingInstantForDb, getListingDateTimeZone, anchorUtcMidnightToListingDayStartIso } from '@/lib/listing-date';
import { formatChatListingTimeFootnote } from '@/lib/email/booking-email-i18n';
import { PricingService } from '../pricing.service';
import { resolveListingCategorySlug } from './query.service';
import { normalizeListingCurrency } from './pricing.service';
import { pickCheckInInstructionsForBookingMetadata } from '@/lib/booking/booking-check-in-instructions';
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot';

/** Транспорт / яхты: в чате показываем начало и конец аренды с временем. */
const INQUIRY_SHOW_TIME_SLUGS = new Set(['vehicles', 'yachts']);

function formatInquiryPartyLineRu(categorySlug, guestsCount) {
  const n = Math.max(1, Number(guestsCount) || 1);
  const s = String(categorySlug || '').toLowerCase();
  if (s === 'vehicles' || s === 'yachts') return `Участников поездки: ${n}.`;
  return `Гостей: ${n}.`;
}

function formatInquiryPartyLineEn(categorySlug, guestsCount) {
  const n = Math.max(1, Number(guestsCount) || 1);
  const s = String(categorySlug || '').toLowerCase();
  if (s === 'vehicles' || s === 'yachts') return `Party size: ${n}.`;
  return `Guests: ${n}.`;
}

/**
 * @param {string|Date|null|undefined} iso
 * @param {'ru'|'en'} locale
 * @param {boolean} withTime
 */
function formatInquiryInstantForChat(iso, locale, withTime) {
  const tz = getListingDateTimeZone();
  const anchored = withTime ? anchorUtcMidnightToListingDayStartIso(iso) : iso;
  const d = anchored ? new Date(anchored) : null;
  if (!d || Number.isNaN(d.getTime())) return String(iso || '—');
  const loc = locale === 'en' ? 'en-GB' : 'ru-RU';
  if (withTime) {
    return d.toLocaleString(loc, {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(loc, {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatInquiryDateRangeForChat(checkIn, checkOut, locale, categorySlug) {
  const withTime = INQUIRY_SHOW_TIME_SLUGS.has(String(categorySlug || '').toLowerCase());
  return `${formatInquiryInstantForChat(checkIn, locale, withTime)} — ${formatInquiryInstantForChat(
    checkOut,
    locale,
    withTime,
  )}`;
}

/**
 * Ensure a conversation exists between renter and partner for the given listing/booking.
 */
export async function ensureBookingConversation({
  bookingId,
  listingId,
  listing,
  renterId,
  partnerId,
  guestName,
  checkIn,
  checkOut,
  priceThb,
  pricingSnapshot = null,
}) {
  try {
    const [renterResult, partnerResult] = await Promise.all([
      renterId ? supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', renterId).single() : Promise.resolve({ data: null }),
      supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', partnerId).single(),
    ]);

    const renterProfile = renterResult.data;
    const partnerProfile = partnerResult.data;

    const renterName =
      renterId && renterProfile
        ? [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() || renterProfile.email || guestName || 'Guest'
        : guestName || 'Guest';

    const partnerName = partnerProfile
      ? [partnerProfile.first_name, partnerProfile.last_name].filter(Boolean).join(' ').trim() || partnerProfile.email || 'Host'
      : 'Host';

    let convId = null;

    if (bookingId) {
      const { data: byBooking } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .single();
      if (byBooking?.id) convId = byBooking.id;
    }

    if (!convId && renterId) {
      const { data: byListing } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('partner_id', partnerId)
        .eq('renter_id', renterId)
        .limit(1)
        .single();
      if (byListing?.id) convId = byListing.id;
    }

    const now = new Date().toISOString();

    if (!convId) {
      const newConvId = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const listingCategory = listing?.category_id ? String(listing.category_id) : null;

      const { error: convErr } = await supabaseAdmin.from('conversations').insert({
        id: newConvId,
        listing_id: listingId,
        listing_category: listingCategory,
        booking_id: bookingId,
        partner_id: partnerId,
        partner_name: partnerName,
        renter_id: renterId || null,
        renter_name: renterName,
        type: 'BOOKING',
        status: 'OPEN',
        status_label: 'PENDING',
        is_priority: false,
        created_at: now,
        updated_at: now,
        last_message_at: now,
      });

      if (convErr) {
        console.error('[Inquiry] conversation insert error:', convErr.message);
        return null;
      }
      convId = newConvId;
    } else {
      await supabaseAdmin
        .from('conversations')
        .update({
          booking_id: bookingId,
          updated_at: now,
          last_message_at: now,
          status_label: 'PENDING',
        })
        .eq('id', convId);
    }

    const cin = checkIn ? new Date(checkIn).toLocaleDateString('ru-RU') : '—';
    const cout = checkOut ? new Date(checkOut).toLocaleDateString('ru-RU') : '—';
    const price = priceThb ? `฿${Math.round(priceThb).toLocaleString('ru-RU')}` : '';
    const text = `📋 Новое бронирование: ${listing?.title || 'объект'} · ${cin} – ${cout}${price ? ' · ' + price : ''}.`;

    const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await supabaseAdmin.from('messages').insert({
      id: msgId,
      conversation_id: convId,
      sender_id: renterId || partnerId,
      sender_role: renterId ? 'RENTER' : 'PARTNER',
      sender_name: renterName,
      message: text,
      content: text,
      type: 'system',
      metadata: {
        system_key: 'booking_created',
        booking_announcement: true,
        booking_id: bookingId,
        check_in: checkIn,
        check_out: checkOut,
        price_thb: priceThb,
        listing_title: listing?.title,
        ...(pricingSnapshot && Object.keys(pricingSnapshot).length ? { pricing_snapshot: pricingSnapshot } : {}),
      },
      is_read: false,
      created_at: now,
    });

    return convId;
  } catch (e) {
    console.error('[Inquiry] ensureBookingConversation error:', e);
    return null;
  }
}

async function ensureInquiryConversation({
  bookingId,
  listingId,
  listing,
  renterId,
  partnerId,
  guestName,
  checkIn,
  checkOut,
  priceThb,
  guestsCount,
  privateTrip,
  negotiationRequest = false,
  minRemainingSpots,
  pricingSnapshot = null,
}) {
  try {
    const [renterResult, partnerResult] = await Promise.all([
      renterId ? supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', renterId).single() : Promise.resolve({ data: null }),
      supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', partnerId).single(),
    ]);

    const renterProfile = renterResult.data;
    const partnerProfile = partnerResult.data;

    const renterName =
      renterId && renterProfile
        ? [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() || renterProfile.email || guestName || 'Guest'
        : guestName || 'Guest';

    const partnerName = partnerProfile
      ? [partnerProfile.first_name, partnerProfile.last_name].filter(Boolean).join(' ').trim() || partnerProfile.email || 'Host'
      : 'Host';

    let convId = null;

    if (bookingId) {
      const { data: byBooking } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .single();
      if (byBooking?.id) convId = byBooking.id;
    }

    if (!convId && renterId) {
      const { data: byListing } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('partner_id', partnerId)
        .eq('renter_id', renterId)
        .limit(1)
        .single();
      if (byListing?.id) convId = byListing.id;
    }

    const now = new Date().toISOString();

    if (!convId) {
      const newConvId = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const listingCategory = listing?.category_id ? String(listing.category_id) : null;

      const { error: convErr } = await supabaseAdmin.from('conversations').insert({
        id: newConvId,
        listing_id: listingId,
        listing_category: listingCategory,
        booking_id: bookingId,
        partner_id: partnerId,
        partner_name: partnerName,
        renter_id: renterId || null,
        renter_name: renterName,
        type: 'INQUIRY',
        status: 'OPEN',
        status_label: 'INQUIRY',
        is_priority: false,
        created_at: now,
        updated_at: now,
        last_message_at: now,
      });

      if (convErr) {
        console.error('[Inquiry] inquiry conversation insert error:', convErr.message);
        return null;
      }
      convId = newConvId;
    } else {
      await supabaseAdmin
        .from('conversations')
        .update({
          booking_id: bookingId,
          type: 'INQUIRY',
          status_label: 'INQUIRY',
          updated_at: now,
          last_message_at: now,
        })
        .eq('id', convId);
    }

    const categorySlug = await resolveListingCategorySlug(listing?.category_id);
    const dateRangeRu = formatInquiryDateRangeForChat(checkIn, checkOut, 'ru', categorySlug);
    const dateRangeEn = formatInquiryDateRangeForChat(checkIn, checkOut, 'en', categorySlug);
    const showDetailedTimes = INQUIRY_SHOW_TIME_SLUGS.has(String(categorySlug || '').toLowerCase());
    const district = listing?.district;
    let timeBlockRu = '';
    let timeBlockEn = '';
    if (showDetailedTimes) {
      timeBlockRu = `Начало аренды: ${formatInquiryInstantForChat(checkIn, 'ru', true)}\nОкончание аренды: ${formatInquiryInstantForChat(checkOut, 'ru', true)}\n${formatChatListingTimeFootnote('ru', district)}`;
      timeBlockEn = `Rental start: ${formatInquiryInstantForChat(checkIn, 'en', true)}\nRental end: ${formatInquiryInstantForChat(checkOut, 'en', true)}\n${formatChatListingTimeFootnote('en', district)}`;
    }

    let text;
    let systemKey;
    let inquiryBodyRu;
    let inquiryBodyEn;

    if (privateTrip || negotiationRequest) {
      systemKey = 'private_special_deal_inquiry';
      if (showDetailedTimes) {
        inquiryBodyRu = `${timeBlockRu}\n\nИндивидуальное предложение. ${formatInquiryPartyLineRu(categorySlug, guestsCount)} Ответьте, выставив счёт в чате.`;
        inquiryBodyEn = `${timeBlockEn}\n\nPrivate / special deal. ${formatInquiryPartyLineEn(categorySlug, guestsCount)} Please send a quote via Invoice.`;
      } else {
        inquiryBodyRu = `Гость интересуется индивидуальным предложением на период ${dateRangeRu}. ${formatInquiryPartyLineRu(categorySlug, guestsCount)} Ответьте, выставив счёт в чате.`;
        inquiryBodyEn = `The guest is interested in a private/special deal for ${dateRangeEn}. ${formatInquiryPartyLineEn(categorySlug, guestsCount)} Please send a quote via Invoice.`;
      }
      text = inquiryBodyRu;
    } else {
      systemKey = 'capacity_price_inquiry';
      const priceRu = priceThb ? ` Ориентировочная цена: ฿${Math.round(priceThb).toLocaleString('ru-RU')}.` : '';
      const priceEn = priceThb ? ` Guide price: ฿${Math.round(priceThb).toLocaleString('en-US')}.` : '';
      const isVehicleCat = String(categorySlug || '').toLowerCase() === 'vehicles';
      const spotsRu = minRemainingSpots ?? '—';
      const spotsEn = minRemainingSpots ?? '—';
      const inventoryLineRu = isVehicleCat
        ? ' Транспорт на эти даты свободен (ожидает вашего подтверждения).'
        : ` Минимум свободных мест на эти даты: ${spotsRu}.`;
      const inventoryLineEn = isVehicleCat
        ? ' Vehicle is available for these dates (awaiting your confirmation).'
        : ` Min. spots available on these dates: ${spotsEn}.`;
      if (showDetailedTimes) {
        inquiryBodyRu = `${timeBlockRu}\n\n${formatInquiryPartyLineRu(categorySlug, guestsCount)}${priceRu}${inventoryLineRu}`;
        inquiryBodyEn = `${timeBlockEn}\n\n${formatInquiryPartyLineEn(categorySlug, guestsCount)}${priceEn}${inventoryLineEn}`;
      } else {
        inquiryBodyRu = `${formatInquiryPartyLineRu(categorySlug, guestsCount)} Период: ${dateRangeRu}.${priceRu}${inventoryLineRu}`;
        inquiryBodyEn = `${formatInquiryPartyLineEn(categorySlug, guestsCount)} Period: ${dateRangeEn}.${priceEn}${inventoryLineEn}`;
      }
      text = inquiryBodyRu;
    }

    const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await supabaseAdmin.from('messages').insert({
      id: msgId,
      conversation_id: convId,
      sender_id: renterId || partnerId,
      sender_role: renterId ? 'RENTER' : 'PARTNER',
      sender_name: renterName,
      message: text,
      content: text,
      type: 'system',
      metadata: {
        system_key: systemKey,
        inquiry_announcement: true,
        inquiry_body_ru: inquiryBodyRu,
        inquiry_body_en: inquiryBodyEn,
        listing_category_slug: categorySlug || null,
        booking_id: bookingId,
        check_in: checkIn,
        check_out: checkOut,
        price_thb: priceThb,
        guests_count: guestsCount,
        private_trip: !!privateTrip,
        negotiation_request: !!negotiationRequest,
        min_remaining_spots: String(categorySlug || '').toLowerCase() === 'vehicles' ? null : minRemainingSpots,
        listing_title: listing?.title,
        ...(pricingSnapshot && Object.keys(pricingSnapshot).length ? { pricing_snapshot: pricingSnapshot } : {}),
      },
      is_read: false,
      created_at: now,
    });

    return convId;
  } catch (e) {
    console.error('[Inquiry] ensureInquiryConversation error:', e);
    return null;
  }
}

/**
 * Check availability (inventory-aware; delegates to CalendarService).
 */
export async function checkAvailability(listingId, checkIn, checkOut, options = {}) {
  const r = await CalendarService.checkAvailability(listingId, checkIn, checkOut, options);
  if (!r.success) {
    return { available: false, conflictingBookings: [], error: r.error };
  }
  return {
    available: !!r.available,
    conflictingBookings: r.conflicts?.length ? r.conflicts : [],
    calendarResult: r,
  };
}

/**
 * Last-line defense on partner confirm: exclude this booking from the guest sum, then ensure capacity fits.
 */
export async function verifyInventoryBeforePartnerConfirm(bookingId) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, listing_id, check_in, check_out, guests_count, status')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return { ok: false, error: 'Booking not found' };
  }

  const { data: listingRow } = await supabaseAdmin
    .from('listings')
    .select('category_id, metadata')
    .eq('id', booking.listing_id)
    .maybeSingle();

  let listingCategorySlug = await resolveListingCategorySlug(listingRow?.category_id);
  if (!listingCategorySlug && listingRow?.metadata && typeof listingRow.metadata === 'object') {
    listingCategorySlug = String(
      listingRow.metadata.category_slug || listingRow.metadata.categorySlug || '',
    ).toLowerCase();
  }

  const isVehicle = listingCategorySlug === 'vehicles';

  const cin = booking.check_in;
  const cout = booking.check_out;
  const gc = Math.max(1, parseInt(booking.guests_count, 10) || 1);

  const cal = await CalendarService.checkAvailability(booking.listing_id, cin, cout, {
    guestsCount: isVehicle ? 1 : gc,
    excludeBookingId: bookingId,
    listingCategorySlugOverride: isVehicle ? 'vehicles' : undefined,
    occupyingStatusesCsv: isVehicle ? 'CONFIRMED,PAID,PAID_ESCROW,CHECKED_IN' : undefined,
  });

  if (!cal.success) {
    return { ok: false, error: cal.error || 'Availability check failed' };
  }
  if (!cal.available) {
    return {
      ok: false,
      error: 'INSUFFICIENT_CAPACITY',
      conflicts: cal.conflicts,
      calendarResult: cal,
    };
  }
  return { ok: true };
}

/**
 * Private / over-capacity price request — does not consume calendar inventory until confirmed.
 */
export async function createInquiryBooking(bookingData) {
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
    privateTrip = false,
    negotiationRequest = false,
    minRemainingSpots = null,
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
  const listingTimeZone = resolveListingTimeZoneFromMetadata(listing.metadata);
  const isTourListing = listingCategorySlug === 'tours';
  if (isTourListing && rawGuests == null) {
    console.warn('[Inquiry] Tour inquiry without guests_count, fallback to 1');
  }
  if (isTourListing && Number(rawGuests) === 0) {
    return { error: 'Tours require guests_count >= 1' };
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

  const needsPriceAttestation = !privateTrip && !negotiationRequest;
  if (needsPriceAttestation) {
    const serverSubtotalThb = Math.round(Number(priceCalc.totalPrice));
    if (clientQuotedSubtotalThb === undefined || clientQuotedSubtotalThb === null) {
      return {
        error: 'Price attestation required (clientQuotedSubtotalThb)',
        code: 'PRICE_ATTESTATION_REQUIRED',
      };
    }
    const clientSubtotalThb = Math.round(Number(clientQuotedSubtotalThb));
    if (!Number.isFinite(clientSubtotalThb) || serverSubtotalThb !== clientSubtotalThb) {
      const fraudBanMarkupInq = buildFraudBanReplyMarkup(finalRenterId);
      void notifySystemAlert(
        `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> createInquiryBooking (subtotal)\n` +
          `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
          `createInquiryBooking: клиентская сумма ≠ серверной\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
          `ожидалось THB: <b>${serverSubtotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(clientQuotedSubtotalThb))}</b>\n` +
          `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
        fraudBanMarkupInq ? { reply_markup: fraudBanMarkupInq } : {},
      );
      recordCriticalSignal('PRICE_TAMPERING', {
        tag: '[FRAUD_DETECTION]',
        banUserId: finalRenterId || null,
        detailLines: [
          'path: createInquiryBooking',
          `listing: ${listingId}`,
          `server THB: ${serverSubtotalThb}`,
          `client THB: ${clientSubtotalThb}`,
          `renter: ${finalRenterId || '—'}`,
        ],
      });
      return { error: 'Price verification failed', code: 'PRICE_MISMATCH' };
    }
  }

  let priceThb = priceCalc.totalPrice;
  let discountAmount = (priceCalc.durationDiscountAmount || 0) + 0;
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

  const skipTransactionalMin = privateTrip === true || negotiationRequest === true;

  if (!Number.isFinite(Number(priceThb)) || Number(priceThb) < 0) {
    void notifySystemAlert(
      `[SECURITY_ALERT] <b>Invalid THB subtotal after pricing</b>\n` +
        `path: createInquiryBooking\n` +
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

  if (!skipTransactionalMin) {
    const quotedGuestTotalRawInq = clientQuotedGuestTotalThb;
    if (quotedGuestTotalRawInq !== undefined && quotedGuestTotalRawInq !== null) {
      const qg = Math.round(Number(quotedGuestTotalRawInq));
      if (!Number.isFinite(qg) || qg !== roundedGuestTotalThb) {
        const fraudBanMarkupGuestInq = buildFraudBanReplyMarkup(finalRenterId);
        void notifySystemAlert(
          `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> createInquiryBooking (guest total)\n` +
            `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
            `ожидалось итог THB (с учетом pot-rounding): <b>${roundedGuestTotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(quotedGuestTotalRawInq))}</b>\n` +
            `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
            `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
          fraudBanMarkupGuestInq ? { reply_markup: fraudBanMarkupGuestInq } : {},
        );
        recordCriticalSignal('PRICE_TAMPERING', {
          tag: '[FRAUD_DETECTION]',
          banUserId: finalRenterId || null,
          detailLines: [
            'path: createInquiryBooking guest total',
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
          `path: createInquiryBooking\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
          `guest payable THB: <b>${roundedGuestTotalThb}</b> (min <b>${MIN_BOOKING_GUEST_TOTAL_THB}</b>)\n` +
          `renter: <code>${escapeSystemAlertHtml(finalRenterId || '—')}</code>`,
      );
      return {
        error: `Minimum payable total is ${MIN_BOOKING_GUEST_TOTAL_THB} THB (subtotal + service fee).`,
        code: 'BOOKING_MIN_TOTAL_THB',
      };
    }
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
  const netAmountLocal = await PricingService.convertThbToCurrencyRaw(feeSplit.partnerEarningsThb, listingCurrency);

  const tag = privateTrip
    ? 'Тип заявки: частная поездка (запрос к хосту).'
    : negotiationRequest
      ? 'Тип заявки: запрос особой цены / персонального предложения.'
      : 'Тип заявки: запрос цены и наличия (вместимость / даты).';
  const mergedSpecial = specialRequests ? `${specialRequests}\n\n${tag}` : tag;

  const checkInDbInq = normalizeBookingInstantForDb(checkIn, listingTimeZone) || checkIn;
  const checkOutDbInq = normalizeBookingInstantForDb(checkOut, listingTimeZone) || checkOut;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      listing_id: listingId,
      renter_id: finalRenterId,
      partner_id: listing.owner_id,
      status: 'INQUIRY',
      check_in: checkInDbInq,
      check_out: checkOutDbInq,
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
      special_requests: mergedSpecial,
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
      `🧾 <b>Критическая ошибка: не удалось создать inquiry-бронирование (БД)</b>\n` +
        `<code>${escapeSystemAlertHtml(bookingError.message)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
    );
    return { error: bookingError.message };
  }

  await supabaseAdmin
    .from('listings')
    .update({ bookings_count: (listing.bookings_count || 0) + 1 })
    .eq('id', listingId);

  const conversationId = await ensureInquiryConversation({
    bookingId: booking.id,
    listingId,
    listing,
    renterId: finalRenterId,
    partnerId: listing.owner_id,
    guestName,
    checkIn,
    checkOut,
    priceThb,
    guestsCount,
    privateTrip,
    negotiationRequest,
    minRemainingSpots,
    pricingSnapshot,
  });

  if (!conversationId) {
    void notifySystemAlert(
      `💬 <b>Inquiry создан, чат не привязан</b>\n` +
        `booking: <code>${escapeSystemAlertHtml(booking.id)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
    );
  }

  return {
    success: true,
    inquiry: true,
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
      commission,
    },
  };
}
