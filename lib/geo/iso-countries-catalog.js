/**
 * Stage 200.45 — ISO-3166-1 alpha-2 country catalog for wizard typeahead.
 * Locales via i18n-iso-countries; launch seed labels preferred when present.
 */

import countries from 'i18n-iso-countries'
import isoLocales from '@/lib/geo/iso-countries-locales.cjs'
import { LAUNCH_GEO_SEED } from '@/lib/geo/launch-markets-seed-data'

let registered = false

function ensureLocales() {
  if (registered) return
  countries.registerLocale(isoLocales.en)
  countries.registerLocale(isoLocales.ru)
  countries.registerLocale(isoLocales.zh)
  registered = true
}

const SEED_COUNTRY_LABELS = (() => {
  /** @type {Record<string, { en?: string, ru?: string, th?: string, zh?: string }>} */
  const map = {}
  for (const row of LAUNCH_GEO_SEED) {
    if (row.level !== 'country') continue
    map[row.code] = {
      en: row.label_en,
      ru: row.label_ru,
      th: row.label_th,
      zh: row.label_zh,
    }
  }
  return map
})()

/**
 * @param {string} lang
 * @returns {'en'|'ru'|'zh'}
 */
function catalogLang(lang) {
  const l = String(lang || 'en').toLowerCase().slice(0, 2)
  if (l === 'ru') return 'ru'
  if (l === 'zh') return 'zh'
  return 'en'
}

/**
 * @param {string} code ISO alpha-2
 * @param {string} [lang]
 * @returns {string}
 */
export function getIsoCountryLabel(code, lang = 'en') {
  ensureLocales()
  const iso = String(code || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  if (!/^[A-Z]{2}$/.test(iso)) return ''
  const seed = SEED_COUNTRY_LABELS[iso]
  const l = catalogLang(lang)
  if (lang === 'th' && seed?.th) return seed.th
  if (seed?.[l]) return seed[l]
  if (seed?.en) return seed.en
  const fromPkg = countries.getName(iso, l) || countries.getName(iso, 'en')
  return fromPkg || iso
}

/**
 * Full country list for typeahead (ISO + optional extra DB labels).
 * @param {{ lang?: string, extra?: Array<{ code: string, label?: string }> }} [opts]
 * @returns {Array<{ code: string, label: string, labelEn: string }>}
 */
export function listIsoCountries(opts = {}) {
  ensureLocales()
  const lang = opts.lang || 'en'
  const l = catalogLang(lang)
  const codes = Object.keys(countries.getAlpha2Codes() || {})
  /** @type {Map<string, { code: string, label: string, labelEn: string }>} */
  const map = new Map()
  for (const code of codes) {
    const iso = String(code).toUpperCase()
    map.set(iso, {
      code: iso,
      label: getIsoCountryLabel(iso, lang),
      labelEn: getIsoCountryLabel(iso, 'en'),
    })
  }
  for (const row of opts.extra || []) {
    const iso = String(row.code || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    if (!/^[A-Z]{2}$/.test(iso)) continue
    const prev = map.get(iso)
    const label = String(row.label || '').trim() || prev?.label || getIsoCountryLabel(iso, lang)
    map.set(iso, {
      code: iso,
      label,
      labelEn: prev?.labelEn || getIsoCountryLabel(iso, 'en'),
    })
  }
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, l === 'zh' ? 'zh' : l === 'ru' ? 'ru' : 'en', {
      sensitivity: 'base',
    }),
  )
}

/**
 * @param {Array<{ code: string, label: string, labelEn: string }>} list
 * @param {string} query
 * @param {number} [limit]
 */
export function filterIsoCountries(list, query, limit = 12) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (!q) return list.slice(0, limit)
  const out = []
  for (const row of list) {
    const hay = `${row.code} ${row.label} ${row.labelEn}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
    if (hay.includes(q) || row.code.toLowerCase().startsWith(q)) {
      out.push(row)
      if (out.length >= limit) break
    }
  }
  return out
}
