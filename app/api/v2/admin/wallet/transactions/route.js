/**
 * GET /api/v2/admin/wallet/transactions — wallet ledger audit (Stage 71.6).
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
  return { ok: true };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 80));
  const userId = searchParams.get('userId') ? String(searchParams.get('userId')).trim() : null;

  let q = supabaseAdmin
    .from('wallet_transactions')
    .select(
      'id,wallet_id,user_id,operation_type,amount_thb,balance_before_thb,balance_after_thb,tx_type,reference_id,expires_at,metadata,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    q = q.eq('user_id', userId);
  }

  const { data: txs, error: txErr } = await q;
  if (txErr) {
    return NextResponse.json(
      { success: false, error: txErr.message || 'WALLET_TX_QUERY_FAILED' },
      { status: 500 },
    );
  }

  const ids = [...new Set((txs || []).map((t) => t.user_id).filter(Boolean))];
  let profileMap = {};
  if (ids.length) {
    const { data: profs, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name,referral_code')
      .in('id', ids);
    if (!pErr && profs) {
      profileMap = Object.fromEntries(profs.map((p) => [p.id, p]));
    }
  }

  const rows = (txs || []).map((t) => ({
    ...t,
    profile: profileMap[t.user_id] || null,
  }));

  return NextResponse.json({ success: true, data: { transactions: rows, limit } });
}
