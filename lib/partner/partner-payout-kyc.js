/**
 * Stage 48.0 — Payout gate: profiles.is_verified (admin KYC), distinct from partner_payout_profiles.is_verified (rails).
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isPartnerProfileAdminVerified(userId) {
  const id = String(userId || '').trim()
  if (!id || !supabaseAdmin) return false
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('is_verified')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return false
  return data.is_verified === true
}
