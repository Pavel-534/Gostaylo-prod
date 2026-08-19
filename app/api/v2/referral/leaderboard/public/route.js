import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { rateLimitCheck } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds'
import {
  aggregateReferralLeaderboardAlltimeFromDb,
  aggregateReferralLeaderboardFromDb,
} from '@/lib/referral/referral-leaderboard-db'
import { maskPublicReferralName } from '@/lib/referral/public-leaderboard-privacy'
import { buildReferralGamificationForUser } from '@/lib/referral/build-referral-gamification-for-user'

export const dynamic = 'force-dynamic'

const CACHE_REVALIDATE_SEC = 300
const CACHE_KEY_PARTS = ['referral-public-leaderboard-v1']

function bucketLabelFromThb(amountThb) {
  const n = Number(amountThb)
  if (!Number.isFinite(n) || n < 0) return '< 1K'

  // Round to nearest 5K as requested in TZ.
  const rounded = Math.round(n / 5000) * 5000

  if (rounded < 1000) return '< 1K'
  if (rounded < 5000) return '1K-5K'
  if (rounded < 10000) return '5K-10K'
  if (rounded < 25000) return '10K-25K'
  if (rounded < 50000) return '25K-50K'
  if (rounded < 100000) return '50K-100K'
  return '100K+'
}

function extractCityAndCountryFromProfile(profile) {
  const md = profile?.metadata
  const out = {}

  const cityLabel = typeof md?.city_label === 'string' ? md.city_label.trim() : ''
  const cityFallback = typeof md?.city === 'string' ? md.city.trim() : ''
  const countryCode = typeof md?.country_code === 'string' ? md.country_code.trim() : ''
  const countryFallback = typeof md?.geo_pin_country === 'string' ? md.geo_pin_country.trim() : ''

  if (cityLabel) out.city_label = cityLabel
  else if (cityFallback) out.city_label = cityFallback

  if (countryCode) out.country_code = countryCode
  else if (countryFallback) out.country_code = countryFallback

  return out
}

function computeNextRankHint(entries) {
  // Bucket-level hint for "how to reach rank 6".
  // entries are already sorted by earned desc (rpc order).
  if (!Array.isArray(entries) || entries.length < 6) return null
  const rank6 = entries[5]
  if (!rank6?.earned_bucket_thb) return null
  return `До 6 места: ~${rank6.earned_bucket_thb}`
}

const loadPublicLeaderboardBaseCached = unstable_cache(
  async (period, requestedLimit) => {
    const periodSafe = period === 'alltime' ? 'alltime' : 'month'
    const limitSafe = Math.min(25, Math.max(1, Math.floor(Number(requestedLimit) || 10)))
    const fetchLimit = limitSafe + 1 // allow self-exclusion without empty ranks

    if (!supabaseAdmin) return { entriesInternal: [], next_rank_hint: null }

    const totals =
      periodSafe === 'month'
        ? await (async () => {
            const bounds = referralStatsCurrentMonthBoundsUtc('UTC')
            return aggregateReferralLeaderboardFromDb(
              supabaseAdmin,
              bounds.monthStartUtcIso,
              bounds.monthEndExclusiveUtcIso,
              fetchLimit,
            )
          })()
        : await aggregateReferralLeaderboardAlltimeFromDb(supabaseAdmin, fetchLimit)

    const ids = (totals || []).map((x) => x.referrerId).filter(Boolean)
    if (ids.length === 0) return { entriesInternal: [], next_rank_hint: null }

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,referral_tier_name,iana_timezone,created_at,metadata')
      .in('id', ids)

    const byId = new Map((profiles || []).map((p) => [String(p?.id || ''), p]))

    const entriesInternal = []
    for (const row of totals || []) {
      const referrerId = String(row.referrerId || '')
      const profile = byId.get(referrerId)
      if (!referrerId || !profile) continue

      const earned_bucket_thb = bucketLabelFromThb(row.amountThb)
      const tier_name = typeof profile?.referral_tier_name === 'string' ? profile.referral_tier_name.trim() : ''
      const cityCountry = extractCityAndCountryFromProfile(profile)

      // Badge_count + direct_partners_count: use existing SSOT (same math as /referral/me).
      const gamification = await buildReferralGamificationForUser(supabaseAdmin, profile)
      const badge_count = Array.isArray(gamification?.badgesEarned) ? gamification.badgesEarned.length : 0
      const direct_partners_count = Number(gamification?.directPartnersInvited || 0)

      const internal = {
        referrerId,
        rank: 0, // filled after optional self-exclusion
        masked_name: maskPublicReferralName(profile),
        tier_name: tier_name || null,
        earned_bucket_thb,
        direct_partners_count,
        badge_count,
        ...cityCountry,
      }

      entriesInternal.push(internal)
    }

    const next_rank_hint = computeNextRankHint(entriesInternal)
    return { entriesInternal, next_rank_hint, limitSafe }
  },
  CACHE_KEY_PARTS,
  { revalidate: CACHE_REVALIDATE_SEC },
)

export async function GET(request) {
  const rl = await rateLimitCheck(request, 'referral_leaderboard_public')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  const { searchParams } = new URL(request.url)
  const period = String(searchParams.get('period') || 'month').toLowerCase() === 'alltime' ? 'alltime' : 'month'
  const limit = Math.min(25, Math.max(1, Math.floor(Number(searchParams.get('limit')) || 10)))

  // Optional session: if present, exclude self from public list.
  const session = await getSessionPayload()
  const excludeUserId = session?.userId ? String(session.userId) : null

  const cached = await loadPublicLeaderboardBaseCached(period, limit)

  const internal = Array.isArray(cached?.entriesInternal) ? cached.entriesInternal : []

  const filtered = excludeUserId
    ? internal.filter((x) => String(x.referrerId) !== excludeUserId)
    : internal

  const sliced = filtered.slice(0, limit)

  const entries = sliced.map((x, idx) => {
    const { referrerId: _ignore, rank: _r, ...rest } = x
    return {
      rank: idx + 1,
      ...rest,
    }
  })

  return NextResponse.json({
    period,
    as_of: new Date().toISOString(),
    entries,
    next_rank_hint: cached?.next_rank_hint ?? null,
  })
}

