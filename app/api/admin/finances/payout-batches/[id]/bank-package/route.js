/**
 * GET /api/admin/finances/payout-batches/[id]/bank-package — ZIP для банка (Stage 102.4).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { buildPayoutBatchBankPackageZip } from '@/lib/services/payout-batch-bank-package.service.js'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const batchId = params?.id
  if (!batchId) {
    return NextResponse.json({ success: false, error: 'Missing batch id' }, { status: 400 })
  }

  const result = await buildPayoutBatchBankPackageZip(batchId)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 404 })
  }

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="bank-package-${batchId}.zip"`,
      'Cache-Control': 'no-store',
      'X-Acts-Included': String(result.actsCount ?? 0),
    },
  })
}
