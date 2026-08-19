import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getSessionPayload } from '@/lib/services/session-service'
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes'
import { supabaseAdmin } from '@/lib/supabase'
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds'

export const dynamic = 'force-dynamic'

const CACHE_TTL_SEC = 600

function bucketLabelFromThb(amountThb) {
  const n = Number(amountThb)
  if (!Number.isFinite(n) || n < 0) return '< 1K'
  const rounded = Math.round(n / 5000) * 5000
  if (rounded < 1000) return '< 1K'
  if (rounded < 5000) return '1K-5K'
  if (rounded < 10000) return '5K-10K'
  if (rounded < 25000) return '10K-25K'
  if (rounded < 50000) return '25K-50K'
  if (rounded < 100000) return '50K-100K'
  return '100K+'
}

async function computeUserRank(userId) {
  if (!supabaseAdmin || !userId) return null

  const bounds = referralStatsCurrentMonthBoundsUtc('UTC')

  const { data: rows, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('referrer_id, amount_thb')
    .eq('status', 'earned')
    .gte('earned_at', bounds.monthStartUtcIso)
    .lt('earned_at', bounds.monthEndExclusiveUtcIso)

  if (error) {
    console.warn('[referral/me/rank]', error.message)
    return null
  }

  const sums = new Map()
  for (const row of rows || []) {
    const rid = String(row?.referrer_id || '').trim()
    if (!rid) continue
    sums.set(rid, (sums.get(rid) || 0) + (Number(row?.amount_thb) || 0))
  }

  const myEarned = sums.get(userId) || 0
  if (myEarned <= 0) return { rank: null, total_ambassadors: sums.size, my_earned_thb: 0 }

  const sorted = [...sums.entries()]
    .map(([id, thb]) => ({ id, thb }))
    .sort((a, b) => b.thb - a.thb)

  let rank = null
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].id === userId) {
      rank = i + 1
      break
    }
  }

  let nextRankBucketHint = null
  if (rank != null && rank > 1) {
    const above = sorted[rank - 2]
    if (above) {
      nextRankBucketHint = `До ${rank - 1}-го места: ~${bucketLabelFromThb(above.thb)}`
    }
  }

  return {
    rank,
    total_ambassadors: sums.size,
    my_earned_thb: Math.round(myEarned * 100) / 100,
    earned_bucket_thb: bucketLabelFromThb(myEarned),
    next_rank_bucket_hint: nextRankBucketHint,
  }
}

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401)
  }

  const userId = String(session.userId)
  const bounds = referralStatsCurrentMonthBoundsUtc('UTC')
  const cacheKey = `referral-user-rank-${userId}-${bounds.ymKey}`

  const cached = unstable_cache(
    () => computeUserRank(userId),
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
