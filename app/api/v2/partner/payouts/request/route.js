/**
 * POST /api/v2/partner/payouts/request
 * Stage 47.1 — заглушка шлюза вывода: логирует тело запроса (без создания выплаты).
 * Реальная заявка остаётся на POST /api/v2/partner/payouts → PaymentsV3Service.requestPayout.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { isPartnerProfileAdminVerified } from '@/lib/partner/partner-payout-kyc'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const sessionUserId = await getUserIdFromSession()
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const kycOk = await isPartnerProfileAdminVerified(sessionUserId)
    if (!kycOk) {
      return NextResponse.json(
        { success: false, error: 'PROFILE_NOT_VERIFIED', code: 'PROFILE_NOT_VERIFIED' },
        { status: 403 },
      )
    }

    await request.json().catch(() => ({}))

    return NextResponse.json({
      success: true,
      stub: true,
      message: 'Payout request logged (Stage 47.1 stub — no payout created)',
    })
  } catch (error) {
    console.error('[PAYOUT_REQUEST_STUB]', error)
    return NextResponse.json({ success: false, error: error?.message || 'Error' }, { status: 500 })
  }
}
