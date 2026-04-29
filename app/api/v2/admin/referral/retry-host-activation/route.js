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
  return { ok: true, session };
}

/**
 * POST — повторить `distributeHostPartnerActivation` после пополнения promo tank
 * (броня остаётся COMPLETED; метаданные `pending_tank_refill` снимаются при успехе).
 */
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
