/**
 * POST /api/v2/partner/guest-reviews
 * Partner submits a review of the guest (one per booking).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service';
import { BookingStatus } from '@/lib/services/escrow.service';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const partner = await verifyPartnerAccess(userId);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const bookingId = String(body.bookingId || body.booking_id || '').trim();
    const rating = parseInt(body.rating, 10);
    const comment = String(body.comment ?? '').slice(0, 4000);

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId required' }, { status: 400 });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'rating must be 1–5' }, { status: 400 });
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, partner_id, renter_id, status')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    if (String(booking.partner_id) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (!booking.renter_id) {
      return NextResponse.json({ success: false, error: 'Guest not linked to profile' }, { status: 400 });
    }
    if (![BookingStatus.THAWED, BookingStatus.COMPLETED].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot review guest for status ${booking.status}` },
        { status: 409 },
      );
    }
    if (String(booking.renter_id) === String(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid guest' }, { status: 400 });
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('guest_reviews')
      .insert({
        author_id: userId,
        guest_id: booking.renter_id,
        booking_id: bookingId,
        rating,
        comment: comment || '',
      })
      .select('id, created_at')
      .single();

    if (insErr) {
      if (String(insErr.message || '').includes('duplicate') || insErr.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Review already submitted for this booking' },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { id: inserted.id, createdAt: inserted.created_at },
    });
  } catch (error) {
    console.error('[PARTNER GUEST-REVIEWS POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
