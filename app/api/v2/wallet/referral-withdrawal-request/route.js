/**
 * POST /api/v2/wallet/referral-withdrawal-request
 * Stage 114.2 — полуавтоматическая заявка на вывод withdrawable (без изменения экономики начислений).
 */
import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import WalletService from '@/lib/services/finance/wallet.service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  try {
    const result = await WalletService.requestReferralWithdrawal(session.userId)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'REFERRAL_WITHDRAWAL_REQUEST_FAILED',
          blockers: result.blockers || [],
          data: result.data || null,
        },
        { status: result.status || 400 },
      )
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_WITHDRAWAL_REQUEST_FAILED' },
      { status: 500 },
    )
  }
}
