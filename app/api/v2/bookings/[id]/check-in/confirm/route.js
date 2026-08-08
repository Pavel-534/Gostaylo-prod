/**
 * POST /api/v2/bookings/[id]/check-in/confirm
 * Guest check-in marker only — CHECKED_IN ≠ THAWED (see `lib/booking/status-transitions.js`).
 * Does NOT release escrow; thaw remains `POST /api/cron/escrow-thaw`.
 * Stage 200.72 — API honesty: never report fundsReleased while escrow still holds funds.
 * Stage 200.74 — dispatch CHECK_IN_CONFIRMED (escrow-held copy via notify SSOT).
 */

import { NextResponse } from 'next/server';
import { validateAccess } from '@/lib/api/api-guard';
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { supabaseAdmin } from '@/lib/supabase'
import { NotificationService } from '@/lib/services/notification.service.js'
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const bookingId = params.id;
  
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }
  
  try {
    const access = await validateAccess(request, bookingId, ['renter', 'partner', 'staff'], {
      select: 'id,status,renter_id,partner_id,price_thb,commission_thb,partner_earnings_thb,check_in,check_out,listing_id,metadata',
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
          fundsReleased: false,
          escrowHeld: true,
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
    const statusRes = await transitionBookingStatus(bookingId, 'CHECKED_IN', {
      scope: 'system',
      actorContext: {
        actorId: session?.userId || null,
        actorRole: session?.role || null,
        trigger: 'checkin_confirm',
      },
      metadata: { checkedInAt, updatedAt: checkedInAt },
      extraPatch: {
        metadata: {
          ...(booking.metadata || {}),
          checkedInAt,
          checkInConfirmedBy: session.userId,
        },
      },
    })

    if (!statusRes.success) {
      throw new Error(statusRes.error || 'BOOKING_STATUS_TRANSITION_FAILED')
    }
    
    const priceThb = parseFloat(booking.price_thb) || 0;
    const guestServiceFeeThb = parseFloat(booking.commission_thb) || 0;
    const partnerEarnings =
      Number.isFinite(parseFloat(booking.partner_earnings_thb))
        ? parseFloat(booking.partner_earnings_thb)
        : priceThb;
    
    console.log(`[CHECK-IN CONFIRMED] Booking ${bookingId} (escrow still held; thaw via cron)`);
    console.log(`  Partner: ${booking.partner_id}`);
    console.log(`  Total: ฿${priceThb.toLocaleString()}`);
    console.log(`  Guest Service Fee: ฿${guestServiceFeeThb.toLocaleString()}`);
    console.log(`  Partner Earnings (pending thaw): ฿${partnerEarnings.toLocaleString()}`);

    // Stage 200.74 — structured notify (funds remain in escrow per copy SSOT)
    void (async () => {
      try {
        let listing = null
        let partner = null
        if (booking.listing_id && supabaseAdmin) {
          const { data: listingRow } = await supabaseAdmin
            .from('listings')
            .select('id, title')
            .eq('id', String(booking.listing_id))
            .maybeSingle()
          listing = listingRow
        }
        if (booking.partner_id && supabaseAdmin) {
          const { data: partnerRow } = await supabaseAdmin
            .from('profiles')
            .select('id, email, first_name, last_name, telegram_id, language, preferred_language')
            .eq('id', String(booking.partner_id))
            .maybeSingle()
          partner = partnerRow
        }
        await NotificationService.dispatch('CHECK_IN_CONFIRMED', {
          booking: {
            id: booking.id,
            check_in: booking.check_in,
            check_out: booking.check_out,
            price_thb: booking.price_thb,
            partner_id: booking.partner_id,
          },
          listing,
          partner,
        })
      } catch (err) {
        console.warn('[CHECK-IN] CHECK_IN_CONFIRMED dispatch:', err?.message || err)
      }
    })()
    
    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        status: 'CHECKED_IN',
        fundsReleased: false,
        escrowHeld: true,
        partnerEarnings,
        checkedInAt
      }
    });
    
  } catch (error) {
    console.error('[CHECK-IN-CONFIRM ERROR]', error);
    return NextResponse.json({ success: false, error: 'Failed to confirm check-in' }, { status: 500 });
  }
}
