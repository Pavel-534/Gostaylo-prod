import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'
import {
  interceptDuplicateIdempotencyKey,
  readIdempotencyKeyFromRequest,
  recordAdminAudit,
} from '@/lib/services/audit/admin-audit.js'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const gate = await requireAdminStaff(_request)
  if (gate.error) return gate.error

  const pack = await PayoutBatchService.getBatchWithItems(params.id)
  if (!pack) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ success: true, data: pack })
}

export async function PATCH(request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '').toLowerCase()
  const idempotencyKey = readIdempotencyKeyFromRequest(request)
  const actorRole = normalizeAdminRole(gate.profile?.role) || 'UNKNOWN'
  const batchId = String(params?.id || '').trim()

  if (action === 'lock') {
    const r = await PayoutBatchService.lockBatch(params.id, gate.profile?.id)
    if (r.success === false || r.error) {
      return NextResponse.json({ success: false, ...r }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...r })
  }
  if (action === 'settled') {
    if (idempotencyKey) {
      const dup = await interceptDuplicateIdempotencyKey(idempotencyKey)
      if (dup) return dup
    }

    const r = await PayoutBatchService.markBatchSettled(params.id, gate.profile?.id || null)
    if (r.error === 'not_found') {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
    }
    if (r.error === 'invalid_status') {
      return NextResponse.json({ success: false, ...r }, { status: 400 })
    }
    if (r.error === 'open_partner_payout_requests') {
      return NextResponse.json({ success: false, ...r }, { status: 409 })
    }
    try {
      const { invalidateFinancialIntelligenceCache } = await import(
        '@/lib/analytics/core/invalidate-financial-intelligence.js'
      )
      await invalidateFinancialIntelligenceCache()
    } catch (e) {
      console.warn('[payout-batches/settled] cache invalidate', e?.message || e)
    }

    if (r.success !== false) {
      await recordAdminAudit({
        actorId: gate.profile?.id || null,
        actorRole,
        action: 'payout_batch_settled',
        entityType: 'payout_batch',
        entityId: batchId,
        reason: body.reason ? String(body.reason).slice(0, 2000) : null,
        payload: { action: 'settled', batchId, result: r },
        idempotencyKey,
      })
    }

    return NextResponse.json({ success: r.success !== false, ...r })
  }
  return NextResponse.json({ success: false, error: 'unknown_action' }, { status: 400 })
}
