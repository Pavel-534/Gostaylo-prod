/**
 * POST /api/v2/admin/audit/impersonation
 * Запись в audit_logs при входе админа в кабинет другого пользователя (impersonation).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { insertAuditLog } from '@/lib/services/audit/insert-audit-log'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) {
    return access.error
  }
  const adminId = String(access.profile?.id || '')
  if (!adminId || !supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
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
