/**
 * Partner occupancy — current inventory per night (bookings + manual blocks).
 * GET /api/v2/partner/listings/[id]/occupancy?days=180
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret';
import { getSessionPayload } from '@/lib/services/session-service';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { CalendarService } from '@/lib/services/calendar.service';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAuth() {
  const jwtCheck = tryGetJwtSecret();
  if (!jwtCheck.ok) return { misconfigured: true };
  const session = await getSessionPayload();
  if (!session?.userId) return null;
  return { userId: session.userId, role: session.role };
}

export async function GET(request, { params }) {
  const auth = await verifyAuth();
  if (auth?.misconfigured) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500);
  }
  if (!auth) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401);
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
