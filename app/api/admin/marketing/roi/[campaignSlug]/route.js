import { NextResponse } from 'next/server';
import buildReferralCampaignRoiReport from '@/lib/analytics/reports/referral-campaign-roi.report.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/marketing/roi/[campaignSlug]?period=7d|30d|today&fresh=1
 */
export async function GET(request, { params }) {
  const { requireAdminStaff } = await import('@/lib/security/admin-staff-access');
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const skipCache = url.searchParams.get('fresh') === '1';
    const campaignSlug = params?.campaignSlug || '';

    const data = await buildReferralCampaignRoiReport({
      campaignSlug,
      periodPreset: period,
      skipCache,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/marketing/roi/campaign]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'CAMPAIGN_ROI_REPORT_FAILED' },
      { status: 500 },
    );
  }
}
