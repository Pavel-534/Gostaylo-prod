/**
 * Stage 132.2 — referral context for partner dashboard (supply activation strip).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getReferralRelationByReferee } from '@/lib/services/marketing/referral-payout.service'
import { REFERRAL_LEDGER_REFERRAL_TYPE } from '@/lib/services/marketing/referral-calculation'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'

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
  const relation = await getReferralRelationByReferee(pid)
  const directReferrerId = relation?.referrer_id ? String(relation.referrer_id).trim() : null

  let referredBy = null
  if (directReferrerId) {
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', directReferrerId)
      .maybeSingle()

    const displayName = referrerProfile
      ? formatPrivacyDisplayNameForParticipant(
          referrerProfile.first_name,
          referrerProfile.last_name,
          referrerProfile.email,
          'Амбассадор',
        )
      : 'Амбассадор'

    referredBy = { id: directReferrerId, displayName }
  }

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
