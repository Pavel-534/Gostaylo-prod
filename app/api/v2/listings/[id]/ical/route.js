/**
 * Gostaylo - iCal Export Feed (публичный, только ?token=…)
 * GET /api/v2/listings/[id]/ical?token=xxx
 *
 * Не путать с GET /api/v2/partner/listings/[id]/ical-export-link — тот только для кабинета
 * партнёра (кука сессии), чтобы скопировать эту публичную ссылку с токеном.
 * Airbnb/Booking ходят сюда без куки; доступ только по HMAC-токену.
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
 * Generate iCal format date (date only, no time) from ISO date or YYYY-MM-DD
 */
function formatICalDateOnly(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.split('T')[0].replace(/-/g, '');
  }
  const d = new Date(date);
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

/** Inclusive calendar date (YYYY-MM-DD) → next day as YYYYMMDD (iCal all-day DTEND exclusive). */
function icalExclusiveEndFromInclusive(ymd) {
  const part = String(ymd).split('T')[0];
  const [y, m, d] = part.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return formatICalDateOnly(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function escapeIcalText(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
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
  
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, address, status, available')
    .eq('id', listingId)
    .single();

  if (!listing) {
    return new NextResponse('Listing not found', { status: 404 });
  }

  const statusUp = String(listing.status || '').toUpperCase();
  const publiclyBookable = statusUp === 'ACTIVE' && listing.available !== false;
  
  // Get confirmed bookings
  // Valid booking_status enum values: PENDING, CONFIRMED, PAID, CANCELLED, COMPLETED, REFUNDED
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, guest_name, status')
    .eq('listing_id', listingId)
    .in('status', ['CONFIRMED', 'PAID', 'COMPLETED'])
    .gte('check_out', new Date().toISOString().split('T')[0]);
  
  const todayYmd = new Date().toISOString().split('T')[0];

  const { data: blocks } = await supabase
    .from('calendar_blocks')
    .select('id, start_date, end_date, reason, source')
    .eq('listing_id', listingId)
    .gte('end_date', todayYmd);

  const { data: seasonalRows } = await supabase
    .from('seasonal_prices')
    .select('id, start_date, end_date, label, season_type, price_daily')
    .eq('listing_id', listingId)
    .gte('end_date', todayYmd);
  
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
  
  if (!publiclyBookable) {
    const farEnd = new Date();
    farEnd.setUTCMonth(farEnd.getUTCMonth() + 18);
    const endInc = farEnd.toISOString().split('T')[0];
    ical.push(
      'BEGIN:VEVENT',
      `UID:listing-unavailable-${listingId}@gostaylo.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatICalDateOnly(todayYmd)}`,
      `DTEND;VALUE=DATE:${icalExclusiveEndFromInclusive(endInc)}`,
      'SUMMARY:Gostaylo — объект недоступен',
      `DESCRIPTION:${escapeIcalText('Объявление не активно или скрыто на Gostaylo. Бронирование через календарь недоступно.')}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }

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
  
  (blocks || []).forEach((block) => {
    const uid = `block-${block.id}@gostaylo.com`;
    const src = block.source ? String(block.source) : '';
    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatICalDateOnly(block.start_date)}`,
      `DTEND;VALUE=DATE:${icalExclusiveEndFromInclusive(block.end_date)}`,
      `SUMMARY:${escapeIcalText(block.reason || 'Blocked')}`,
      `DESCRIPTION:${escapeIcalText(`Занято в Gostaylo (${src || 'block'})`)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  (seasonalRows || []).forEach((sp) => {
    const uid = `season-${sp.id}@gostaylo.com`;
    const label = sp.label || sp.season_type || 'Season';
    const price =
      sp.price_daily != null && !Number.isNaN(parseFloat(sp.price_daily))
        ? `${parseFloat(sp.price_daily)} THB/night`
        : '';
    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatICalDateOnly(sp.start_date)}`,
      `DTEND;VALUE=DATE:${icalExclusiveEndFromInclusive(sp.end_date)}`,
      `SUMMARY:${escapeIcalText(`Gostaylo — ${label}${price ? ` (${price})` : ''}`)}`,
      `DESCRIPTION:${escapeIcalText('Сезонные цены Gostaylo. Событие информационное (TRANSPARENT), не блокирует календарь в большинстве OTA.')}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
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
