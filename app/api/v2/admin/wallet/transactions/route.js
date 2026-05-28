/**
 * GET /api/v2/admin/wallet/transactions — wallet ledger audit (Stage 71.6).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { buildWalletReferenceLabels } from '@/lib/admin/wallet-transaction-reference-label';

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

  const refLabels = await buildWalletReferenceLabels(supabaseAdmin, txs || []);

  const rows = (txs || []).map((t) => {
    const rid = String(t?.reference_id || '').trim();
    return {
      ...t,
      profile: profileMap[t.user_id] || null,
      reference_label: rid && refLabels[rid] ? refLabels[rid] : null,
    };
  });

  return NextResponse.json({ success: true, data: { transactions: rows, limit } });
}
