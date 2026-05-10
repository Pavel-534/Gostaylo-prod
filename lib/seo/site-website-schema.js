/**
 * Stage 86.0 + 87.0 — SSOT: глобальный WebSite + SearchAction (семантический поиск).
 * Локаль: **`inLanguage`** + **`description`** из **`booking.js`** (**`seoJsonLd_webSiteDescription`**).
 */

import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'

/** @param {'ru'|'en'|'zh'|'th'} lang */
export function seoInLanguageTag(lang) {
  if (lang === 'zh') return 'zh-CN'
  if (lang === 'th') return 'th-TH'
  if (lang === 'ru') return 'ru-RU'
  return 'en-US'
}

function schemaLang(lang) {
  return ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'
}

/**
 * Умный поиск: параметр `semantic=1` + текстовый `q` (`run-listings-search-get`).
 *
 * @param {string} baseUrl — канонический origin без завершающего `/`
 * @param {string} [brand] — человекочитаемое имя продукта
 * @param {'ru'|'en'|'zh'|'th'} [lang] — локаль описания **`WebSite`** и **`inLanguage`**
 * @returns {Record<string, unknown>}
 */
export function buildWebSiteSearchActionJsonLd(baseUrl, brand, lang = 'en') {
  const lng = schemaLang(lang)
  const origin = baseUrl.replace(/\/$/, '')
  const name = brand || getSiteDisplayName()
  const searchTemplate = `${origin}/listings?q={search_term_string}&semantic=1`
  const description = getUIText('seoJsonLd_webSiteDescription', lng)

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: `${origin}/`,
    inLanguage: seoInLanguageTag(lng),
    ...(description && description !== 'seoJsonLd_webSiteDescription' ? { description } : {}),
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
