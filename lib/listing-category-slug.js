/**
 * Категория «Транспорт» в БД: slug `vehicles`, id `cat-vehicles`, отображаемое имя — «Транспорт».
 * В URL допускаем алиасы transport / vehicle для deep links из чата и маркетинга.
 */

export const TRANSPORT_CATEGORY_DB_SLUG = 'vehicles'

export function normalizeListingCategorySlugForSearch(raw) {
  if (raw == null || raw === '' || raw === 'all') return 'all'
  const s = String(raw).toLowerCase()
  if (s === 'transport' || s === 'vehicle' || s === 'transportation') {
    return TRANSPORT_CATEGORY_DB_SLUG
  }
  return raw
}

export function isTransportListingCategory(slug) {
  const n = normalizeListingCategorySlugForSearch(slug)
  return n === TRANSPORT_CATEGORY_DB_SLUG
}
