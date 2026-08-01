/**
 * GET /api/v2/admin/partner-ledger-shadow?partnerId=
 * ADR-203 Phase 1 — status vs ledger shadow compare (read-only).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { comparePartnerLedgerShadow } from '@/lib/ops/ledger-shadow-reconcile.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const url = new URL(request.url)
  const partnerId = String(url.searchParams.get('partnerId') || '').trim()
  if (!partnerId) {
    return NextResponse.json({ success: false, error: 'partnerId required' }, { status: 400 })
  }

  const asOfDate = url.searchParams.get('asOf') || url.searchParams.get('asOfDate') || null
  const alignRaw = url.searchParams.get('alignPendingPayoutReserve')
  const alignPendingPayoutReserve =
    alignRaw == null ? true : !['0', 'false', 'no'].includes(String(alignRaw).toLowerCase())

  try {
    const data = await comparePartnerLedgerShadow(partnerId, {
      asOfDate,
      alignPendingPayoutReserve,
    })
    if (!data.success) {
      return NextResponse.json(data, { status: 500 })
    }
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}
