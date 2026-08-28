/**
 * Stage 48.0 / 202.13 — Payout gate: profiles.verification_status === VERIFIED (admin KYC).
 * Distinct from email `is_verified` / `email_verified_at` and from partner_payout_profiles.is_verified (rails).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { profileHasAdminKycVerified } from '@/lib/auth/profile-verification-flags.js'

/**
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isPartnerProfileAdminVerified(userId) {
  const id = String(userId || '').trim()
  if (!id || !supabaseAdmin) return false
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('verification_status')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return false
  return profileHasAdminKycVerified(data)
}
