/**
 * Gostaylo - Bookings API (v2)
 * GET /api/v2/bookings - List bookings
 * POST /api/v2/bookings - Create booking
 * 
 * SECURITY: Server-side double-booking prevention using CalendarService
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { CalendarService } from '@/lib/services/calendar.service';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimitCheck } from '@/lib/rate-limit';
import { createBookingSchema } from '@/lib/validations/booking';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      renterId: searchParams.get('renterId'),
      partnerId: searchParams.get('partnerId'),
      listingId: searchParams.get('listingId'),
      status: searchParams.get('status'),
      limit: parseInt(searchParams.get('limit')) || 50
    };
    
    const result = await BookingService.getBookings(filters);
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: result.bookings,
      count: result.bookings.length
    });
    
  } catch (error) {
    console.error('[BOOKINGS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const rl = rateLimitCheck(request, 'booking');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  try {
    const body = await request.json();
    
    const parseResult = createBookingSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      const message = firstError?.message || 'Invalid request data';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
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
      currency,
      promoCode
    } = parseResult.data;
    
    // ========================================
    // SECURITY LOCK: Server-Side Availability Check
    // Prevents double-bookings even if frontend is bypassed
    // ========================================
    const availabilityCheck = await CalendarService.checkAvailability(listingId, checkIn, checkOut);
    
    if (!availabilityCheck.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to check availability' 
      }, { status: 500 });
    }
    
    if (!availabilityCheck.available) {
      // 409 Conflict - dates were just taken by another user
      console.log(`[BOOKING CONFLICT] Attempted booking for ${listingId}: ${checkIn} to ${checkOut}`);
      console.log(`[BOOKING CONFLICT] Conflicts:`, availabilityCheck.conflicts);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Sorry, these dates were JUST taken by another user. Please select different dates.',
        code: 'DATES_CONFLICT',
        conflicts: availabilityCheck.conflicts
      }, { status: 409 });
    }
    
    // Validate minimum stay duration
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // Fetch listing to get min_stay
    const { data: listingData } = await supabaseAdmin
      .from('listings')
      .select('min_booking_days, title')
      .eq('id', listingId)
      .single();
    
    const minStay = listingData?.min_booking_days || 1;
    
    if (nights < minStay) {
      return NextResponse.json({ 
        success: false, 
        error: `Minimum stay for this property is ${minStay} night${minStay > 1 ? 's' : ''}. You selected ${nights} night${nights > 1 ? 's' : ''}.`,
        code: 'MIN_STAY_VIOLATION',
        minStay,
        selectedNights: nights
      }, { status: 400 });
    }
    // ========================================
    
    // Create booking using service
    const result = await BookingService.createBooking({
      listingId,
      renterId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests,
      currency,
      promoCode
    });
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
    // Get partner details for notification
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('*, owner:profiles!owner_id(*)')
      .eq('id', listingId)
      .single();
    
    if (listing) {
      // Send notification to partner with commission details
      await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
        booking: {
          ...result.booking,
          commission_rate: result.commission?.commissionRate,
          commission_thb: result.commission?.commissionThb,
          partner_earnings_thb: result.commission?.partnerEarnings
        },
        partner: listing.owner,
        listing: { title: listing.title, district: listing.district }
      });
    }
    
    console.log(`[BOOKING] New booking created: ${result.booking.id} for listing ${listingId}`);
    
    return NextResponse.json({
      success: true,
      booking: result.booking,
      /** Linked chat thread (see BookingService.ensureBookingConversation) */
      conversationId: result.conversationId ?? null,
    });
    
  } catch (error) {
    console.error('[BOOKINGS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
