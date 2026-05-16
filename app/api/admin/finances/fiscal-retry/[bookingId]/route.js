import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { retryPendingFiscalReceipt } from '@/lib/services/fiscal-kassa.service.js'

export const dynamic = 'force-dynamic'

export async function POST(_request, { params }) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const result = await retryPendingFiscalReceipt(params.bookingId)
  return NextResponse.json({ success: !result.error, ...result })
}
