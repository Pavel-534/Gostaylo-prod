/**
 * resolveWhereTarget — приводит абстрактный whereValue (slug/code) к семантической цели.
 *
 * Разбирает значение фильтра «Куда», полученное от UI:
 *   • country code (TH/RU/ID/AE) → { level: 'country', code, ... }
 *   • region code  (TH-PHK, RU-MOW)→ { level: 'region',  code, country, ... }
 *   • city code    (phuket-city, moscow) → { level: 'city', code, region, country, districts: [...] }
 *   • legacy district (patong, kamala) → { level: 'district', district, hint city/region }
 *   • bare slug совпадающий с city.code в country-presets → city
 *   • иначе null (UI fallback на ILIKE)
 *
 * Возвращает структурированную цель, которую API использует для построения OR-clause
 * по новым колонкам (country_code/region_code/city_code) + backward-compat district.
 *
 * @param {string} value — raw input
 * @returns {object|null}
 */

import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'
import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'

export function resolveWhereTarget(value) {
  if (!value || value === 'all') return null
  const raw = String(value).trim()
  const aliased = resolveWhereSlugAlias(raw) || raw
  const v = aliased
  const vLower = v.toLowerCase()

  // 1) Country (ISO-2)
  const country = COUNTRY_PRESETS.find((c) => c.code === v.toUpperCase())
  if (country) {
    return {
      level: 'country',
      countryCode: country.code,
      regions: country.regions.map((r) => r.code),
      cities: country.regions.flatMap((r) => r.cities.map((c) => c.code)),
      districts: country.regions.flatMap((r) => r.cities.flatMap((c) => c.districts || [])),
    }
  }

  // 2) Region (ISO-2-like, includes hyphen)
  for (const c of COUNTRY_PRESETS) {
    const region = c.regions.find((r) => r.code === v.toUpperCase() || r.code === v)
    if (region) {
      return {
        level: 'region',
        countryCode: c.code,
        regionCode: region.code,
        cities: region.cities.map((ci) => ci.code),
        districts: region.cities.flatMap((ci) => ci.districts || []),
      }
    }
  }

  // 3) City (slug match against ALL cities in presets)
  for (const c of COUNTRY_PRESETS) {
    for (const r of c.regions) {
      const city = r.cities.find((ci) => ci.code === vLower || ci.code === v)
      if (city) {
        return {
          level: 'city',
          countryCode: c.code,
          regionCode: r.code,
          cityCode: city.code,
          districts: city.districts || [],
        }
      }
    }
  }

  // 4) Match by canonical name in any language → city or region
  for (const c of COUNTRY_PRESETS) {
    for (const r of c.regions) {
      // Region label match
      const regionLabelMatch = Object.values(r.labels || {}).some(
        (l) => String(l).toLowerCase() === vLower,
      )
      if (regionLabelMatch) {
        return {
          level: 'region',
          countryCode: c.code,
          regionCode: r.code,
          cities: r.cities.map((ci) => ci.code),
          districts: r.cities.flatMap((ci) => ci.districts || []),
        }
      }
      for (const city of r.cities) {
        const cityLabelMatch = Object.values(city.labels || {}).some(
          (l) => String(l).toLowerCase() === vLower,
        )
        if (cityLabelMatch) {
          return {
            level: 'city',
            countryCode: c.code,
            regionCode: r.code,
            cityCode: city.code,
            districts: city.districts || [],
          }
        }
      }
    }
  }

  // 5) Legacy bare district name — fallthrough, caller handles ILIKE
  return null
}
