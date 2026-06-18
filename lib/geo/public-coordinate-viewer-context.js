/**
 * Stage 163.2 — session + renter bookings for coordinate reveal gate (per HTTP request).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  RENTER_COORD_REVEAL_STATUSES,
  resolveCoordinateRevealLevel,
} from '@/lib/geo/listing-public-coordinates'

/**
 * @typedef {{
 *   viewerId: string | null,
 *   viewerRole: string | null,
 *   renterBookings: Array<{ listing_id?: string, status?: string }>,
 * }} PublicCoordinateViewerContext
 */

/** @type {PublicCoordinateViewerContext} */
const ANONYMOUS_CONTEXT = {
  viewerId: null,
  viewerRole: null,
  renterBookings: [],
}

/**
 * Load viewer context once per search / map-pins request.
 * @returns {Promise<PublicCoordinateViewerContext>}
 */
export async function fetchPublicCoordinateViewerContext() {
  try {
    const session = await getSessionPayload()
    const viewerId = session?.userId ? String(session.userId) : null
    const viewerRole = session?.role ? String(session.role) : null
    if (!viewerId) {
      return ANONYMOUS_CONTEXT
    }

    const statuses = [...RENTER_COORD_REVEAL_STATUSES]
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('listing_id, status')
      .eq('renter_id', viewerId)
      .in('status', statuses)

    if (error) {
      console.warn('[coord-privacy] renter bookings lookup failed:', error.message)
      return { viewerId, viewerRole, renterBookings: [] }
    }

    return {
      viewerId,
      viewerRole,
      renterBookings: data ?? [],
    }
  } catch (e) {
    console.warn('[coord-privacy] viewer context failed:', e?.message || e)
    return ANONYMOUS_CONTEXT
  }
}

/**
 * @param {object} listing
 * @param {PublicCoordinateViewerContext} ctx
 */
export function coordinateRevealLevelForListing(listing, ctx) {
  return resolveCoordinateRevealLevel({
    viewerId: ctx?.viewerId,
    viewerRole: ctx?.viewerRole,
    listing,
    renterBookings: ctx?.renterBookings ?? [],
  })
}

/**
 * Renter bookings for a single listing PDP (narrow query).
 * @param {string} viewerId
 * @param {string} listingId
 */
export async function fetchRenterBookingsForListingReveal(viewerId, listingId) {
  const rid = String(viewerId || '').trim()
  const lid = String(listingId || '').trim()
  if (!rid || !lid) return []

  const statuses = [...RENTER_COORD_REVEAL_STATUSES]
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('listing_id, status')
    .eq('renter_id', rid)
    .eq('listing_id', lid)
    .in('status', statuses)

  if (error) {
    console.warn('[coord-privacy] listing reveal bookings failed:', error.message)
    return []
  }
  return data ?? []
}
