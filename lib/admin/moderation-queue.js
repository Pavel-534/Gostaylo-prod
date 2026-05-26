/**
 * Stage 116.3 — SSOT: очередь модерации PENDING (фильтры + фасеты для UI).
 */

/**
 * @param {object[]} listings
 * @param {object} filters
 * @param {string} [filters.partnerQ]
 * @param {string} [filters.categorySlug]
 * @param {string} [filters.dateFrom] — YYYY-MM-DD
 * @param {string} [filters.dateTo]
 */
export function filterPendingModerationListings(listings, filters = {}) {
  const partnerQ = String(filters.partnerQ || '')
    .trim()
    .toLowerCase()
  const categorySlug = String(filters.categorySlug || '').trim().toLowerCase()
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null

  return (listings || []).filter((listing) => {
    if (listing.metadata?.is_draft === true) return false

    if (categorySlug) {
      const slug = String(listing.categories?.slug || listing.metadata?.category_slug || '')
        .toLowerCase()
        .trim()
      if (slug !== categorySlug) return false
    }

    if (partnerQ) {
      const owner = listing.owner || {}
      const hay = [
        owner.first_name,
        owner.last_name,
        owner.email,
        owner.id,
        listing.owner_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(partnerQ)) return false
    }

    if (dateFrom || dateTo) {
      const created = listing.created_at ? new Date(listing.created_at) : null
      if (!created || Number.isNaN(created.getTime())) return false
      if (dateFrom && created < dateFrom) return false
      if (dateTo && created > dateTo) return false
    }

    return true
  })
}

/**
 * @param {object[]} listings — уже без черновиков
 */
export function buildModerationFacets(listings) {
  const partners = new Map()
  const categories = new Map()

  for (const l of listings || []) {
    const oid = l.owner_id || l.owner?.id
    if (oid) {
      const o = l.owner || {}
      const label =
        [o.first_name, o.last_name].filter(Boolean).join(' ').trim() ||
        o.email ||
        String(oid).slice(0, 8)
      if (!partners.has(oid)) partners.set(oid, { id: oid, label, count: 0 })
      partners.get(oid).count += 1
    }

    const slug = String(l.categories?.slug || '').trim()
    const name = String(l.categories?.name || slug || '—').trim()
    if (slug) {
      if (!categories.has(slug)) categories.set(slug, { slug, name, count: 0 })
      categories.get(slug).count += 1
    }
  }

  return {
    partners: [...partners.values()].sort((a, b) => b.count - a.count),
    categories: [...categories.values()].sort((a, b) => b.count - a.count),
  }
}

/**
 * @param {number|string|null} lat
 * @param {number|string|null} lng
 */
/**
 * @param {object} listing
 */
export function formatModerationPartnerLabel(listing) {
  const o = listing?.owner || {}
  const name = [o.first_name, o.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (o.email) return String(o.email)
  return listing?.owner_id ? String(listing.owner_id).slice(0, 12) : 'Партнёр'
}

/**
 * @param {string | null | undefined} iso
 */
export function formatModerationCreatedAt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * @param {string | null | undefined} text
 * @param {number} [max]
 */
export function truncateModerationDescription(text, max = 140) {
  const s = String(text || '').trim()
  if (!s) return ''
  if (s.length <= max) return s
  return `${s.slice(0, max).trim()}…`
}

export function formatListingCoordinates(lat, lng) {
  const la = lat == null || lat === '' ? NaN : Number(lat)
  const ln = lng == null || lng === '' ? NaN : Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return { lat: la, lng: ln, label: `${la.toFixed(5)}, ${ln.toFixed(5)}` }
}
