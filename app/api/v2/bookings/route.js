/**
 * FunnyRent 2.1 - Bookings API (v2)
 * GET /api/v2/bookings - List bookings
 * POST /api/v2/bookings - Create booking
 */

import { NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';
import { supabaseAdmin } from '@/lib/supabase';

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
  try {
    const body = await request.json();
    
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
    } = body;
    
    // Validate required fields
    if (!listingId || !checkIn || !checkOut) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: listingId, checkIn, checkOut' 
      }, { status: 400 });
    }
    
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
      // Send notification to partner
      await NotificationService.dispatch(NotificationEvents.NEW_BOOKING_REQUEST, {
        booking: result.booking,
        partner: listing.owner,
        listing: { title: listing.title, district: listing.district }
      });
    }
    
    console.log(`[BOOKING] New booking created: ${result.booking.id} for listing ${listingId}`);
    
    return NextResponse.json({ success: true, data: result.booking });
    
  } catch (error) {
    console.error('[BOOKINGS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
