/**
 * Парсинг и сбор query для /listings (шаринг и синхронизация).
 */

/** Верхняя граница слайдера цены (THB); совпадает с UI фильтров */
export const LISTINGS_PRICE_SLIDER_MAX_THB = 80000

export function parseBBoxFromParams(sp) {
  const south = parseFloat(sp.get('south'))
  const north = parseFloat(sp.get('north'))
  const west = parseFloat(sp.get('west'))
  const east = parseFloat(sp.get('east'))
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  if (south >= north || west >= east) return null
  return { south, north, west, east }
}

export function bboxToSearchParams(bbox, params) {
  if (!bbox) return
  params.set('south', String(bbox.south))
  params.set('north', String(bbox.north))
  params.set('west', String(bbox.west))
  params.set('east', String(bbox.east))
}

/** @typedef {{
 *   minPriceThb: number | null,
 *   maxPriceThb: number | null,
 *   bedroomsMin: number | null,
 *   bathroomsMin: number | null,
 *   amenities: string[],
 *   transmission: string,
 *   fuelType: string,
 *   engineCcMin: number | null,
 *   nannyLangs: string[],
 *   nannyExperienceMin: number | null,
 *   nannySpecialization: string,
 * }} ListingsExtraFilters */

export const defaultExtraFilters = () => ({
  minPriceThb: null,
  maxPriceThb: null,
  bedroomsMin: null,
  bathroomsMin: null,
  amenities: [],
  transmission: '',
  fuelType: '',
  engineCcMin: null,
  nannyLangs: [],
  nannyExperienceMin: null,
  nannySpecialization: '',
})

export function parseExtraFiltersFromParams(sp) {
  const pf = (keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseFloat(v)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const pi = (keys) => {
    for (const k of keys) {
      const v = sp.get(k)
      if (v != null && v !== '') {
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) return n
      }
    }
    return null
  }
  const comma = (key) =>
    (sp.get(key) || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

  return {
    minPriceThb: pf(['min_price', 'minPrice']),
    maxPriceThb: pf(['max_price', 'maxPrice']),
    bedroomsMin: pi(['bedrooms', 'bedrooms_min']),
    bathroomsMin: pi(['bathrooms', 'bathrooms_min']),
    amenities: comma('amenities'),
    transmission: sp.get('transmission')?.trim() || '',
    fuelType: sp.get('fuel_type')?.trim() || sp.get('fuelType')?.trim() || '',
    engineCcMin: pf(['engine_cc_min', 'engineCcMin']),
    nannyLangs: comma('nanny_langs'),
    nannyExperienceMin: pi(['nanny_experience_min', 'nannyExperienceMin']),
    nannySpecialization: sp.get('nanny_specialization')?.trim() || sp.get('nannySpecialization')?.trim() || '',
  }
}

export function hasActiveExtraFilters(f) {
  if (!f) return false
  if (f.minPriceThb != null && f.minPriceThb > 0) return true
  if (
    f.maxPriceThb != null &&
    f.maxPriceThb > 0 &&
    f.maxPriceThb < LISTINGS_PRICE_SLIDER_MAX_THB
  )
    return true
  if (f.bedroomsMin != null && f.bedroomsMin > 0) return true
  if (f.bathroomsMin != null && f.bathroomsMin > 0) return true
  if (f.amenities?.length) return true
  if (f.transmission) return true
  if (f.fuelType) return true
  if (f.engineCcMin != null && f.engineCcMin > 0) return true
  if (f.nannyLangs?.length) return true
  if (f.nannyExperienceMin != null && f.nannyExperienceMin > 0) return true
  if (f.nannySpecialization) return true
  return false
}

export function appendExtraFiltersToParams(params, f) {
  if (f.minPriceThb != null && f.minPriceThb > 0) params.set('min_price', String(Math.round(f.minPriceThb)))
  if (
    f.maxPriceThb != null &&
    f.maxPriceThb > 0 &&
    f.maxPriceThb < LISTINGS_PRICE_SLIDER_MAX_THB
  ) {
    params.set('max_price', String(Math.round(f.maxPriceThb)))
  }
  if (f.bedroomsMin != null && f.bedroomsMin > 0) params.set('bedrooms', String(f.bedroomsMin))
  if (f.bathroomsMin != null && f.bathroomsMin > 0) params.set('bathrooms', String(f.bathroomsMin))
  if (f.amenities?.length) params.set('amenities', f.amenities.join(','))
  if (f.transmission) params.set('transmission', f.transmission)
  if (f.fuelType) params.set('fuel_type', f.fuelType)
  if (f.engineCcMin != null && f.engineCcMin > 0) params.set('engine_cc_min', String(f.engineCcMin))
  if (f.nannyLangs?.length) params.set('nanny_langs', f.nannyLangs.join(','))
  if (f.nannyExperienceMin != null && f.nannyExperienceMin > 0) {
    params.set('nanny_experience_min', String(f.nannyExperienceMin))
  }
  if (f.nannySpecialization) params.set('nanny_specialization', f.nannySpecialization)
}
