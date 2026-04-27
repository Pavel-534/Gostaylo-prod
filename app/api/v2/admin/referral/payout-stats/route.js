import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionPayload } from '@/lib/services/session-service';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSessionPayload();
  if (!session?.userId) return { error: 'Unauthorized', status: 401 };
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 };
  }
  return { ok: true };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
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

