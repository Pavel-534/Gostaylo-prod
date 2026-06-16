/**
 * Stage 149.2 — block guest payment when host cannot receive payouts.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { isPartnerPayoutProfileReady } from '@/lib/partner/host-payout-profile-ready'

/**
 * @param {string | null | undefined} ownerId
 * @returns {Promise<{ ok: true } | { ok: false, code: string, error: string }>}
 */
export async function assertHostPayoutReadyForBooking(ownerId) {
  const oid = String(ownerId || '').trim()
  if (!oid || !supabaseAdmin) {
    return {
      ok: false,
      code: 'HOST_PAYOUT_NOT_READY',
      error: 'This listing is temporarily unavailable for booking. Please try again later.',
    }
  }

  const { data: profileRow, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('metadata')
    .eq('id', oid)
    .maybeSingle()

  if (profileErr) {
    console.warn('[host-payout-booking-gate] profile lookup:', profileErr.message)
  }

  const meta =
    profileRow?.metadata && typeof profileRow.metadata === 'object' ? profileRow.metadata : {}
  if (meta.referral_payout_blocked === true) {
    return {
      ok: false,
      code: 'HOST_PAYOUT_BLOCKED',
      error: 'This listing is temporarily unavailable for booking. Please try again later.',
    }
  }

  const payoutProfiles = await PayoutRailsService.listPartnerPayoutProfiles(oid).catch(() => [])
  const payoutReady = payoutProfiles.some(isPartnerPayoutProfileReady)
  if (!payoutReady) {
    return {
      ok: false,
      code: 'HOST_PAYOUT_NOT_READY',
      error: 'This listing is temporarily unavailable for booking. The host is still setting up payouts.',
    }
  }

  return { ok: true }
}
