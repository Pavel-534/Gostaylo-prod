import { NextResponse } from 'next/server'
import { getPaymentAdaptersHealth } from '@/lib/services/payment-adapters/health'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) {
    return access.error
  }

  const health = getPaymentAdaptersHealth()
  return NextResponse.json({
    success: true,
    data: health,
  })
}

