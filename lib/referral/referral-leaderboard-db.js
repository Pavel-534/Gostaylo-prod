/**
 * SSOT: агрегация лидерборда из БД (RPC Stage 74.2) с fallback на постраничное чтение.
 */

const PAGE = 800

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
) {
  const lim = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)))
  const start = String(monthStartUtcIso || '')
  const end = String(monthEndExclusiveUtcIso || '')
  if (!supabaseAdmin || !start || !end) return []

  const { data, error } = await supabaseAdmin.rpc('referral_ledger_leaderboard_for_period', {
    p_period_start: start,
    p_period_end_exclusive: end,
    p_limit: lim,
  })

  if (!error && Array.isArray(data) && data.length > 0) {
    return data
      .map((row) => ({
        referrerId: String(row.referrer_id ?? row.referrerId ?? '').trim(),
        amountThb: Math.round(Number(row.total_thb ?? row.totalThb) * 100) / 100,
      }))
      .filter((x) => x.referrerId)
  }

  if (error) {
    console.warn('[referral_ledger_leaderboard_for_period]', error.message)
  }

  return legacyAggregateReferralLeaderboard(supabaseAdmin, start, end, lim)
}

async function legacyAggregateReferralLeaderboard(supabaseAdmin, monthStartUtcIso, monthEndExclusiveUtcIso, limit) {
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
      const amt = Number(row?.amount_thb) || 0
      sums.set(id, (sums.get(id) || 0) + amt)
    }
    if (rows.length < PAGE) break
    offset += PAGE
  }

  return [...sums.entries()]
    .map(([referrerId, sum]) => ({
      referrerId,
      amountThb: Math.round(sum * 100) / 100,
    }))
    .sort((a, b) => b.amountThb - a.amountThb)
    .slice(0, limit)
}
