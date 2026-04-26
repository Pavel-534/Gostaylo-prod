/**
 * Stage 63.0 — PDP: scalar metadata keys surfaced automatically (no per-field JSX branches).
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
 * Keys already rendered in `GuestListingTitleBlock` (avoid duplicate chips).
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
  'max_guests',
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
 * UI label key for `getUIText` — add `listingInfo_meta_<key>` per locale when you want a proper name.
 * @param {string} key — metadata snake_case key
 */
export function listingMetadataSpecUiKey(key) {
  return `listingInfo_meta_${key}`
}
