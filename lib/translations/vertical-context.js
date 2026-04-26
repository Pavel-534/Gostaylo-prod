/**
 * Stage 62.0 — category slug → vertical UI overlay (`verticalHelicopters_${baseKey}` in `getUIText`).
 * Extend `HELICOPTER_CATEGORY_SLUGS` when DB/registry adds aliases.
 */
export const HELICOPTER_CATEGORY_SLUGS = new Set(['helicopter', 'helicopters'])

/**
 * @param {string} baseKey — canonical UI key (e.g. `bookNow`)
 * @param {string | null | undefined} listingCategorySlug — `listing.category_slug` or equivalent
 * @returns {string | null} alternate merged key, or null to use base only
 */
export function resolveVerticalOverrideRawKey(baseKey, listingCategorySlug) {
  const slug = String(listingCategorySlug || '').trim().toLowerCase()
  if (!slug || !baseKey) return null
  if (HELICOPTER_CATEGORY_SLUGS.has(slug)) {
    return `verticalHelicopters_${baseKey}`
  }
  return null
}
