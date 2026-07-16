/**
 * POST /api/v2/auth/phone/verify — verify SMS OTP and issue session (Stage 189.0).
 */
import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { verifyPhoneOtpChallenge } from '@/lib/auth/phone-otp.service'
import {
  attachSessionForProfile,
  resolveProfileByVerifiedPhone,
} from '@/lib/auth/alternate-auth-session.service'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth')
  if (rl) return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })

  let body
  try {
    body = await request.json()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
  }

  const verified = await verifyPhoneOtpChallenge(body?.challengeId, body?.code)
  if (!verified.ok) return authErrorJson(verified.error_code, 400)

  const profileResult = await resolveProfileByVerifiedPhone(verified.phoneE164, {
    acceptedLegalTerms: body?.acceptedLegalTerms === true,
  })
  if (!profileResult.ok) {
    return authErrorJson(
      profileResult.error_code,
      profileResult.error_code === AuthErrorCode.AUTH_ACCOUNT_SUSPENDED ? 403 : 400,
    )
  }

  const response = NextResponse.json({
    success: true,
    user: null,
    created: profileResult.created,
  })
  const session = attachSessionForProfile(response, profileResult.profile)
  return NextResponse.json({
    success: true,
    user: session.user,
    created: profileResult.created,
  }, {
    headers: response.headers,
  })
}
