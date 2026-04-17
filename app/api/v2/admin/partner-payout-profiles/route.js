/**
 * GET /api/v2/admin/partner-payout-profiles — профили с is_verified = false (+ партнёр, метод).
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

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('*, method:payout_methods(id,name,channel,currency)')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const partnerIds = [...new Set((profiles || []).map((p) => p.partner_id).filter(Boolean))];
    let partnerMap = new Map();
    if (partnerIds.length) {
      const { data: profs, error: pe } = await supabaseAdmin
        .from('profiles')
        .select('id,email,first_name,last_name')
        .in('id', partnerIds);
      if (pe) return NextResponse.json({ success: false, error: pe.message }, { status: 500 });
      partnerMap = new Map((profs || []).map((p) => [p.id, p]));
    }

    const rows = (profiles || []).map((p) => ({
      id: p.id,
      partnerId: p.partner_id,
      methodId: p.method_id,
      data: p.data || {},
      isDefault: p.is_default,
      createdAt: p.created_at,
      method: p.method || null,
      partner: partnerMap.get(p.partner_id) || null,
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
