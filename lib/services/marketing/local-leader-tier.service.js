import { LEADER_TIERS } from '@/lib/config/leader-tier-thresholds.js'

/**
 * @typedef {import('@/lib/config/leader-tier-thresholds.js').LEADER_TIERS[number]} LeaderTierRow
 */

/**
 * @param {{
 *   qualifiedHostsCount?: number,
 *   completedBookingsAsHost?: number,
 *   earnedThb?: number,
 *   regionAssigned?: boolean,
 * }} metrics
 * @returns {{ current: LeaderTierRow, next: LeaderTierRow | null }}
 */
export function computeLocalLeaderTier({
  qualifiedHostsCount = 0,
  completedBookingsAsHost = 0,
  earnedThb = 0,
  regionAssigned = false,
} = {}) {
  const q = Math.max(0, Number(qualifiedHostsCount) || 0)
  const hostBookings = Math.max(0, Number(completedBookingsAsHost) || 0)
  const earned = Math.max(0, Number(earnedThb) || 0)
  const region = regionAssigned === true

  for (let i = LEADER_TIERS.length - 1; i >= 0; i--) {
    const tier = LEADER_TIERS[i]
    if (tier.requiresRegionAssignment && !region) continue
    if (q < tier.minQualifiedHosts) continue
    if (hostBookings < tier.minCompletedBookingsAsHost) continue
    if (earned < tier.minEarnedThb) continue
    return {
      current: tier,
      next: i < LEADER_TIERS.length - 1 ? LEADER_TIERS[i + 1] : null,
    }
  }

  return { current: LEADER_TIERS[0], next: LEADER_TIERS[1] ?? null }
}

/**
 * Progress toward next tier (bottleneck ratio across required metrics).
 *
 * @param {LeaderTierRow | null | undefined} nextTier
 * @param {{
 *   qualifiedHostsCount?: number,
 *   completedBookingsAsHost?: number,
 *   earnedThb?: number,
 *   regionAssigned?: boolean,
 * }} metrics
 */
export function progressToNextTier(nextTier, metrics = {}) {
  if (!nextTier) {
    return { percent: 100, missing: {} }
  }

  const q = Math.max(0, Number(metrics.qualifiedHostsCount) || 0)
  const hostBookings = Math.max(0, Number(metrics.completedBookingsAsHost) || 0)
  const earned = Math.max(0, Number(metrics.earnedThb) || 0)
  const region = metrics.regionAssigned === true

  const missing = {
    qualifiedHosts: Math.max(0, nextTier.minQualifiedHosts - q),
    completedBookingsAsHost: Math.max(0, nextTier.minCompletedBookingsAsHost - hostBookings),
    earnedThb: Math.max(0, nextTier.minEarnedThb - earned),
    regionAssignment: nextTier.requiresRegionAssignment && !region,
  }

  const ratios = []
  if (nextTier.minQualifiedHosts > 0) ratios.push(q / nextTier.minQualifiedHosts)
  if (nextTier.minCompletedBookingsAsHost > 0) ratios.push(hostBookings / nextTier.minCompletedBookingsAsHost)
  if (nextTier.minEarnedThb > 0) ratios.push(earned / nextTier.minEarnedThb)
  if (nextTier.requiresRegionAssignment) ratios.push(region ? 1 : 0)

  const minRatio = ratios.length > 0 ? Math.min(...ratios) : 1
  return {
    percent: Math.min(100, Math.round(minRatio * 100)),
    missing,
  }
}
