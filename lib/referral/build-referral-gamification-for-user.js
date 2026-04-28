/**
 * Единый расчёт earned-бейджей и метрик геймификации (SSOT для `/api/v2/referral/me` и админки).
 */

import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'
import { aggregateReferralLeaderboardFromDb } from '@/lib/referral/referral-leaderboard-db'
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds'
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone'
import { yearMonthKeyInTimeZone, currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month'
import {
  computeReferralBadgeResult,
  FAST_START_MAX_DAYS,
} from '@/lib/referral/referral-badges'

/**
 * @param {*} supabaseAdmin
 * @param {object} profile — строка profiles с id, created_at, …
 * @param {{ monthlyNetworkEarnedThb?: number }} [opts] — если уже посчитано в роуте, передайте чтобы не дублировать чтение ledger
 */
export async function buildReferralGamificationForUser(supabaseAdmin, profile, opts = {}) {
  const empty = {
    badgesEarned: [],
    primaryBadge: null,
    leaderboardRankMonthly: null,
    fastStartEligible: false,
    badgeSnapshot: null,
  }
  if (!supabaseAdmin || !profile?.id) return empty

  const statsTz = resolveReferralStatsTimeZone(profile)
  const currentYm = currentYearMonthKeyInTimeZone(statsTz)
  let monthlyNetworkEarnedThb =
    opts.monthlyNetworkEarnedThb != null ? Number(opts.monthlyNetworkEarnedThb) : NaN

  if (!Number.isFinite(monthlyNetworkEarnedThb)) {
    const { data: earnedRows } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, earned_at, updated_at, ledger_depth')
      .eq('referrer_id', profile.id)
      .eq('status', 'earned')

    monthlyNetworkEarnedThb = 0
    for (const row of earnedRows || []) {
      const iso = row?.earned_at || row?.updated_at
      if (!iso) continue
      const amt = Number(row?.amount_thb) || 0
      const depth = Math.min(32, Math.max(1, Math.floor(Number(row?.ledger_depth) || 1)))
      const ymKey = yearMonthKeyInTimeZone(iso, statsTz)
      if (ymKey === currentYm && depth >= 2) monthlyNetworkEarnedThb += amt
    }
    monthlyNetworkEarnedThb = Math.round(monthlyNetworkEarnedThb * 100) / 100
  }

  const monthBounds = referralStatsCurrentMonthBoundsUtc(statsTz)
  const directPartnersInvited = Number((await ReferralPnlService.countDirectPartnersInvited(profile.id)) || 0)

  const [topRows, firstEarnedRes] = await Promise.all([
    aggregateReferralLeaderboardFromDb(
      supabaseAdmin,
      monthBounds.monthStartUtcIso,
      monthBounds.monthEndExclusiveUtcIso,
      10,
    ),
    supabaseAdmin
      .from('referral_ledger')
      .select('earned_at')
      .eq('referrer_id', profile.id)
      .eq('status', 'earned')
      .order('earned_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const idx = topRows.findIndex((r) => r.referrerId === profile.id)
  const leaderboardRankForMonth = idx >= 0 ? idx + 1 : null

  let fastStartEligible = false
  const createdAt = profile?.created_at
  const firstEarnIso = firstEarnedRes?.data?.earned_at
  if (createdAt && firstEarnIso) {
    const c = Date.parse(String(createdAt))
    const e = Date.parse(String(firstEarnIso))
    if (Number.isFinite(c) && Number.isFinite(e)) {
      const days = (e - c) / 86400000
      fastStartEligible = days >= 0 && days <= FAST_START_MAX_DAYS
    }
  }

  const badgeResult = computeReferralBadgeResult({
    monthlyNetworkEarnedThb,
    directPartnersInvited,
    leaderboardRankForMonth,
    fastStartEligible,
  })

  return {
    badgesEarned: badgeResult.earned,
    primaryBadge: badgeResult.primary,
    leaderboardRankMonthly: leaderboardRankForMonth,
    fastStartEligible,
    badgeSnapshot: {
      badges_earned: badgeResult.earned,
      primary_badge: badgeResult.primary,
      leaderboard_rank_monthly: leaderboardRankForMonth,
    },
    directPartnersInvited,
    monthlyNetworkEarnedThb,
  }
}
