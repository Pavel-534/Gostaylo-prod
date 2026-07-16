/**
 * Exclude E2E-tagged listings/bookings from inbox lists and unread aggregates.
 * SSOT for chat conversation filtering (Stage 171.29).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { isMarkedE2eTestData } from '@/lib/e2e/test-data-tag'

/**
 * @param {Array<{ listing_id?: string|null, booking_id?: string|null }>} rows
 * @returns {Promise<typeof rows>}
 */
export async function filterOutE2eConversationRows(rows) {
  if (!rows?.length) return []
  if (!supabaseAdmin) return rows

  const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))]
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))]
  const listingById = new Map()
  const bookingById = new Map()

  if (listingIds.length) {
    const { data } = await supabaseAdmin
      .from('listings')
      .select('id,title,description,metadata')
      .in('id', listingIds)
    for (const row of data || []) listingById.set(String(row.id), row)
  }

  if (bookingIds.length) {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select('id,special_requests,guest_name')
      .in('id', bookingIds)
    for (const row of data || []) bookingById.set(String(row.id), row)
  }

  return rows.filter((c) => {
    const listing = c.listing_id ? listingById.get(String(c.listing_id)) : null
    const booking = c.booking_id ? bookingById.get(String(c.booking_id)) : null
    return !isMarkedE2eTestData(listing) && !isMarkedE2eTestData(booking)
  })
}
