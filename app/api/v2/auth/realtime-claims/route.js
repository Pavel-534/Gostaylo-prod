/**
 * GET /api/v2/auth/realtime-claims
 * Возвращает декодированные claims того же JWT, что уходит в Supabase Realtime (без секрета).
 * Для проверки: profile_id, app_role, sub.
 */

import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getSessionPayload } from '@/lib/services/session-service'
import { createSupabaseRealtimeAccessToken } from '@/lib/auth/supabase-realtime-jwt'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const access_token = createSupabaseRealtimeAccessToken({
    profileId: session.userId,
    authUserId: session.authUserId ?? null,
    email: session.email,
    role: session.role,
  })

  if (!access_token) {
    return NextResponse.json(
      { ok: false, error: 'Realtime token unavailable (SUPABASE_JWT_SECRET / profile)' },
      { status: 503 },
    )
  }

  const decoded = jwt.decode(access_token)
  if (!decoded || typeof decoded !== 'object') {
    return NextResponse.json({ ok: false, error: 'Decode failed' }, { status: 500 })
  }

  const appRole =
    decoded.app_role ??
    (decoded.user_metadata && typeof decoded.user_metadata === 'object'
      ? decoded.user_metadata.role
      : null) ??
    (decoded.app_metadata && typeof decoded.app_metadata === 'object'
      ? decoded.app_metadata.role
      : null)

  return NextResponse.json({
    ok: true,
    profile_id: decoded.profile_id ?? null,
    app_role: appRole != null ? String(appRole) : null,
    session_role: session.role ?? null,
    sub: decoded.sub ?? null,
    jwt_role: decoded.role ?? null,
  })
}
