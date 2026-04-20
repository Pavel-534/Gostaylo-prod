/**
 * POST /api/bookings/[id]/check-in/confirm
 * Confirm check-in and release funds to partner (escrow release)
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request, { params }) {
  const bookingId = params.id;
  
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }
  
  try {
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
    
    if (booking.status === 'CHECKED_IN') {
      return NextResponse.json({
        success: true,
        data: {
          bookingId,
          status: 'CHECKED_IN',
          alreadyCheckedIn: true,
        },
      });
    }

    if (booking.status !== 'PAID_ESCROW') {
      return NextResponse.json({
        success: false,
        error: 'Check-in is available after payment is received (PAID_ESCROW)',
      }, { status: 400 });
    }
    
    // Update booking status to CHECKED_IN
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
          status: 'CHECKED_IN',
          metadata: {
            ...booking.metadata,
            checkedInAt: new Date().toISOString(),
            fundsReleasedAt: new Date().toISOString()
          }
        })
      }
    );
    
    if (!updateRes.ok) {
      throw new Error('Failed to update booking');
    }
    
    // Log funds release (in production, this would trigger actual fund transfer)
    const priceThb = parseFloat(booking.price_thb) || 0;
    const guestServiceFeeThb = parseFloat(booking.commission_thb) || 0;
    const partnerEarnings =
      Number.isFinite(parseFloat(booking.partner_earnings_thb))
        ? parseFloat(booking.partner_earnings_thb)
        : priceThb;
    
    console.log(`[CHECK-IN CONFIRMED] Booking ${bookingId}`);
    console.log(`  Partner: ${booking.partner_id}`);
    console.log(`  Total: ฿${priceThb.toLocaleString()}`);
    console.log(`  Guest Service Fee: ฿${guestServiceFeeThb.toLocaleString()}`);
    console.log(`  Partner Earnings: ฿${partnerEarnings.toLocaleString()}`);
    
    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        status: 'CHECKED_IN',
        fundsReleased: true,
        partnerEarnings,
        checkedInAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[CHECK-IN-CONFIRM ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to confirm check-in' }, { status: 500 });
  }
}
