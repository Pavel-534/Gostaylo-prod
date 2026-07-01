/**
 * Сколько человек/мест допустимо для объявления (карточка, страница, виджет брони).
 */
import {
  isTransportListingCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'

function positiveInt(v, fallback) {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  return fallback
}

/**
 * SSOT column value for `listings.max_capacity` (write path + search/booking guards).
 *
 * @param {{
 *   categorySlug?: string | null,
 *   metadata?: object | null,
 *   maxCapacity?: number | string | null,
 *   bedroomsCount?: number | string | null,
 * }} input
 * @returns {number}
 */
export function deriveListingMaxCapacityColumn(input = {}) {
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const slug = String(input.categorySlug || '').toLowerCase()

  const listingCap = positiveInt(input.maxCapacity, 0)
  const metaGuests = positiveInt(meta.max_guests, 0) || positiveInt(meta.guests, 0)
  const bedrooms = positiveInt(meta.bedrooms, 0) || positiveInt(input.bedroomsCount, 0)

  if (isTransportListingCategory(slug)) {
    const seats = positiveInt(meta.seats, 0)
    if (seats > 0) return seats
    const fallback = metaGuests || listingCap || 2
    return fallback > 0 ? fallback : 2
  }

  let combined = Math.max(listingCap, metaGuests)
  if (showsPropertyInteriorSpecs(slug) && bedrooms > 0) {
    const fromBeds = Math.max(bedrooms * 2, bedrooms + 1)
    if (combined <= 1 || combined < fromBeds) combined = Math.max(combined, fromBeds)
  }
  if (combined > 0) return combined
  return 4
}

/**
 * @param {object} listing
 * @returns {number}
 */
export function resolveListingGuestCapacity(listing) {
  const meta = listing?.metadata || {}
  const slug = String(
    listing?.categorySlug || listing?.category?.slug || listing?.categories?.slug || '',
  ).toLowerCase()

  return deriveListingMaxCapacityColumn({
    categorySlug: slug,
    metadata: meta,
    maxCapacity: listing?.maxCapacity ?? listing?.max_capacity,
    bedroomsCount: listing?.bedrooms_count ?? listing?.bedroomsCount,
  })
}

/**
 * Merge partner/admin listing patch row with synced `max_capacity` (+ metadata.max_guests when stale).
 *
 * @param {Record<string, unknown>} updateData
 * @param {{
 *   categorySlug?: string | null,
 *   existing?: { metadata?: object, max_capacity?: number, bedrooms_count?: number } | null,
 * }} context
 * @returns {Record<string, unknown>}
 */
export function applyListingMaxCapacitySyncToRow(updateData, context = {}) {
  const existing = context.existing || {}
  const mergedMeta = {
    ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
    ...(updateData.metadata && typeof updateData.metadata === 'object' ? updateData.metadata : {}),
  }

  const cap = deriveListingMaxCapacityColumn({
    categorySlug: context.categorySlug,
    metadata: mergedMeta,
    maxCapacity: updateData.max_capacity ?? existing.max_capacity,
    bedroomsCount: updateData.bedrooms_count ?? existing.bedrooms_count,
  })

  updateData.max_capacity = cap

  const metaGuests = positiveInt(mergedMeta.max_guests, 0)
  if (!metaGuests || metaGuests < cap) {
    updateData.metadata = { ...mergedMeta, max_guests: cap }
  } else if (updateData.metadata === undefined && Object.keys(mergedMeta).length > 0) {
    updateData.metadata = mergedMeta
  }

  return updateData
}
