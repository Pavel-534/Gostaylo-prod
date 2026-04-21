import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { getPaymentAdaptersHealth } from '@/lib/services/payment-adapters/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (String(session.role || '').toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
  }

  const health = getPaymentAdaptersHealth()
  return NextResponse.json({
    success: true,
    data: health,
  })
}

