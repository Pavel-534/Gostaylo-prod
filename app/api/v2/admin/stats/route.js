/**
 * GoStayLo - Admin Stats API (v2)
 * GET /api/v2/admin/stats - Dashboard statistics
 */

import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { buildAdminStatsPayload } from '@/lib/admin/admin-stats-payload'

export async function GET(request) {
  try {
    const access = await requireAdminStaff(request)
    if (access.error) return access.error

    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const data = await buildAdminStatsPayload(supabaseAdmin)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
