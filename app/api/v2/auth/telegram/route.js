/**
 * POST /api/v2/auth/telegram — Telegram Login Widget callback (Stage 189.0).
 */
import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { verifyTelegramLoginAuth } from '@/lib/auth/telegram-login-verify'
import {
  attachSessionForProfile,
  resolveProfileByTelegramLogin,
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const verified = verifyTelegramLoginAuth(body || {}, botToken)
  if (!verified.ok) {
    return authErrorJson(AuthErrorCode.AUTH_TELEGRAM_VERIFY_FAILED, 401)
  }

  const profileResult = await resolveProfileByTelegramLogin(verified.data, {
    acceptedLegalTerms: body?.acceptedLegalTerms === true,
  })
  if (!profileResult.ok) {
    return authErrorJson(
      profileResult.error_code,
      profileResult.error_code === AuthErrorCode.AUTH_ACCOUNT_SUSPENDED ? 403 : 400,
    )
  }

  const response = NextResponse.json({ success: true, user: null })
  const session = attachSessionForProfile(response, profileResult.profile)
  return NextResponse.json(
    { success: true, user: session.user, created: profileResult.created },
    { headers: response.headers },
  )
}
