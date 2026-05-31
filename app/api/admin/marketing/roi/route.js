import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import buildReferralRoiReport from '@/lib/analytics/reports/referral-roi.report.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/marketing/roi?period=7d|30d|today&fresh=1
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const skipCache = url.searchParams.get('fresh') === '1';

    const data = await buildReferralRoiReport({ periodPreset: period, skipCache });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/marketing/roi]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_ROI_REPORT_FAILED' },
      { status: 500 },
    );
  }
}
