/**
 * GoStayLo - Listing Availability API (night-based + inventory)
 *
 * GET /api/v2/listings/[id]/availability
 * GET /api/v2/listings/[id]/availability?startDate=&endDate=&guests=1
 */

import { NextResponse } from 'next/server';
import { CalendarService } from '@/lib/services/calendar.service';
import { PricingService } from '@/lib/services/pricing.service';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const listingId = params.id;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const guestsParam = searchParams.get('guests');
  const guestsCount = Math.max(1, parseInt(guestsParam || '1', 10) || 1);

  try {
    const calResult = await CalendarService.getCalendar(listingId, 400);

    if (!calResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: calResult.error || 'Listing not found',
        },
        { status: 404 }
      );
    }

    const { calendar, rangeStart, rangeEnd, maxCapacity, listingActive } = calResult.data;

    const blockedNights = calendar
      .filter(
        (d) =>
          d.date >= rangeStart &&
          d.date <= rangeEnd &&
          d.status !== 'PAST' &&
          (d.remaining_spots ?? 0) <= 0
      )
      .map((d) => d.date)
      .sort();

    if (startDate && endDate) {
      const reqStart = new Date(startDate + 'T00:00:00Z');
      const reqEnd = new Date(endDate + 'T00:00:00Z');

      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD',
          },
          { status: 400 }
        );
      }

      const chk = await CalendarService.checkAvailability(listingId, startDate, endDate, {
        guestsCount,
      });

      if (!chk.success) {
        return NextResponse.json(
          { success: false, error: chk.error || 'Availability check failed' },
          { status: 500 }
        );
      }

      const priceRow = await PricingService.calculateBookingPrice(listingId, startDate, endDate);

      return NextResponse.json({
        success: true,
        available: chk.available,
        conflicts: chk.conflicts || [],
        remaining_spots: chk.min_remaining_spots,
        max_capacity: chk.max_capacity ?? maxCapacity,
        guests_count: guestsCount,
        requestedNights: chk.pricing?.nights ?? priceRow.nights ?? 0,
        originalPrice: priceRow.error ? null : priceRow.originalPrice,
        discountedPrice: priceRow.error ? null : priceRow.discountedPrice,
        durationDiscountPercent: priceRow.error ? null : priceRow.durationDiscountPercent,
        durationDiscountAmount: priceRow.error ? null : priceRow.durationDiscountAmount,
        data: {
          blockedNights,
          listingActive,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        blockedNights,
        listingActive,
        max_capacity: maxCapacity,
        meta: {
          rangeStart,
          rangeEnd,
          totalBlocked: blockedNights.length,
          logic: 'night-based-inventory',
        },
      },
    });
  } catch (error) {
    console.error('[AVAILABILITY] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check availability',
      },
      { status: 500 }
    );
  }
}
