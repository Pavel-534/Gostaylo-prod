/**
 * GET /api/v2/auth/realtime-token
 * Выдаёт короткоживущий access_token для supabase.realtime.setAuth (RLS на messages/conversations).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { createSupabaseRealtimeAccessToken } from '@/lib/auth/supabase-realtime-jwt'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const access_token = createSupabaseRealtimeAccessToken({
    profileId: session.userId,
    authUserId: session.authUserId ?? null,
    email: session.email,
  })

  if (!access_token) {
    return NextResponse.json(
      {
        success: false,
        error: 'Realtime token unavailable (set SUPABASE_JWT_SECRET to match Supabase project JWT Secret)',
      },
      { status: 503 },
    )
  }

  return NextResponse.json({
    success: true,
    access_token,
    expires_in: 3600,
  })
}
