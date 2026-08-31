import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { buildReferralEngagementPayload } from '@/lib/services/marketing/local-leader-metrics.service.js'

export const dynamic = 'force-dynamic'

/** GET — Local Leader tier, quests, roadmap (read-only UX; no money side-effects). */
export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, metadata')
    .eq('id', session.userId)
    .maybeSingle()

  if (profileError || !profile?.id) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404)
  }

  const data = await buildReferralEngagementPayload(supabaseAdmin, profile.id, profile.metadata)

  return NextResponse.json({ success: true, data })
}
