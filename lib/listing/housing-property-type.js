/**
 * Stage 201.92 — housing property type SSOT (Airbnb-style: category is the type).
 *
 * Guest PDP / cards must not show a leftover `metadata.property_type = Villa`
 * when the listing category is apartment / condo / house / …
 */

export const HOUSING_PROPERTY_TYPE_SLUGS = new Set([
  'villa',
  'apartment',
  'house',
  'condo',
  'studio',
  'penthouse',
])

const HOUSING_PROPERTY_TYPE_ALIASES = {
  apartments: 'apartment',
  villas: 'villa',
  houses: 'house',
  condos: 'condo',
  studios: 'studio',
  penthouses: 'penthouse',
}

/** Parent catalog rows — subtype may live in metadata. */
export const GENERIC_HOUSING_CATEGORY_SLUGS = new Set(['property', 'accommodation'])

function inferHousingTypeFromLooseCategory(slug, name = '') {
  const blob = `${slug} ${name}`.toLowerCase()
  if (/(apart|квартир|апарт|flat)/.test(blob)) return 'apartment'
  if (/(condo|кондо)/.test(blob)) return 'condo'
  if (/(studio|студи)/.test(blob)) return 'studio'
  if (/(penthouse|пентхаус)/.test(blob)) return 'penthouse'
  if (/(villa|вилл)/.test(blob)) return 'villa'
  if (/(houses?\b|дом\b)/.test(blob)) return 'house'
  return null
}

/**
 * @param {unknown} raw
 * @returns {string | null} canonical slug (`apartment`, `villa`, …)
 */
export function canonicalizeHousingPropertyTypeSlug(raw) {
  if (raw == null) return null
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!s || s === 'unset' || s === 'default' || s === 'property' || s === 'accommodation') {
    return null
  }
  const aliased = HOUSING_PROPERTY_TYPE_ALIASES[s] || s
  return HOUSING_PROPERTY_TYPE_SLUGS.has(aliased) ? aliased : null
}

/**
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {string}
 */
export function listingCategorySlugOf(listing) {
  const cat = listing?.category ?? listing?.categories
  const catObj = Array.isArray(cat) ? cat[0] : cat && typeof cat === 'object' ? cat : null
  return String(
    listing?.categorySlug || listing?.category_slug || catObj?.slug || '',
  ).toLowerCase()
}

/**
 * Guest-facing housing type: concrete category wins over stale metadata.
 * @param {Record<string, unknown> | null | undefined} listing
 * @returns {string | null}
 */
export function resolveListingHousingPropertyTypeSlug(listing) {
  const cat = listingCategorySlugOf(listing)
  const fromCategory = canonicalizeHousingPropertyTypeSlug(cat)
  if (fromCategory) return fromCategory

  const catName = String(
    listing?.categoryName || listing?.category?.name || listing?.categories?.name || '',
  )
  const fromLoose = inferHousingTypeFromLooseCategory(cat, catName)
  if (fromLoose) return fromLoose

  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}
  const fromMeta = canonicalizeHousingPropertyTypeSlug(
    meta.property_type ?? meta.property_subtype ?? meta.subcategory ?? meta.sub_category,
  )
  if (fromMeta && (!cat || GENERIC_HOUSING_CATEGORY_SLUGS.has(cat))) return fromMeta
  return null
}

/**
 * When the partner picks villa/apartment/…, keep metadata in lockstep (search filters).
 * @param {Record<string, unknown> | null | undefined} metadata
 * @param {string} categorySlug
 * @returns {Record<string, unknown>}
 */
export function applyHousingPropertyTypeFromCategorySlug(metadata, categorySlug) {
  const out = { ...(metadata && typeof metadata === 'object' ? metadata : {}) }
  const type = canonicalizeHousingPropertyTypeSlug(categorySlug)
  if (type) {
    out.property_type = type
    delete out.subcategory
    delete out.sub_category
    delete out.property_subtype
  }
  return out
}
