/**
 * Бейджи реферальной геймификации (Stage 74.2) — вычисление по данным профиля и статистики.
 * Идентификаторы стабильны для metadata/API: fast_start | network_builder | top10_monthly
 */

/** THB за месяц с сети (L2+) для бейджа «Network Builder». */
export const NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB = 300
/** Активированные партнёры (прямые) для Network Builder — в SSOT с tier (`directPartnersInvited`). */
export const NETWORK_BUILDER_MIN_DIRECT_PARTNERS = 5
/** @deprecated используйте NETWORK_BUILDER_MIN_DIRECT_PARTNERS */
export const NETWORK_BUILDER_MIN_INVITES = NETWORK_BUILDER_MIN_DIRECT_PARTNERS
/** Дней от регистрации до первого earned — Fast Start. */
export const FAST_START_MAX_DAYS = 14

/** Порядок отображения медалей на `/profile/referral` (Stage 75.2). */
export const BADGE_PROGRESSION_ORDER = ['fast_start', 'network_builder', 'top10_monthly']

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
 * }} input
 * @returns {{ earned: string[], primary: string | null }}
 */
export function computeReferralBadgeResult(input) {
  const earned = []
  if (input.fastStartEligible) earned.push('fast_start')
  const net = Number(input.monthlyNetworkEarnedThb) || 0
  const partners = Number(input.directPartnersInvited) || 0
  if (net >= NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB || partners >= NETWORK_BUILDER_MIN_DIRECT_PARTNERS) {
    earned.push('network_builder')
  }
  const rank = input.leaderboardRankForMonth
  if (rank != null && rank >= 1 && rank <= 10) earned.push('top10_monthly')

  /** Приоритет отображения на Stories: топ месяца > сеть > быстрый старт */
  let primary = null
  if (earned.includes('top10_monthly')) primary = 'top10_monthly'
  else if (earned.includes('network_builder')) primary = 'network_builder'
  else if (earned.includes('fast_start')) primary = 'fast_start'

  return { earned: [...new Set(earned)], primary }
}
