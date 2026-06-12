/**
 * PATCH /api/v2/referral/vanity — set or clear custom vanity slug for authenticated ambassador.
 * Body: { vanityCode: string | null }
 */
import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import {
  setCustomVanityCodeForUser,
  clearCustomVanityCodeForUser,
} from '@/lib/services/marketing/referral-vanity.service.js'
import { buildVanityGoUrl } from '@/lib/referral/public-landing-url'

export const dynamic = 'force-dynamic'

export async function PATCH(request) {
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

  const raw = body?.vanityCode ?? body?.custom_vanity_code
  if (raw == null || String(raw).trim() === '') {
    const cleared = await clearCustomVanityCodeForUser(session.userId)
    if (!cleared.success) {
      return NextResponse.json(
        { success: false, error: cleared.error },
        { status: cleared.status || 400 },
      )
    }
    return NextResponse.json({ success: true, data: { vanityCode: null, vanityUrl: null } })
  }

  const result = await setCustomVanityCodeForUser(session.userId, raw)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 400 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      vanityCode: result.data.vanityCode,
      vanityUrl: buildVanityGoUrl(result.data.vanityCode),
      referralCode: result.data.referralCode,
    },
  })
}
