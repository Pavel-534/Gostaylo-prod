import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import buildBookingPlReport from '@/lib/analytics/reports/booking-pl-report.js';
import { withAnalyticsCache } from '@/lib/analytics/core/analytics-cache.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence/bookings/[bookingId]
 */
export async function GET(request, { params }) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const bookingId = String(params?.bookingId || '').trim();
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
    }

    const skipCache = new URL(request.url).searchParams.get('fresh') === '1';
    const cacheKey = `booking-pl:${bookingId}`;

    if (skipCache) {
      const result = await buildBookingPlReport(bookingId);
      if (!result.success) {
        return NextResponse.json(result, { status: result.error === 'BOOKING_NOT_FOUND' ? 404 : 400 });
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    const cached = await withAnalyticsCache(
      cacheKey,
      async () => {
        const result = await buildBookingPlReport(bookingId);
        if (!result.success) throw new Error(result.error || 'BOOKING_PL_FAILED');
        return result.data;
      },
      { ttlMs: 120_000 },
    );
    const { cacheHit, ...data } = cached;

    return NextResponse.json({ success: true, data, meta: { cacheHit: Boolean(cacheHit) } });
  } catch (error) {
    console.error('[finance/intelligence/bookings/[id]]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'BOOKING_PL_FAILED' },
      { status: 500 },
    );
  }
}
