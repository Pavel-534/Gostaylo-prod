/**
 * Stage 63.0 — legacy auto-row helper (catalog experiments). PDP uses `ListingCardSpecsRow` only.
 * SSOT: keys listed here are excluded from auto-row (handled elsewhere or internal).
 */

/** @type {Set<string>} */
const METADATA_KEYS_SUPPRESSED = new Set([
  'seo',
  'seo_title',
  'seo_description',
  'timezone',
  'seasonal_pricing',
  'discounts',
  'rent_entire_unit',
  'category_slug',
  'categorySlug',
  'check_in_instructions',
  'property_type',
  'group_size_min',
  'group_size_max',
])

/**
 * Keys already shown в шапке PDP / карточках (`GuestListingTitleBlock`, `ListingCardSpecsRow`) —
 * не дублировать в авто-ряду спецификаций.
 * @type {Set<string>}
 */
const METADATA_KEYS_RENDERED_IN_TITLE = new Set([
  'bedrooms',
  'bathrooms',
  'area',
  'cabins',
  'cabins_count',
  'duration_hours',
  'tour_hours',
  'vehicle_year',
  'model_year',
  'year',
  'engine_cc',
  /** Показываются в `ListingCardSpecsRow` на карточках — не дублировать в авто-блоке PDP */
  'transmission',
  'gearbox',
  'fuel_type',
  'fuelType',
  'max_guests',
  'maxGuests',
  'passengers',
  'seats',
  'city',
  'squareMeters',
  'square_meters',
])

/** Guest-facing or dedicated UI — never raw auto-row. @type {Set<string>} */
const METADATA_KEYS_DEDICATED_UI = new Set([
  'cancellationPolicy',
  'cancellation_policy',
  'checkInTime',
  'check_in_time',
  'checkOutTime',
  'check_out_time',
  'houseRules',
  'house_rules',
  'subcategory',
  'sub_category',
  'amenities',
])

function formatScalarForSpecDisplay(value) {
  if (value == null) return null
  if (typeof value === 'boolean') return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length ? t : null
  }
  return null
}

/**
 * @param {Record<string, unknown>|null|undefined} metadata
 * @returns {{ key: string, value: string }[]}
 */
export function getPublicListingMetadataSpecEntries(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  /** @type {{ key: string, value: string }[]} */
  const out = []
  for (const [rawKey, rawVal] of Object.entries(metadata)) {
    const key = String(rawKey)
    if (METADATA_KEYS_SUPPRESSED.has(key)) continue
    if (METADATA_KEYS_RENDERED_IN_TITLE.has(key)) continue
    if (METADATA_KEYS_DEDICATED_UI.has(key)) continue
    if (key.endsWith('_translations')) continue
    if (key.startsWith('_')) continue
    const disp = formatScalarForSpecDisplay(rawVal)
    if (disp == null) continue
    out.push({ key, value: disp })
  }
  out.sort((a, b) => a.key.localeCompare(b.key))
  return out
}

/**
 * UI label key for `getUIText` — add `listingInfo_meta_<snake_key>` per locale when you want a proper name.
 * @param {string} key — metadata key (camelCase or snake_case)
 */
export function listingMetadataSpecUiKey(key) {
  const snake = String(key)
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
  return `listingInfo_meta_${snake}`
}
