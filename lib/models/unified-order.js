/**
 * Stage 200 — Unified order shape for guest/partner order lists.
 * UI type: home | transport | activity | service
 * Canonical serviceType: stay | transport | service | tour (listing wizard SSOT)
 */

import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type.js'

/** @typedef {'home' | 'transport' | 'activity' | 'service'} UnifiedOrderUiType */
/** @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType */

function normalizeCategorySlug(input) {
  return String(input || '').trim().toLowerCase()
}

/**
 * @param {object|null|undefined} booking
 * @returns {{ slug: string, wizardProfile: string|null }}
 */
export function resolveBookingCategoryContext(booking) {
  const listing = booking?.listings || booking?.listing || {}
  const listingMeta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const bookingMeta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}

  const slugCandidates = [
    listing?.category_slug,
    listing?.category?.slug,
    listingMeta?.category_slug,
    listingMeta?.categorySlug,
    bookingMeta?.listing_category_slug,
    bookingMeta?.listingCategorySlug,
    bookingMeta?.category_slug,
  ]
    .map(normalizeCategorySlug)
    .filter(Boolean)

  const wizardProfile =
    listing?.wizard_profile ||
    listing?.category?.wizard_profile ||
    listingMeta?.wizard_profile ||
    bookingMeta?.wizard_profile ||
    null

  return {
    slug: slugCandidates[0] || '',
    wizardProfile: wizardProfile != null ? String(wizardProfile) : null,
  }
}

/**
 * Map listing service type → order list UI type (filters / icons).
 * @param {ListingServiceType} serviceType
 * @returns {UnifiedOrderUiType}
 */
export function mapServiceTypeToOrderUiType(serviceType) {
  if (serviceType === 'transport') return 'transport'
  if (serviceType === 'tour') return 'activity'
  if (serviceType === 'service') return 'service'
  return 'home'
}

/**
 * @param {object|null|undefined} booking
 * @returns {{ uiType: UnifiedOrderUiType, serviceType: ListingServiceType, categorySlug: string }}
 */
export function resolveUnifiedOrderType(booking) {
  const { slug, wizardProfile } = resolveBookingCategoryContext(booking)
  const serviceType = inferListingServiceTypeFromCategorySlug(slug, wizardProfile)
  return {
    uiType: mapServiceTypeToOrderUiType(serviceType),
    serviceType,
    categorySlug: slug,
  }
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * @param {object|null|undefined} booking
 */
export function toUnifiedOrder(booking) {
  const currency = String(booking?.currency || 'THB').toUpperCase()
  const pricePaid = Number(booking?.price_paid)
  const priceThb = Number(booking?.price_thb)
  const totalPrice = currency === 'THB' || !Number.isFinite(pricePaid) ? priceThb : pricePaid

  const metadata = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const resolved = resolveUnifiedOrderType(booking)

  return {
    id: String(booking?.id || ''),
    type: resolved.uiType,
    serviceType: resolved.serviceType,
    categorySlug: resolved.categorySlug || null,
    status: String(booking?.status || ''),
    total_price: Number.isFinite(totalPrice) ? totalPrice : 0,
    currency,
    dates: {
      check_in: toIsoOrNull(booking?.check_in),
      check_out: toIsoOrNull(booking?.check_out),
      created_at: toIsoOrNull(booking?.created_at),
      updated_at: toIsoOrNull(booking?.updated_at),
    },
    metadata,
  }
}
