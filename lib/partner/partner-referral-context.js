/**
 * Stage 132.2 — referral context for partner dashboard (supply activation strip).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { REFERRAL_LEDGER_REFERRAL_TYPE } from '@/lib/services/marketing/referral-calculation'
import { resolveDirectReferrerForUser } from '@/lib/referral/resolve-direct-referrer'

/**
 * @param {string} partnerId
 * @returns {Promise<{ referredBy: { id: string, displayName: string } | null, directReferrerId: string | null, hostActivationCompleted: boolean }>}
 */
export async function resolvePartnerReferralContext(partnerId) {
  const empty = {
    referredBy: null,
    directReferrerId: null,
    hostActivationCompleted: false,
  }
  if (!partnerId || !supabaseAdmin) return empty

  const pid = String(partnerId).trim()
  const { directReferrerId, referredBy } = await resolveDirectReferrerForUser(pid)
  const hostActivationCompleted = await resolveHostActivationCompleted(pid)
  return { referredBy, directReferrerId, hostActivationCompleted }
}

/**
 * True when partner has ≥1 COMPLETED booking on own listings or host_activation ledger exists.
 * @param {string} partnerId
 */
async function resolveHostActivationCompleted(partnerId) {
  if (!supabaseAdmin) return false

  const { count: ledgerCount, error: ledgerErr } = await supabaseAdmin
    .from('referral_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('referee_id', partnerId)
    .eq('referral_type', REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION)

  if (!ledgerErr && (Number(ledgerCount) || 0) > 0) return true

  const { data: listings } = await supabaseAdmin.from('listings').select('id').eq('owner_id', partnerId)
  const listingIds = (listings || []).map((l) => String(l.id || '')).filter(Boolean)
  if (!listingIds.length) return false

  const { count: completedCount, error: completedErr } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .in('listing_id', listingIds)
    .eq('status', 'COMPLETED')

  if (completedErr) return false
  return (Number(completedCount) || 0) >= 1
}
