/**
 * Gostaylo - Check Listing Availability
 * GET /api/v2/listings/[id]/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Checks both manual blocks AND iCal blocks before allowing booking
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Check if date ranges overlap
 */
function datesOverlap(start1, end1, start2, end2) {
  return start1 <= end2 && end1 >= start2;
}

/**
 * Get all dates in a range
 */
function getDatesInRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export async function GET(request, { params }) {
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  const supabase = getSupabase();
  
  // Check if listing exists
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, status, available, min_booking_days, max_booking_days')
    .eq('id', listingId)
    .single();
  
  if (listingError || !listing) {
    return NextResponse.json({ 
      success: false, 
      error: 'Listing not found' 
    }, { status: 404 });
  }
  
  // If no dates provided, return all blocked dates for calendar display
  if (!startDate || !endDate) {
    // Get next 12 months of blocked dates for calendar grey-out
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 12);
    
    const rangeStart = today.toISOString().split('T')[0];
    const rangeEnd = futureDate.toISOString().split('T')[0];
    
    // Get all calendar blocks
    const { data: blocks } = await supabase
      .from('calendar_blocks')
      .select('start_date, end_date')
      .eq('listing_id', listingId)
      .gte('end_date', rangeStart)
      .lte('start_date', rangeEnd);
    
    // Get all bookings that should block dates (including PENDING)
    // Valid booking_status enum values: PENDING, CONFIRMED, PAID, CANCELLED, COMPLETED, REFUNDED
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('check_in, check_out, status')
      .eq('listing_id', listingId)
      .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
      .gte('check_out', rangeStart)
      .lte('check_in', rangeEnd);
    
    console.log('[AVAILABILITY] Fetch params:', { listingId, rangeStart, rangeEnd });
    console.log('[AVAILABILITY] Bookings found:', bookings?.length, bookings);
    if (bookingsError) {
      console.error('[AVAILABILITY] Bookings error:', bookingsError);
    }
    
    // Collect all blocked dates
    const blockedDatesSet = new Set();
    
    (blocks || []).forEach(block => {
      getDatesInRange(block.start_date, block.end_date).forEach(d => blockedDatesSet.add(d));
    });
    
    (bookings || []).forEach(booking => {
      getDatesInRange(booking.check_in, booking.check_out).forEach(d => blockedDatesSet.add(d));
    });
    
    return NextResponse.json({
      success: true,
      data: {
        blockedDates: Array.from(blockedDatesSet).sort(),
        listingActive: listing.status === 'ACTIVE'
      }
    });
  }
  
  // Validate date format for specific range check
  const startParsed = new Date(startDate);
  const endParsed = new Date(endDate);
  
  if (isNaN(startParsed.getTime()) || isNaN(endParsed.getTime())) {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid date format. Use YYYY-MM-DD' 
    }, { status: 400 });
  }
  
  if (startParsed > endParsed) {
    return NextResponse.json({ 
      success: false, 
      error: 'Start date must be before end date' 
    }, { status: 400 });
  }
  
  if (listing.status !== 'ACTIVE') {
    return NextResponse.json({
      success: true,
      available: false,
      reason: 'Listing is not active',
      blockedDates: []
    });
  }
  
  // Check booking duration constraints
  const requestedDays = Math.ceil((endParsed - startParsed) / (1000 * 60 * 60 * 24)) + 1;
  
  if (listing.min_booking_days && requestedDays < listing.min_booking_days) {
    return NextResponse.json({
      success: true,
      available: false,
      reason: `Минимальный срок бронирования: ${listing.min_booking_days} дней`,
      blockedDates: []
    });
  }
  
  if (listing.max_booking_days && requestedDays > listing.max_booking_days) {
    return NextResponse.json({
      success: true,
      available: false,
      reason: `Максимальный срок бронирования: ${listing.max_booking_days} дней`,
      blockedDates: []
    });
  }
  
  // Get all calendar blocks that overlap with requested dates
  const { data: blocks, error: blocksError } = await supabase
    .from('calendar_blocks')
    .select('start_date, end_date, source, reason')
    .eq('listing_id', listingId)
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);
  
  if (blocksError) {
    console.error('[AVAILABILITY] Error fetching blocks:', blocksError);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check availability' 
    }, { status: 500 });
  }
  
  // Get existing bookings that overlap (including PENDING)
  // Valid booking_status enum values: PENDING, CONFIRMED, PAID, CANCELLED, COMPLETED, REFUNDED
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('check_in, check_out, status')
    .eq('listing_id', listingId)
    .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
    .or(`check_in.lte.${endDate},check_out.gte.${startDate}`);
  
  if (bookingsError) {
    console.error('[AVAILABILITY] Error fetching bookings:', bookingsError);
  }
  
  // Find conflicting blocks
  const conflictingBlocks = (blocks || []).filter(block => 
    datesOverlap(startDate, endDate, block.start_date, block.end_date)
  );
  
  // Find conflicting bookings
  const conflictingBookings = (bookings || []).filter(booking =>
    datesOverlap(startDate, endDate, booking.check_in, booking.check_out)
  );
  
  // Collect all blocked dates
  const blockedDatesSet = new Set();
  
  conflictingBlocks.forEach(block => {
    getDatesInRange(block.start_date, block.end_date).forEach(d => blockedDatesSet.add(d));
  });
  
  conflictingBookings.forEach(booking => {
    getDatesInRange(booking.check_in, booking.check_out).forEach(d => blockedDatesSet.add(d));
  });
  
  const blockedDates = Array.from(blockedDatesSet).sort();
  
  // Check if any requested dates are blocked
  const requestedDates = getDatesInRange(startDate, endDate);
  const conflictingDates = requestedDates.filter(d => blockedDatesSet.has(d));
  
  const available = conflictingDates.length === 0;
  
  let reason = null;
  if (!available) {
    if (conflictingBlocks.length > 0 && conflictingBookings.length > 0) {
      reason = 'Некоторые даты уже заняты или заблокированы';
    } else if (conflictingBlocks.length > 0) {
      const sources = [...new Set(conflictingBlocks.map(b => b.source))];
      if (sources.includes('manual') && sources.length === 1) {
        reason = 'Даты заблокированы владельцем';
      } else {
        reason = 'Даты недоступны (синхронизировано из внешнего календаря)';
      }
    } else {
      reason = 'Эти даты уже забронированы';
    }
  }
  
  return NextResponse.json({
    success: true,
    available,
    reason,
    blockedDates,
    conflictingDates,
    details: {
      blocks: conflictingBlocks.length,
      bookings: conflictingBookings.length
    }
  });
}
