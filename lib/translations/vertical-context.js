/**
 * Stage 62.0 / 155.3 — category slug → vertical UI overlay (`verticalTransport_${baseKey}` in `getUIText`).
 * Extend `HELICOPTER_CATEGORY_SLUGS` when DB/registry adds aliases.
 */
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'

export const HELICOPTER_CATEGORY_SLUGS = new Set(['helicopter', 'helicopters'])

const SERVICE_TYPE_PREFIX = {
  transport: 'verticalTransport',
  tour: 'verticalService',
  service: 'verticalService',
}

/**
 * @param {string} baseKey — canonical UI key (e.g. `bookNow`)
 * @param {string | null | undefined} listingCategorySlug — `listing.category_slug` or equivalent
 * @param {string | null | undefined} [wizardProfile] — `categories.wizard_profile`
 * @returns {string | null} alternate merged key, or null to use base only
 */
export function resolveVerticalOverrideRawKey(baseKey, listingCategorySlug, wizardProfile) {
  const slug = String(listingCategorySlug || '').trim().toLowerCase()
  if (!slug || !baseKey) return null
  if (HELICOPTER_CATEGORY_SLUGS.has(slug)) {
    return `verticalHelicopters_${baseKey}`
  }
  const serviceType = inferListingServiceTypeFromCategorySlug(slug, wizardProfile)
  const prefix = SERVICE_TYPE_PREFIX[serviceType]
  if (prefix) return `${prefix}_${baseKey}`
  return null
}
