import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json'
  const result = await PayoutBatchService.exportBatchRegistry(params.id, format)
  if (result.error === 'not_found') {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  }
  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error, message: result.message, status: result.status },
      { status: result.error === 'invalid_status' ? 400 : 404 },
    )
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="payout-batch-${params.id}.${format}"`,
      'X-Export-Checksum': result.checksum,
    },
  })
}
