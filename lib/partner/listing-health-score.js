/**
 * Stage 199.2 — Listing Health Score (partner editor, pure).
 * Weights: photos 30% · description 20% · amenities 20% · house/check-in rules 30%.
 */

export const LISTING_HEALTH_MIN_PHOTOS = 5
export const LISTING_HEALTH_MIN_DESCRIPTION = 150
export const LISTING_HEALTH_MIN_AMENITIES = 3
export const LISTING_HEALTH_MIN_HOUSE_RULES = 20
export const LISTING_HEALTH_MIN_CHECK_IN_INSTRUCTIONS = 40

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
 * @param {{
 *   title?: string
 *   description?: string
 *   images?: string[] | null
 *   metadata?: object | null
 * }} input
 * @returns {{
 *   score: number
 *   maxScore: number
 *   parts: Array<{
 *     key: string
 *     weight: number
 *     ok: boolean
 *     earned: number
 *     current?: number
 *     min?: number
 *     tipKey: string
 *     tipParams?: Record<string, number>
 *   }>
 *   tips: Array<{ key: string, tipKey: string, tipParams?: Record<string, number> }>
 * }}
 */
export function calculateListingHealthScore(input = {}) {
  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  const description = String(input.description || '').trim()
  const amenities = resolveListingAmenitySlugs(input.metadata)
  const photosOk = images.length >= LISTING_HEALTH_MIN_PHOTOS
  const descriptionOk = description.length >= LISTING_HEALTH_MIN_DESCRIPTION
  const amenitiesOk = amenities.length >= LISTING_HEALTH_MIN_AMENITIES
  const rulesOk = listingHasHouseAndCheckInRules(input.metadata)

  const photosNeeded = Math.max(0, LISTING_HEALTH_MIN_PHOTOS - images.length)

  const parts = [
    {
      key: 'photos',
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
      weight: LISTING_HEALTH_WEIGHT_RULES,
      ok: rulesOk,
      earned: rulesOk ? LISTING_HEALTH_WEIGHT_RULES : 0,
      tipKey: 'listingHealth_tipRules',
    },
  ]

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
    parts,
    tips,
  }
}

/**
 * @param {object} formData — wizard form
 * @param {object} [ctx]
 */
export function listingHealthInputFromWizardForm(formData) {
  return {
    title: formData?.title,
    description: formData?.description,
    images: formData?.images,
    metadata: formData?.metadata,
  }
}

/**
 * @param {object} listing — partner list/API row
 */
export function listingHealthInputFromPartnerListing(listing) {
  return {
    title: listing?.title,
    description: listing?.description,
    images: listing?.images,
    metadata: listing?.metadata,
  }
}
