/**
 * PATCH /api/v2/admin/locations/suggestions/:id/resolve
 * Stage 160 — MERGE or REJECT (ADMIN only).
 *
 * Body: { action: "MERGE"|"REJECT", target_code?, target_type?, reject_reason?, synonym_lang? }
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { denyUnlessAdminFinancialRole, recordAdminAudit } from '@/lib/services/audit/admin-audit.js'
import { resolveLocationSuggestion } from '@/lib/services/location-suggestion-resolve.service'

export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const rbacDeny = denyUnlessAdminFinancialRole(access)
  if (rbacDeny) return rbacDeny

  const suggestionId = String(params?.id || '').trim()
  if (!suggestionId) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON' }, { status: 400 })
  }

  const action = String(body?.action || '').toUpperCase()
  if (action === 'MERGE') {
    if (!body.target_code || !body.target_type) {
      return NextResponse.json(
        { success: false, error: 'target_code and target_type required for MERGE' },
        { status: 400 },
      )
    }
  }

  const adminUserId = access.profile?.id
  if (!adminUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const result = await resolveLocationSuggestion({ ...body, suggestionId }, adminUserId)

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: result.status || 500 },
    )
  }

  await recordAdminAudit({
    actorId: adminUserId,
    actorRole: access.profile?.role,
    action: `location_suggestion_${action.toLowerCase()}`,
    entityType: 'location_suggestion',
    entityId: suggestionId,
    payload: {
      target_code: body.target_code,
      target_type: body.target_type,
      merged_listings_count: result.merged_listings_count,
      synonym_id: result.synonym_id,
      reject_reason: body.reject_reason,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      action: result.action,
      suggestion_id: result.suggestion_id,
      raw_term: result.raw_term,
      merged_listings_count: result.merged_listings_count ?? 0,
      synonym_id: result.synonym_id ?? null,
      target_code: result.target_code,
      target_type: result.target_type,
    },
  })
}
