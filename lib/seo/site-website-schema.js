/**
 * Stage 86.0 — SSOT: глобальный WebSite + SearchAction (семантический поиск).
 * Контекст см. ListingSchema.jsx, listing-schema-org.js (PDP graph).
 */

import { getSiteDisplayName } from '@/lib/site-url'

/**
 * Умный поиск: параметр `semantic=1` + текстовый `q` (`run-listings-search-get`).
 *
 * @param {string} baseUrl — канонический origin без завершающего `/`
 * @param {string} [brand] — человекочитаемое имя продукта
 * @returns {Record<string, unknown>}
 */
export function buildWebSiteSearchActionJsonLd(baseUrl, brand) {
  const origin = baseUrl.replace(/\/$/, '')
  const name = brand || getSiteDisplayName()
  const searchTemplate = `${origin}/listings?q={search_term_string}&semantic=1`

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: `${origin}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchTemplate,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
