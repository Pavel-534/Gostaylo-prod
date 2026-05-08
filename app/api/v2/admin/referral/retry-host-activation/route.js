import { NextResponse } from 'next/server';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { requireAccess } from '@/lib/security/access-guard';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await requireAccess({ roles: ['ADMIN'] });
  if (access.error) return { error: access.error };
  return { ok: true, profile: access.profile };
}

/**
 * POST — повторить `distributeHostPartnerActivation` после пополнения promo tank
 * (броня остаётся COMPLETED; метаданные `pending_tank_refill` снимаются при успехе).
 */
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const bookingId = String(body?.bookingId || body?.booking_id || '').trim();
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
  }
  try {
    const result = await ReferralPnlService.distributeHostPartnerActivation(bookingId);
    const status = result?.success === false ? 500 : 200;
    return NextResponse.json({ success: result?.success !== false, data: result }, { status });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'RETRY_HOST_ACTIVATION_FAILED' },
      { status: 500 },
    );
  }
}
