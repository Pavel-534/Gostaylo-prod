/**
 * POST /api/v2/auth/link-conflict/resolve
 * Body: { token, action: 'login_existing' | 'send_merge_otp' | 'confirm_merge', challengeId?, code? }
 */
import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes'
import {
  getAuthLinkConflictByToken,
  mergeProfilesOnLinkConflict,
  resolveAuthLinkConflict,
} from '@/lib/auth/account-linking.service'
import { readAppSessionProfileId } from '@/lib/auth/read-app-session'
import {
  createPhoneOtpChallenge,
  verifyPhoneOtpChallenge,
} from '@/lib/auth/phone-otp.service'
import { attachSessionForProfile } from '@/lib/auth/alternate-auth-session.service'
import { supabaseAdmin } from '@/lib/supabase'

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

  const token = String(body?.token || '').trim()
  const action = String(body?.action || '').trim()
  if (!token) return authErrorJson('AUTH_LINK_CONFLICT_NOT_FOUND', 400)

  const got = await getAuthLinkConflictByToken(token)
  if (!got.ok) return authErrorJson(got.error_code, 404)

  if (action === 'login_existing') {
    await resolveAuthLinkConflict(token, 'resolved_login')
    return NextResponse.json({
      success: true,
      redirectTo: '/auth/login',
    })
  }

  if (action === 'send_merge_otp') {
    const session = readAppSessionProfileId(request)
    if (!session.ok) return session.error

    const challengerId = got.conflict.challenger_profile_id
    if (!challengerId || session.profileId !== String(challengerId)) {
      return authErrorJson('AUTH_LINK_MERGE_NOT_ELIGIBLE', 403)
    }

    if (!supabaseAdmin) return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500)

    const { data: challenger } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .eq('id', challengerId)
      .maybeSingle()

    if (!challenger?.phone) {
      return authErrorJson('AUTH_LINK_MERGE_NO_PHONE', 400)
    }

    const sent = await createPhoneOtpChallenge(challenger.phone)
    if (!sent.ok) return authErrorJson(sent.error_code, 400)

    return NextResponse.json({
      success: true,
      challengeId: sent.challengeId,
      mockCode: sent.mockCode,
    })
  }

  if (action === 'confirm_merge') {
    const session = readAppSessionProfileId(request)
    if (!session.ok) return session.error

    const challengerId = got.conflict.challenger_profile_id
    if (!challengerId || session.profileId !== String(challengerId)) {
      return authErrorJson('AUTH_LINK_MERGE_NOT_ELIGIBLE', 403)
    }

    const verified = await verifyPhoneOtpChallenge(body?.challengeId, body?.code)
    if (!verified.ok) return authErrorJson(verified.error_code, 400)

    const merged = await mergeProfilesOnLinkConflict(token, {
      challengerProfileId: challengerId,
      verifiedPhoneE164: verified.phoneE164,
    })
    if (!merged.ok) return authErrorJson(merged.error_code, 400)

    const response = NextResponse.json({ success: true, merged: true })
    const attached = attachSessionForProfile(response, merged.profile)
    return NextResponse.json(
      { success: true, merged: true, user: attached.user },
      { headers: response.headers },
    )
  }

  return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400)
}
