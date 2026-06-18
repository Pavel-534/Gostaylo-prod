/**
 * Stage 167.1 — merge localStorage recent views with server rows (newest viewed_at wins).
 */

const MAX_RECENT = 10

/**
 * @param {object} item
 */
function normalizeRecentItem(item) {
  const id = String(item.id ?? item.listing_id ?? '').trim()
  if (!id) return null

  const listing = item.listing && typeof item.listing === 'object' ? item.listing : null

  return {
    id,
    title: item.title ?? listing?.title ?? 'Untitled',
    district: item.district ?? listing?.district ?? null,
    base_price_thb:
      item.base_price_thb ??
      item.basePriceThb ??
      listing?.base_price_thb ??
      listing?.basePriceThb ??
      null,
    guest_display_price_thb:
      item.guest_display_price_thb ??
      item.guestDisplayPriceThb ??
      listing?.guest_display_price_thb ??
      listing?.guestDisplayPriceThb ??
      null,
    images: item.images ?? listing?.images ?? [],
    cover_image:
      item.cover_image ??
      item.coverImage ??
      listing?.cover_image ??
      listing?.coverImage ??
      null,
    property_type: item.property_type ?? item.metadata?.property_type ?? listing?.metadata?.property_type,
    bedrooms: item.bedrooms ?? item.metadata?.bedrooms ?? listing?.metadata?.bedrooms,
    bathrooms: item.bathrooms ?? item.metadata?.bathrooms ?? listing?.metadata?.bathrooms,
    viewed_at: item.viewed_at ?? item.viewedAt ?? new Date().toISOString(),
  }
}

/**
 * @param {object[]} localItems
 * @param {object[]} serverItems — rows from GET /api/v2/listing-views
 * @param {number} [max]
 */
export function mergeRecentListings(localItems, serverItems, max = MAX_RECENT) {
  /** @type {Map<string, object>} */
  const byId = new Map()

  for (const raw of [...(localItems || []), ...(serverItems || [])]) {
    const normalized = normalizeRecentItem(raw)
    if (!normalized) continue
    const existing = byId.get(normalized.id)
    if (!existing) {
      byId.set(normalized.id, normalized)
      continue
    }
    const nextTs = Date.parse(normalized.viewed_at) || 0
    const prevTs = Date.parse(existing.viewed_at) || 0
    if (nextTs >= prevTs) byId.set(normalized.id, normalized)
  }

  return [...byId.values()]
    .sort((a, b) => (Date.parse(b.viewed_at) || 0) - (Date.parse(a.viewed_at) || 0))
    .slice(0, max)
}

export const RECENTLY_VIEWED_MAX = MAX_RECENT
