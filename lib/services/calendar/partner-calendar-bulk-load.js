/**
 * Stage 200.53.3 — Partner master calendar bulk raw loader (SoT data layer).
 *
 * Exactly **3** DB round-trips for N listings (bookings + calendar_blocks + seasonal_prices),
 * then in-memory group by listing_id. Cell math stays in `buildCalendar` (SSOT).
 *
 * Guest/public `getCalendarForDateRange` is unchanged and still does per-listing fetches.
 */

import { occupyingStatusesInFilter } from '@/lib/booking/status-sets.js'
import { toListingDate } from '@/lib/listing-date'
import { supabaseAdmin } from '@/lib/supabase'

/** Same fields as `getOccupyingBookings({ includePartnerGridFields: true })`. */
const PARTNER_BOOKING_SELECT =
  'id,listing_id,check_in,check_out,status,guest_name,guests_count,price_thb,metadata'

const GUEST_BOOKING_SELECT = 'id,listing_id,check_in,check_out,status,guest_name,guests_count'

/** @returns {{ bookingsByListingId: Map<string, object[]>, blocksByListingId: Map<string, object[]>, seasonalByListingId: Map<string, object[]> }} */
export function emptyPartnerCalendarRawMaps() {
  return {
    bookingsByListingId: new Map(),
    blocksByListingId: new Map(),
    seasonalByListingId: new Map(),
  }
}

/**
 * @param {unknown} listingIds
 * @returns {string[]}
 */
export function normalizeListingIds(listingIds) {
  return [
    ...new Set(
      (Array.isArray(listingIds) ? listingIds : [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean),
    ),
  ]
}

/**
 * @param {string | null | undefined} occupyingStatusesCsv
 * @returns {string[]}
 */
export function parseOccupyingStatusesList(occupyingStatusesCsv) {
  const csv =
    typeof occupyingStatusesCsv === 'string' && occupyingStatusesCsv.trim()
      ? occupyingStatusesCsv.trim()
      : occupyingStatusesInFilter()
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {Array<{ listing_id?: unknown } | null | undefined> | null | undefined} rows
 * @returns {Map<string, object[]>}
 */
export function groupRowsByListingId(rows) {
  const map = new Map()
  for (const row of rows || []) {
    if (!row || row.listing_id == null) continue
    const id = String(row.listing_id)
    if (!id) continue
    let bucket = map.get(id)
    if (!bucket) {
      bucket = []
      map.set(id, bucket)
    }
    bucket.push(row)
  }
  return map
}

/**
 * Ensure every requested listing id has an array (empty if no rows).
 * @param {Map<string, object[]>} map
 * @param {string[]} ids
 */
function ensureListingKeys(map, ids) {
  for (const id of ids) {
    if (!map.has(id)) map.set(id, [])
  }
  return map
}

/**
 * Bulk-load raw calendar inputs for the partner master calendar.
 *
 * @param {{
 *   listingIds: string[],
 *   rangeStart: string,
 *   rangeEnd: string,
 *   occupyingStatusesCsv?: string,
 *   includePartnerGridFields?: boolean,
 *   supabase?: import('@supabase/supabase-js').SupabaseClient | null,
 * }} opts
 * @returns {Promise<{
 *   bookingsByListingId: Map<string, object[]>,
 *   blocksByListingId: Map<string, object[]>,
 *   seasonalByListingId: Map<string, object[]>,
 * }>}
 */
export async function loadPartnerCalendarRaw({
  listingIds,
  rangeStart,
  rangeEnd,
  occupyingStatusesCsv,
  includePartnerGridFields = true,
  supabase = supabaseAdmin,
} = {}) {
  const ids = normalizeListingIds(listingIds)
  if (!ids.length) return emptyPartnerCalendarRawMaps()

  const rs = toListingDate(rangeStart)
  const re = toListingDate(rangeEnd)
  if (!rs || !re || rs > re) {
    const err = new Error('INVALID_DATE_RANGE')
    err.code = 'INVALID_DATE_RANGE'
    throw err
  }

  if (!supabase) {
    const err = new Error('Supabase admin client unavailable')
    err.code = 'CALENDAR_DISABLED'
    throw err
  }

  const statuses = parseOccupyingStatusesList(occupyingStatusesCsv)
  const bookingSelect = includePartnerGridFields ? PARTNER_BOOKING_SELECT : GUEST_BOOKING_SELECT

  // Exactly 3 round-trips for the whole set (Promise.all = wall-clock parallel, still 3 queries).
  const [bookingsRes, blocksRes, seasonalRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(bookingSelect)
      .in('listing_id', ids)
      .in('status', statuses)
      .gte('check_out', rs)
      .lte('check_in', re)
      .order('check_in', { ascending: true }),
    supabase
      .from('calendar_blocks')
      .select('id,listing_id,start_date,end_date,source,reason,units_blocked,expires_at')
      .in('listing_id', ids)
      .gte('end_date', rs)
      .lte('start_date', re)
      .order('start_date', { ascending: true }),
    supabase
      .from('seasonal_prices')
      .select('*')
      .in('listing_id', ids)
      .lte('start_date', re)
      .gte('end_date', rs)
      .order('start_date', { ascending: true }),
  ])

  if (bookingsRes.error) {
    console.error('[partner-calendar-bulk] bookings error:', bookingsRes.error)
    const err = new Error(bookingsRes.error.message || 'Failed to load bookings')
    err.code = 'CALENDAR_DB_ERROR'
    throw err
  }
  if (blocksRes.error) {
    console.error('[partner-calendar-bulk] blocks error:', blocksRes.error)
    const err = new Error(blocksRes.error.message || 'Failed to load calendar blocks')
    err.code = 'CALENDAR_DB_ERROR'
    throw err
  }
  if (seasonalRes.error) {
    console.error('[partner-calendar-bulk] seasonal error:', seasonalRes.error)
    const err = new Error(seasonalRes.error.message || 'Failed to load seasonal prices')
    err.code = 'CALENDAR_DB_ERROR'
    throw err
  }

  const bookingsByListingId = ensureListingKeys(groupRowsByListingId(bookingsRes.data), ids)
  const blocksByListingId = ensureListingKeys(groupRowsByListingId(blocksRes.data), ids)
  const seasonalByListingId = ensureListingKeys(groupRowsByListingId(seasonalRes.data), ids)

  return {
    bookingsByListingId,
    blocksByListingId,
    seasonalByListingId,
  }
}
