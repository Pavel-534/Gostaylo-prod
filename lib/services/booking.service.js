/**
 * Gostaylo - Booking Service
 * Handles availability, iCal sync, and booking status transitions
 */

import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from './pricing.service';
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url';

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
      .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
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
      .select('*, profiles!owner_id(id, email, first_name, last_name, custom_commission_rate)')
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
    
    return {
      success: true,
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
