/**
 * Stage 86.0 + 87.0 — SSOT BreadcrumbList для PDP (гео «зонтик»: страна → регион/город → район).
 * Подписи узлов — локаль из `booking.js` (**`seoJsonLd_*`**) через **`getUIText`**.
 */

import { resolveCanonicalCityLabelForGeo } from '@/lib/locations/city-district-map'
import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'
import { getUIText } from '@/lib/translations'

function listingMeta(listing) {
  const md = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  return md
}

/** @param {'ru'|'en'|'zh'|'th'} lang */
function schemaLang(lang) {
  return ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'
}

/**
 * Иерархия для ИИ/SEO: Home → Страна (TH) → Канон города / зонта → Район (если отличается) → объект.
 *
 * @param {object} listing
 * @param {string} baseUrl
 * @param {'ru'|'en'|'zh'|'th'} [lang]
 * @returns {Record<string, unknown>}
 */
export function buildListingBreadcrumbJsonLd(listing, baseUrl, lang = 'en') {
  const lng = schemaLang(lang)
  const origin = baseUrl.replace(/\/$/, '')
  const md = listingMeta(listing)
  /** Канон «Phuket» / «Moscow» и т.д. для узла зонта (Stage 90.0 — RU узел страны через **`resolveWhereTarget`**). */
  const parentRaw =
    (typeof md.parent_location === 'string' && md.parent_location.trim()) ||
    (typeof md.city === 'string' && md.city.trim()) ||
    ''
  const parentTrim = parentRaw.trim()
  let geoTarget = parentTrim ? resolveWhereTarget(parentTrim) : null
  if (!geoTarget && parentTrim) {
    const canon = resolveCanonicalCityLabelForGeo(parentTrim)
    if (canon) geoTarget = resolveWhereTarget(canon)
  }

  const isRussia = geoTarget?.countryCode === 'RU'

  const cityOrRegion = parentTrim
    ? resolveCanonicalCityLabelForGeo(parentTrim) || parentTrim
    : 'Phuket'

  const countryName = isRussia
    ? getUIText('seoJsonLd_breadcrumb_countryRussia', lng)
    : getUIText('seoJsonLd_breadcrumb_countryThailand', lng)
  const countryWhereParam = isRussia ? 'RU' : 'Thailand'

  const district = typeof listing?.district === 'string' ? listing.district.trim() : ''
  const listingTitle =
    typeof listing?.title === 'string' && listing.title.trim() ? listing.title.trim() : 'Listing'

  /** @type {object[]} */
  const elements = []
  let pos = 1

  elements.push({
    '@type': 'ListItem',
    position: pos++,
    name: getUIText('seoJsonLd_breadcrumb_home', lng),
    item: `${origin}/`,
  })

  elements.push({
    '@type': 'ListItem',
    position: pos++,
    name: countryName,
    item: `${origin}/listings?where=${encodeURIComponent(countryWhereParam)}`,
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
