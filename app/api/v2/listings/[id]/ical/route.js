/**
 * Gostaylo - iCal Export Feed
 * GET /api/v2/listings/[id]/ical?token=xxx
 * 
 * Generates iCal feed for a listing's bookings
 * Partners can use this URL to sync Gostaylo bookings to Airbnb/Booking.com
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Generate iCal format date
 */
function formatICalDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate iCal format date (date only, no time)
 */
function formatICalDateOnly(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Verify export token
 */
function verifyExportToken(listingId, token) {
  const secret = process.env.JWT_SECRET || 'gostaylo-secret';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`ical-export-${listingId}`)
    .digest('hex')
    .slice(0, 32);
  return token === expected;
}

export async function GET(request, { params }) {
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  // Verify token
  if (!token || !verifyExportToken(listingId, token)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  const supabase = getSupabase();
  
  // Get listing info
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, address')
    .eq('id', listingId)
    .single();
  
  if (!listing) {
    return new NextResponse('Listing not found', { status: 404 });
  }
  
  // Get confirmed bookings
  // Valid booking_status enum values: PENDING, CONFIRMED, PAID, CANCELLED, COMPLETED, REFUNDED
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, guest_name, status')
    .eq('listing_id', listingId)
    .in('status', ['CONFIRMED', 'PAID', 'COMPLETED'])
    .gte('check_out', new Date().toISOString().split('T')[0]);
  
  // Get manual blocks
  const { data: blocks } = await supabase
    .from('calendar_blocks')
    .select('id, start_date, end_date, reason, source')
    .eq('listing_id', listingId)
    .eq('source', 'manual')
    .gte('end_date', new Date().toISOString().split('T')[0]);
  
  // Build iCal content
  const now = formatICalDate(new Date());
  const calName = `Gostaylo - ${listing.title}`;
  
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gostaylo//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-TIMEZONE:Asia/Bangkok`
  ];
  
  // Add bookings as events
  (bookings || []).forEach(booking => {
    const uid = `booking-${booking.id}@gostaylo.com`;
    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatICalDateOnly(booking.check_in)}`,
      `DTEND;VALUE=DATE:${formatICalDateOnly(booking.check_out)}`,
      `SUMMARY:Gostaylo Booking - ${booking.guest_name || 'Guest'}`,
      `DESCRIPTION:Booking via Gostaylo`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });
  
  // Add manual blocks as events
  (blocks || []).forEach(block => {
    const uid = `block-${block.id}@gostaylo.com`;
    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatICalDateOnly(block.start_date)}`,
      `DTEND;VALUE=DATE:${formatICalDateOnly(block.end_date)}`,
      `SUMMARY:${block.reason || 'Blocked'}`,
      `DESCRIPTION:Manual block via Gostaylo`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });
  
  ical.push('END:VCALENDAR');
  
  const icalContent = ical.join('\r\n');
  
  return new NextResponse(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${listingId}-calendar.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
