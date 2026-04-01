/**
 * Серверный JSON-LD (Schema.org) для публичной карточки объявления.
 */
import { getRequestSiteUrl } from '@/lib/server-site-url'
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

function buildJsonLd(listing, baseUrl) {
  const slug = categorySlugFromRow(listing)
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

  const base = {
    '@context': 'https://schema.org',
    name,
    ...(description && { description }),
    ...(image && { image }),
  }

  if (slug === 'property') {
    return {
      ...base,
      '@type': 'LodgingBusiness',
      ...(district && {
        address: {
          '@type': 'PostalAddress',
          addressLocality: district,
          addressCountry: 'TH',
        },
      }),
      ...(geo && { geo }),
      offers: offerBlock(listing, pageUrl, price),
    }
  }

  if (slug === 'vehicles') {
    return {
      ...base,
      '@type': 'Product',
      offers: offerBlock(listing, pageUrl, price),
      potentialAction: {
        '@type': 'RentAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: pageUrl,
        },
      },
      ...(geo && { geo }),
    }
  }

  if (slug === 'tours') {
    // Product + additionalType: у TouristTrip в Schema.org нет типичного offers — оффер на Product валиден для краулеров
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/TouristTrip',
      category: 'Tour',
      offers: offerBlock(listing, pageUrl, price),
      ...(geo && { geo }),
    }
  }

  if (slug === 'yachts') {
    return {
      ...base,
      '@type': 'Product',
      additionalType: 'https://schema.org/Boat',
      category: 'Boat rental',
      offers: offerBlock(listing, pageUrl, price),
      ...(geo && { geo }),
    }
  }

  return {
    ...base,
    '@type': 'Product',
    offers: offerBlock(listing, pageUrl, price),
    ...(geo && { geo }),
  }
}

/**
 * @param {{ listing: object | null }} props
 */
export default async function ListingSchema({ listing }) {
  if (!listing?.id) return null

  const baseUrl = await getRequestSiteUrl()
  const schema = buildJsonLd(listing, baseUrl)
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
