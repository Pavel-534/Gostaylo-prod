/**
 * GET /api/v2/admin/payouts — все выплаты (только ADMIN).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionPayload } from '@/lib/services/session-service';

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
  return { userId: session.userId };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10)));

  try {
    const { data: payouts, error } = await supabaseAdmin
      .from('payouts')
      .select(
        `
        *,
        payout_method:payout_methods(id,name,channel,currency),
        payout_profile:partner_payout_profiles(id,is_verified,is_default)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const transformed = (payouts || []).map((p) => ({
      id: p.id,
      partnerId: p.partner_id,
      bookingId: p.booking_id,
      amount: parseFloat(p.amount),
      grossAmount: parseFloat(p.gross_amount) || parseFloat(p.amount) || 0,
      payoutFeeAmount: parseFloat(p.payout_fee_amount) || 0,
      finalAmount: parseFloat(p.final_amount) || parseFloat(p.amount) || 0,
      currency: p.currency,
      status: p.status,
      payoutMethod: p.payout_method || null,
      payoutProfile: p.payout_profile || null,
      createdAt: p.created_at,
      processedAt: p.processed_at,
    }));

    return NextResponse.json({ success: true, data: transformed });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
