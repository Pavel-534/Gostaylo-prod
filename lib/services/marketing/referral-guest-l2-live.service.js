/**
 * Stage 131.4 — Live L2 monthly cap counter (ledger SSOT).
 * Do NOT mix with shadow accruals in `referral-guest-l2-shadow.service.js`.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { round2 } from '@/lib/services/marketing/referral-calculation.js'

function monthStartUtcIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

/**
 * Sum earned/pending Live L2 mentor bonuses for UTC month from `referral_ledger`.
 * SSOT: rows with metadata.split_role = 'l2_mentor' OR metadata.l2_live = true.
 */
export async function getMonthlyGuestL2LiveSpentThb(l2ReferrerId, monthStartIso = monthStartUtcIso()) {
  const l2Id = String(l2ReferrerId || '').trim()
  if (!l2Id) return 0

  const { data, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb, status, earned_at, updated_at, metadata')
    .eq('referrer_id', l2Id)
    .eq('type', 'bonus')
    .in('status', ['pending', 'earned', 'earned_held'])

  if (error) {
    if (String(error.message || '').includes('does not exist')) return 0
    throw new Error(error.message || 'LIVE_L2_MONTHLY_READ_FAILED')
  }

  const monthStartMs = Date.parse(monthStartIso)
  return round2(
    (data || []).reduce((acc, row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      const isLiveL2 = meta.split_role === 'l2_mentor' || meta.l2_live === true
      if (!isLiveL2) return acc
      const iso = row?.earned_at || row?.updated_at
      if (!iso || Date.parse(iso) < monthStartMs) return acc
      return acc + (Number(row.amount_thb) || 0)
    }, 0),
  )
}

export default { getMonthlyGuestL2LiveSpentThb }
