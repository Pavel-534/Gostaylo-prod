/**
 * Stage 52.0–53.0 — реестр поведения категорий (Master Map).
 * Один вход для: bucket разморозки эскроу, тип услуги визарда, режим маркера на карте.
 *
 * Новая категория (например `helicopters`): по возможности расширьте **`lib/listing-category-slug.js`** (алиасы транспорта/туров),
 * затем при необходимости добавьте строку в **`CATEGORY_SLUG_BEHAVIOR_OVERRIDES`** ниже — без правки 4+ файлов с дублирующими if.
 *
 * Копирайт уведомлений и календарь партнёра — через публичные хелперы ниже (bucket / чипы), без дублирования Set’ов в потребителях.
 */

import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'

/** @typedef {'housing' | 'transport' | 'service'} EscrowThawBucket */
/** @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType */
/** @typedef {'privacy' | 'exact'} MapLocationDisplayMode */

/**
 * @typedef {{
 *   escrowThawBucket: EscrowThawBucket,
 *   listingServiceType: ListingServiceType,
 *   mapLocationDisplayMode: MapLocationDisplayMode,
 * }} CategoryBehavior
 */

/**
 * Точечные переопределения по каноническому slug (`categories.slug`, lowercased).
 * Пример: `helicopters: { mapLocationDisplayMode: 'exact', escrowThawBucket: 'transport' }`
 * @type {Record<string, Partial<CategoryBehavior>>}
 */
export const CATEGORY_SLUG_BEHAVIOR_OVERRIDES = {
  // yachts: {} — покрыто isYachtLikeCategory в listing-category-slug
  /** Stage 65.0 — маркетплейс услуг (визард + thaw service). */
  chef: { listingServiceType: 'service', escrowThawBucket: 'service' },
  chefs: { listingServiceType: 'service', escrowThawBucket: 'service' },
  massage: { listingServiceType: 'service', escrowThawBucket: 'service' },
  massages: { listingServiceType: 'service', escrowThawBucket: 'service' },
}

/**
 * @param {string | null | undefined} categorySlug
 * @returns {CategoryBehavior}
 */
export function resolveCategoryBehavior(categorySlug) {
  const raw = categorySlug
  const s = String(raw || '').toLowerCase().trim()

  /** @type {EscrowThawBucket} */
  let escrowThawBucket = 'housing'
  if (s === 'property' || s === 'properties') {
    escrowThawBucket = 'housing'
  } else if (isTransportListingCategory(raw) || isYachtLikeCategory(raw)) {
    escrowThawBucket = 'transport'
  } else if (
    s === 'services' ||
    s === 'service' ||
    s === 'nanny' ||
    s === 'nannies' ||
    s === 'tours' ||
    s.includes('tour')
  ) {
    escrowThawBucket = 'service'
  }

  /** @type {ListingServiceType} */
  let listingServiceType = 'stay'
  if (isTransportListingCategory(raw) || isYachtLikeCategory(raw)) {
    listingServiceType = 'transport'
  } else if (isTourListingCategory(raw)) {
    listingServiceType = 'tour'
  } else if (s === 'services' || s === 'nanny' || s === 'babysitter' || s.includes('service')) {
    listingServiceType = 'service'
  }

  /** @type {MapLocationDisplayMode} */
  let mapLocationDisplayMode = 'privacy'
  if (/(yacht|vehicle|vehicles|transport|helicopter|tour|tours|boat|car|food|dining)/.test(s)) {
    mapLocationDisplayMode = 'exact'
  } else if (/(nanny|babysitter|property|villa|apartment|house|real)/.test(s)) {
    mapLocationDisplayMode = 'privacy'
  }

  const base = { escrowThawBucket, listingServiceType, mapLocationDisplayMode }
  const ov = s ? CATEGORY_SLUG_BEHAVIOR_OVERRIDES[s] : null
  if (!ov || typeof ov !== 'object') return base
  return {
    escrowThawBucket: ov.escrowThawBucket ?? base.escrowThawBucket,
    listingServiceType: ov.listingServiceType ?? base.listingServiceType,
    mapLocationDisplayMode: ov.mapLocationDisplayMode ?? base.mapLocationDisplayMode,
  }
}

/**
 * @param {string | null | undefined} categorySlug
 * @returns {EscrowThawBucket}
 */
export function getEscrowThawBucketFromRegistry(categorySlug) {
  return resolveCategoryBehavior(categorySlug).escrowThawBucket
}

/**
 * @param {string | null | undefined} slug
 * @returns {ListingServiceType}
 */
export function inferListingServiceTypeFromRegistry(slug) {
  return resolveCategoryBehavior(slug).listingServiceType
}

/**
 * Только по slug; для legacy `categoryId` см. **`getMapLocationDisplayModeFromLegacyCategoryId`**.
 * @param {string | null | undefined} categorySlug
 * @returns {MapLocationDisplayMode}
 */
export function getMapLocationDisplayModeFromRegistry(categorySlug) {
  return resolveCategoryBehavior(categorySlug).mapLocationDisplayMode
}

/**
 * Эскроу-ведро по slug (как в `getEscrowThawBucketFromRegistry`) — удобные предикаты для UI/фильтров.
 * «Service» здесь — **финансовое** ведро thaw, не путать с `listingServiceType === 'service'`.
 */
export function isHousingCategory(categorySlug) {
  return getEscrowThawBucketFromRegistry(categorySlug) === 'housing'
}

export function isTransportCategory(categorySlug) {
  return getEscrowThawBucketFromRegistry(categorySlug) === 'transport'
}

export function isServiceEscrowCategory(categorySlug) {
  return getEscrowThawBucketFromRegistry(categorySlug) === 'service'
}

/**
 * Легаси `listings.category_id` / строковые id до slug в БД — маппинг на канонический slug для реестра карт.
 * @param {string | number | null | undefined} categoryId
 * @returns {MapLocationDisplayMode}
 */
export function getMapLocationDisplayModeFromLegacyCategoryId(categoryId) {
  const id = String(categoryId ?? '')
    .toLowerCase()
    .trim()
  if (!id) return 'privacy'
  /** @type {Record<string, string>} */
  const slugByLegacy = {
    '2': 'vehicles',
    '3': 'tours',
    '4': 'yachts',
    '1': 'property',
    nanny: 'property',
    property: 'property',
  }
  const hint = slugByLegacy[id]
  if (hint) return getMapLocationDisplayModeFromRegistry(hint)
  return 'privacy'
}

/** Чип «Виллы» мастер-календаря партнёра (канон. slug из `categories`). */
export function isPartnerCalendarVillasSlug(categorySlug) {
  return String(categorySlug || '').toLowerCase().trim() === 'property'
}

/** Чип «Транспорт». */
export function isPartnerCalendarTransportSlug(categorySlug) {
  return String(categorySlug || '').toLowerCase().trim() === 'vehicles'
}

/** Чип «Туры»: отдельные slug `tours` и `yachts` — одна группа в UI. */
export function isPartnerCalendarToursSlug(categorySlug) {
  const s = String(categorySlug || '').toLowerCase().trim()
  return s === 'tours' || s === 'yachts'
}
