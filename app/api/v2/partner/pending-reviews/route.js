/**
 * GET /api/v2/partner/pending-reviews
 * Completed (THAWED / COMPLETED) bookings where the partner has not yet submitted guest_reviews.
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service';
import { BookingStatus } from '@/lib/services/escrow.service';

export async function GET() {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const partner = await verifyPartnerAccess(userId);
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 });
    }

    const { data: bookings, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,
        status,
        check_in,
        check_out,
        guest_name,
        renter_id,
        price_thb,
        partner_earnings_thb,
        created_at,
        listing:listings(id, title, category_id)
      `,
      )
      .eq('partner_id', userId)
      .in('status', [BookingStatus.THAWED, BookingStatus.COMPLETED])
      .order('check_out', { ascending: false });

    if (bErr) {
      return NextResponse.json({ success: false, error: bErr.message }, { status: 500 });
    }

    const rows = bookings || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: { items: [] } });
    }

    const ids = rows.map((b) => b.id);
    const { data: existing, error: gErr } = await supabaseAdmin
      .from('guest_reviews')
      .select('booking_id')
      .eq('author_id', userId)
      .in('booking_id', ids);

    if (gErr) {
      return NextResponse.json({ success: false, error: gErr.message }, { status: 500 });
    }

    const done = new Set((existing || []).map((r) => r.booking_id));
    const pending = rows.filter((b) => !done.has(b.id));

    const items = pending.map((b) => ({
      id: b.id,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guestName: b.guest_name,
      renterId: b.renter_id,
      priceThb: b.price_thb,
      netAmountThb: b.partner_earnings_thb,
      createdAt: b.created_at,
      listing: b.listing
        ? {
            id: b.listing.id,
            title: b.listing.title,
            categoryId: b.listing.category_id,
          }
        : null,
    }));

    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error('[PARTNER PENDING-REVIEWS]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
