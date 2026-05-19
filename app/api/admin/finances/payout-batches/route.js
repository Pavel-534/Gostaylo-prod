import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const status = new URL(request.url).searchParams.get('status')
  const data = await PayoutBatchService.listBatchesForAdmin({ status: status || null })
  return NextResponse.json({ success: true, data })
}

export async function POST(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const result = await PayoutBatchService.createDraftPoolForToday({
    rail: body.rail || 'TBANK_RU',
    force: Boolean(body.force),
    createdBy: gate.profile?.id || null,
  })
  if (result.error) {
    return NextResponse.json({ success: false, ...result }, { status: 400 })
  }
  if (result.message === 'no_ready_bookings' || (result.itemCount === 0 && !result.batchId)) {
    return NextResponse.json({
      success: false,
      code: 'NO_READY_BOOKINGS',
      message: 'Нет бронирований, готовых к выплате',
      itemCount: 0,
    })
  }
  if (result.message === 'all_already_batched') {
    return NextResponse.json({
      success: false,
      code: 'ALL_ALREADY_BATCHED',
      message: 'Все готовые брони уже в предыдущих пулах',
      itemCount: 0,
    })
  }
  return NextResponse.json({ success: true, ...result })
}
