/**
 * Admin system_settings (service_role). Used by admin UI after RLS on system_settings.
 * GET ?keys=key1,key2  |  PATCH { key, value }
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';

export const dynamic = 'force-dynamic';

const MAX_KEYS = 24;

export async function GET(request) {
  const gate = await requireAdminStaff();
  if (gate.error) return gate.error;

  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const keysRaw = searchParams.get('keys') || searchParams.get('key');
  if (!keysRaw?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Query keys or key is required' },
      { status: 400 }
    );
  }

  const keys = [
    ...new Set(
      keysRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_KEYS);

  if (!keys.length) {
    return NextResponse.json(
      { success: false, error: 'No valid keys' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('id,key,value,updated_at')
    .in('key', keys);

  if (error) {
    console.error('[admin/system-settings GET]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const byKey = {};
  for (const row of data || []) {
    byKey[row.key] = row;
  }

  return NextResponse.json({
    success: true,
    data: { rows: data || [], byKey },
  });
}

export async function PATCH(request) {
  const gate = await requireAdminStaff();
  if (gate.error) return gate.error;

  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Database not configured' },
      { status: 500 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const key = String(body.key || '').trim();
  if (!key || key.length > 128) {
    return NextResponse.json(
      { success: false, error: 'key is required' },
      { status: 400 }
    );
  }

  if (body.value === undefined) {
    return NextResponse.json(
      { success: false, error: 'value is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .upsert({ key, value: body.value }, { onConflict: 'key' })
    .select('id,key,value,updated_at')
    .single();

  if (error) {
    console.error('[admin/system-settings PATCH]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
