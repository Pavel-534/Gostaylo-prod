/**
 * Stage 116.2 — SSOT статуса onboarding партнёра после approve.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'

function partnerPayoutProfileReady(profile) {
  if (!profile) return false
  if (profile.is_verified === true) return true
  const d = profile.data && typeof profile.data === 'object' ? profile.data : {}
  return Object.values(d).some((v) => v != null && String(v).trim() !== '')
}

/**
 * @param {string} partnerId
 * @returns {Promise<{ payoutReady: boolean, calendarConfigured: boolean, hasListing: boolean, listingCount: number }>}
 */
export async function resolvePartnerOnboardingStatus(partnerId) {
  const empty = {
    payoutReady: false,
    calendarConfigured: false,
    hasListing: false,
    listingCount: 0,
  }
  if (!partnerId || !supabaseAdmin) return empty

  const [profiles, listingsRes] = await Promise.all([
    PayoutRailsService.listPartnerPayoutProfiles(partnerId).catch(() => []),
    supabaseAdmin
      .from('listings')
      .select('id, status, sync_settings, metadata')
      .eq('owner_id', partnerId)
      .in('status', ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED']),
  ])

  const payoutReady = profiles.some(partnerPayoutProfileReady)

  const listings = (listingsRes.data || []).filter(
    (l) => !(l?.metadata && typeof l.metadata === 'object' && l.metadata.is_deleted === true),
  )
  const listingIds = listings.map((l) => l.id).filter(Boolean)
  const hasListing = listingIds.length > 0

  let calendarConfigured = listings.some((l) => {
    const sync = l.sync_settings
    if (sync && typeof sync === 'object') {
      if (sync.ical_url || sync.icalUrl || sync.auto_sync === true) return true
    }
    return false
  })

  if (!calendarConfigured && listingIds.length > 0) {
    const { count, error } = await supabaseAdmin
      .from('calendar_blocks')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', listingIds)
      .eq('source', 'manual')
    if (!error && (count || 0) > 0) calendarConfigured = true
  }

  return {
    payoutReady,
    calendarConfigured,
    hasListing,
    listingCount: listingIds.length,
  }
}
