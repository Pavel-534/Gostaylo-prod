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
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_MONITOR_FAILED' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body?.action || '').toLowerCase();
  if (action !== 'topup') {
    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  }

  const amountThb = Number(body?.amountThb ?? body?.amount_thb);
  if (!Number.isFinite(amountThb) || amountThb <= 0) {
    return NextResponse.json({ success: false, error: 'amountThb must be > 0' }, { status: 400 });
  }

  try {
    const result = await ReferralPnlService.adjustMarketingPromoPot(amountThb, 'manual_topup', {
      metadata: {
        trigger: 'admin_manual_topup',
        note: String(body?.note || '').slice(0, 500),
      },
    });
    if (!result.applied) {
      return NextResponse.json(
        { success: false, error: result.reason || 'TOPUP_NOT_APPLIED', data: result },
        { status: 409 },
      );
    }
    const stats = await ReferralPnlService.getMonitorStats();
    return NextResponse.json({ success: true, data: { topup: result, monitor: stats } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'PROMO_TANK_TOPUP_FAILED' },
      { status: 500 },
    );
  }
}

