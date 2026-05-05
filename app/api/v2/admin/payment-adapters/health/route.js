import { NextResponse } from 'next/server'
import { getPaymentAdaptersHealth } from '@/lib/services/payment-adapters/health'
import { requireAccess } from '@/lib/security/access-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) {
    return access.error
  }

  const health = getPaymentAdaptersHealth()
  return NextResponse.json({
    success: true,
    data: health,
  })
}

