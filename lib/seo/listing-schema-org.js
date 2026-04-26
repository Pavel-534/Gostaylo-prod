/**
 * Stage 63.0 — SSOT: listing category slug → Schema.org JSON-LD shape (PDP / crawlers).
 * @see components/seo/ListingSchema.jsx
 */

import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'
import {
  lodgingStreetAddressStub,
  phuketPostalCodeForDistrict,
} from '@/lib/seo/phuket-address-stubs.js'
import { decodeTelegramText } from '@/lib/services/telegram/telegram-text.js'

function safeDescription(raw) {
  if (raw == null) return ''
  const s = String(raw)
  const decoded = decodeTelegramText(s)
  return typeof decoded === 'string' ? decoded : s
}

function categorySlugFromRow(listing) {
  const c = listing?.categories
  if (c && typeof c === 'object' && c.slug != null) return String(c.slug).toLowerCase().trim()
  return ''
}

function absoluteUrl(base, path) {
  if (!path) return null
  if (String(path).startsWith('http')) return String(path)
  const origin = base.replace(/\/$/, '')
  const p = String(path).startsWith('/') ? path : `/${path}`
  return `${origin}${p}`
}

function canonicalListingUrl(base, id) {
  return `${base.replace(/\/$/, '')}/listings/${id}/`
}

function parsePriceThb(listing) {
  const v = listing?.base_price_thb ?? listing?.basePriceThb
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function availabilityUrl(listing) {
  const ok = listing?.available !== false
  return ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

function geoBlock(listing) {
  const lat = listing?.latitude
  const lng = listing?.longitude
  const la = typeof lat === 'number' ? lat : parseFloat(lat)
  const lo = typeof lng === 'number' ? lng : parseFloat(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return undefined
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return undefined
  return {
    '@type': 'GeoCoordinates',
    latitude: la,
    longitude: lo,
  }
}

function offerBlock(listing, pageUrl, price) {
  const offer = {
    '@type': 'Offer',
    priceCurrency: 'THB',
    availability: availabilityUrl(listing),
    url: pageUrl,
  }
  if (price != null) offer.price = String(price)
  return offer
}

/**
 * @param {string} slug — categories.slug lowercased
 * @returns {'lodging'|'vehicle_product'|'motorcycle_product'|'tour_product'|'boat_product'|'helicopter_service'|'generic_product'}
 */
export function resolveListingSchemaOrgShape(slug) {
  const s = String(slug || '').toLowerCase().trim()
  if (s === 'property' || s === 'properties') return 'lodging'
  if (isYachtLikeCategory(slug)) return 'boat_product'
  if (isTourListingCategory(slug)) return 'tour_product'
  if (s === 'helicopter' || s === 'helicopters') return 'helicopter_service'
  if (s === 'bikes' || s === 'bike') return 'motorcycle_product'
  if (isTransportListingCategory(slug)) return 'vehicle_product'
  return 'generic_product'
}

/**
 * Schema.org PropertyValue nodes for rich results (engine, year, flight hours, etc.).
 * @param {Record<string, unknown>|null|undefined} metadata
 * @param {'lodging'|'vehicle_product'|'motorcycle_product'|'tour_product'|'boat_product'|'helicopter_service'|'generic_product'} shape
 * @returns {object|undefined} `{ additionalProperty: [...] }` or undefined
 */
export function buildListingSchemaTechnicalAdditions(metadata, shape) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  /** @type {{ '@type': 'PropertyValue', name: string, value: string }[]} */
  const props = []

  const pushNum = (name, raw) => {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '').replace(/\D/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) return
    props.push({ '@type': 'PropertyValue', name, value: String(n) })
  }
  const pushStr = (name, raw) => {
    const v = raw == null ? '' : String(raw).trim()
    if (!v) return
    props.push({ '@type': 'PropertyValue', name, value: v })
  }

  if (shape === 'vehicle_product' || shape === 'motorcycle_product' || shape === 'generic_product') {
    pushNum('Engine displacement (cc)', m.engine_cc)
    const y = m.vehicle_year ?? m.model_year ?? m.year
    if (y != null && String(y).trim()) {
      props.push({ '@type': 'PropertyValue', name: 'Model year', value: String(y).trim() })
    }
  }

  if (shape === 'helicopter_service') {
    pushNum('Flight hours', m.flight_hours ?? m.flightHours)
    pushStr('Aircraft type', m.aircraft_type ?? m.aircraftType)
    pushStr('Service type', 'Helicopter charter')
  }

  if (shape === 'boat_product') {
    pushNum('Cabins', m.cabins ?? m.cabins_count)
  }

  if (!props.length) return undefined
  return { additionalProperty: props }
}

/**
 * @param {object} listing
 * @param {string} baseUrl
 * @param {string|null} telephone
 * @returns {Record<string, unknown>}
 */
export function buildListingJsonLd(listing, baseUrl, telephone) {
  const slug = categorySlugFromRow(listing)
  const shape = resolveListingSchemaOrgShape(slug)
  const id = listing.id
  const pageUrl = canonicalListingUrl(baseUrl, id)
  const name = listing.title?.trim() || 'Listing'
  const description = safeDescription(listing.description).trim() || undefined
  const mainImage = absoluteUrl(baseUrl, listing.cover_image || listing.images?.[0])
  const images = Array.isArray(listing.images)
    ? listing.images.map((u) => absoluteUrl(baseUrl, u)).filter(Boolean)
    : []
  const image = mainImage
    ? images.length > 1
      ? [mainImage, ...images.filter((u) => u !== mainImage)]
      : mainImage
    : undefined

  const price = parsePriceThb(listing)
  const geo = geoBlock(listing)
  const district = listing.district?.trim()
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const tech = buildListingSchemaTechnicalAdditions(meta, shape)

  const base = {
    '@context': 'https://schema.org',
    name,
    ...(description && { description }),
    ...(image && { image }),
  }

  if (shape === 'lodging') {
    const priceRange = price != null ? `฿${Math.round(price)}+` : '฿฿'
    const locality = district || 'Phuket'
    const postalCode = phuketPostalCodeForDistrict(district)
    const streetAddress = lodgingStreetAddressStub(listing)
    return {
      ...base,
      '@type': 'LodgingBusiness',
      ...(telephone ? { telephone } : {}),
      priceRange,
      address: {
        '@type': 'PostalAddress',
        streetAddress,
        addressLocality: locality,
        addressRegion: 'Phuket',
        postalCode,
        addressCountry: 'TH',
      },
      ...(geo && { geo }),
      offers: offerBlock(listing, pageUrl, price),
    }
  }

  if (shape === 'helicopter_service') {
    return {
      ...base,
      '@type': 'Service',
      serviceType: 'Helicopter charter',
      category: 'Air charter',
      offers: offerBlock(listing, pageUrl, price),
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'tour_product') {
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/TouristTrip',
      category: 'Tour',
      offers: offerBlock(listing, pageUrl, price),
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'boat_product') {
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/Boat',
      category: 'Boat rental',
      offers: offerBlock(listing, pageUrl, price),
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'motorcycle_product') {
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/Motorcycle',
      category: 'Motorcycle rental',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: {
        '@type': 'RentAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: pageUrl,
        },
      },
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'vehicle_product') {
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/Vehicle',
      category: 'Vehicle rental',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: {
        '@type': 'RentAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: pageUrl,
        },
      },
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  return {
    ...base,
    '@type': 'Product',
    offers: offerBlock(listing, pageUrl, price),
    ...(geo && { geo }),
    ...(tech || {}),
  }
}
