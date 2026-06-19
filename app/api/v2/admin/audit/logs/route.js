/**
 * GET /api/v2/admin/audit/logs — admin audit explorer (ADMIN / MODERATOR read).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const { searchParams } = new URL(request.url)
  const entityType = String(searchParams.get('entity_type') || '').trim()
  const entityId = String(searchParams.get('entity_id') || '').trim()
  const action = String(searchParams.get('action') || '').trim()
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))

  let query = supabaseAdmin
    .from('admin_audit_logs')
    .select(
      'id, actor_id, actor_role, action, entity_type, entity_id, reason, payload_json, request_id, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  if (action) query = query.ilike('action', `%${action}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data || [] })
}
