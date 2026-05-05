/**
 * GET /api/v2/admin/payouts — все выплаты (только ADMIN).
 * Query: `status` — одно значение enum **или** псевдоним **`FINAL` | `SUCCESS` | `PAID_OR_COMPLETED`** → строки со статусом **PAID** и **COMPLETED** (финальные успешные).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAccess } from '@/lib/security/access-guard';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await requireAccess({ roles: ['ADMIN'] });
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10)));
  const statusFilter = String(searchParams.get('status') || '').trim().toUpperCase();
  /** PAID и COMPLETED — финальные успешные выплаты (единый фильтр для отчётов). */
  const FINAL_SUCCESS_ALIASES = new Set(['FINAL', 'SUCCESS', 'PAID_OR_COMPLETED', 'COMPLETED_OR_PAID']);

  try {
    let q = supabaseAdmin.from('payouts').select(
      `
        *,
        payout_method:payout_methods(id,name,channel,currency),
        payout_profile:partner_payout_profiles(id,is_verified,is_default)
      `,
    );
    if (statusFilter) {
      if (FINAL_SUCCESS_ALIASES.has(statusFilter)) {
        q = q.in('status', ['PAID', 'COMPLETED']);
      } else {
        q = q.eq('status', statusFilter);
      }
    }
    const { data: payouts, error } = await q.order('created_at', { ascending: false }).limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const transformed = (payouts || []).map((p) => {
      const st = String(p.status || '').toUpperCase();
      return {
      id: p.id,
      partnerId: p.partner_id,
      bookingId: p.booking_id,
      amount: parseFloat(p.amount),
      grossAmount: parseFloat(p.gross_amount) || parseFloat(p.amount) || 0,
      payoutFeeAmount: parseFloat(p.payout_fee_amount) || 0,
      finalAmount: parseFloat(p.final_amount) || parseFloat(p.amount) || 0,
      currency: p.currency,
      status: p.status,
      isFinalSuccess: st === 'PAID' || st === 'COMPLETED',
      rejectionReason: p.rejection_reason || null,
      payoutMethod: p.payout_method || null,
      payoutProfile: p.payout_profile || null,
      createdAt: p.created_at,
      processedAt: p.processed_at,
    };
    });

    return NextResponse.json({ success: true, data: transformed });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
