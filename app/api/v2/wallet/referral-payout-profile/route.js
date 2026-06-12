/**
 * GET/POST /api/v2/wallet/referral-payout-profile
 * Stage 131.5 / 131.7 — RU bank profile + fingerprint + KYC auto-verify.
 */
import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import {
  getReferralRuPayoutProfile,
  isRuBankProfileDataComplete,
  REFERRAL_RU_PAYOUT_METHOD_ID,
} from '@/lib/referral/referral-ru-payout-profile.js'
import { saveReferralRuPayoutProfile } from '@/lib/services/marketing/referral-payout-profile.service.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  try {
    const profile = await getReferralRuPayoutProfile(session.userId)
    const data = profile?.data && typeof profile.data === 'object' ? profile.data : {}
    return NextResponse.json({
      success: true,
      data: {
        profile: profile
          ? {
              id: profile.id,
              methodId: profile.method_id,
              isVerified: profile.is_verified === true,
              isDefault: profile.is_default === true,
              dataComplete: isRuBankProfileDataComplete(data),
              autoVerified: profile.metadata?.source === 'kyc_trusted',
              data: {
                recipientName: data.recipientName || data.fullName || '',
                inn: data.inn || '',
                bik: data.bik || '',
                accountNumber: data.accountNumber
                  ? `…${String(data.accountNumber).slice(-4)}`
                  : '',
              },
            }
          : null,
        methodId: REFERRAL_RU_PAYOUT_METHOD_ID,
        ready: profile ? isRuBankProfileDataComplete(data) : false,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_PAYOUT_PROFILE_READ_FAILED' },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }
  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const method = await PayoutRailsService.getPayoutMethodById(REFERRAL_RU_PAYOUT_METHOD_ID)
  if (!method || method.is_active === false) {
    return NextResponse.json(
      { success: false, error: 'RU_PAYOUT_METHOD_UNAVAILABLE' },
      { status: 503 },
    )
  }

  const formData = body.data && typeof body.data === 'object' ? body.data : {}
  const existing = await getReferralRuPayoutProfile(session.userId)

  try {
    const result = await saveReferralRuPayoutProfile({
      userId: session.userId,
      methodId: REFERRAL_RU_PAYOUT_METHOD_ID,
      formData,
      existingProfile: existing,
    })
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'SAVE_FAILED' },
        { status: result.status || 400 },
      )
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_PAYOUT_PROFILE_SAVE_FAILED' },
      { status: 500 },
    )
  }
}
