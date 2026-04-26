/**
 * Stage 67.0 — SSOT: значения `categories.wizard_profile` (Postgres TEXT) → форма визарда и поведение каталога.
 * Не импортирует `category-behavior` / `category-form-schema` (избегаем циклов).
 */

import { isTransportListingCategory } from '@/lib/listing-category-slug'

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

/** @typedef {'stay'|'transport'|'transport_helicopter'|'yacht'|'tour'|'nanny'|'chef'|'massage'|'service_generic'|'none'} WizardFormProfile */

const CANON = new Set([
  'stay',
  'transport',
  'transport_helicopter',
  'yacht',
  'tour',
  'nanny',
  'chef',
  'massage',
  'service_generic',
])

function isHelicopterSlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  return s === 'helicopter' || s === 'helicopters'
}

/**
 * Нормализованное значение колонки БД (нижний регистр) или null.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeCategoryWizardProfileColumn(raw) {
  if (raw == null) return null
  const s = String(raw).toLowerCase().trim()
  if (!s) return null
  return CANON.has(s) ? s : null
}

/**
 * @param {unknown} dbRaw — `categories.wizard_profile`
 * @param {string} categorySlug
 * @returns {WizardFormProfile | null} null → использовать эвристики в `category-form-schema`
 */
export function wizardFormProfileFromDb(dbRaw, categorySlug) {
  const col = normalizeCategoryWizardProfileColumn(dbRaw)
  if (!col) return null
  if (col === 'transport' && isHelicopterSlug(categorySlug)) return 'transport_helicopter'
  return /** @type {WizardFormProfile} */ (col)
}

/**
 * @param {unknown} dbRaw
 * @returns {ListingServiceType | null}
 */
export function listingServiceTypeFromWizardProfileColumn(dbRaw) {
  const col = normalizeCategoryWizardProfileColumn(dbRaw)
  if (!col) return null
  if (col === 'stay') return 'stay'
  if (col === 'transport' || col === 'transport_helicopter' || col === 'yacht') return 'transport'
  if (col === 'tour') return 'tour'
  if (col === 'nanny' || col === 'chef' || col === 'massage' || col === 'service_generic') return 'service'
  return null
}

/**
 * @param {unknown} dbRaw
 * @returns {boolean}
 */
export function isServiceMarketplaceWizardProfileColumn(dbRaw) {
  const col = normalizeCategoryWizardProfileColumn(dbRaw)
  return (
    col === 'nanny' ||
    col === 'chef' ||
    col === 'massage' ||
    col === 'service_generic'
  )
}

/**
 * Полное поведение категории из БД (без slug-оверрайдов — их накладывает `resolveCategoryBehavior`).
 * @param {unknown} dbRaw
 * @param {string} [categorySlug]
 * @returns {CategoryBehavior | null}
 */
export function categoryBehaviorFromWizardProfileColumn(dbRaw, categorySlug = '') {
  const col = normalizeCategoryWizardProfileColumn(dbRaw)
  if (!col) return null

  if (col === 'stay') {
    return {
      escrowThawBucket: 'housing',
      listingServiceType: 'stay',
      mapLocationDisplayMode: 'privacy',
    }
  }
  if (col === 'transport' || col === 'transport_helicopter') {
    return {
      escrowThawBucket: 'transport',
      listingServiceType: 'transport',
      mapLocationDisplayMode: 'exact',
    }
  }
  if (col === 'yacht') {
    return {
      escrowThawBucket: 'transport',
      listingServiceType: 'transport',
      mapLocationDisplayMode: 'exact',
    }
  }
  if (col === 'tour') {
    return {
      escrowThawBucket: 'service',
      listingServiceType: 'tour',
      mapLocationDisplayMode: 'exact',
    }
  }
  if (col === 'nanny' || col === 'chef' || col === 'massage' || col === 'service_generic') {
    return {
      escrowThawBucket: 'service',
      listingServiceType: 'service',
      mapLocationDisplayMode: 'privacy',
    }
  }
  return null
}

/**
 * Режим интервального поиска/брони для транспорта (время суток).
 * @param {unknown} dbRaw
 * @param {string} [categorySlug] — fallback, если колонка ещё не заполнена
 * @returns {boolean}
 */
export function isTransportIntervalWizardProfile(dbRaw, categorySlug = '') {
  const col = normalizeCategoryWizardProfileColumn(dbRaw)
  if (col === 'transport' || col === 'transport_helicopter') return true
  if (col) return false
  const s = String(categorySlug || '').toLowerCase()
  if (s === 'vehicles' || s === 'transport' || s === 'vehicle' || isHelicopterSlug(s)) return true
  return false
}

/**
 * Транспортная вертикаль (поля техники на шаге 1 / скрытие housing specs).
 * @param {string} categorySlug
 * @param {unknown} [wizardProfileDb]
 */
export function isTransportWizardCategory(categorySlug, wizardProfileDb) {
  const form = wizardFormProfileFromDb(wizardProfileDb, categorySlug)
  if (form === 'transport' || form === 'transport_helicopter') return true
  return isTransportListingCategory(categorySlug)
}
