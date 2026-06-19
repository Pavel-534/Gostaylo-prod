/**
 * PATCH /api/v2/admin/privacy/erasure-requests/[id]
 *   action=process_now | cancel
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { recordAdminAudit } from '@/lib/services/audit/admin-audit.js'
import { denyUnlessAdminFinancialRole } from '@/lib/services/audit/admin-audit.js'
import {
  executeErasureForUser,
  ERASURE_GRACE_DAYS,
} from '@/lib/privacy/data-subject-erasure.service'

export const dynamic = 'force-dynamic'

export async function PATCH(request, context) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const adminOnly = denyUnlessAdminFinancialRole(access)
  if (adminOnly) return adminOnly

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const action = String(body.action || '').trim().toLowerCase()
  if (!['process_now', 'cancel'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }

  const { data: row, error } = await supabaseAdmin
    .from('data_erasure_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  if (action === 'cancel') {
    if (row.status !== 'pending_grace') {
      return NextResponse.json({ success: false, error: 'Not cancellable' }, { status: 409 })
    }
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('data_erasure_requests')
      .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
      .eq('id', id)

    await recordAdminAudit({
      actorId: access.profile?.id,
      actorRole: access.profile?.role,
      action: 'erasure_request_cancel',
      entityType: 'data_erasure_request',
      entityId: id,
      payload: { user_id: row.user_id },
    })

    return NextResponse.json({ success: true, cancelled: true })
  }

  if (!['pending_grace', 'processing'].includes(row.status)) {
    return NextResponse.json({ success: false, error: 'Not processable' }, { status: 409 })
  }

  const result = await executeErasureForUser(row.user_id, row.id)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error || 'Failed' }, { status: 500 })
  }

  await recordAdminAudit({
    actorId: access.profile?.id,
    actorRole: access.profile?.role,
    action: 'erasure_process_now',
    entityType: 'data_erasure_request',
    entityId: id,
    payload: { user_id: row.user_id, grace_days: ERASURE_GRACE_DAYS },
  })

  return NextResponse.json({ success: true, processed: true })
}
