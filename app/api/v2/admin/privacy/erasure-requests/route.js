/**
 * GET /api/v2/admin/privacy/erasure-requests — DSAR erasure queue (ADMIN).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const { searchParams } = new URL(request.url)
  const status = String(searchParams.get('status') || '').trim()
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  let query = supabaseAdmin
    .from('data_erasure_requests')
    .select('id, user_id, status, requested_at, scheduled_for, completed_at, cancelled_at, reason')
    .order('requested_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data || [] })
}
