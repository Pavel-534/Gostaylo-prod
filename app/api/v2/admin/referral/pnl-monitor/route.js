import { NextResponse } from 'next/server';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { ok: true, profile: access.profile };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
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
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
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
        admin_user_id: auth.profile?.id ? String(auth.profile.id) : null,
        admin_email: auth.profile?.email ? String(auth.profile.email).slice(0, 320) : null,
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

