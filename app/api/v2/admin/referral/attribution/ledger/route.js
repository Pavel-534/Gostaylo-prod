import { NextResponse } from 'next/server';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/admin/referral/attribution/ledger?attributionId=rat-...
 */
export async function GET(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const attributionId = searchParams.get('attributionId') || '';

  try {
    const result = await ReferralAttributionService.getAdminLedgerForAttribution(attributionId);
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 },
      );
    }
    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_ATTRIBUTION_LEDGER_FAILED' },
      { status: 500 },
    );
  }
}
