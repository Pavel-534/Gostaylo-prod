/**
 * SSOT: агрегация лидерборда из БД (RPC Stage 74.2) с fallback на постраничное чтение.
 */

import { isTestProfileId } from '@/lib/e2e/test-marketing-referral-markers.js'

const PAGE = 800

/** Over-fetch before excluding smoke/E2E referrers so top-N stays filled. */
function leaderboardFetchLimit(requestedLimit) {
  const lim = Math.min(100, Math.max(1, Math.floor(Number(requestedLimit) || 10)))
  return Math.min(100, Math.max(lim, lim * 5))
}

/**
 * @param {Array<{ referrerId: string, amountThb: number }>} rows
 * @param {number} limit
 * @param {{ excludeTestReferrers?: boolean }} [opts]
 */
function finalizeLeaderboardRows(rows, limit, opts = {}) {
  const lim = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)))
  const excludeTest = opts.excludeTestReferrers !== false
  const filtered = excludeTest
    ? (rows || []).filter((row) => !isTestProfileId(row.referrerId))
    : rows || []
  return filtered.slice(0, lim)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} monthStartUtcIso
 * @param {string} monthEndExclusiveUtcIso
 * @param {number} [limit]
 * @returns {Promise<Array<{ referrerId: string, amountThb: number }>>}
 */
export async function aggregateReferralLeaderboardFromDb(
  supabaseAdmin,
  monthStartUtcIso,
  monthEndExclusiveUtcIso,
  limit = 10,
  opts = {},
) {
  const lim = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)))
  const fetchLim = leaderboardFetchLimit(lim)
  const start = String(monthStartUtcIso || '')
  const end = String(monthEndExclusiveUtcIso || '')
  if (!supabaseAdmin || !start || !end) return []

  const { data, error } = await supabaseAdmin.rpc('referral_ledger_leaderboard_for_period', {
    p_period_start: start,
    p_period_end_exclusive: end,
    p_limit: fetchLim,
  })

  if (!error && Array.isArray(data) && data.length > 0) {
    const mapped = data
      .map((row) => ({
        referrerId: String(row.referrer_id ?? row.referrerId ?? '').trim(),
        amountThb: Math.round(Number(row.total_thb ?? row.totalThb) * 100) / 100,
      }))
      .filter((x) => x.referrerId)
    return finalizeLeaderboardRows(mapped, lim, opts)
  }

  if (error) {
    console.warn('[referral_ledger_leaderboard_for_period]', error.message)
  }

  return legacyAggregateReferralLeaderboard(supabaseAdmin, start, end, lim, opts)
}

/**
 * Lifetime leaderboard by earned referral_ledger.
 *
 * Mirrors `referral_ledger_leaderboard_for_period` behavior:
 * - primary path: RPC aggregation
 * - fallback: paginated scan over referral_ledger (by id) + JS reduce
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {number} [limit]
 * @returns {Promise<Array<{ referrerId: string, amountThb: number }>>}
 */
export async function aggregateReferralLeaderboardAlltimeFromDb(supabaseAdmin, limit = 10, opts = {}) {
  const lim = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)))
  const fetchLim = leaderboardFetchLimit(lim)
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin.rpc('referral_ledger_leaderboard_alltime', {
    p_limit: fetchLim,
  })

  if (!error && Array.isArray(data) && data.length > 0) {
    const mapped = data
      .map((row) => ({
        referrerId: String(row.referrer_id ?? row.referrerId ?? '').trim(),
        amountThb: Math.round(Number(row.total_thb ?? row.totalThb) * 100) / 100,
      }))
      .filter((x) => x.referrerId)
    return finalizeLeaderboardRows(mapped, lim, opts)
  }

  if (error) {
    console.warn('[referral_ledger_leaderboard_alltime]', error.message)
  }

  return legacyAggregateReferralLeaderboardAlltime(supabaseAdmin, lim, opts)
}

async function legacyAggregateReferralLeaderboard(
  supabaseAdmin,
  monthStartUtcIso,
  monthEndExclusiveUtcIso,
  limit,
  opts = {},
) {
  const sums = new Map()
  let offset = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('referrer_id, amount_thb')
      .eq('status', 'earned')
      .gte('earned_at', monthStartUtcIso)
      .lt('earned_at', monthEndExclusiveUtcIso)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.warn('[referral leaderboard legacy]', error.message)
      break
    }
    const rows = data || []
    for (const row of rows) {
      const id = String(row?.referrer_id || '').trim()
      if (!id) continue
      if (opts.excludeTestReferrers !== false && isTestProfileId(id)) continue
      const amt = Number(row?.amount_thb) || 0
      sums.set(id, (sums.get(id) || 0) + amt)
    }
    if (rows.length < PAGE) break
    offset += PAGE
  }

  return finalizeLeaderboardRows(
    [...sums.entries()]
      .map(([referrerId, sum]) => ({
        referrerId,
        amountThb: Math.round(sum * 100) / 100,
      }))
      .sort((a, b) => b.amountThb - a.amountThb),
    limit,
    opts,
  )
}

async function legacyAggregateReferralLeaderboardAlltime(supabaseAdmin, limit, opts = {}) {
  const sums = new Map()
  let offset = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('referrer_id, amount_thb')
      .eq('status', 'earned')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.warn('[referral leaderboard alltime legacy]', error.message)
      break
    }

    const rows = data || []
    for (const row of rows) {
      const id = String(row?.referrer_id || '').trim()
      if (!id) continue
      if (opts.excludeTestReferrers !== false && isTestProfileId(id)) continue
      const amt = Number(row?.amount_thb) || 0
      sums.set(id, (sums.get(id) || 0) + amt)
    }

    if (rows.length < PAGE) break
    offset += PAGE
  }

  return finalizeLeaderboardRows(
    [...sums.entries()]
      .map(([referrerId, sum]) => ({
        referrerId,
        amountThb: Math.round(sum * 100) / 100,
      }))
      .sort((a, b) => b.amountThb - a.amountThb),
    limit,
    opts,
  )
}
