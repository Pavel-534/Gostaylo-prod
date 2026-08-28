/**
 * POST /api/v2/auth/resend-verification
 * Stage 202.13 — restore missing route referenced by lib/auth.js resendVerificationEmail.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitCheck } from '@/lib/rate-limit'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import {
  generateEmailVerificationToken,
  sendEmailVerificationMessage,
} from '@/lib/auth/email-verification-send.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500)
  }

  let jwtSecret
  try {
    jwtSecret = getJwtSecret()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
  }

  const email = String(body?.email || '')
    .toLowerCase()
    .trim()
  if (!email) {
    return authErrorJson(AuthErrorCode.AUTH_EMAIL_REQUIRED, 400)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: user, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, is_verified, email_verified_at')
    .eq('email', email)
    .maybeSingle()

  // Anti-enumeration: same shape whether user exists or already verified.
  const okPayload = {
    success: true,
    message: 'If an account needs verification, a new email was sent.',
  }

  if (error || !user) {
    return NextResponse.json(okPayload)
  }

  if (user.is_verified === true || user.email_verified_at) {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      message: 'Email already verified.',
    })
  }

  const token = generateEmailVerificationToken(user.id, user.email, jwtSecret)
  const sent = await sendEmailVerificationMessage(user, token)
  if (!sent.success) {
    return authErrorJson(sent.error_code || AuthErrorCode.AUTH_EMAIL_SEND_FAILED, 503)
  }

  return NextResponse.json({ ...okPayload, mock: Boolean(sent.mock) })
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/v2/auth/resend-verification',
  })
}
