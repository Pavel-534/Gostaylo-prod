/**
 * Топ рефереров по earned referral_ledger за календарный месяц в TZ статистики (полуинтервал [start, end)).
 */

import { maskReferralLeaderboardName } from '@/lib/referral/leaderboard-privacy'
import { aggregateReferralLeaderboardFromDb } from '@/lib/referral/referral-leaderboard-db'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ monthStartUtcIso: string, monthEndExclusiveUtcIso: string, limit?: number }} opts
 * @returns {Promise<Array<{ rank: number, referrerId: string, amountThb: number, displayName: string }>>}
 */
export async function buildReferralLeaderboard(supabaseAdmin, opts) {
  const monthStartUtcIso = String(opts.monthStartUtcIso || '')
  const monthEndExclusiveUtcIso = String(opts.monthEndExclusiveUtcIso || '')
  const limit = Math.min(50, Math.max(1, Math.floor(Number(opts.limit) || 10)))

  if (!supabaseAdmin || !monthStartUtcIso || !monthEndExclusiveUtcIso) {
    return []
  }

  const sorted = await aggregateReferralLeaderboardFromDb(
    supabaseAdmin,
    monthStartUtcIso,
    monthEndExclusiveUtcIso,
    limit,
  )

  const ids = sorted.map((x) => x.referrerId)
  let nameById = {}
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids)
    for (const p of profiles || []) {
      nameById[String(p.id)] = {
        first_name: p.first_name,
        last_name: p.last_name,
      }
    }
  }

  return sorted.map((row, i) => {
    const meta = nameById[row.referrerId] || {}
    return {
      rank: i + 1,
      referrerId: row.referrerId,
      amountThb: row.amountThb,
      displayName: maskReferralLeaderboardName(row.referrerId, meta.first_name, meta.last_name),
    }
  })
}
