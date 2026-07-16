/**
 * POST /api/v2/auth/phone/send — send SMS OTP (Stage 189.0 → 189.2 dual-route dispatch).
 */
import { rateLimitCheck } from '@/lib/rate-limit'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { createPhoneOtpChallenge, normalizePhoneE164 } from '@/lib/auth/phone-otp.service'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth')
  if (rl) return Response.json(rl.body, { status: rl.status, headers: rl.headers })

  let body
  try {
    body = await request.json()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
  }

  const phone = normalizePhoneE164(body?.phone)
  if (!phone) return authErrorJson(AuthErrorCode.AUTH_PHONE_INVALID, 400)

  const rlIp = await rateLimitCheck(request, 'sms_otp_ip')
  if (rlIp) return Response.json(rlIp.body, { status: rlIp.status, headers: rlIp.headers })

  const rlPhone = await rateLimitCheck(request, 'sms_otp', phone)
  if (rlPhone) {
    return Response.json(rlPhone.body, { status: rlPhone.status, headers: rlPhone.headers })
  }

  const result = await createPhoneOtpChallenge(phone)
  if (!result.ok) return authErrorJson(result.error_code, 400)

  return Response.json({
    success: true,
    challengeId: result.challengeId,
    ...(result.mockCode ? { mockCode: result.mockCode } : {}),
  })
}
