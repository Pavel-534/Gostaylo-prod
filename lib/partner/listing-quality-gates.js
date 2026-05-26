/**
 * Stage 116.0–116.2 — SSOT quality gates для publish листинга (wizard + partner API).
 */

import {
  resolveWizardFormProfileWithLegacyName,
} from '@/lib/config/category-form-schema.js'

export const LISTING_QUALITY_MIN_PHOTOS = 5
export const LISTING_QUALITY_MIN_DESCRIPTION = 120
export const LISTING_QUALITY_MIN_TITLE = 3

/** @type {Record<string, string[]>} */
const PUBLISH_REQUIRED_METADATA_BY_PROFILE = {
  stay: ['bedrooms', 'bathrooms', 'max_guests'],
  transport: ['vehicle_year', 'seats'],
  transport_helicopter: ['vehicle_year', 'seats', 'passengers'],
  yacht: ['passengers'],
  tour: ['duration'],
  nanny: ['experience_years', 'languages'],
  chef: ['experience_years', 'cuisine_types'],
  massage: ['experience_years'],
  service_generic: ['experience_years'],
  none: [],
}

/** Жильё и транспорт — обязательные координаты (Stage 116.1). */
const GEO_REQUIRED_PROFILES = new Set(['stay', 'transport', 'transport_helicopter'])

/**
 * @param {string | null | undefined} wizardProfile
 * @param {string} categorySlug
 * @param {string} [categoryName]
 */
export function listingProfileRequiresGeoCoordinates(wizardProfile, categorySlug, categoryName = '') {
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryName, wizardProfile)
  return GEO_REQUIRED_PROFILES.has(profile)
}

function isMetadataFieldFilled(metadata, key) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const raw = meta[key]
  if (raw == null) return false
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0
  if (typeof raw === 'boolean') return true
  if (Array.isArray(raw)) return raw.length > 0
  const s = String(raw).trim()
  if (!s || s === 'unset') return false
  return true
}

function hasValidCoordinates(latitude, longitude) {
  const lat = latitude == null || latitude === '' ? NaN : Number(latitude)
  const lng = longitude == null || longitude === '' ? NaN : Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/**
 * @param {object} input
 * @param {string} [input.title]
 * @param {string} [input.description]
 * @param {string[]|null} [input.images]
 * @param {number|string|null} [input.latitude]
 * @param {number|string|null} [input.longitude]
 * @param {string} [input.district]
 * @param {object} [input.metadata]
 * @param {string} [input.categorySlug]
 * @param {string} [input.categoryName]
 * @param {string|null} [input.wizardProfile]
 * @param {number|string|null} [input.basePriceThb]
 * @returns {{ ok: boolean, errors: string[], codes: string[] }}
 */
export function validateListingPublishQuality(input = {}) {
  const errors = []
  const codes = []

  const title = String(input.title || '').trim()
  if (title.length < LISTING_QUALITY_MIN_TITLE) {
    errors.push(`Title must be at least ${LISTING_QUALITY_MIN_TITLE} characters`)
    codes.push('LISTING_TITLE_TOO_SHORT')
  }

  const description = String(input.description || '').trim()
  if (description.length < LISTING_QUALITY_MIN_DESCRIPTION) {
    errors.push(`Description must be at least ${LISTING_QUALITY_MIN_DESCRIPTION} characters`)
    codes.push('LISTING_DESCRIPTION_TOO_SHORT')
  }

  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  if (images.length < LISTING_QUALITY_MIN_PHOTOS) {
    errors.push(`At least ${LISTING_QUALITY_MIN_PHOTOS} photos are required`)
    codes.push('LISTING_PHOTOS_INSUFFICIENT')
  }

  const price = parseFloat(String(input.basePriceThb ?? '').replace(',', '.'))
  if (!Number.isFinite(price) || price <= 0) {
    errors.push('Base price must be greater than 0')
    codes.push('LISTING_PRICE_INVALID')
  }

  if (!String(input.district || '').trim()) {
    errors.push('District / location label is required')
    codes.push('LISTING_DISTRICT_REQUIRED')
  }

  const categorySlug = String(input.categorySlug || '')
  const categoryName = String(input.categoryName || '')
  const wizardProfile = input.wizardProfile ?? null
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryName, wizardProfile)

  if (listingProfileRequiresGeoCoordinates(wizardProfile, categorySlug, categoryName)) {
    if (!hasValidCoordinates(input.latitude, input.longitude)) {
      errors.push('Map coordinates are required for this listing category')
      codes.push('LISTING_COORDINATES_REQUIRED')
    }
  }

  const requiredMeta = PUBLISH_REQUIRED_METADATA_BY_PROFILE[profile] || []
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  for (const key of requiredMeta) {
    if (!isMetadataFieldFilled(metadata, key)) {
      errors.push(`Missing required field: ${key}`)
      codes.push(`LISTING_METADATA_${key.toUpperCase()}_REQUIRED`)
    }
  }

  return { ok: errors.length === 0, errors, codes }
}

/**
 * Чек-лист для UI визарда (каждый пункт — pass/fail).
 * @param {Parameters<typeof validateListingPublishQuality>[0]} input
 * @returns {{ ok: boolean, items: Array<{ code: string, ok: boolean, i18nKey: string, params?: Record<string, string|number> }>, errors: string[], codes: string[] }}
 */
export function buildListingPublishQualityChecklist(input = {}) {
  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  const description = String(input.description || '').trim()
  const title = String(input.title || '').trim()
  const categorySlug = String(input.categorySlug || '')
  const categoryName = String(input.categoryName || '')
  const wizardProfile = input.wizardProfile ?? null
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryName, wizardProfile)
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const price = parseFloat(String(input.basePriceThb ?? '').replace(',', '.'))
  const needsGeo = listingProfileRequiresGeoCoordinates(wizardProfile, categorySlug, categoryName)
  const requiredMeta = PUBLISH_REQUIRED_METADATA_BY_PROFILE[profile] || []

  const items = [
    {
      code: 'LISTING_TITLE_TOO_SHORT',
      ok: title.length >= LISTING_QUALITY_MIN_TITLE,
      i18nKey: 'listingQuality_title',
      params: { min: LISTING_QUALITY_MIN_TITLE, current: title.length },
    },
    {
      code: 'LISTING_DESCRIPTION_TOO_SHORT',
      ok: description.length >= LISTING_QUALITY_MIN_DESCRIPTION,
      i18nKey: 'listingQuality_description',
      params: { min: LISTING_QUALITY_MIN_DESCRIPTION, current: description.length },
    },
    {
      code: 'LISTING_PHOTOS_INSUFFICIENT',
      ok: images.length >= LISTING_QUALITY_MIN_PHOTOS,
      i18nKey: 'listingQuality_photos',
      params: { min: LISTING_QUALITY_MIN_PHOTOS, current: images.length },
    },
    {
      code: 'LISTING_DISTRICT_REQUIRED',
      ok: Boolean(String(input.district || '').trim()),
      i18nKey: 'listingQuality_district',
    },
    {
      code: 'LISTING_PRICE_INVALID',
      ok: Number.isFinite(price) && price > 0,
      i18nKey: 'listingQuality_price',
    },
  ]

  if (needsGeo) {
    items.push({
      code: 'LISTING_COORDINATES_REQUIRED',
      ok: hasValidCoordinates(input.latitude, input.longitude),
      i18nKey: 'listingQuality_coordinates',
    })
  }

  for (const key of requiredMeta) {
    items.push({
      code: `LISTING_METADATA_${key.toUpperCase()}_REQUIRED`,
      ok: isMetadataFieldFilled(metadata, key),
      i18nKey: 'listingQuality_metadataField',
      params: { field: key },
    })
  }

  const gate = validateListingPublishQuality(input)
  return {
    ok: items.every((i) => i.ok),
    items,
    errors: gate.errors,
    codes: gate.codes,
  }
}

/**
 * @param {{ i18nKey: string, params?: Record<string, string|number> }} item
 * @param {(key: string, fb?: string) => string} t
 */
export function formatListingQualityChecklistLabel(item, t) {
  const fb = item.i18nKey === 'listingQuality_metadataField'
    ? `Fill required field: ${item.params?.field || ''}`
    : item.i18nKey
  let label = t(item.i18nKey, fb)
  if (item.params && typeof label === 'string') {
    for (const [k, v] of Object.entries(item.params)) {
      label = label.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
    }
  }
  return label
}

/**
 * Собрать input для gates из formData визарда.
 */
export function listingQualityInputFromWizardForm(formData, ctx = {}) {
  return {
    title: formData?.title,
    description: formData?.description,
    images: formData?.images,
    latitude: formData?.latitude,
    longitude: formData?.longitude,
    district: formData?.district,
    metadata: formData?.metadata,
    categorySlug: ctx.categorySlug ?? '',
    categoryName: ctx.categoryName ?? formData?.categoryName ?? '',
    wizardProfile: ctx.wizardProfile ?? null,
    basePriceThb: formData?.basePriceThb,
  }
}

/**
 * Stage 117.0 — тот же input для списка `/partner/listings` и визарда.
 * @param {object} listing — строка API или локальный state
 */
export function listingQualityInputFromPartnerListing(listing) {
  const cat = listing?.category ?? listing?.categories
  const catObj = Array.isArray(cat) ? cat[0] : cat && typeof cat === 'object' ? cat : null
  return {
    title: listing?.title,
    description: listing?.description,
    images: listing?.images,
    latitude: listing?.latitude,
    longitude: listing?.longitude,
    district: listing?.district,
    metadata: listing?.metadata,
    categorySlug: listing?.categorySlug ?? catObj?.slug ?? '',
    categoryName: listing?.categoryName ?? catObj?.name ?? '',
    wizardProfile: listing?.wizardProfile ?? catObj?.wizard_profile ?? catObj?.wizardProfile ?? null,
    basePriceThb: listing?.base_price_thb ?? listing?.basePriceThb,
  }
}

/**
 * Только metadata-поля для шага 1 визарда / publish.
 */
export function validateListingMetadataForProfile(
  metadata,
  categorySlug,
  categoryName = '',
  wizardProfile = null,
) {
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryName, wizardProfile)
  const required = PUBLISH_REQUIRED_METADATA_BY_PROFILE[profile] || []
  for (const key of required) {
    if (!isMetadataFieldFilled(metadata, key)) return false
  }
  return true
}

/** Partner application: experience narrative minimum. */
export const PARTNER_APPLICATION_MIN_EXPERIENCE = 100

/**
 * @param {{ phone?: string, experience?: string }} input
 */
export function validatePartnerApplicationQuality(input = {}) {
  const errors = []
  const codes = []

  const phone = String(input.phone || '').replace(/\D/g, '')
  if (phone.length < 8) {
    errors.push('Valid phone number is required (at least 8 digits)')
    codes.push('PARTNER_PHONE_INVALID')
  }

  const experience = String(input.experience || '').trim()
  if (experience.length < PARTNER_APPLICATION_MIN_EXPERIENCE) {
    errors.push(`Experience description must be at least ${PARTNER_APPLICATION_MIN_EXPERIENCE} characters`)
    codes.push('PARTNER_EXPERIENCE_TOO_SHORT')
  }

  return { ok: errors.length === 0, errors, codes }
}
