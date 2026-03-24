/**
 * POST /api/v2/admin/audit/impersonation
 * Запись в audit_logs при входе админа в кабинет другого пользователя (impersonation).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { createClient } from '@supabase/supabase-js'
import { insertAuditLog } from '@/lib/services/audit/insert-audit-log'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const adminId = await getUserIdFromSession()
  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', adminId).single()
  if (error || !profile || profile.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const targetUserId = body.targetUserId || body.target_user_id
  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ success: false, error: 'targetUserId required' }, { status: 400 })
  }

  const targetRole = body.targetRole || body.target_role || 'USER'
  const message = `Admin [${adminId}] impersonated ${String(targetRole).toUpperCase()} [${targetUserId}]`

  await insertAuditLog({
    userId: adminId,
    action: 'IMPERSONATION_START',
    entityType: 'user',
    entityId: targetUserId,
    payload: {
      message,
      admin_id: adminId,
      target_user_id: targetUserId,
      target_role: String(targetRole).toUpperCase(),
    },
  })

  return NextResponse.json({ success: true })
}
