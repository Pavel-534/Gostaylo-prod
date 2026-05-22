/**
 * Бейджи реферальной геймификации (Stage 74.2) — вычисление по данным профиля и статистики.
 * Идентификаторы стабильны для metadata/API: fast_start | network_builder | top10_monthly
 */

/** THB за месяц с сети (L2+) для бейджа «Network Builder». */
export const NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB = 300
/** Активированные партнёры (прямые) для Network Builder — SSOT с Stories (`STORIES_TEAM_MIN_DIRECT_PARTNERS`). */
export const NETWORK_BUILDER_MIN_DIRECT_PARTNERS = 3
/** @deprecated используйте NETWORK_BUILDER_MIN_DIRECT_PARTNERS */
export const NETWORK_BUILDER_MIN_INVITES = NETWORK_BUILDER_MIN_DIRECT_PARTNERS
/** Дней от регистрации до первого earned — Fast Start. */
export const FAST_START_MAX_DAYS = 14

/** Stage 114.3 — публичные ачивки (без смены экономики начислений). */
export const FIRST_REFERRAL_MIN_INVITES = 1
export const TEAM_10_MIN_INVITES = 10
export const EARNED_100K_MIN_THB = 100_000

/** Порядок отображения медалей на `/profile/referral` (Stage 75.2 + 114.3). */
export const BADGE_PROGRESSION_ORDER = [
  'first_referral',
  'fast_start',
  'network_builder',
  'team_10',
  'top10_monthly',
  'earned_100k',
]

/** Разблокировка второго шаблона Stories «доход команды»: мин. активированных партнёров (как tier). */
export const STORIES_TEAM_MIN_DIRECT_PARTNERS = 3
/** @deprecated используйте STORIES_TEAM_MIN_DIRECT_PARTNERS */
export const STORIES_TEAM_DIRECT_REFERRALS_REQUIRED = STORIES_TEAM_MIN_DIRECT_PARTNERS

/**
 * @param {{
 *   monthlyNetworkEarnedThb: number,
 *   directPartnersInvited: number,
 *   leaderboardRankForMonth: number | null,
 *   fastStartEligible: boolean,
 *   friendsInvited?: number,
 *   totalLifetimeEarnedThb?: number,
 * }} input
 * @returns {{ earned: string[], primary: string | null }}
 */
export function computeReferralBadgeResult(input) {
  const earned = []
  const friends = Number(input.friendsInvited) || 0
  const lifetime = Number(input.totalLifetimeEarnedThb) || 0
  if (friends >= FIRST_REFERRAL_MIN_INVITES || lifetime > 0) earned.push('first_referral')
  if (input.fastStartEligible) earned.push('fast_start')
  const net = Number(input.monthlyNetworkEarnedThb) || 0
  const partners = Number(input.directPartnersInvited) || 0
  if (net >= NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB || partners >= NETWORK_BUILDER_MIN_DIRECT_PARTNERS) {
    earned.push('network_builder')
  }
  if (friends >= TEAM_10_MIN_INVITES) earned.push('team_10')
  const rank = input.leaderboardRankForMonth
  if (rank != null && rank >= 1 && rank <= 10) earned.push('top10_monthly')
  if (lifetime >= EARNED_100K_MIN_THB) earned.push('earned_100k')

  /** Приоритет отображения: топ > 100k > сеть > команда 10 > первый > fast start */
  let primary = null
  if (earned.includes('top10_monthly')) primary = 'top10_monthly'
  else if (earned.includes('earned_100k')) primary = 'earned_100k'
  else if (earned.includes('network_builder')) primary = 'network_builder'
  else if (earned.includes('team_10')) primary = 'team_10'
  else if (earned.includes('first_referral')) primary = 'first_referral'
  else if (earned.includes('fast_start')) primary = 'fast_start'

  return { earned: [...new Set(earned)], primary }
}
