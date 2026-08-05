/**
 * Stage 86.0 / 200.37 — BreadcrumbList for PDP from listing geo codes (no Phuket invent).
 */

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
 * @param {object} listing
 * @param {string} baseUrl
 * @param {'ru'|'en'|'zh'|'th'} [lang]
 * @returns {Record<string, unknown>}
 */
export function buildListingBreadcrumbJsonLd(listing, baseUrl, lang = 'en') {
  const lng = schemaLang(lang)
  const origin = baseUrl.replace(/\/$/, '')
  const md = listingMeta(listing)

  const countryCode = String(listing?.country_code || listing?.countryCode || md.country_code || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const cityCode = String(listing?.city_code || listing?.cityCode || md.city_code || '').trim()
  const cityOrRegion =
    (typeof md.city_label === 'string' && md.city_label.trim()) ||
    (typeof md.city === 'string' && md.city.trim()) ||
    (typeof md.parent_location === 'string' && md.parent_location.trim()) ||
    cityCode ||
    ''

  const isRussia = countryCode === 'RU'
  const isThailand = countryCode === 'TH' || !countryCode

  const countryName = isRussia
    ? getUIText('seoJsonLd_breadcrumb_countryRussia', lng)
    : isThailand
      ? getUIText('seoJsonLd_breadcrumb_countryThailand', lng)
      : countryCode || getUIText('seoJsonLd_breadcrumb_countryThailand', lng)
  const countryWhereParam = countryCode || (isRussia ? 'RU' : 'TH')

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
      item: `${origin}/listings?where=${encodeURIComponent(cityCode || cityOrRegion)}`,
    })
  }

  if (district && district.toLowerCase() !== cityOrRegion.toLowerCase()) {
    const sp = new URLSearchParams()
    sp.set('where', cityCode || cityOrRegion)
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
