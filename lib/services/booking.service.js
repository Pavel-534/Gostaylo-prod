/**
 * GoStayLo - Booking Service
 * Handles availability, iCal sync, and booking status transitions
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from './pricing.service';
import { CalendarService } from './calendar.service';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';
import { buildBookingPricingSnapshot } from '@/lib/booking-pricing-snapshot';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';

/**
 * Ensure a conversation exists between renter and partner for the given listing/booking.
 * If one already exists it is returned as-is; otherwise a new one is created.
 * A system message is always inserted to announce the booking.
 *
 * @param {{ bookingId, listingId, listing, renterId, partnerId, guestName, checkIn, checkOut, priceThb, pricingSnapshot?: object }} opts
 * @returns {Promise<string>} conversationId
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
    // Resolve display names from profiles
    const [renterResult, partnerResult] = await Promise.all([
      renterId ? supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', renterId).single() : Promise.resolve({ data: null }),
      supabaseAdmin.from('profiles').select('id,first_name,last_name,email').eq('id', partnerId).single(),
    ]);

    const renterProfile = renterResult.data;
    const partnerProfile = partnerResult.data;

    const renterName =
      (renterId && renterProfile)
        ? [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() || renterProfile.email || guestName || 'Guest'
        : guestName || 'Guest';

    const partnerName =
      partnerProfile
        ? [partnerProfile.first_name, partnerProfile.last_name].filter(Boolean).join(' ').trim() || partnerProfile.email || 'Host'
        : 'Host';

    // Check for existing conversation (by booking or listing+participants)
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
      // Create new conversation
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
        console.error('[BookingService] conversation insert error:', convErr.message);
        return null;
      }
      convId = newConvId;
    } else {
      // Всегда привязываем к текущей брони. Иначе при повторном запросе (тот же листинг +
      // те же участники) беседа остаётся на старом booking_id — в чате не PENDING и нет кнопок.
      await supabaseAdmin
        .from('conversations')
        .update({
          booking_id: bookingId,
          updated_at: now,
          last_message_at: now,
          status_label: 'PENDING',
        })
        .eq('id', convId)
    }

    // Insert system announcement message
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
    console.error('[BookingService] ensureBookingConversation error:', e);
    return null;
  }
}

/**
 * Chat thread for INQUIRY bookings (private trip or party > remaining spots).
 */
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
        console.error('[BookingService] inquiry conversation insert error:', convErr.message);
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

    const cin = checkIn ? String(checkIn).slice(0, 10) : '—';
    const cout = checkOut ? String(checkOut).slice(0, 10) : '—';
    const dateRangeLabel = `${cin} – ${cout}`;

    let text;
    let systemKey;
    if (privateTrip || negotiationRequest) {
      text = `Customer is interested in a private/special deal for ${dateRangeLabel} (${guestsCount} guests). Please provide a quote via Invoice.`;
      systemKey = 'private_special_deal_inquiry';
    } else {
      const price = priceThb ? ` · guide ฿${Math.round(priceThb).toLocaleString('en-US')}` : '';
      text = `🔔 Price / capacity inquiry: «${listing?.title || 'listing'}» · ${guestsCount} guests · ${dateRangeLabel}${price}. (Min. spots available on these dates: ${minRemainingSpots ?? '—'}).`;
      systemKey = 'capacity_price_inquiry';
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
        booking_id: bookingId,
        check_in: checkIn,
        check_out: checkOut,
        price_thb: priceThb,
        guests_count: guestsCount,
        private_trip: !!privateTrip,
        negotiation_request: !!negotiationRequest,
        min_remaining_spots: minRemainingSpots,
        listing_title: listing?.title,
        ...(pricingSnapshot && Object.keys(pricingSnapshot).length ? { pricing_snapshot: pricingSnapshot } : {}),
      },
      is_read: false,
      created_at: now,
    });

    return convId;
  } catch (e) {
    console.error('[BookingService] ensureInquiryConversation error:', e);
    return null;
  }
}

function mapListingStorageRow(listing) {
  if (!listing) return listing;
  return {
    ...listing,
    images: mapPublicImageUrls(listing.images || []),
    cover_image: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
  };
}

function mapBookingListingsJoin(booking) {
  if (!booking) return booking;
  if (!booking.listings) return booking;
  return { ...booking, listings: mapListingStorageRow(booking.listings) };
}

async function resolveListingCategorySlug(categoryId) {
  if (!categoryId) return '';
  const { data } = await supabaseAdmin
    .from('categories')
    .select('slug')
    .eq('id', categoryId)
    .maybeSingle();
  return String(data?.slug || '').toLowerCase();
}

export class BookingService {
  
  /**
   * Check availability (inventory-aware; delegates to CalendarService).
   */
  static async checkAvailability(listingId, checkIn, checkOut, options = {}) {
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
  static async verifyInventoryBeforePartnerConfirm(bookingId) {
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, listing_id, check_in, check_out, guests_count, status')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return { ok: false, error: 'Booking not found' };
    }

    const cin = String(booking.check_in).slice(0, 10);
    const cout = String(booking.check_out).slice(0, 10);
    const gc = Math.max(1, parseInt(booking.guests_count, 10) || 1);

    const cal = await CalendarService.checkAvailability(booking.listing_id, cin, cout, {
      guestsCount: gc,
      excludeBookingId: bookingId,
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
   * Create a new booking
   * NOTE: Uses supabaseAdmin which bypasses RLS
   */
  static async createBooking(bookingData) {
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
    } = bookingData;

    const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 1);
    
    // For anonymous/guest bookings, renter_id can be null
    // The guest info is stored in guest_name, guest_phone, guest_email fields
    const finalRenterId = renterId || null;
    
    // Get listing details
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select(
        '*, owner:profiles!owner_id(id, email, first_name, last_name, phone, telegram_id, custom_commission_rate)'
      )
      .eq('id', listingId)
      .single();
    
    if (listingError || !listing) {
      return { error: 'Listing not found' };
    }

    const listingCategorySlug = await resolveListingCategorySlug(listing.category_id);
    const isTourListing = listingCategorySlug === 'tours';
    if (isTourListing && rawGuests == null) {
      console.warn('[BookingService] Tour booking without guests_count, fallback to 1');
    }
    if (isTourListing && Number(rawGuests) === 0) {
      return { error: 'Tours require guests_count >= 1' };
    }
    
    const maxCap = Math.max(1, parseInt(listing.max_capacity, 10) || 1);
    if (guestsCount > maxCap) {
      return { error: `Party size exceeds listing capacity (${maxCap})` };
    }

    const availability = await this.checkAvailability(listingId, checkIn, checkOut, {
      guestsCount,
    });
    if (!availability.available) {
      return { error: 'Dates not available', conflictingBookings: availability.conflictingBookings };
    }
    
    // Calculate price
    const priceCalc = await PricingService.calculateBookingPrice(
      listingId,
      checkIn,
      checkOut,
      parseFloat(listing.base_price_thb),
      { listingCategorySlug, guestsCount }
    );
    
    if (priceCalc.error) {
      return { error: priceCalc.error };
    }
    
    let priceThb = priceCalc.totalPrice;
    let discountAmount = priceCalc.durationDiscountAmount || 0;
    let promoCodeUsed = null;
    let promoExtraDiscountThb = 0;

    if (promoCode) {
      const promoResult = await PricingService.validatePromoCode(promoCode, priceThb);
      if (promoResult.valid) {
        promoExtraDiscountThb = promoResult.discountAmount;
        discountAmount += promoResult.discountAmount;
        priceThb = promoResult.newTotal;
        promoCodeUsed = promoCode.toUpperCase();
      }
    }

    const pricingSnapshot = buildBookingPricingSnapshot(
      priceCalc,
      parseFloat(listing.base_price_thb),
      promoCodeUsed
        ? { promoCodeUsed, promoExtraDiscountThb }
        : {},
    );

    const commission = await PricingService.calculateCommission(priceThb, listing.owner_id);
    
    // Get exchange rate for currency conversion
    const rates = await PricingService.getExchangeRates();
    const rate = rates.find(r => r.code === currency);
    const exchangeRate = rate?.rateToThb || 1;
    const pricePaid = priceThb / exchangeRate;
    
    // Create booking with commission locked at request time ("Bread logic")
    // commission_rate and partner_earnings_thb are permanently saved
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        listing_id: listingId,
        renter_id: finalRenterId,
        partner_id: listing.owner_id,
        status: 'PENDING',
        check_in: checkIn,
        check_out: checkOut,
        price_thb: priceThb,
        currency,
        price_paid: pricePaid,
        exchange_rate: exchangeRate,
        commission_thb: commission.commissionThb,
        commission_rate: commission.commissionRate,
        partner_earnings_thb: commission.partnerEarnings,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        special_requests: specialRequests,
        guests_count: guestsCount,
        promo_code_used: promoCodeUsed,
        discount_amount: discountAmount,
        pricing_snapshot: pricingSnapshot,
      })
      .select()
      .single();
    
    if (bookingError) {
      void notifySystemAlert(
        `🧾 <b>Критическая ошибка: не удалось создать бронирование (БД)</b>\n` +
          `<code>${escapeSystemAlertHtml(bookingError.message)}</code>\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
      )
      return { error: bookingError.message };
    }
    
    // Update listing bookings count
    await supabaseAdmin
      .from('listings')
      .update({ bookings_count: (listing.bookings_count || 0) + 1 })
      .eq('id', listingId);

    // Auto-create or link a conversation so renter↔partner can communicate immediately
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
      )
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

  /**
   * Private / over-capacity price request — does not consume calendar inventory until confirmed.
   */
  static async createInquiryBooking(bookingData) {
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
    } = bookingData;

    const guestsCount = Math.max(1, parseInt(rawGuests, 10) || 1);
    const finalRenterId = renterId || null;

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select(
        '*, owner:profiles!owner_id(id, email, first_name, last_name, phone, telegram_id, custom_commission_rate)'
      )
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { error: 'Listing not found' };
    }

    const listingCategorySlug = await resolveListingCategorySlug(listing.category_id);
    const isTourListing = listingCategorySlug === 'tours';
    if (isTourListing && rawGuests == null) {
      console.warn('[BookingService] Tour inquiry without guests_count, fallback to 1');
    }
    if (isTourListing && Number(rawGuests) === 0) {
      return { error: 'Tours require guests_count >= 1' };
    }

    const priceCalc = await PricingService.calculateBookingPrice(
      listingId,
      checkIn,
      checkOut,
      parseFloat(listing.base_price_thb),
      { listingCategorySlug, guestsCount }
    );

    if (priceCalc.error) {
      return { error: priceCalc.error };
    }

    let priceThb = priceCalc.totalPrice;
    let discountAmount = (priceCalc.durationDiscountAmount || 0) + 0;
    let promoCodeUsed = null;
    let promoExtraDiscountThb = 0;

    if (promoCode) {
      const promoResult = await PricingService.validatePromoCode(promoCode, priceThb);
      if (promoResult.valid) {
        promoExtraDiscountThb = promoResult.discountAmount;
        discountAmount += promoResult.discountAmount;
        priceThb = promoResult.newTotal;
        promoCodeUsed = promoCode.toUpperCase();
      }
    }

    const pricingSnapshot = buildBookingPricingSnapshot(
      priceCalc,
      parseFloat(listing.base_price_thb),
      promoCodeUsed
        ? { promoCodeUsed, promoExtraDiscountThb }
        : {},
    );

    const commission = await PricingService.calculateCommission(priceThb, listing.owner_id);
    const rates = await PricingService.getExchangeRates();
    const rate = rates.find((r) => r.code === currency);
    const exchangeRate = rate?.rateToThb || 1;
    const pricePaid = priceThb / exchangeRate;

    const tag = privateTrip
      ? '[PRIVATE_TRIP_INQUIRY]'
      : negotiationRequest
        ? '[NEGOTIATION_REQUEST]'
        : '[CAPACITY_PRICE_INQUIRY]';
    const mergedSpecial = specialRequests ? `${specialRequests}\n${tag}` : tag;

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        listing_id: listingId,
        renter_id: finalRenterId,
        partner_id: listing.owner_id,
        status: 'INQUIRY',
        check_in: checkIn,
        check_out: checkOut,
        price_thb: priceThb,
        currency,
        price_paid: pricePaid,
        exchange_rate: exchangeRate,
        commission_thb: commission.commissionThb,
        commission_rate: commission.commissionRate,
        partner_earnings_thb: commission.partnerEarnings,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        special_requests: mergedSpecial,
        guests_count: guestsCount,
        promo_code_used: promoCodeUsed,
        discount_amount: discountAmount,
        pricing_snapshot: pricingSnapshot,
      })
      .select()
      .single();

    if (bookingError) {
      void notifySystemAlert(
        `🧾 <b>Критическая ошибка: не удалось создать inquiry-бронирование (БД)</b>\n` +
          `<code>${escapeSystemAlertHtml(bookingError.message)}</code>\n` +
          `listing: <code>${escapeSystemAlertHtml(listingId)}</code>`,
      )
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
      )
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

  /**
   * Update booking status
   */
  static async updateStatus(bookingId, newStatus, metadata = {}) {
    const validTransitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      INQUIRY: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],
      'PAID': ['COMPLETED', 'REFUNDED'],
      'COMPLETED': [],
      'CANCELLED': [],
      'REFUNDED': []
    };
    
    // Get current booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (error || !booking) {
      return { error: 'Booking not found' };
    }
    
    // Validate transition
    if (!validTransitions[booking.status]?.includes(newStatus)) {
      return { error: `Cannot transition from ${booking.status} to ${newStatus}` };
    }
    
    // Prepare update data
    const updateData = { status: newStatus };
    
    if (newStatus === 'CONFIRMED') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (newStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date().toISOString();
    } else if (newStatus === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString();
    } else if (newStatus === 'PAID') {
      updateData.checked_in_at = metadata.checkedInAt || new Date().toISOString();
    }
    
    // Update booking
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();
    
    if (updateError) {
      return { error: updateError.message };
    }

    try {
      await syncBookingStatusToConversationChat({
        bookingId,
        previousStatus: booking.status,
        newStatus,
        declineReasonKey: metadata.declineReasonKey,
        declineReasonDetail: metadata.declineReasonDetail,
        reasonFreeText: metadata.reason,
      })
    } catch (e) {
      console.error('[BookingService] chat sync', e)
    }

    return { success: true, booking: updated };
  }
  
  /**
   * Get bookings by filter
   */
  static async getBookings(filters = {}) {
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        listings (id, title, district, images, base_price_thb),
        renter:profiles!renter_id (id, email, first_name, last_name),
        partner:profiles!partner_id (id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });
    
    if (filters.renterId) {
      query = query.eq('renter_id', filters.renterId);
    }
    if (filters.partnerId) {
      query = query.eq('partner_id', filters.partnerId);
    }
    if (filters.listingId) {
      query = query.eq('listing_id', filters.listingId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return { error: error.message, bookings: [] };
    }
    
    return { bookings: (data || []).map(mapBookingListingsJoin) };
  }
  
  /**
   * Get booking by ID
   */
  static async getBookingById(bookingId) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        listings (id, title, district, images, base_price_thb, owner_id, metadata),
        renter:profiles!renter_id (id, email, first_name, last_name, phone, telegram_id),
        partner:profiles!partner_id (id, email, first_name, last_name)
      `)
      .eq('id', bookingId)
      .single();
    
    if (error) {
      return null;
    }
    
    return mapBookingListingsJoin(data);
  }
}

export default BookingService;
