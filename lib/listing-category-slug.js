/**
 * Категория «Транспорт» в БД: slug `vehicles`, id `cat-vehicles`, отображаемое имя — «Транспорт».
 * В URL допускаем алиасы transport / vehicle для deep links из чата и маркетинга.
 */

import { TRANSPORT_CATEGORY_DB_SLUG } from '@/lib/config/app-constants'
export { TRANSPORT_CATEGORY_DB_SLUG }

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
  if (n === TRANSPORT_CATEGORY_DB_SLUG) return true
  const s = String(slug || '').toLowerCase().trim()
  if (s === 'helicopter' || s === 'helicopters') return true
  return false
}

/** Категория «Туры» в каталоге (slug в БД + совместимость с вариантами slug). */
export function isTourListingCategory(slug) {
  const s = String(slug || '').toLowerCase()
  if (s === 'tours') return true
  return s.includes('tour')
}

/** Яхты / лодки (slug или подстрока). */
export function isYachtLikeCategory(slug) {
  const s = String(slug || '').toLowerCase()
  return s === 'yachts' || s.includes('yacht') || s.includes('boat')
}

/** Кровати / ванные / м² — только для жилья, не для транспорта, туров, яхт. */
export function showsPropertyInteriorSpecs(slug) {
  if (isTransportListingCategory(slug)) return false
  if (isTourListingCategory(slug)) return false
  if (isYachtLikeCategory(slug)) return false
  return true
}
