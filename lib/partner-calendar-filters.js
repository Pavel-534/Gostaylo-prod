/**
 * Фильтры мобильного мастер-календаря партнёра по категориям из БД (listings.category_id → categories.slug).
 * Slug'и в проде: property, vehicles, tours, yachts (см. таблица categories).
 */

/** @typedef {'all' | 'villas' | 'transport' | 'tours'} PartnerMobileCategoryFilter */

const VILLA_SLUGS = new Set(['property'])
const TRANSPORT_SLUGS = new Set(['vehicles'])
/** Чип «Туры»: в БД отдельные slug'и tours и yachts — в фильтре одна группа, пятая кнопка не используется */
const TOURS_SLUGS = new Set(['tours', 'yachts'])

/**
 * @param {{ category?: { slug?: string } | null, categorySlug?: string }} listing
 */
export function getListingCategorySlug(listing) {
  if (!listing) return ''
  const fromJoin = listing.category?.slug
  if (fromJoin) return String(fromJoin).toLowerCase()
  if (listing.categorySlug) return String(listing.categorySlug).toLowerCase()
  return ''
}

/**
 * @param {PartnerMobileCategoryFilter} filter
 * @param {{ category?: { slug?: string } | null, categorySlug?: string }} listingRow — item.listing из API календаря
 */
export function listingMatchesPartnerMobileCategoryFilter(listingRow, filter) {
  if (filter === 'all') return true
  const slug = getListingCategorySlug(listingRow)
  if (!slug) return filter === 'all'
  if (filter === 'villas') return VILLA_SLUGS.has(slug)
  if (filter === 'transport') return TRANSPORT_SLUGS.has(slug)
  if (filter === 'tours') return TOURS_SLUGS.has(slug)
  return true
}

/**
 * Иконка строки сетки: легаси-ключ type (villa, yacht, bike, car).
 * @param {string} [categorySlug]
 */
export function mapCategorySlugToListingType(categorySlug) {
  if (!categorySlug) return undefined
  const s = String(categorySlug).toLowerCase()
  if (s === 'vehicles') return 'car'
  if (s === 'yachts') return 'yacht'
  if (s === 'property') return 'villa'
  if (s === 'tours') return 'villa'
  return undefined
}
