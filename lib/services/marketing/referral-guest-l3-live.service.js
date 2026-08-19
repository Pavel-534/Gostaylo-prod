/**
 * Stage 131.A1.2 — Live L3 monthly cap counter (ledger SSOT).
 * Mirror of referral-guest-l2-live.service.js — pending/earned/earned_held, not earned-only.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { round2 } from '@/lib/services/marketing/referral-guest-pool-payout-split.js'

function monthStartUtcIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

/**
 * Sum Live L3 upline bonuses for UTC month from referral_ledger.
 * SSOT: metadata.split_role = 'l3_upline' OR metadata.l3_live = true.
 */
export async function getMonthlyGuestL3LiveSpentThb(l3ReferrerId, monthStartIso = monthStartUtcIso()) {
  const l3Id = String(l3ReferrerId || '').trim()
  if (!l3Id || !supabaseAdmin) return 0

  const { data, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb, status, earned_at, updated_at, metadata')
    .eq('referrer_id', l3Id)
    .eq('type', 'bonus')
    .in('status', ['pending', 'earned', 'earned_held'])

  if (error) {
    if (String(error.message || '').includes('does not exist')) return 0
    throw new Error(error.message || 'LIVE_L3_MONTHLY_READ_FAILED')
  }

  const monthStartMs = Date.parse(monthStartIso)
  return round2(
    (data || []).reduce((acc, row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      const isLiveL3 = meta.split_role === 'l3_upline' || meta.l3_live === true
      if (!isLiveL3) return acc
      const iso = row?.earned_at || row?.updated_at
      if (!iso || Date.parse(iso) < monthStartMs) return acc
      return acc + (Number(row.amount_thb) || 0)
    }, 0),
  )
}

export default { getMonthlyGuestL3LiveSpentThb }
