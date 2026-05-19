/**
 * POST /api/v2/partner/payouts/request
 * Stage 100.3 — alias for live payout create (same as POST /api/v2/partner/payouts).
 * Accepts legacy body: { availableThb, payoutPreviewFinal, ... } → normalized amount.
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { isPartnerProfileAdminVerified } from '@/lib/partner/partner-payout-kyc'
import { PaymentsV3Service } from '@/lib/services/payments-v3.service'
import { assertTreasuryOpsAllowed } from '@/lib/treasury/treasury-ops-config.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const pauseGate = await assertTreasuryOpsAllowed('payout')
    if (!pauseGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: pauseGate.code,
          message: pauseGate.message,
        },
        { status: 503 },
      )
    }

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

    const body = await request.json().catch(() => ({}))
    const amount = Number(
      body.amount ?? body.payoutPreviewFinal ?? body.availableThb ?? body.available_thb ?? 0,
    )
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    const result = await PaymentsV3Service.requestPayout(sessionUserId, amount, body.method || 'MANUAL', {
      walletAddress: body.walletAddress,
      bankAccount: body.bankAccount,
      payoutProfileId: body.payoutProfileId ?? body.payout_profile_id ?? null,
    })

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result.payout,
      payoutMath: result.payoutMath || null,
    })
  } catch (error) {
    console.error('[PAYOUT_REQUEST]', error)
    return NextResponse.json({ success: false, error: error?.message || 'Error' }, { status: 500 })
  }
}
