/**
 * Stage 116.2 — SSOT статуса onboarding партнёра после approve.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'
import { isPartnerPayoutProfileReady } from '@/lib/partner/host-payout-profile-ready'

function isListingNotSoftDeleted(row) {
  return !(row?.metadata && typeof row.metadata === 'object' && row.metadata.is_deleted === true)
}

function isListingDraftRow(row) {
  return row?.metadata && typeof row.metadata === 'object' && row.metadata.is_draft === true
}

/**
 * @param {string} partnerId
 * @returns {Promise<{
 *   payoutReady: boolean,
 *   calendarConfigured: boolean,
 *   hasListing: boolean,
 *   listingCount: number,
 *   listingCountExcludingDrafts: number,
 *   latestListingId: string | null,
 *   latestListingStatus: string | null,
 *   latestListingTitle: string | null,
 *   latestListingDescription: string | null,
 *   latestListingBasePriceThb: number | null,
 *   latestListingBaseCurrency: string | null,
 * }>}
 */
export async function resolvePartnerOnboardingStatus(partnerId) {
  const empty = {
    payoutReady: false,
    calendarConfigured: false,
    hasListing: false,
    listingCount: 0,
    listingCountExcludingDrafts: 0,
    latestListingId: null,
    latestListingStatus: null,
    latestListingTitle: null,
    latestListingDescription: null,
    latestListingBasePriceThb: null,
    latestListingBaseCurrency: null,
  }
  if (!partnerId || !supabaseAdmin) return empty

  const [profiles, listingsRes] = await Promise.all([
    PayoutRailsService.listPartnerPayoutProfiles(partnerId).catch(() => []),
    supabaseAdmin
      .from('listings')
      .select(
        'id, status, sync_settings, metadata, title, description, base_price_thb, base_currency, created_at',
      )
      .eq('owner_id', partnerId)
      .in('status', ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED'])
      .order('created_at', { ascending: false }),
  ])

  const payoutReady = profiles.some(isPartnerPayoutProfileReady)

  const listings = (listingsRes.data || []).filter(isListingNotSoftDeleted)
  const listingIds = listings.map((l) => l.id).filter(Boolean)
  const hasListing = listingIds.length > 0
  const listingCountExcludingDrafts = listings.filter((l) => !isListingDraftRow(l)).length

  const latest = listings[0] || null

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
    listingCountExcludingDrafts,
    latestListingId: latest?.id ? String(latest.id) : null,
    latestListingStatus: latest?.status ? String(latest.status) : null,
    latestListingTitle: latest?.title ? String(latest.title) : null,
    latestListingDescription: latest?.description ? String(latest.description) : null,
    latestListingBasePriceThb:
      latest?.base_price_thb != null && Number.isFinite(Number(latest.base_price_thb))
        ? Number(latest.base_price_thb)
        : null,
    latestListingBaseCurrency: latest?.base_currency ? String(latest.base_currency) : 'THB',
  }
}
