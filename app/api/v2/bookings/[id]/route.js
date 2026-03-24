/**
 * Gostaylo - Single Booking API (v2)
 * GET /api/v2/bookings/[id] - Get booking details
 * PUT /api/v2/bookings/[id] - Update booking status
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { BookingService } from '@/lib/services/booking.service';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const booking = await BookingService.getBookingById(id);
    
    if (!booking) {
      return NextResponse.json({ 
        success: false, 
        error: 'Booking not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: booking });
    
  } catch (error) {
    console.error('[BOOKING GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, reason, declineReasonKey, declineReasonDetail } = body;
    
    if (!status) {
      return NextResponse.json({ 
        success: false, 
        error: 'Status is required' 
      }, { status: 400 });
    }
    
    // Get booking before update for notification
    const bookingBefore = await BookingService.getBookingById(id);
    
    // Update status
    const result = await BookingService.updateStatus(id, status, {
      reason,
      declineReasonKey,
      declineReasonDetail,
    });
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
    // Send notifications based on status change
    if (bookingBefore) {
      if (status === 'CONFIRMED') {
        await NotificationService.dispatch(NotificationEvents.BOOKING_CONFIRMED, {
          booking: result.booking,
          renter: bookingBefore.renter,
          listing: bookingBefore.listings
        });
      } else if (status === 'CANCELLED') {
        await NotificationService.dispatch(NotificationEvents.BOOKING_CANCELLED, {
          booking: result.booking,
          renter: bookingBefore.renter,
          listing: bookingBefore.listings,
          reason
        });
      }
    }
    
    console.log(`[BOOKING] Status updated: ${id} -> ${status}`);
    
    return NextResponse.json({ success: true, data: result.booking });
    
  } catch (error) {
    console.error('[BOOKING PUT ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
