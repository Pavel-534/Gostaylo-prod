/**
 * POST /api/v2/admin/referral/ledger-bulk
 * Stage 114.6 — hold_all_pending | release_all_held по фильтрам FinTech.
 */
import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { applyReferralLedgerBulkAction } from '@/lib/admin/referral-ledger-bulk-admin.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) return access.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const data = await applyReferralLedgerBulkAction({
      action: body?.action,
      periodFrom: body?.periodFrom || '',
      periodTo: body?.periodTo || '',
      type: body?.type || 'all',
      adminUserId: access.profile?.id || null,
      limit: Number(body?.limit) || 200,
    })
    if (data?.processed === 0 && data?.failureCount > 0) {
      return NextResponse.json(
        { success: false, error: data?.error || 'REFERRAL_LEDGER_BULK_FAILED', data },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: data?.success !== false, data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_LEDGER_BULK_FAILED' },
      { status: 500 },
    )
  }
}
