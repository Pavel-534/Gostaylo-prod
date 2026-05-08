/**
 * PATCH /api/v2/admin/partner-payout-profiles/[id] — верификация профиля (is_verified).
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

export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Profile id required' }, { status: 400 });
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

  return NextResponse.json({ success: true, data });
}
