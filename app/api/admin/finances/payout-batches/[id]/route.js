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
    if (r.success === false || r.error) {
      return NextResponse.json({ success: false, ...r }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...r })
  }
  if (action === 'settled') {
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
    return NextResponse.json({ success: r.success !== false, ...r })
  }
  return NextResponse.json({ success: false, error: 'unknown_action' }, { status: 400 })
}
