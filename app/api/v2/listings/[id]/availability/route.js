/**
 * Gostaylo - Listing Availability API (Interval/Night-Based Model)
 * 
 * @note This endpoint will be ENHANCED (not deprecated) to become /api/v2/calendar
 * Current logic is correct and will be preserved.
 * 
 * CORE CONCEPT: We book NIGHTS, not days.
 * - A booking from March 14 to March 16 means 2 NIGHTS (14th and 15th)
 * - The check_out day (16th) is AVAILABLE for the next guest to check IN
 * - This enables back-to-back bookings (Booking.com style)
 * 
 * GET /api/v2/listings/[id]/availability
 *   - Returns array of "blocked nights" (dates where you cannot START a stay)
 *   - A date is blocked if the NIGHT starting on that date is occupied
 * 
 * GET /api/v2/listings/[id]/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *   - Checks if specific night range is available
 *   - For stay 14-16 (2 nights), checks nights of 14 and 15 only
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
 * Get all NIGHTS in a booking range
 * For booking check_in: 2026-03-14, check_out: 2026-03-16 (2 nights)
 * Returns: ['2026-03-14', '2026-03-15'] - the nights that are blocked
 * The check_out day (16th) is NOT returned - it's available for new check_in
 */
function getBlockedNights(checkIn, checkOut) {
  const nights = [];
  const current = new Date(checkIn + 'T00:00:00Z');
  const end = new Date(checkOut + 'T00:00:00Z');
  
  // Loop from check_in to day BEFORE check_out (exclusive end)
  while (current < end) {
    nights.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return nights;
}

/**
 * Get blocked dates for calendar_block (manual/iCal)
 * Calendar blocks are INCLUSIVE - the end_date is also blocked
 */
function getBlockedDatesFromBlock(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  
  // Loop from start to end (inclusive)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return dates;
}

/**
 * Check if requested nights overlap with existing bookings
 * Night-based overlap: new stay from A to B overlaps if any night of A to B-1 
 * is already occupied
 */
function nightsOverlap(newCheckIn, newCheckOut, existingCheckIn, existingCheckOut) {
  // New stay blocks nights from newCheckIn to newCheckOut-1
  // Existing blocks nights from existingCheckIn to existingCheckOut-1
  // Overlap if: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn
  return newCheckIn < existingCheckOut && newCheckOut > existingCheckIn;
}

export async function GET(request, { params }) {
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  const supabase = getSupabase();
  
  try {
    // 1. Verify listing exists
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, status, available')
      .eq('id', listingId)
      .single();
    
    if (listingError || !listing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Listing not found' 
      }, { status: 404 });
    }
    
    // 2. Calculate date range (today to today + 365 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const futureDate = new Date(today);
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureStr = futureDate.toISOString().split('T')[0];
    
    // 3. Fetch ALL blocking sources in parallel
    const [blocksResult, bookingsResult] = await Promise.all([
      // Calendar blocks (manual + iCal imports)
      supabase
        .from('calendar_blocks')
        .select('start_date, end_date, source, reason')
        .eq('listing_id', listingId)
        .gte('end_date', todayStr)
        .lte('start_date', futureStr),
      
      // Bookings that block nights (PENDING, CONFIRMED, PAID)
      supabase
        .from('bookings')
        .select('id, check_in, check_out, status')
        .eq('listing_id', listingId)
        .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
        .gte('check_out', todayStr)  // Booking ends after today
        .lte('check_in', futureStr)   // Booking starts before future limit
    ]);
    
    const blocks = blocksResult.data || [];
    const bookings = bookingsResult.data || [];
    
    // 4. Aggregate all blocked NIGHTS into a Set
    const blockedNightsSet = new Set();
    
    // Add calendar blocks (INCLUSIVE - end_date is blocked)
    blocks.forEach(block => {
      getBlockedDatesFromBlock(block.start_date, block.end_date).forEach(d => {
        if (d >= todayStr && d <= futureStr) {
          blockedNightsSet.add(d);
        }
      });
    });
    
    // Add booking NIGHTS (EXCLUSIVE - check_out is available for new check_in)
    bookings.forEach(booking => {
      getBlockedNights(booking.check_in, booking.check_out).forEach(d => {
        if (d >= todayStr && d <= futureStr) {
          blockedNightsSet.add(d);
        }
      });
    });
    
    // 5. Convert to sorted array
    const blockedNights = Array.from(blockedNightsSet).sort();
    
    console.log(`[AVAILABILITY] ${listingId}: ${blockedNights.length} blocked nights, ${blocks.length} blocks, ${bookings.length} bookings`);
    
    // 6. If specific date range requested, check availability
    if (startDate && endDate) {
      // Validate dates
      const reqStart = new Date(startDate + 'T00:00:00Z');
      const reqEnd = new Date(endDate + 'T00:00:00Z');
      
      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid date format. Use YYYY-MM-DD' 
        }, { status: 400 });
      }
      
      // Get nights that would be booked (check_in to check_out - 1)
      const requestedNights = getBlockedNights(startDate, endDate);
      
      // Check if any requested night is already blocked
      const conflicts = requestedNights.filter(night => blockedNightsSet.has(night));
      const isAvailable = conflicts.length === 0;
      
      return NextResponse.json({
        success: true,
        available: isAvailable,
        conflicts: conflicts,
        requestedNights: requestedNights.length,
        data: {
          blockedNights,
          listingActive: listing.status === 'ACTIVE' && listing.available !== false
        }
      });
    }
    
    // 7. Return all blocked nights for calendar display
    return NextResponse.json({
      success: true,
      data: {
        blockedNights, // Array of dates where you cannot START a stay
        listingActive: listing.status === 'ACTIVE' && listing.available !== false,
        meta: {
          rangeStart: todayStr,
          rangeEnd: futureStr,
          totalBlocked: blockedNights.length,
          sources: {
            calendarBlocks: blocks.length,
            bookings: bookings.length
          },
          logic: 'night-based' // Indicator for frontend
        }
      }
    });
    
  } catch (error) {
    console.error('[AVAILABILITY] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check availability' 
    }, { status: 500 });
  }
}
