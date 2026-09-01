/**
 * Stage 202.30 — /api/v2/referral/me/rank compute (RPC + legacy full-scan fallback).
 * Filters mirror `referral_ledger_leaderboard_for_period` (Stage 74.2).
 */

import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds.js'

function isMissingRpcError(error, rpcName) {
  const msg = String(error?.message || error || '')
  return (
    msg.includes(rpcName) ||
    msg.includes('Could not find the function') ||
    msg.includes('schema cache')
  )
}

let warnedUserRankRpcMissing = false

/** @param {number} amountThb */
export function bucketLabelFromThb(amountThb) {
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

/**
 * @param {number | null} rank
 * @param {number | null | undefined} aboveEarnedThb
 */
export function buildNextRankBucketHint(rank, aboveEarnedThb) {
  if (rank == null || rank <= 1) return null
  const above = Number(aboveEarnedThb)
  if (!Number.isFinite(above)) return null
  return `До ${rank - 1}-го места: ~${bucketLabelFromThb(above)}`
}

/**
 * Legacy Node scan — preserved for RPC-missing fallback (Stage 131.A6.1 semantics).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ monthStartUtcIso: string, monthEndExclusiveUtcIso: string }} bounds
 */
export async function computeUserMonthlyRankLegacy(supabaseAdmin, userId, bounds) {
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
  if (myEarned <= 0) {
    return { rank: null, total_ambassadors: sums.size, my_earned_thb: 0 }
  }

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
      nextRankBucketHint = buildNextRankBucketHint(rank, above.thb)
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

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {string} [statsTz]
 */
export async function computeUserMonthlyRank(supabaseAdmin, userId, statsTz = 'UTC') {
  if (!supabaseAdmin || !userId) return null

  const bounds = referralStatsCurrentMonthBoundsUtc(statsTz)

  const { data, error } = await supabaseAdmin.rpc('referral_user_rank_for_period', {
    p_user_id: String(userId),
    p_period_start: bounds.monthStartUtcIso,
    p_period_end_exclusive: bounds.monthEndExclusiveUtcIso,
  })

  if (!error) {
    const row = Array.isArray(data) ? data[0] : null
    if (!row) {
      return {
        rank: null,
        total_ambassadors: 0,
        my_earned_thb: 0,
      }
    }

    const myEarned = Number(row.my_earned_thb) || 0
    const rank = myEarned > 0 ? Number(row.rank) || null : null
    const totalAmbassadors = Number(row.total_ambassadors) || 0
    const aboveEarned =
      row.above_earned_thb != null && Number.isFinite(Number(row.above_earned_thb))
        ? Number(row.above_earned_thb)
        : null

    return {
      rank,
      total_ambassadors: totalAmbassadors,
      my_earned_thb: Math.round(myEarned * 100) / 100,
      earned_bucket_thb: myEarned > 0 ? bucketLabelFromThb(myEarned) : undefined,
      next_rank_bucket_hint: buildNextRankBucketHint(rank, aboveEarned),
    }
  }

  if (isMissingRpcError(error, 'referral_user_rank_for_period')) {
    if (!warnedUserRankRpcMissing) {
      warnedUserRankRpcMissing = true
      console.warn('[referral/me/rank] referral_user_rank_for_period RPC missing — legacy Node scan')
    }
    return computeUserMonthlyRankLegacy(supabaseAdmin, userId, bounds)
  }

  console.warn('[referral/me/rank]', error.message)
  return computeUserMonthlyRankLegacy(supabaseAdmin, userId, bounds)
}
