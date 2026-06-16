import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { denyUnlessAdminFinancialRole, recordAdminAudit } from '@/lib/services/audit/admin-audit.js'
import { normalizeAdminRole } from '@/lib/admin/admin-menu'
import { retryDisputeResolutionTerminalState } from '@/lib/services/dispute/dispute-resolution-retry.js'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  try {
    const access = await requireAdminStaff(request)
    if (access.error) return access.error

    const rbacDeny = denyUnlessAdminFinancialRole(access)
    if (rbacDeny) return rbacDeny

    const disputeId = String(params?.id || '').trim()
    if (!disputeId) {
      return NextResponse.json({ success: false, error: 'Dispute ID is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = String(body?.reason || '').trim().slice(0, 2000)
    const actorId = access.profile?.id || null
    const actorRole = normalizeAdminRole(access.profile?.role) || 'ADMIN'

    const result = await retryDisputeResolutionTerminalState(disputeId, {
      actorId,
      actorRole,
      reason: reason || 'Manual resolution saga retry',
    })

    if (!result.success) {
      const status = result.error === 'dispute_not_found' ? 404 : 400
      return NextResponse.json({ success: false, ...result }, { status })
    }

    if (!result.noop) {
      await recordAdminAudit({
        actorId,
        actorRole,
        action: 'dispute_resolution_retry',
        entityType: 'dispute',
        entityId: disputeId,
        reason: reason || null,
        payload: {
          fromStatus: result.fromStatus,
          toStatus: result.toStatus,
        },
      })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    console.error('[ADMIN DISPUTE RESOLUTION RETRY]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
