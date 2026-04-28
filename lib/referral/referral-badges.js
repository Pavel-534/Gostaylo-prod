/**
 * Бейджи реферальной геймификации (Stage 74.2) — вычисление по данным профиля и статистики.
 * Идентификаторы стабильны для metadata/API: fast_start | network_builder | top10_monthly
 */

/** THB за месяц с сети (L2+) для бейджа «Network Builder». */
export const NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB = 300
/** Прямые приглашённые (friends) для Network Builder (альтернатива сумме). */
export const NETWORK_BUILDER_MIN_INVITES = 5
/** Дней от регистрации до первого earned — Fast Start. */
export const FAST_START_MAX_DAYS = 14

/**
 * @param {{
 *   monthlyNetworkEarnedThb: number,
 *   friendsInvited: number,
 *   leaderboardRankForMonth: number | null,
 *   fastStartEligible: boolean,
 * }} input
 * @returns {{ earned: string[], primary: string | null }}
 */
export function computeReferralBadgeResult(input) {
  const earned = []
  if (input.fastStartEligible) earned.push('fast_start')
  const net = Number(input.monthlyNetworkEarnedThb) || 0
  const friends = Number(input.friendsInvited) || 0
  if (net >= NETWORK_BUILDER_MIN_MONTHLY_NETWORK_THB || friends >= NETWORK_BUILDER_MIN_INVITES) {
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
