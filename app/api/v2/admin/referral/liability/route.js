/**
 * GET /api/v2/admin/referral/liability
 * Stage 114.2 / 114.4 / 114.5 — FinTech snapshot + accounting (query: periodFrom, periodTo, status, type).
 */
import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { loadReferralAccountingSnapshot } from '@/lib/admin/referral-accounting-snapshot.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error
  try {
    const { searchParams } = new URL(request.url)
    const data = await loadReferralAccountingSnapshot({
      accrualLimit: Number(searchParams.get('accrualLimit')) || 20,
      periodFrom: searchParams.get('periodFrom') || '',
      periodTo: searchParams.get('periodTo') || '',
      ledgerStatus: searchParams.get('status') || 'all',
      ledgerType: searchParams.get('type') || 'all',
      topLimit: Number(searchParams.get('topLimit')) || 10,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_LIABILITY_FAILED' },
      { status: 500 },
    )
  }
}
