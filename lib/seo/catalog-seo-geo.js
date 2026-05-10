/**
 * Stage 90.0 — SSOT гео-контекста для SEO каталога (`/listings`) и согласованности с **`resolveWhereTarget`**.
 * Рынок **RU** / **TH** получает осмысленные «{where} + страна»; иначе — generic без привязки к Пхукету.
 */

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'

/** @typedef {'default'|'ru'|'th'|'generic'} CatalogSeoMarket */

/**
 * @param {object|null|undefined} target — результат **`resolveWhereTarget`**
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @param {string} fallback
 */
function displayLabelForTarget(target, lang, fallback) {
  if (!target) return fallback
  const L = ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'

  if (target.level === 'country') {
    const c = COUNTRY_PRESETS.find((x) => x.code === target.countryCode)
    return c?.labels?.[L] || c?.labels?.en || fallback
  }

  for (const c of COUNTRY_PRESETS) {
    if (c.code !== target.countryCode) continue
    for (const r of c.regions) {
      if (target.level === 'region' && r.code === target.regionCode) {
        return r.labels?.[L] || r.labels?.en || fallback
      }
      if (target.level === 'city' && r.code === target.regionCode) {
        const city = r.cities.find((ci) => ci.code === target.cityCode)
        if (city) return city.labels?.[L] || city.labels?.en || fallback
      }
    }
  }

  return fallback
}

/**
 * @param {string | null | undefined} whereRaw
 * @param {'ru'|'en'|'zh'|'th'} lang
 * @returns {{ market: CatalogSeoMarket, whereDisplay: string, countryCode: string | null }}
 */
export function resolveCatalogSeoPlaceContext(whereRaw, lang) {
  const w =
    whereRaw && String(whereRaw).trim() && String(whereRaw).toLowerCase() !== 'all'
      ? String(whereRaw).trim()
      : ''
  if (!w) {
    return { market: 'default', whereDisplay: '', countryCode: null }
  }

  const target = resolveWhereTarget(w)
  if (!target) {
    return { market: 'generic', whereDisplay: w, countryCode: null }
  }

  const cc = target.countryCode || null
  const whereDisplay = displayLabelForTarget(target, lang, w)

  if (cc === 'RU') return { market: 'ru', whereDisplay, countryCode: 'RU' }
  if (cc === 'TH') return { market: 'th', whereDisplay, countryCode: 'TH' }
  return { market: 'generic', whereDisplay, countryCode: cc }
}
