import { NextResponse } from 'next/server';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/admin/referral/attribution
 * Query: dateFrom, dateTo, status, ledgerStatus, referrerId, utmSource, minMarginThb,
 *        profitabilityFilter, limit, format=csv|referrers-csv|cohort-csv
 */
export async function GET(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const status = searchParams.get('status') || null;
    const ledgerStatus = searchParams.get('ledgerStatus') || null;
    const referrerId = searchParams.get('referrerId') || null;
    const utmSource = searchParams.get('utmSource') || null;
    const minMarginThb = searchParams.get('minMarginThb') || null;
    const profitabilityFilter = searchParams.get('profitabilityFilter') || 'all';
    const limit = searchParams.get('limit') || '80';
    const format = String(searchParams.get('format') || '').toLowerCase();

    const data = await ReferralAttributionService.getAdminDashboard({
      dateFrom,
      dateTo,
      status,
      ledgerStatus,
      referrerId,
      utmSource,
      minMarginThb,
      profitabilityFilter,
      tableLimit: limit,
    });

    const fromKey = (dateFrom || 'start').slice(0, 10);
    const toKey = (dateTo || 'end').slice(0, 10);

    if (format === 'referrers-csv') {
      const csv = ReferralAttributionService.buildAdminReferrerMonetaryCsv(
        data.referrerMonetaryRows,
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="referral-monetary_${fromKey}_${toKey}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'cohort-csv') {
      const cohortMap = await ReferralAttributionService.buildCohortMapForReferrers(
        data.referrerMonetaryRows,
        { fromIso: data.period.from, toIso: data.period.to },
      );
      const csv = ReferralAttributionService.buildAdminReferrerCohortCsv(
        data.referrerMonetaryRows,
        cohortMap,
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="referral-cohort_${fromKey}_${toKey}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'csv') {
      const csv = ReferralAttributionService.buildAdminDashboardCsv(data.rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="referral-attribution_${fromKey}_${toKey}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_ATTRIBUTION_ADMIN_FAILED' },
      { status: 500 },
    );
  }
}
