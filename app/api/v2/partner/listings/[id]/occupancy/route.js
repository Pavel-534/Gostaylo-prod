/**
 * Partner occupancy — current inventory per night (bookings + manual blocks).
 * GET /api/v2/partner/listings/[id]/occupancy?days=180
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { CalendarService } from '@/lib/services/calendar.service';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function verifyAuth() {
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return { misconfigured: true };
  }
  const cookieStore = cookies();
  const session = cookieStore.get('gostaylo_session');
  if (!session?.value) return null;

  try {
    return jwt.verify(session.value, secret);
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const auth = verifyAuth();
  if (auth?.misconfigured) {
    return NextResponse.json(
      { success: false, error: 'Server misconfigured: JWT_SECRET is missing' },
      { status: 500 }
    );
  }
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const days = Math.min(2500, Math.max(7, parseInt(searchParams.get('days') || '180', 10) || 180));

  const supabase = getSupabase();
  const { data: listing } = await supabase
    .from('listings')
    .select('owner_id, max_capacity, status')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }

  if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const cal = await CalendarService.getCalendar(listingId, days);
  if (!cal.success) {
    return NextResponse.json({ success: false, error: cal.error || 'Failed to load calendar' }, { status: 500 });
  }

  const { rangeStart, rangeEnd, maxCapacity, calendar, listingActive } = cal.data;

  const occupancy = calendar.map((d) => ({
    date: d.date,
    status: d.status,
    max_capacity: d.max_capacity,
    booked_guests: d.booked_guests,
    blocked_units: d.blocked_units,
    remaining_spots: d.remaining_spots,
    can_check_in: d.can_check_in,
    is_transition: d.is_transition,
  }));

  return NextResponse.json({
    success: true,
    listingId,
    rangeStart,
    rangeEnd,
    max_capacity: maxCapacity,
    listingActive,
    days,
    occupancy,
  });
}
