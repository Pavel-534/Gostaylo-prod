/**
 * Stage 199.2 / 200.28 — Listing Health Score (partner editor, pure).
 * Stay: photos · description · amenities · house/check-in rules.
 * Transport/yacht: photos · description · vehicle features · pickup instructions.
 * Tour/service: photos · description · key details (no housing rules).
 */

import { resolveWizardFormProfileWithLegacyName } from '@/lib/config/category-form-schema.js'

export const LISTING_HEALTH_MIN_PHOTOS = 1
/** Soft quality tip (not a publish gate). Was 150. */
export const LISTING_HEALTH_MIN_DESCRIPTION = 80
export const LISTING_HEALTH_MIN_AMENITIES = 3
export const LISTING_HEALTH_MIN_HOUSE_RULES = 20
export const LISTING_HEALTH_MIN_CHECK_IN_INSTRUCTIONS = 40
export const LISTING_HEALTH_MIN_PICKUP_INSTRUCTIONS = 20

export const LISTING_HEALTH_WEIGHT_PHOTOS = 30
export const LISTING_HEALTH_WEIGHT_DESCRIPTION = 20
export const LISTING_HEALTH_WEIGHT_AMENITIES = 20
export const LISTING_HEALTH_WEIGHT_RULES = 30

/**
 * @param {unknown} metadata
 */
function metaObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

/**
 * @param {string | null | undefined} wizardProfile
 * @param {string} [categorySlug]
 * @param {string} [categoryName]
 * @returns {'stay' | 'transport' | 'tour' | 'service'}
 */
export function resolveListingHealthMode(wizardProfile, categorySlug = '', categoryName = '') {
  const profile = resolveWizardFormProfileWithLegacyName(categorySlug, categoryName, wizardProfile)
  if (profile === 'stay' || profile === 'none') return 'stay'
  if (profile === 'transport' || profile === 'transport_helicopter' || profile === 'yacht') {
    return 'transport'
  }
  if (profile === 'tour') return 'tour'
  return 'service'
}

/**
 * @param {unknown} metadata
 * @returns {string[]}
 */
export function resolveListingAmenitySlugs(metadata) {
  const meta = metaObject(metadata)
  const raw = meta.amenities
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || '').trim()).filter(Boolean)
}

/**
 * @param {unknown} metadata
 */
export function listingHasHouseAndCheckInRules(metadata) {
  const meta = metaObject(metadata)
  const checkInTime = String(meta.check_in_time || meta.checkInTime || '').trim()
  const checkOutTime = String(meta.check_out_time || meta.checkOutTime || '').trim()
  const houseRules = String(meta.house_rules || meta.houseRules || '').trim()
  const checkInInstructions = String(meta.check_in_instructions || meta.checkInInstructions || '').trim()
  const checkInPhotos = Array.isArray(meta.check_in_photos)
    ? meta.check_in_photos.filter((u) => typeof u === 'string' && u.trim())
    : []
  const flightRules = String(meta.flight_rules || '').trim()
  const genericRules = String(meta.rules || '').trim()

  const hasCheckIn =
    Boolean(checkInTime) ||
    checkInInstructions.length >= LISTING_HEALTH_MIN_CHECK_IN_INSTRUCTIONS ||
    checkInPhotos.length > 0

  const hasHouseOrExit =
    houseRules.length >= LISTING_HEALTH_MIN_HOUSE_RULES ||
    Boolean(checkOutTime) ||
    flightRules.length >= LISTING_HEALTH_MIN_HOUSE_RULES ||
    genericRules.length >= LISTING_HEALTH_MIN_HOUSE_RULES

  return hasCheckIn && hasHouseOrExit
}

/**
 * Pickup / meeting instructions for transport & non-stay verticals (no «house rules»).
 * @param {unknown} metadata
 */
export function listingHasPickupOrGuestInstructions(metadata) {
  const meta = metaObject(metadata)
  const checkInInstructions = String(meta.check_in_instructions || meta.checkInInstructions || '').trim()
  const checkInPhotos = Array.isArray(meta.check_in_photos)
    ? meta.check_in_photos.filter((u) => typeof u === 'string' && u.trim())
    : []
  const flightRules = String(meta.flight_rules || '').trim()
  const genericRules = String(meta.rules || '').trim()
  return (
    checkInInstructions.length >= LISTING_HEALTH_MIN_PICKUP_INSTRUCTIONS ||
    checkInPhotos.length > 0 ||
    flightRules.length >= LISTING_HEALTH_MIN_PICKUP_INSTRUCTIONS ||
    genericRules.length >= LISTING_HEALTH_MIN_PICKUP_INSTRUCTIONS
  )
}

/**
 * @param {{
 *   title?: string
 *   description?: string
 *   images?: string[] | null
 *   metadata?: object | null
 *   wizardProfile?: string | null
 *   categorySlug?: string
 *   categoryName?: string
 * }} input
 */
export function calculateListingHealthScore(input = {}) {
  const mode = resolveListingHealthMode(
    input.wizardProfile,
    input.categorySlug || '',
    input.categoryName || '',
  )
  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  const description = String(input.description || '').trim()
  const amenities = resolveListingAmenitySlugs(input.metadata)
  const photosOk = images.length >= LISTING_HEALTH_MIN_PHOTOS
  const descriptionOk = description.length >= LISTING_HEALTH_MIN_DESCRIPTION
  const photosNeeded = Math.max(0, LISTING_HEALTH_MIN_PHOTOS - images.length)

  /** @type {Array<{ key: string, labelKey: string, weight: number, ok: boolean, earned: number, current?: number, min?: number, tipKey: string, tipParams?: Record<string, number> }>} */
  let parts

  if (mode === 'stay') {
    const amenitiesOk = amenities.length >= LISTING_HEALTH_MIN_AMENITIES
    const rulesOk = listingHasHouseAndCheckInRules(input.metadata)
    parts = [
      {
        key: 'photos',
        labelKey: 'listingHealth_part_photos',
        weight: LISTING_HEALTH_WEIGHT_PHOTOS,
        ok: photosOk,
        earned: photosOk ? LISTING_HEALTH_WEIGHT_PHOTOS : 0,
        current: images.length,
        min: LISTING_HEALTH_MIN_PHOTOS,
        tipKey: 'listingHealth_tipPhotos',
        tipParams: { count: photosNeeded, min: LISTING_HEALTH_MIN_PHOTOS, current: images.length },
      },
      {
        key: 'description',
        labelKey: 'listingHealth_part_description',
        weight: LISTING_HEALTH_WEIGHT_DESCRIPTION,
        ok: descriptionOk,
        earned: descriptionOk ? LISTING_HEALTH_WEIGHT_DESCRIPTION : 0,
        current: description.length,
        min: LISTING_HEALTH_MIN_DESCRIPTION,
        tipKey: 'listingHealth_tipDescription',
        tipParams: {
          min: LISTING_HEALTH_MIN_DESCRIPTION,
          current: description.length,
          need: Math.max(0, LISTING_HEALTH_MIN_DESCRIPTION - description.length),
        },
      },
      {
        key: 'amenities',
        labelKey: 'listingHealth_part_amenities',
        weight: LISTING_HEALTH_WEIGHT_AMENITIES,
        ok: amenitiesOk,
        earned: amenitiesOk ? LISTING_HEALTH_WEIGHT_AMENITIES : 0,
        current: amenities.length,
        min: LISTING_HEALTH_MIN_AMENITIES,
        tipKey: 'listingHealth_tipAmenities',
        tipParams: {
          min: LISTING_HEALTH_MIN_AMENITIES,
          current: amenities.length,
          need: Math.max(0, LISTING_HEALTH_MIN_AMENITIES - amenities.length),
        },
      },
      {
        key: 'rules',
        labelKey: 'listingHealth_part_rules',
        weight: LISTING_HEALTH_WEIGHT_RULES,
        ok: rulesOk,
        earned: rulesOk ? LISTING_HEALTH_WEIGHT_RULES : 0,
        tipKey: 'listingHealth_tipRules',
      },
    ]
  } else if (mode === 'transport') {
    const featuresOk = amenities.length >= LISTING_HEALTH_MIN_AMENITIES
    const pickupOk = listingHasPickupOrGuestInstructions(input.metadata)
    const wPhotos = 40
    const wDesc = 30
    const wFeat = 15
    const wPickup = 15
    parts = [
      {
        key: 'photos',
        labelKey: 'listingHealth_part_photos',
        weight: wPhotos,
        ok: photosOk,
        earned: photosOk ? wPhotos : 0,
        current: images.length,
        min: LISTING_HEALTH_MIN_PHOTOS,
        tipKey: 'listingHealth_tipPhotos',
        tipParams: { count: photosNeeded, min: LISTING_HEALTH_MIN_PHOTOS, current: images.length },
      },
      {
        key: 'description',
        labelKey: 'listingHealth_part_description',
        weight: wDesc,
        ok: descriptionOk,
        earned: descriptionOk ? wDesc : 0,
        current: description.length,
        min: LISTING_HEALTH_MIN_DESCRIPTION,
        tipKey: 'listingHealth_tipDescription',
        tipParams: {
          min: LISTING_HEALTH_MIN_DESCRIPTION,
          current: description.length,
          need: Math.max(0, LISTING_HEALTH_MIN_DESCRIPTION - description.length),
        },
      },
      {
        key: 'features',
        labelKey: 'listingHealth_part_vehicleFeatures',
        weight: wFeat,
        ok: featuresOk,
        earned: featuresOk ? wFeat : 0,
        current: amenities.length,
        min: LISTING_HEALTH_MIN_AMENITIES,
        tipKey: 'listingHealth_tipVehicleFeatures',
        tipParams: {
          min: LISTING_HEALTH_MIN_AMENITIES,
          current: amenities.length,
          need: Math.max(0, LISTING_HEALTH_MIN_AMENITIES - amenities.length),
        },
      },
      {
        key: 'pickup',
        labelKey: 'listingHealth_part_pickup',
        weight: wPickup,
        ok: pickupOk,
        earned: pickupOk ? wPickup : 0,
        tipKey: 'listingHealth_tipPickup',
      },
    ]
  } else {
    // tour / service — no housing amenities/rules
    const detailsOk = listingHasPickupOrGuestInstructions(input.metadata) || amenities.length > 0
    const wPhotos = 45
    const wDesc = 35
    const wDetails = 20
    parts = [
      {
        key: 'photos',
        labelKey: 'listingHealth_part_photos',
        weight: wPhotos,
        ok: photosOk,
        earned: photosOk ? wPhotos : 0,
        current: images.length,
        min: LISTING_HEALTH_MIN_PHOTOS,
        tipKey: 'listingHealth_tipPhotos',
        tipParams: { count: photosNeeded, min: LISTING_HEALTH_MIN_PHOTOS, current: images.length },
      },
      {
        key: 'description',
        labelKey: 'listingHealth_part_description',
        weight: wDesc,
        ok: descriptionOk,
        earned: descriptionOk ? wDesc : 0,
        current: description.length,
        min: LISTING_HEALTH_MIN_DESCRIPTION,
        tipKey: 'listingHealth_tipDescription',
        tipParams: {
          min: LISTING_HEALTH_MIN_DESCRIPTION,
          current: description.length,
          need: Math.max(0, LISTING_HEALTH_MIN_DESCRIPTION - description.length),
        },
      },
      {
        key: 'details',
        labelKey: mode === 'tour' ? 'listingHealth_part_tourDetails' : 'listingHealth_part_serviceDetails',
        weight: wDetails,
        ok: detailsOk,
        earned: detailsOk ? wDetails : 0,
        tipKey: mode === 'tour' ? 'listingHealth_tipTourDetails' : 'listingHealth_tipServiceDetails',
      },
    ]
  }

  const score = parts.reduce((sum, p) => sum + p.earned, 0)
  const tips = parts
    .filter((p) => !p.ok)
    .map((p) => ({
      key: p.key,
      tipKey: p.tipKey,
      tipParams: p.tipParams,
    }))

  return {
    score,
    maxScore: 100,
    mode,
    parts,
    tips,
  }
}

/**
 * @param {object} formData — wizard form
 * @param {{ wizardProfile?: string | null, categorySlug?: string, categoryName?: string }} [ctx]
 */
export function listingHealthInputFromWizardForm(formData, ctx = {}) {
  return {
    title: formData?.title,
    description: formData?.description,
    images: formData?.images,
    metadata: formData?.metadata,
    wizardProfile: ctx.wizardProfile ?? formData?.wizardProfile ?? null,
    categorySlug: ctx.categorySlug ?? formData?.categorySlug ?? '',
    categoryName: ctx.categoryName ?? formData?.categoryName ?? '',
  }
}

/**
 * @param {object} listing — partner list/API row
 */
export function listingHealthInputFromPartnerListing(listing) {
  const cat = listing?.category ?? listing?.categories
  const catObj = Array.isArray(cat) ? cat[0] : cat && typeof cat === 'object' ? cat : null
  return {
    title: listing?.title,
    description: listing?.description,
    images: listing?.images,
    metadata: listing?.metadata,
    wizardProfile: catObj?.wizard_profile ?? catObj?.wizardProfile ?? listing?.wizard_profile ?? null,
    categorySlug: catObj?.slug ?? listing?.category_slug ?? '',
    categoryName: catObj?.name ?? '',
  }
}
