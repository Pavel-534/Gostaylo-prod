/**
 * Stage 132.2 — SSOT: direct upline (referrer) for any profile role.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getReferralRelationByReferee } from '@/lib/services/marketing/referral-payout.service'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { buildAmbassadorLandingUrl } from '@/lib/referral/public-landing-url'

/**
 * @param {string} refereeId profiles.id of the invited user
 * @returns {Promise<{ directReferrerId: string | null, referredBy: { id: string, displayName: string, avatarUrl: string | null, tierLabel: string | null, landingUrl: string } | null }>}
 */
export async function resolveDirectReferrerForUser(refereeId) {
  const empty = { directReferrerId: null, referredBy: null }
  if (!refereeId || !supabaseAdmin) return empty

  const rid = String(refereeId).trim()
  const relation = await getReferralRelationByReferee(rid)
  const directReferrerId = relation?.referrer_id ? String(relation.referrer_id).trim() : null
  if (!directReferrerId) return empty

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, avatar_url, referral_tier_name')
    .eq('id', directReferrerId)
    .maybeSingle()

  const displayName = profile
    ? formatPrivacyDisplayNameForParticipant(
        profile.first_name,
        profile.last_name,
        profile.email,
        'Амбассадор',
      )
    : 'Амбассадор'

  return {
    directReferrerId,
    referredBy: {
      id: directReferrerId,
      displayName,
      avatarUrl: profile?.avatar_url ? String(profile.avatar_url).trim() || null : null,
      tierLabel: String(profile?.referral_tier_name || '').trim() || null,
      landingUrl: buildAmbassadorLandingUrl(directReferrerId),
    },
  }
}
