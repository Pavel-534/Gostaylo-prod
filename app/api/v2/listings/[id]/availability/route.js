/**
 * Gostaylo - Listing Availability API (Server-First Architecture)
 * 
 * This is the SINGLE SOURCE OF TRUTH for availability data.
 * 
 * GET /api/v2/listings/[id]/availability
 *   - Returns all blocked dates for next 365 days
 *   - Sources: calendar_blocks + bookings (PENDING, CONFIRMED, PAID)
 *   - Returns sorted ISO date strings (YYYY-MM-DD)
 * 
 * GET /api/v2/listings/[id]/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *   - Checks if specific date range is available
 *   - Used for real-time validation before booking submission
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
 * Get all dates in a range (inclusive of start, exclusive of end for bookings)
 * For a booking check_in: 2026-03-20, check_out: 2026-03-22
 * Returns: ['2026-03-20', '2026-03-21'] (check_out date is available for new check_in)
 */
function getDatesInRange(startStr, endStr, includeEnd = false) {
  const dates = [];
  const current = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  
  // For bookings: check_out day is available for new check_in
  // For calendar_blocks: end_date is blocked
  const endLimit = includeEnd ? end : new Date(end.getTime() - 24 * 60 * 60 * 1000);
  
  while (current <= endLimit) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return dates;
}

/**
 * Check if two date ranges overlap
 */
function rangesOverlap(start1, end1, start2, end2) {
  // For bookings: overlap if start1 < end2 AND end1 > start2
  return start1 < end2 && end1 > start2;
}

export async function GET(request, { params }) {
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  const supabase = getSupabase();
  
  try {
    // 1. Verify listing exists and is active
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
      
      // Bookings that block dates (PENDING, CONFIRMED, PAID)
      // Only these statuses block availability
      supabase
        .from('bookings')
        .select('id, check_in, check_out, status')
        .eq('listing_id', listingId)
        .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
        .gte('check_out', todayStr)
        .lte('check_in', futureStr)
    ]);
    
    const blocks = blocksResult.data || [];
    const bookings = bookingsResult.data || [];
    
    // 4. Aggregate all blocked dates into a Set for uniqueness
    const blockedDatesSet = new Set();
    
    // Add calendar blocks (manual/iCal) - include end date
    blocks.forEach(block => {
      getDatesInRange(block.start_date, block.end_date, true).forEach(d => {
        if (d >= todayStr && d <= futureStr) {
          blockedDatesSet.add(d);
        }
      });
    });
    
    // Add booking dates - exclude check_out (available for new check_in)
    bookings.forEach(booking => {
      getDatesInRange(booking.check_in, booking.check_out, false).forEach(d => {
        if (d >= todayStr && d <= futureStr) {
          blockedDatesSet.add(d);
        }
      });
    });
    
    // 5. Convert to sorted array
    const blockedDates = Array.from(blockedDatesSet).sort();
    
    // Log for debugging (can be removed in production)
    console.log(`[AVAILABILITY] ${listingId}: ${blockedDates.length} blocked dates, ${blocks.length} blocks, ${bookings.length} bookings`);
    
    // 6. If specific date range requested, check availability
    if (startDate && endDate) {
      const reqStart = new Date(startDate + 'T00:00:00Z');
      const reqEnd = new Date(endDate + 'T00:00:00Z');
      
      // Validate date format
      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid date format. Use YYYY-MM-DD' 
        }, { status: 400 });
      }
      
      // Check if requested range overlaps with any blocked date
      const requestedDates = getDatesInRange(startDate, endDate, false);
      const conflicts = requestedDates.filter(d => blockedDatesSet.has(d));
      const isAvailable = conflicts.length === 0;
      
      return NextResponse.json({
        success: true,
        available: isAvailable,
        conflicts: conflicts,
        data: {
          blockedDates,
          listingActive: listing.status === 'ACTIVE' && listing.available !== false
        }
      });
    }
    
    // 7. Return all blocked dates for calendar display
    return NextResponse.json({
      success: true,
      data: {
        blockedDates,
        listingActive: listing.status === 'ACTIVE' && listing.available !== false,
        meta: {
          rangeStart: todayStr,
          rangeEnd: futureStr,
          totalBlocked: blockedDates.length,
          sources: {
            calendarBlocks: blocks.length,
            bookings: bookings.length
          }
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
