/**
 * PATCH /api/v2/admin/partner-payout-profiles/[id] — верификация профиля (is_verified).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import { buildPartnerPayoutProfileVerifyAuditPayload } from '@/lib/admin/money-write-audit.js';
import { normalizeAdminRole } from '@/lib/admin/admin-menu';
import {
  interceptDuplicateIdempotencyKey,
  readIdempotencyKeyFromRequest,
  recordAdminAudit,
} from '@/lib/services/audit/admin-audit.js';

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return {
    userId: access.profile?.id || null,
    actorRole: normalizeAdminRole(access.profile?.role) || 'ADMIN',
  };
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Profile id required' }, { status: 400 });
  }

  const idempotencyKey = readIdempotencyKeyFromRequest(request);
  if (idempotencyKey) {
    const dup = await interceptDuplicateIdempotencyKey(idempotencyKey);
    if (dup) return dup;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (body?.action !== 'verify' && body?.is_verified !== true) {
    return NextResponse.json({ success: false, error: 'Use action: "verify" or is_verified: true' }, { status: 400 });
  }

  const { data: beforeRow, error: fetchErr } = await supabaseAdmin
    .from('partner_payout_profiles')
    .select('id, is_verified, partner_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }
  if (!beforeRow?.id) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('partner_payout_profiles')
    .update({
      is_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await recordAdminAudit({
    actorId: auth.userId,
    actorRole: auth.actorRole,
    action: 'partner_payout_profile_verify',
    entityType: 'partner_payout_profile',
    entityId: String(id),
    payload: buildPartnerPayoutProfileVerifyAuditPayload({ row: beforeRow, adminId: auth.userId }),
    idempotencyKey,
  });

  return NextResponse.json({ success: true, data });
}
