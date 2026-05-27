import { NextResponse } from 'next/server';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { ok: true };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }
  try {
    const stats = await ReferralPnlService.getMonitorStats();
    return NextResponse.json({
      success: true,
      data: {
        totalPaidOutThb: stats?.payoutsTotalThb ?? 0,
        currentPromoTankBalanceThb: stats?.currentPromoTankBalanceThb ?? 0,
        forecastDebitNext10HostActivationsThb: stats?.forecastDebitNext10HostActivationsThb ?? 0,
        projectedDebitPerHostActivationThb: stats?.projectedDebitPerHostActivationThb ?? 0,
        partnerActivationBonusThb: stats?.partnerActivationBonusThb ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_PAYOUT_STATS_FAILED' },
      { status: 500 },
    );
  }
}

