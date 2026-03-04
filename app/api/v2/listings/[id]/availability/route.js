/**
 * FunnyRent 2.1 - Booking Availability API
 * GET /api/v2/listings/[id]/availability
 * Returns booked dates for a specific listing
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Listing ID is required' 
      }, { status: 400 });
    }

    // Fetch all non-cancelled bookings for this listing
    // Valid BookingStatus enum: PENDING, CONFIRMED, CANCELLED, COMPLETED, REFUNDED
    // Statuses that block dates: PENDING, CONFIRMED, COMPLETED
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, check_in, check_out, status')
      .eq('listing_id', id)
      .in('status', ['PENDING', 'CONFIRMED', 'COMPLETED']);
    
    if (error) {
      console.error('[AVAILABILITY ERROR]', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    // Generate array of blocked dates
    const blockedDates = [];
    
    bookings?.forEach(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      
      // Add all dates from check_in to check_out (exclusive of check_out)
      let current = new Date(checkIn);
      while (current < checkOut) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    // Remove duplicates
    const uniqueBlockedDates = [...new Set(blockedDates)];

    return NextResponse.json({ 
      success: true, 
      data: {
        listingId: id,
        blockedDates: uniqueBlockedDates,
        bookings: bookings?.map(b => ({
          id: b.id,
          checkIn: b.check_in,
          checkOut: b.check_out,
          status: b.status
        })) || []
      }
    });
    
  } catch (error) {
    console.error('[AVAILABILITY ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
