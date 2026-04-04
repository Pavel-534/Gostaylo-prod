/**
 * GoStayLo - Universal Calendar API (v2)
 * Single Source of Truth for calendar/availability data
 * 
 * GET /api/v2/listings/[id]/calendar
 *   - Returns complete calendar with day-by-day status
 *   - Query params: ?days=180 (default: 180 days ahead)
 * 
 * GET /api/v2/listings/[id]/calendar?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
 *   - Checks specific date range availability
 * 
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     calendar: [{ date, status, price, can_check_in, can_check_out, ... }],
 *     basePriceThb: number,
 *     minStay: number,
 *     maxStay: number,
 *     meta: { totalDays, blockedDays, sources }
 *   }
 * }
 * 
 * @created 2026-03-12
 */

import { NextResponse } from 'next/server';
import { CalendarService } from '@/lib/services/calendar.service';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id: listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'Listing ID required' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const days = parseInt(searchParams.get('days')) || 180;
    const guests = Math.max(1, parseInt(searchParams.get('guests') || '1', 10) || 1);
    
    // If specific dates provided, check availability
    if (checkIn && checkOut) {
      const result = await CalendarService.checkAvailability(listingId, checkIn, checkOut, {
        guestsCount: guests,
      });
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    
    // Otherwise return full calendar
    const result = await CalendarService.getCalendar(listingId, days);
    
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
