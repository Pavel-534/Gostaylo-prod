/**
 * POST /api/admin/activity
 * Запись в activity_log (service_role). Тело: { activity_type, description?, metadata? }
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const activity_type = String(body.activity_type || body.action || '').trim().slice(0, 50)
    if (!activity_type) {
      return NextResponse.json({ success: false, error: 'activity_type required' }, { status: 400 })
    }

    const description =
      typeof body.description === 'string'
        ? body.description
        : body.details != null
          ? typeof body.details === 'string'
            ? body.details
            : JSON.stringify(body.details)
          : null

    const metadata =
      body.metadata && typeof body.metadata === 'object' ? body.metadata : { source: 'admin-panel' }

    const { data, error } = await supabaseAdmin
      .from('activity_log')
      .insert({
        activity_type,
        description,
        user_name: gate.profile?.email || gate.profile?.id || 'staff',
        metadata,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[admin/activity POST]', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[admin/activity POST]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
