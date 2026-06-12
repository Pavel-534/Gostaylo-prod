import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { getShadowL2LiabilityDashboard } from '@/lib/services/finance/shadow-l2-liability.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const data = await getShadowL2LiabilityDashboard()
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'SHADOW_L2_READ_FAILED', message: e?.message || 'read failed' },
      { status: 500 },
    )
  }
}
