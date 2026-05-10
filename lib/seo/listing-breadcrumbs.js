/**
 * Stage 86.0 — SSOT BreadcrumbList для PDP (гео «зонтик»: страна → регион/город → район).
 * Связано с метаданными `parent_location` / `city` и `district` (__location-filter__ Phuket umbrella).
 */

import { resolveCanonicalCityLabelForGeo } from '@/lib/locations/city-district-map'

function listingMeta(listing) {
  const md = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  return md
}

/**
 * Иерархия для ИИ/SEO: Home → Страна (TH) → Канон города / зонта → Район (если отличается) → объект.
 *
 * @param {object} listing
 * @param {string} baseUrl
 * @returns {Record<string, unknown>}
 */
export function buildListingBreadcrumbJsonLd(listing, baseUrl) {
  const origin = baseUrl.replace(/\/$/, '')
  const md = listingMeta(listing)
  /** Канон «Phuket» и т.д. для узла зонта */
  const parentRaw =
    (typeof md.parent_location === 'string' && md.parent_location.trim()) ||
    (typeof md.city === 'string' && md.city.trim()) ||
    ''
  const cityOrRegion = parentRaw
    ? resolveCanonicalCityLabelForGeo(parentRaw.trim()) || parentRaw.trim()
    : 'Phuket'
  const district = typeof listing?.district === 'string' ? listing.district.trim() : ''
  const listingTitle =
    typeof listing?.title === 'string' && listing.title.trim() ? listing.title.trim() : 'Listing'

  /** @type {object[]} */
  const elements = []
  let pos = 1

  elements.push({
    '@type': 'ListItem',
    position: pos++,
    name: 'Home',
    item: `${origin}/`,
  })

  elements.push({
    '@type': 'ListItem',
    position: pos++,
    name: 'Thailand',
    item: `${origin}/listings?where=${encodeURIComponent('Thailand')}`,
  })

  if (cityOrRegion) {
    elements.push({
      '@type': 'ListItem',
      position: pos++,
      name: cityOrRegion,
      item: `${origin}/listings?where=${encodeURIComponent(cityOrRegion)}`,
    })
  }

  if (district && district.toLowerCase() !== cityOrRegion.toLowerCase()) {
    const sp = new URLSearchParams()
    sp.set('where', cityOrRegion)
    sp.set('location', district)
    elements.push({
      '@type': 'ListItem',
      position: pos++,
      name: district,
      item: `${origin}/listings?${sp.toString()}`,
    })
  }

  elements.push({
    '@type': 'ListItem',
    position: pos++,
    name: listingTitle,
    item: `${origin}/listings/${listing?.id}/`,
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements,
  }
}
