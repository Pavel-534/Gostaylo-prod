/**
 * Stage 200.37 / 200.38 — city→districts for search umbrella from geo_locations children.
 */

export { PHUKET_DISTRICTS, PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

import { GeoService } from '@/lib/services/geo/geo.service'
import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'

/**
 * Slug/code → English city label for metadata.cs umbrella (legacy rows).
 * @param {string} whereValue
 * @returns {Promise<string|null>}
 */
export async function resolveCanonicalCityLabelForGeo(whereValue) {
  if (!whereValue || whereValue === 'all') return null
  const target = await resolveWhereTarget(whereValue)
  if (target?.label) return target.label
  if (target?.cityCode) {
    const row = await GeoService.getByCode(target.cityCode)
    return row?.label_en || row?.label_ru || target.cityCode
  }
  return null
}

/**
 * Sync: only exact known slug aliases (no preset walk). Prefer async.
 * @param {string} whereValue
 * @returns {string|null}
 */
export function resolveCanonicalCityLabelForGeoSync(whereValue) {
  if (!whereValue || whereValue === 'all') return null
  const lower = String(whereValue).trim().toLowerCase()
  const aliases = {
    'phuket-city': 'Phuket',
    phuket: 'Phuket',
    moscow: 'Moscow',
    bangkok: 'Bangkok',
    samui: 'Koh Samui',
    spb: 'Saint Petersburg',
    'saint-petersburg': 'Saint Petersburg',
    sochi: 'Sochi',
    denpasar: 'Denpasar',
    krabi: 'Krabi',
    'krabi-city': 'Krabi',
    pattaya: 'Pattaya',
    kazan: 'Kazan',
  }
  return aliases[lower] || null
}

/**
 * @deprecated sync stub — returns null; use getDistrictsForCityAsync
 */
export function getDistrictsForCity(_city) {
  return null
}

/**
 * @param {string} city
 * @returns {Promise<string[]|null>}
 */
export async function getDistrictsForCityAsync(city) {
  if (!city || city === 'all') return null
  const target = await resolveWhereTarget(city)
  if (target?.districts?.length) return [...target.districts]
  const code = target?.cityCode || String(city).trim()
  const children = await GeoService.getChildren(code, 'neighborhood')
  if (!children?.length) {
    const asCity = await GeoService.getChildren(code, 'city')
    const labels = (asCity || [])
      .map((r) => r.label_en || r.label_ru)
      .filter(Boolean)
    return labels.length ? labels : null
  }
  const labels = children.map((r) => r.label_en || r.label_ru).filter(Boolean)
  return labels.length ? labels : null
}
