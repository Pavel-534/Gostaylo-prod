/**
 * Stage 63.0 + 86.0 — SSOT: listing category → Schema.org JSON-LD (PDP / AI / crawlers).
 * Жильё: `Accommodation` (+ geo-адрес). Транспорт: нативные `Vehicle` / `Motorcycle` / `Boat`.
 * @see components/seo/ListingSchema.jsx
 */

import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'
import { serializePublicCoordinates } from '@/lib/geo/listing-public-coordinates'
import {
  lodgingStreetAddressStub,
  phuketPostalCodeForDistrict,
} from '@/lib/seo/phuket-address-stubs.js'
import { decodeTelegramText } from '@/lib/services/telegram/telegram-text.js'
import { buildListingBreadcrumbJsonLd } from '@/lib/seo/listing-breadcrumbs.js'
import { computeGuestDisplayFromBaseThb } from '@/lib/pricing/guest-display-price.js'

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
  const guestFromApi = listing?.guest_display_price_thb ?? listing?.guestDisplayPriceThb
  const guestParsed = Number(guestFromApi)
  if (Number.isFinite(guestParsed) && guestParsed > 0) return Math.round(guestParsed)

  const v = listing?.base_price_thb ?? listing?.basePriceThb
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  const feePct =
    listing?.guestServiceFeePercent ?? listing?.guest_service_fee_percent ?? undefined
  return computeGuestDisplayFromBaseThb(n, feePct)
}

function availabilityUrl(listing) {
  const ok = listing?.available !== false
  return ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

function geoBlock(listing) {
  const serialized = serializePublicCoordinates(listing, 'public_fuzz')
  const la = serialized.latitude
  const lo = serialized.longitude
  if (la == null || lo == null) return undefined
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
 * Текст для `vehicleTransmission` (англоязычный канон для LLM/schema).
 *
 * @param {Record<string, unknown>|null|undefined} metadata
 */
function seoVehicleTransmissionText(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const raw = m.transmission ?? m.gearbox ?? ''
  const t = String(raw).toLowerCase().trim()
  if (!t || t === 'unset') return undefined
  if (t === 'automatic' || t.includes('auto')) return 'Automatic transmission'
  if (t === 'manual') return 'Manual transmission'
  if (t === 'cvt') return 'CVT'
  return String(raw).trim()
}

/** @param {Record<string, unknown>|null|undefined} metadata */
function seoVehicleEngineFromCc(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const n = typeof m.engine_cc === 'number' ? m.engine_cc : parseInt(String(m.engine_cc ?? '').replace(/\D/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return {
    '@type': 'EngineSpecification',
    engineDisplacement: {
      '@type': 'QuantitativeValue',
      value: n,
      unitText: 'cc',
    },
  }
}

function cabinsCount(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {}
  const n = parseInt(String(m.cabins ?? m.cabins_count ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function lodgingBedroomBathroomCounts(listing, meta) {
  const beds = parseInt(String(listing?.bedrooms_count ?? meta?.bedrooms ?? '').replace(/\D/g, ''), 10)
  const baths = parseInt(String(listing?.bathrooms_count ?? meta?.bathrooms ?? '').replace(/\D/g, ''), 10)
  return {
    bedrooms: Number.isFinite(beds) && beds > 0 ? beds : undefined,
    bathrooms: Number.isFinite(baths) && baths > 0 ? baths : undefined,
  }
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

/** Нативные поля вынесены в Vehicle/Boat/Motorcycle; остальное — PropertyValue. */
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

  if (shape === 'vehicle_product' || shape === 'motorcycle_product') {
    const vtNative = seoVehicleTransmissionText(m)
    if (!vtNative) pushStr('Transmission', m.transmission ?? m.gearbox)
    /** Кубатуру задаём через `vehicleEngine` на корне сущности */
    const cc = typeof m.engine_cc === 'number' ? m.engine_cc : parseInt(String(m.engine_cc ?? '').replace(/\D/g, ''), 10)
    if (!(Number.isFinite(cc) && cc > 0)) pushNum('Engine displacement (cc)', m.engine_cc)
    const y = m.vehicle_year ?? m.model_year ?? m.year
    if (y != null && String(y).trim()) {
      props.push({ '@type': 'PropertyValue', name: 'Model year', value: String(y).trim() })
    }
  }

  if (shape === 'generic_product') {
    pushNum('Engine displacement (cc)', m.engine_cc)
    pushStr('Transmission', m.transmission ?? m.gearbox)
    const y = m.vehicle_year ?? m.model_year ?? m.year
    if (y != null && String(y).trim()) {
      props.push({ '@type': 'PropertyValue', name: 'Model year', value: String(y).trim() })
    }
  }

  if (shape === 'boat_product') {
    const cabn = cabinsCount(m)
    const engineSpec = seoVehicleEngineFromCc(m)
    if (cabn == null) pushNum('Cabins', m.cabins ?? m.cabins_count)
    if (!engineSpec) pushNum('Engine displacement (cc)', m.engine_cc)
  }

  if (shape === 'helicopter_service') {
    pushNum('Flight hours', m.flight_hours ?? m.flightHours)
    pushStr('Aircraft type', m.aircraft_type ?? m.aircraftType)
    pushStr('Service type', 'Helicopter charter')
  }

  if (!props.length) return undefined
  return { additionalProperty: props }
}

function listingEntityBaseWithoutContext(name, description, image) {
  return {
    name,
    ...(description && { description }),
    ...(image && { image }),
  }
}

/**
 * Основная сущность листинга (без обёртки `@context`; для включения в `@graph`).
 *
 * @param {object} listing
 * @param {string} baseUrl
 * @param {string|null} telephone — для операторского контакта (Accommodation-хостинг исторически совмещался с LodgingBusiness)
 */
export function buildListingPrimaryJsonLdWithoutContext(listing, baseUrl, telephone) {
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
  const image = mainImage ? (images.length > 1 ? [mainImage, ...images.filter((u) => u !== mainImage)] : mainImage) : undefined

  const price = parsePriceThb(listing)
  const geo = geoBlock(listing)
  const district = listing.district?.trim()
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const tech = buildListingSchemaTechnicalAdditions(meta, shape)

  const base = listingEntityBaseWithoutContext(name, description, image)

  const vehicleExtras = () => ({
    ...(seoVehicleTransmissionText(meta) ? { vehicleTransmission: seoVehicleTransmissionText(meta) } : {}),
    ...(seoVehicleEngineFromCc(meta) ? { vehicleEngine: seoVehicleEngineFromCc(meta) } : {}),
  })

  const rentAction = {
    '@type': 'RentAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: pageUrl,
    },
  }

  if (shape === 'lodging') {
    const priceRange = price != null ? `฿${Math.round(price)}+` : '฿฿'
    const locality = district || (typeof meta.city === 'string' && meta.city.trim()) || 'Phuket'
    const postalCode = phuketPostalCodeForDistrict(district)
    const streetAddress = lodgingStreetAddressStub(listing)
    const { bedrooms, bathrooms } = lodgingBedroomBathroomCounts(listing, meta)
    const areaN = typeof meta.area === 'number' ? meta.area : parseFloat(meta.area ?? '')
    const floor =
      Number.isFinite(areaN) && areaN > 0
        ? { '@type': 'QuantitativeValue', value: Math.round(areaN * 100) / 100, unitCode: 'MTK' }
        : undefined

    /** `Accommodation` — канонический тип жилья для маркетплейсов; `priceRange` остаётся для сниппетов. */
    return {
      ...base,
      '@type': 'Accommodation',
      ...(telephone ? { telephone } : {}),
      priceRange,
      ...(bedrooms ? { numberOfRooms: bedrooms } : {}),
      ...(bathrooms ? { numberOfBathroomsTotal: bathrooms } : {}),
      ...(floor ? { floorSize: floor } : {}),
      address: {
        '@type': 'PostalAddress',
        streetAddress,
        addressLocality: locality,
        addressRegion: typeof meta.parent_location === 'string' ? meta.parent_location.trim() || 'Phuket' : 'Phuket',
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
    const cab = cabinsCount(meta)
    return {
      ...base,
      '@type': 'Boat',
      category: 'Boat rental',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: rentAction,
      ...(cab ? { numberOfRooms: cab } : {}),
      ...vehicleExtras(),
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'motorcycle_product') {
    return {
      ...base,
      '@type': 'Motorcycle',
      category: 'Motorcycle rental',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: rentAction,
      ...vehicleExtras(),
      ...(geo && { geo }),
      ...(tech || {}),
    }
  }

  if (shape === 'vehicle_product') {
    return {
      ...base,
      '@type': 'Vehicle',
      category: 'Vehicle rental',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: rentAction,
      ...vehicleExtras(),
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

/** Без второго блока breadcrumbs (единый payload — только листинг + legacy одиночный объект). */
export function buildListingJsonLd(listing, baseUrl, telephone) {
  return {
    '@context': 'https://schema.org',
    ...buildListingPrimaryJsonLdWithoutContext(listing, baseUrl, telephone),
  }
}

/**
 * Stage 86.0 + 87.0: `@graph` = основная сущность + BreadcrumbList (**`lang`** для подписей).
 *
 * @param {object} listing
 * @param {string} baseUrl
 * @param {string|null} telephone
 * @param {'ru'|'en'|'zh'|'th'} [lang]
 */
export function buildListingStructuredDataPayload(listing, baseUrl, telephone, lang = 'en') {
  const primary = buildListingPrimaryJsonLdWithoutContext(listing, baseUrl, telephone)
  const crumbs = buildListingBreadcrumbJsonLd(listing, baseUrl, lang)

  const stripCtx = (o) => {
    if (!o || typeof o !== 'object') return o
    const { ['@context']: _x, ...rest } = /** @type {Record<string, unknown>} */ (o)
    return rest
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [primary, stripCtx(crumbs)],
  }
}
