import { NextResponse } from 'next/server';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { ok: true };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }
  try {
    const data = await ReferralPnlService.getAnalyticsStats();
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_ANALYTICS_FAILED' },
      { status: 500 },
    );
  }
}
