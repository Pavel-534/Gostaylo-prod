import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { buildReferralEngagementPayload } from '@/lib/services/marketing/local-leader-metrics.service.js'

export const dynamic = 'force-dynamic'

const ENGAGEMENT_CACHE_REVALIDATE_SEC = 60

const ENGAGEMENT_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
}

/**
 * @param {string} userId
 * @param {object | null | undefined} profileMetadata
 */
function loadEngagementPayloadCached(userId, profileMetadata) {
  return unstable_cache(
    async () => {
      if (!supabaseAdmin) return null
      return buildReferralEngagementPayload(supabaseAdmin, userId, profileMetadata)
    },
    ['referral-engagement-v1', userId],
    { revalidate: ENGAGEMENT_CACHE_REVALIDATE_SEC },
  )()
}

/** GET — Local Leader tier, quests, roadmap (read-only UX; no money side-effects). */
export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'DB_UNAVAILABLE' }, { status: 503 })
  }

  const userId = String(session.userId)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, metadata')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile?.id) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404)
  }

  const data = await loadEngagementPayloadCached(userId, profile.metadata)

  return NextResponse.json({ success: true, data }, { headers: ENGAGEMENT_CACHE_HEADERS })
}
