/**
 * Stage 160 — validate admin MERGE target against presets / phuket canon.
 */

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

const CITY_FALLBACK_CODES = new Set(['samara', 'chiang-mai', 'hua-hin', 'phang-nga'])

/**
 * @param {string} target_type
 * @param {string} target_code
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateMergeTarget(target_type, target_code) {
  const type = String(target_type || '').trim()
  const code = String(target_code || '').trim()
  if (!code) return { ok: false, error: 'target_code is required' }
  if (!['country', 'region', 'city', 'district'].includes(type)) {
    return { ok: false, error: 'invalid target_type' }
  }

  if (type === 'country') {
    const hit = COUNTRY_PRESETS.some((c) => c.code === code.toUpperCase())
    return hit ? { ok: true } : { ok: false, error: 'unknown country code' }
  }

  if (type === 'region') {
    for (const country of COUNTRY_PRESETS) {
      if (country.regions.some((r) => r.code === code)) return { ok: true }
    }
    return { ok: false, error: 'unknown region code' }
  }

  if (type === 'city') {
    for (const country of COUNTRY_PRESETS) {
      for (const region of country.regions) {
        if (region.cities.some((c) => c.code === code)) return { ok: true }
      }
    }
    if (CITY_FALLBACK_CODES.has(code)) return { ok: true }
    return { ok: false, error: 'unknown city code' }
  }

  if (PHUKET_DISTRICTS_CANON.some((d) => d.toLowerCase() === code.toLowerCase())) {
    return { ok: true }
  }

  for (const country of COUNTRY_PRESETS) {
    for (const region of country.regions) {
      for (const city of region.cities) {
        if ((city.districts || []).some((d) => d.toLowerCase() === code.toLowerCase())) {
          return { ok: true }
        }
      }
    }
  }

  return { ok: false, error: 'unknown district name' }
}

/**
 * @param {string} raw_term
 * @returns {'ru'|'en'|'th'|'zh'|'*'}
 */
export function guessSynonymLang(raw_term) {
  const s = String(raw_term || '')
  if (/[\u0400-\u04FF]/.test(s)) return 'ru'
  if (/[\u0E00-\u0E7F]/.test(s)) return 'th'
  if (/[\u4e00-\u9fff]/.test(s)) return 'zh'
  return '*'
}
