import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import { buildPartnerLiabilityReport } from '@/lib/analytics/reports/partner-liability.block.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence/partners
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const excludeTest = new URL(request.url).searchParams.get('excludeTest') !== '0';
    const data = await buildPartnerLiabilityReport({ excludeTest });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[finance/intelligence/partners]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'PARTNER_LIABILITY_FAILED' },
      { status: 500 },
    );
  }
}
