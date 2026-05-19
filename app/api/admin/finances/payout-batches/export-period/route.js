import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from_and_to_required' }, { status: 400 })
  }

  const csv = await PayoutBatchService.exportBatchesPeriodCsv(from, to)
  const fileStamp = `${from}_${to}`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payout-pools-${fileStamp}.csv"`,
    },
  })
}
