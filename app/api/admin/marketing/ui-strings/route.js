import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { validateMarketingUiStringsPayload } from '@/lib/marketing/validate-marketing-ui-strings'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'marketing_ui_strings'

export async function GET() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    if (error) throw error
    const value = data?.value && typeof data.value === 'object' && !Array.isArray(data.value) ? data.value : {}
    return NextResponse.json({ data: value })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to load' }, { status: 500 })
  }
}

export async function PUT(request) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body?.value !== undefined ? body.value : body
  const parsed = validateMarketingUiStringsPayload(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.errors }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from('system_settings').upsert(
      { key: SETTINGS_KEY, value: parsed.value },
      { onConflict: 'key' },
    )
    if (error) throw error
    return NextResponse.json({ success: true, data: parsed.value })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 })
  }
}
