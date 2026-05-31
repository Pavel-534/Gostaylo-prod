import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import buildExecutiveSummaryReport from '@/lib/analytics/reports/executive-summary.report.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence
 * Query: period=today|7d|30d, excludeTest=1|0
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const excludeTest = url.searchParams.get('excludeTest') !== '0';

    const skipCache = url.searchParams.get('fresh') === '1';

    const data = await buildExecutiveSummaryReport({
      periodPreset: period,
      excludeTest,
      skipCache,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[finance/intelligence]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'INTELLIGENCE_REPORT_FAILED' },
      { status: 500 },
    );
  }
}
