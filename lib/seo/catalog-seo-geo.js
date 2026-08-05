/**
 * Stage 90.0 / 200.37 — SEO place context from geo_locations (async).
 */

import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'

/** @typedef {'default'|'ru'|'th'|'generic'} CatalogSeoMarket */

/**
 * @param {string | null | undefined} whereRaw
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @returns {Promise<{ market: CatalogSeoMarket, whereDisplay: string, countryCode: string | null }>}
 */
export async function resolveCatalogSeoPlaceContext(whereRaw, lang) {
  const w =
    whereRaw && String(whereRaw).trim() && String(whereRaw).toLowerCase() !== 'all'
      ? String(whereRaw).trim()
      : ''
  if (!w) {
    return { market: 'default', whereDisplay: '', countryCode: null }
  }

  const target = await resolveWhereTarget(w, { lang })
  if (!target) {
    return { market: 'generic', whereDisplay: w, countryCode: null }
  }

  const cc = target.countryCode || null
  const whereDisplay = target.label || w

  if (cc === 'RU') return { market: 'ru', whereDisplay, countryCode: 'RU' }
  if (cc === 'TH') return { market: 'th', whereDisplay, countryCode: 'TH' }
  return { market: 'generic', whereDisplay, countryCode: cc }
}
