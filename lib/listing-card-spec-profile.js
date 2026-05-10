/**
 * SSOT: какие характеристики показывать на карточке листинга (каталог / главная / поиск).
 * Учитывает `categories.wizard_profile` + slug (см. Stage 67.0).
 */

import {
  wizardFormProfileFromDb,
  normalizeCategoryWizardProfileColumn,
} from '@/lib/config/category-wizard-profile-db'
import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import { getUIText } from '@/lib/translations'

/** @typedef {'yacht' | 'transport' | 'tour' | 'housing' | 'compact'} ListingCardSpecVertical */

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {string}
 */
export function resolveListingCategorySlugForCard(listing) {
  if (!listing || typeof listing !== 'object') return ''
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  return String(listing.categorySlug || listing.category?.slug || meta.category_slug || '').trim()
}

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {ListingCardSpecVertical}
 */
export function resolveListingCardSpecVertical(listing) {
  const slug = resolveListingCategorySlugForCard(listing)
  const cat = listing?.category && typeof listing.category === 'object' ? listing.category : {}
  const wpRaw = cat.wizard_profile ?? cat.wizardProfile
  const wpForm = wizardFormProfileFromDb(wpRaw, slug)
  const col = normalizeCategoryWizardProfileColumn(wpRaw)

  if (wpForm === 'yacht' || isYachtLikeCategory(slug)) return 'yacht'

  if (
    wpForm === 'transport_helicopter' ||
    wpForm === 'transport' ||
    (isTransportListingCategory(slug) && !isYachtLikeCategory(slug))
  ) {
    return 'transport'
  }

  if (wpForm === 'tour' || isTourListingCategory(slug)) return 'tour'

  if (col === 'nanny' || col === 'chef' || col === 'massage' || col === 'service_generic') {
    return 'compact'
  }

  if (wpForm === 'stay' || showsPropertyInteriorSpecs(slug)) return 'housing'

  return 'compact'
}

/**
 * Спальни: колонки листинга (lite SELECT) или metadata (fallback).
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardBedrooms(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const n = Number(listing.bedrooms ?? listing.bedrooms_count ?? meta.bedrooms ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardBathrooms(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const n = Number(listing.bathrooms ?? listing.bathrooms_count ?? meta.bathrooms ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardCabins(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const raw = meta.cabins ?? meta.cabins_count ?? ''
  const n = parseInt(String(raw).replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardEngineCc(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const n = parseInt(String(meta.engine_cc ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {Record<string, unknown>} [metadata]
 * @param {string} [language]
 * @returns {string}
 */
export function formatListingTransmissionLabel(metadata, language = 'en') {
  if (!metadata || typeof metadata !== 'object') return ''
  const raw = metadata.transmission ?? metadata.gearbox ?? ''
  const t = String(raw).toLowerCase().trim()
  if (!t || t === 'unset') return ''
  if (t === 'automatic' || t.includes('auto')) return getUIText('transmissionAuto', language)
  if (t === 'manual' || t.includes('manual')) return getUIText('transmissionManual', language)
  if (t === 'cvt' || t.includes('cvt')) return getUIText('transmissionCvt', language)
  return String(raw).trim()
}

/**
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardDurationHours(listing) {
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const n = parseInt(String(meta.duration_hours ?? meta.tour_hours ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Гости / места — уже SSOT в listing-guest-capacity.
 * @param {Record<string, unknown>} listing
 * @returns {number}
 */
export function getListingCardGuestCapacity(listing) {
  return resolveListingGuestCapacity(listing)
}

/** Выше 80% надёжности (или > 0.8 в норме 0–1). Stage 87.0 */
const TRUSTVerified_RELIABILITY_EXceedsPct = 80

function metadataVerificationFlagTruthy(meta, key) {
  const v = meta[key]
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'
}

/**
 * Stage 87.0 — компактный бейдж «Verified» на карточках каталога: верификация в metadata или высокая надёжность.
 * Ключи metadata: **`verified_partner`**, **`partner_trust_verified`**, **`trust_verified`**.
 *
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {boolean}
 */
export function listingQualifiesForTrustVerifiedMiniBadge(listing) {
  if (!listing || typeof listing !== 'object') return false
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  if (
    metadataVerificationFlagTruthy(meta, 'verified_partner') ||
    metadataVerificationFlagTruthy(meta, 'partner_trust_verified') ||
    metadataVerificationFlagTruthy(meta, 'trust_verified')
  ) {
    return true
  }
  const pt = listing.partnerTrust
  if (!pt || typeof pt !== 'object') return false
  const r = pt.reliabilityPercent
  if (r == null || !Number.isFinite(Number(r))) return false
  const n = Number(r)
  if (n > 0 && n <= 1) return n > 0.8
  return n > TRUSTVerified_RELIABILITY_EXceedsPct
}
