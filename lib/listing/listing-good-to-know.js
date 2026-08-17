/**
 * Stage 170.9+ — guest «Good to know» / stay policies from listing metadata.
 * SSOT: only housing vertical (`resolveListingCardSpecVertical`); times from host metadata.
 */

import { resolveListingCardSpecVertical } from '@/lib/listing-card-spec-profile'
import { getCategoryName } from '@/lib/translations'
import { resolveListingHousingPropertyTypeSlug } from '@/lib/listing/housing-property-type'

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

function formatHousingPropertyType(listing, language = 'ru') {
  const slug = resolveListingHousingPropertyTypeSlug(listing)
  if (!slug) return null
  return getCategoryName(slug, language)
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
    earlyCheckInOnRequest: false,
    lateCheckOutOnRequest: false,
    houseRules: [],
    propertyType: null,
    hasTiles: false,
    hasFlexibility: false,
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
  const earlyCheckInOnRequest =
    meta.early_check_in_on_request === true || meta.earlyCheckInOnRequest === true
  const lateCheckOutOnRequest =
    meta.late_check_out_on_request === true || meta.lateCheckOutOnRequest === true
  const houseRules = parseHouseRules(meta.house_rules ?? meta.houseRules)
  const propertyType = formatHousingPropertyType(listing, language)

  const hasTiles = Boolean(checkInTime || checkOutTime || propertyType)
  const hasFlexibility = earlyCheckInOnRequest || lateCheckOutOnRequest
  const hasHouseRules = houseRules.length > 0

  return {
    isStayVertical,
    checkInTime,
    checkOutTime,
    earlyCheckInOnRequest,
    lateCheckOutOnRequest,
    houseRules,
    propertyType,
    hasTiles,
    hasFlexibility,
    hasHouseRules,
    hasContent: hasTiles || hasHouseRules || hasFlexibility,
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
