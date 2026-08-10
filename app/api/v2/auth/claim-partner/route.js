/**
 * POST /api/v2/auth/claim-partner
 * ADR-210 Slice 3 — public magic claim: password (+ RU phone OTP) → session.
 * No Google/Apple/Telegram OAuth on this path.
 */

import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { isRussia } from '@/lib/geo'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import {
  attachGostayloSessionCookie,
  profileRowToAuthUser,
  signJwtForProfile,
} from '@/lib/auth/app-session-issue'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { claimPartnerAccount } from '@/lib/services/concierge/concierge-claim.service.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  let jwtSecret
  try {
    jwtSecret = getJwtSecret()
  } catch (e) {
    console.error('[AUTH CLAIM-PARTNER]', e.message)
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
  }

  const result = await claimPartnerAccount({
    token: body?.token,
    password: body?.password,
    phone: body?.phone,
    phoneOtpCode: body?.phoneOtpCode,
    phoneChallengeId: body?.phoneChallengeId,
    isRussia: isRussia(request),
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        error_code: result.code,
        ...(result.profileId ? { profileId: result.profileId } : {}),
      },
      { status: result.status || 400 },
    )
  }

  const token = signJwtForProfile(result.profile, jwtSecret)
  const response = NextResponse.json({
    success: true,
    profileId: result.profileId,
    redirectTo: result.redirectTo,
    user: profileRowToAuthUser(result.profile),
  })
  attachGostayloSessionCookie(response, token)
  return response
}
