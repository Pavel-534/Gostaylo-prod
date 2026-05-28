/**
 * GET /api/v2/admin/partner-payout-profiles — профили с is_verified = false (+ партнёр, метод).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
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
