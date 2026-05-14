/**
 * GET /api/admin/metrics/overview
 * Stage 94 prep: агрегаты и счётчики таблиц только через service_role (без anon /_db).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import {
  buildAdminStatsPayload,
  buildAdminTableCounts,
} from '@/lib/admin/admin-stats-payload'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  try {
    const [stats, tableCounts] = await Promise.all([
      buildAdminStatsPayload(supabaseAdmin),
      buildAdminTableCounts(supabaseAdmin),
    ])

    const { data: seed } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, first_name, last_name')
      .eq('id', 'admin-777')
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        tableCounts,
        seedAdminProfile: seed || null,
        adminStats: stats,
      },
    })
  } catch (e) {
    console.error('[admin/metrics/overview]', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
