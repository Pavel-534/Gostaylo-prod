/**
 * Stage 170.9+ — guest «Good to know» / stay policies from listing metadata.
 * SSOT: only housing vertical (`resolveListingCardSpecVertical`); times from host metadata.
 */

import { resolveListingCardSpecVertical } from '@/lib/listing-card-spec-profile'
import { getCategoryName } from '@/lib/translations'

function pickString(...candidates) {
  for (const raw of candidates) {
    if (raw == null) continue
    const t = String(raw).trim()
    if (t) return t
  }
  return null
}

function parseHouseRules(raw) {
  const text = pickString(raw)
  if (!text) return []
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatPropertySubtype(raw, language = 'ru') {
  const text = pickString(raw)
  if (!text) return null
  const slug = text.toLowerCase().replace(/\s+/g, '_')
  return getCategoryName(slug, language, text)
}

/**
 * @param {Record<string, unknown>|null|undefined} listing
 * @param {string} [language]
 */
export function getListingGoodToKnow(listing, language = 'ru') {
  const vertical = resolveListingCardSpecVertical(listing)
  const isStayVertical = vertical === 'housing'

  const empty = {
    isStayVertical,
    checkInTime: null,
    checkOutTime: null,
    houseRules: [],
    propertyType: null,
    hasTiles: false,
    hasHouseRules: false,
    hasContent: false,
  }

  if (!isStayVertical) return empty

  const meta =
    listing?.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? listing.metadata
      : {}

  const checkInTime = pickString(meta.check_in_time, meta.checkInTime)
  const checkOutTime = pickString(meta.check_out_time, meta.checkOutTime)
  const houseRules = parseHouseRules(meta.house_rules ?? meta.houseRules)
  const propertyType = formatPropertySubtype(
    pickString(meta.subcategory, meta.sub_category, meta.property_subtype, meta.property_type),
    language,
  )

  const hasTiles = Boolean(checkInTime || checkOutTime || propertyType)
  const hasHouseRules = houseRules.length > 0

  return {
    isStayVertical,
    checkInTime,
    checkOutTime,
    houseRules,
    propertyType,
    hasTiles,
    hasHouseRules,
    hasContent: hasTiles || hasHouseRules,
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} listing
 */
export function resolveListingCancellationPolicy(listing) {
  return (
    listing?.cancellationPolicy ??
    listing?.cancellation_policy ??
    listing?.metadata?.cancellationPolicy ??
    listing?.metadata?.cancellation_policy ??
    null
  )
}

/**
 * @param {Record<string, unknown>|null|undefined} listing
 */
export function listingHasGuestPolicies(listing) {
  const info = getListingGoodToKnow(listing)
  const policy = resolveListingCancellationPolicy(listing)
  if (info.isStayVertical) return info.hasContent || Boolean(policy)
  return Boolean(policy)
}
