/**
 * POST /api/bookings/[id]/check-in/confirm
 * Confirm check-in and release funds to partner (escrow release)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateAccess } from '@/lib/api/api-guard';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const bookingId = params.id;
  
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }
  
  try {
    const access = await validateAccess(request, bookingId, ['renter', 'partner', 'staff'], {
      select: 'id,status,renter_id,partner_id,price_thb,commission_thb,partner_earnings_thb,metadata',
    });
    if (!access.ok) return access.response;
    const { booking, session } = access;
    
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
    
    const checkedInAt = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'CHECKED_IN',
        checked_in_at: checkedInAt,
        metadata: {
          ...(booking.metadata || {}),
          checkedInAt,
          fundsReleasedAt: checkedInAt,
          checkInConfirmedBy: session.userId,
        },
      })
      .eq('id', bookingId);
    
    if (updateErr) {
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
        checkedInAt
      }
    });
    
  } catch (error) {
    console.error('[CHECK-IN-CONFIRM ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to confirm check-in' }, { status: 500 });
  }
}
