import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import { resolveAnalyticsPeriod } from '@/lib/analytics/core/period-resolver.js';
import { queryBookingFinancialFactsPage } from '@/lib/analytics/facts/booking-financial-fact.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence/bookings
 * Query: period, page, pageSize, status, category, hasReferral=1|0, pipelineOnly=1, escrowAgingMinDays=7|14|30, excludeTest
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const excludeTest = url.searchParams.get('excludeTest') !== '0';
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 25);
    const status = url.searchParams.get('status') || null;
    const categorySlug = url.searchParams.get('category') || null;
    const partnerId = url.searchParams.get('partnerId') || null;
    const partnerPipelineOnly = url.searchParams.get('partnerPipelineOnly') === '1';
    const pipelineOnly = url.searchParams.get('pipelineOnly') === '1';
    const escrowAgingMinDaysRaw = url.searchParams.get('escrowAgingMinDays');
    const escrowAgingMinDays = escrowAgingMinDaysRaw ? Number(escrowAgingMinDaysRaw) : null;

    let fromIso = url.searchParams.get('fromIso');
    let toIso = url.searchParams.get('toIso');
    if (!pipelineOnly && !escrowAgingMinDays && !partnerPipelineOnly && !fromIso && !toIso) {
      const periods = resolveAnalyticsPeriod(period);
      fromIso = periods.current.fromIso;
      toIso = periods.current.toIso;
    }

    let hasReferral = null;
    const refParam = url.searchParams.get('hasReferral');
    if (refParam === '1') hasReferral = true;
    if (refParam === '0') hasReferral = false;

    const data = await queryBookingFinancialFactsPage({
      fromIso,
      toIso,
      excludeTest,
      status,
      categorySlug,
      partnerId,
      partnerPipelineOnly,
      hasReferral,
      pipelineOnly,
      escrowAgingMinDays,
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[finance/intelligence/bookings]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'BOOKINGS_QUERY_FAILED' },
      { status: 500 },
    );
  }
}
