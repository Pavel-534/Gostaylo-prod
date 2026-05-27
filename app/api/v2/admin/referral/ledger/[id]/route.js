/**
 * PATCH /api/v2/admin/referral/ledger/[id]
 * Stage 114.5 — hold / release_hold / reject (admin).
 */
import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { applyReferralLedgerAdminAction } from '@/lib/admin/referral-ledger-admin.js'

export const dynamic = 'force-dynamic'

export async function PATCH(request, context) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const params = await Promise.resolve(context.params)
  const ledgerId = params?.id ? String(params.id).trim() : ''
  if (!ledgerId) {
    return NextResponse.json({ success: false, error: 'LEDGER_ID_REQUIRED' }, { status: 400 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const result = await applyReferralLedgerAdminAction(ledgerId, {
      action: body?.action,
      note: body?.note,
      adminUserId: access.profile?.id || null,
    })
    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'REFERRAL_LEDGER_ACTION_FAILED' },
        { status: result?.error === 'NOT_FOUND' ? 404 : 400 },
      )
    }
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_LEDGER_ACTION_FAILED' },
      { status: 500 },
    )
  }
}
