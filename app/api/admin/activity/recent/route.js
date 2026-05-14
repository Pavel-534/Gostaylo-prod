/**
 * GET /api/admin/activity/recent?limit=8
 * Последние записи activity_log (service_role).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(1, parseInt(String(searchParams.get('limit') || '8'), 10) || 8))

  try {
    const { data, error } = await supabaseAdmin
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[admin/activity/recent]', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e) {
    console.error('[admin/activity/recent]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
