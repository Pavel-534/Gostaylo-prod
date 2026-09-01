import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getSessionPayload } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { supabaseAdmin } from '@/lib/supabase'
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds'
import { computeUserMonthlyRank } from '@/lib/referral/compute-user-monthly-rank.js'

export const dynamic = 'force-dynamic'

const CACHE_TTL_SEC = 600

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  const userId = String(session.userId)
  const bounds = referralStatsCurrentMonthBoundsUtc('UTC')
  const cacheKey = `referral-user-rank-${userId}-${bounds.ymKey}`

  const cached = unstable_cache(
    () => computeUserMonthlyRank(supabaseAdmin, userId, 'UTC'),
    [cacheKey],
    { revalidate: CACHE_TTL_SEC },
  )

  const result = await cached()

  return NextResponse.json({
    rank: result?.rank ?? null,
    total_ambassadors: result?.total_ambassadors ?? 0,
    as_of: new Date().toISOString(),
    earned_bucket_thb: result?.earned_bucket_thb ?? null,
    next_rank_bucket_hint: result?.next_rank_bucket_hint ?? null,
  })
}
