import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const pack = await PayoutBatchService.getBatchWithItems(params.id)
  if (!pack) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ success: true, data: pack })
}

export async function PATCH(request, { params }) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '').toLowerCase()

  if (action === 'lock') {
    const r = await PayoutBatchService.lockBatch(params.id, gate.profile?.id)
    return NextResponse.json({ success: !r.error, ...r })
  }
  if (action === 'settled') {
    const r = await PayoutBatchService.markBatchSettled(params.id)
    return NextResponse.json({ success: true, ...r })
  }
  return NextResponse.json({ success: false, error: 'unknown_action' }, { status: 400 })
}
