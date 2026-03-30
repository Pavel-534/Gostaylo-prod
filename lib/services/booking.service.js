/**
 * Gostaylo - Booking Service
 * Handles availability, iCal sync, and booking status transitions
 */

import { supabaseAdmin } from '@/lib/supabase';
import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking-occupancy-statuses';
import { PricingService } from './pricing.service';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';

/**
 * Ensure a conversation exists between renter and partner for the given listing/booking.
 * If one already exists it is returned as-is; otherwise a new one is created.
 * A system message is always inserted to announce the booking.
 *
 * @param {{ bookingId, listingId, listing, renterId, partnerId, guestName, checkIn, checkOut, priceThb }} opts
 * @returns {Promise<string>} conversationId
 */
async function ensureBookingConversation({ bookingId, listingId, listing, renterId, partnerId, guestName, checkIn, checkOut, priceThb }) {
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
      // Link existing conversation to booking if not yet linked
      await supabaseAdmin
        .from('conversations')
        .update({ booking_id: bookingId, updated_at: now, last_message_at: now })
        .eq('id', convId)
        .is('booking_id', null);
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

export class BookingService {
  
  /**
   * Check availability for a listing on specific dates
   */
  static async checkAvailability(listingId, checkIn, checkOut) {
    // Get existing bookings that overlap with requested dates
    // Overlap condition: existing.check_in < requested.check_out AND existing.check_out > requested.check_in
    const { data: conflictingBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, check_in, check_out, status')
      .eq('listing_id', listingId)
      .in('status', OCCUPYING_BOOKING_STATUSES)
      .lt('check_in', checkOut)
      .gt('check_out', checkIn);
    
    const hasConflict = conflictingBookings && conflictingBookings.length > 0;
    
    return {
      available: !hasConflict,
      conflictingBookings: conflictingBookings || []
    };
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
      promoCode
    } = bookingData;
    
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
    
    // Check availability
    const availability = await this.checkAvailability(listingId, checkIn, checkOut);
    if (!availability.available) {
      return { error: 'Dates not available', conflictingBookings: availability.conflictingBookings };
    }
    
    // Calculate price
    const priceCalc = await PricingService.calculateBookingPrice(
      listingId, checkIn, checkOut, parseFloat(listing.base_price_thb)
    );
    
    if (priceCalc.error) {
      return { error: priceCalc.error };
    }
    
    let priceThb = priceCalc.totalPrice;
    let discountAmount = 0;
    let promoCodeUsed = null;
    
    // Apply promo code if provided
    if (promoCode) {
      const promoResult = await PricingService.validatePromoCode(promoCode, priceThb);
      if (promoResult.valid) {
        discountAmount = promoResult.discountAmount;
        priceThb = promoResult.newTotal;
        promoCodeUsed = promoCode.toUpperCase();
      }
    }
    
    // Calculate commission
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
        promo_code_used: promoCodeUsed,
        discount_amount: discountAmount
      })
      .select()
      .single();
    
    if (bookingError) {
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
    });
    
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
        commission: commission
      }
    };
  }
  
  /**
   * Update booking status
   */
  static async updateStatus(bookingId, newStatus, metadata = {}) {
    const validTransitions = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PAID', 'CANCELLED'],
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
        renter:profiles!renter_id (id, email, first_name, last_name, phone),
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
