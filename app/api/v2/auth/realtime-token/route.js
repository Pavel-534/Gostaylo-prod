/**
 * GET /api/v2/auth/realtime-token
 * Выдаёт короткоживущий access_token для supabase.realtime.setAuth (RLS на messages/conversations).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { createSupabaseRealtimeAccessToken } from '@/lib/auth/supabase-realtime-jwt'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  const access_token = createSupabaseRealtimeAccessToken({
    profileId: session.userId,
    authUserId: session.authUserId ?? null,
    email: session.email,
    role: session.role,
  })

  if (!access_token) {
    return authErrorJson(AuthErrorCode.AUTH_REALTIME_TOKEN_UNAVAILABLE, 503)
  }

  return NextResponse.json({
    success: true,
    access_token,
    expires_in: 3600,
  })
}
