/**
 * Stage 200.37 — smart where OR clause (geo_locations SSOT, no DISTRICTS_BY_CITY).
 */

import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'
import { getGeoSchemaState } from '@/lib/api/geo-schema-probe'

function districtEqForOrClause(district) {
  const d = String(district)
  if (/^[a-zA-Z0-9_-]+$/.test(d)) {
    return `district.eq.${d}`
  }
  return `district.eq."${d.replace(/"/g, '\\"')}"`
}

function pgOrValue(v) {
  const s = String(v)
  if (/^[\w-]+$/.test(s)) return s
  return `"${s.replace(/"/g, '\\"')}"`
}

function ilikeFrag(column, raw) {
  const s = String(raw || '')
    .replace(/%/g, '')
    .replace(/,/g, ' ')
    .trim()
  if (!s) return null
  return `${column}.ilike.%${s}%`
}

/**
 * @param {string} whereValue
 * @returns {Promise<string|null>}
 */
export async function buildSmartWhereOrClause(whereValue) {
  if (!whereValue || whereValue === 'all') return null

  const target = await resolveWhereTarget(whereValue)
  const schema = await getGeoSchemaState()
  const orParts = []

  if (target) {
    if (target.level === 'country') {
      if (schema.hasCountryCode) orParts.push(`country_code.eq.${pgOrValue(target.countryCode)}`)
      if (schema.hasRegionCode) {
        target.regions?.forEach((r) => orParts.push(`region_code.eq.${pgOrValue(r)}`))
      }
      if (schema.hasCityCode) {
        target.cities?.forEach((c) => orParts.push(`city_code.eq.${pgOrValue(c)}`))
      }
    } else if (target.level === 'region') {
      if (schema.hasRegionCode) orParts.push(`region_code.eq.${pgOrValue(target.regionCode)}`)
      if (schema.hasCityCode) {
        target.cities?.forEach((c) => orParts.push(`city_code.eq.${pgOrValue(c)}`))
      }
      // Umbrella: child neighborhood/city labels as district eq
      target.districts?.forEach((d) => orParts.push(districtEqForOrClause(d)))
    } else if (target.level === 'city' || target.level === 'neighborhood') {
      if (schema.hasCityCode && target.cityCode) {
        orParts.push(`city_code.eq.${pgOrValue(target.cityCode)}`)
        target.cities?.forEach((c) => {
          if (c !== target.cityCode) orParts.push(`city_code.eq.${pgOrValue(c)}`)
        })
      }
      // Parent region catch-all for legacy rows with region but null city
      if (schema.hasRegionCode && target.regionCode) {
        orParts.push(`region_code.eq.${pgOrValue(target.regionCode)}`)
      }
      target.districts?.forEach((d) => orParts.push(districtEqForOrClause(d)))
      // Provisional / metadata city_label
      if (target.label) {
        orParts.push(`metadata.cs.${JSON.stringify({ city: target.label })}`)
        orParts.push(`metadata.cs.${JSON.stringify({ city_label: target.label })}`)
        orParts.push(`metadata.cs.${JSON.stringify({ parent_location: target.label })}`)
      }
    }
  }

  // Free-text / unresolved: ILIKE district + metadata city_label
  if (orParts.length === 0) {
    const parts = []
    const d = ilikeFrag('district', whereValue)
    if (d) parts.push(d)
    parts.push(`metadata.cs.${JSON.stringify({ city: whereValue })}`)
    parts.push(`metadata.cs.${JSON.stringify({ city_label: whereValue })}`)
    return parts.join(',')
  }

  // Always soft-add ILIKE for provisional labels matching the query text
  const softDistrict = ilikeFrag('district', whereValue)
  if (softDistrict) orParts.push(softDistrict)

  const unique = Array.from(new Set(orParts))
  return unique.join(',')
}

export async function applySmartWhereFilter(query, whereValue) {
  const orClause = await buildSmartWhereOrClause(whereValue)
  if (!orClause) return query
  return query.or(orClause)
}
