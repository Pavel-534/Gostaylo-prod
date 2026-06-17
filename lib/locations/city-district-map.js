/**
 * Карта «канонический город → районы» для поиска.
 * SSOT Phuket districts: `lib/locations/phuket-districts-canonical.js`
 */
import {
  PHUKET_DISTRICTS,
  PHUKET_DISTRICTS_CANON,
} from '@/lib/locations/phuket-districts-canonical'

export { PHUKET_DISTRICTS, PHUKET_DISTRICTS_CANON }

/**
 * @type {Record<string, string[]>}
 */
export const DISTRICTS_BY_CITY = {
  Phuket: [...PHUKET_DISTRICTS_CANON],
}

/**
 * Slug/code из Where UI → каноническое имя города для umbrella (`metadata.city`, `DISTRICTS_BY_CITY`).
 */
export function resolveCanonicalCityLabelForGeo(whereValue) {
  if (!whereValue || whereValue === 'all') return null
  const v = String(whereValue).trim()
  const lower = v.toLowerCase()
  /** @type {Record<string, string>} */
  const aliases = {
    'phuket-city': 'Phuket',
    phuket: 'Phuket',
    moscow: 'Moscow',
    'moscow-city': 'Moscow',
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
  if (aliases[lower]) return aliases[lower]
  if (Object.prototype.hasOwnProperty.call(DISTRICTS_BY_CITY, v)) return v
  return null
}

/**
 * @param {string} city
 * @returns {string[] | null}
 */
export function getDistrictsForCity(city) {
  if (!city || city === 'all') return null
  const canon = resolveCanonicalCityLabelForGeo(city) || city
  const list = DISTRICTS_BY_CITY[canon]
  return list?.length ? [...list] : null
}
