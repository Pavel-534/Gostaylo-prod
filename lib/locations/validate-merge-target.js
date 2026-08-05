/**
 * Stage 160 / 200.38 — validate admin MERGE target against geo_locations (+ launch seed offline).
 */

import { GeoService } from '@/lib/services/geo/geo.service'
import { findLaunchGeoByCode } from '@/lib/geo/launch-geo-index'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

const CITY_FALLBACK_CODES = new Set(['samara', 'chiang-mai', 'hua-hin', 'phang-nga'])

function levelMatches(rowLevel, targetType) {
  if (!rowLevel || !targetType) return false
  if (rowLevel === targetType) return true
  if (targetType === 'city' && rowLevel === 'neighborhood') return true
  if (targetType === 'district' && rowLevel === 'neighborhood') return true
  return false
}

/**
 * @param {string} target_type
 * @param {string} target_code
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function validateMergeTarget(target_type, target_code) {
  const type = String(target_type || '').trim()
  const code = String(target_code || '').trim()
  if (!code) return { ok: false, error: 'target_code is required' }
  if (!['country', 'region', 'city', 'district'].includes(type)) {
    return { ok: false, error: 'invalid target_type' }
  }

  try {
    const row = await GeoService.getByCode(code)
    if (row && levelMatches(row.level, type)) return { ok: true }
    if (type === 'country') {
      const iso = await GeoService.getByCode(code.toUpperCase())
      if (iso?.level === 'country') return { ok: true }
    }
  } catch {
    /* fall through to seed */
  }

  const seed = findLaunchGeoByCode(code) || findLaunchGeoByCode(code.toUpperCase())
  if (seed && levelMatches(seed.level, type)) return { ok: true }

  if (type === 'city' && CITY_FALLBACK_CODES.has(code)) return { ok: true }

  if (type === 'district') {
    if (PHUKET_DISTRICTS_CANON.some((d) => d.toLowerCase() === code.toLowerCase())) {
      return { ok: true }
    }
    // Free-text district / neighborhood label — accept non-empty
    if (code.length >= 2) return { ok: true }
  }

  return { ok: false, error: `unknown ${type} code` }
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
