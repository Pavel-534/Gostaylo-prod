/**
 * GET /api/v2/wallet/referral-withdrawal-preview
 * Stage 131.3 — transparent gross / 1.5% fee / net preview before withdrawal request.
 */
import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import WalletService from '@/lib/services/finance/wallet.service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  try {
    const { searchParams } = new URL(request.url)
    const payoutCurrency = searchParams.get('payoutCurrency') || searchParams.get('currency') || 'THB'
    const grossRaw = searchParams.get('grossThb') ?? searchParams.get('amountThb')
    const grossThb = grossRaw != null && grossRaw !== '' ? Number(grossRaw) : null
    const result = await WalletService.getReferralWithdrawalPreview(
      session.userId,
      payoutCurrency,
      Number.isFinite(grossThb) ? grossThb : null,
    )
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'PREVIEW_FAILED' },
        { status: result.status || 400 },
      )
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_WITHDRAWAL_PREVIEW_FAILED' },
      { status: 500 },
    )
  }
}
