/**
 * POST /api/bookings/[id]/payment/confirm
 * Confirm a payment and update booking status
 * SECURITY: Verifies booking ownership (renter_id must match session)
 */

import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/services/session-service';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request, { params }) {
  const bookingId = params.id;
  
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { txId, gatewayRef } = body;
    
    // Fetch booking
    const bookingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    const bookings = await bookingRes.json();
    
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    
    const booking = bookings[0];
    const previousStatus = booking.status;

    // Ownership check: only the renter can confirm payment for their booking
    const sessionUserId = await getUserIdFromSession();
    if (booking.renter_id) {
      if (!sessionUserId) {
        return NextResponse.json({ success: false, error: 'Please log in to complete payment' }, { status: 401 });
      }
      if (booking.renter_id !== sessionUserId) {
        return NextResponse.json({ success: false, error: 'Access denied. This is not your booking.' }, { status: 403 });
      }
    }
    
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Booking is cancelled' }, { status: 400 });
    }
    
    if (booking.status === 'CONFIRMED') {
      return NextResponse.json({ success: false, error: 'Booking is already confirmed' }, { status: 400 });
    }
    
    // Update booking to CONFIRMED
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          status: 'CONFIRMED',
          metadata: {
            ...booking.metadata,
            paymentConfirmedAt: new Date().toISOString(),
            transactionId: txId || null,
            gatewayRef: gatewayRef || null
          }
        })
      }
    );
    
    if (!updateRes.ok) {
      throw new Error('Failed to update booking');
    }

    try {
      await syncBookingStatusToConversationChat({
        bookingId,
        previousStatus,
        newStatus: 'CONFIRMED',
      })
    } catch (e) {
      console.error('[PAYMENT CONFIRMED] chat sync', e)
    }

    // Log payment confirmation
    console.log(`[PAYMENT CONFIRMED] Booking ${bookingId} | TX: ${txId || 'N/A'} | Gateway: ${gatewayRef || 'N/A'}`);
    
    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        status: 'CONFIRMED',
        transactionId: txId,
        confirmedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[PAYMENT-CONFIRM ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to confirm payment' }, { status: 500 });
  }
}
