import { getDistrictsForCity } from '@/lib/locations/city-district-map'
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

export async function buildSmartWhereOrClause(whereValue) {
  if (!whereValue || whereValue === 'all') return null
  const target = resolveWhereTarget(whereValue)
  const cityJson = JSON.stringify({ city: whereValue })
  const orParts = []

  const schema = await getGeoSchemaState()

  if (target) {
    if (target.level === 'country') {
      if (schema.hasCountryCode) orParts.push(`country_code.eq.${pgOrValue(target.countryCode)}`)
      if (schema.hasRegionCode) target.regions?.forEach((r) => orParts.push(`region_code.eq.${pgOrValue(r)}`))
      if (schema.hasCityCode) target.cities?.forEach((c) => orParts.push(`city_code.eq.${pgOrValue(c)}`))
    } else if (target.level === 'region') {
      if (schema.hasRegionCode) orParts.push(`region_code.eq.${pgOrValue(target.regionCode)}`)
      if (schema.hasCityCode) target.cities?.forEach((c) => orParts.push(`city_code.eq.${pgOrValue(c)}`))
      target.districts?.forEach((d) => orParts.push(districtEqForOrClause(d)))
    } else if (target.level === 'city') {
      if (schema.hasCityCode) orParts.push(`city_code.eq.${pgOrValue(target.cityCode)}`)
      target.districts?.forEach((d) => orParts.push(districtEqForOrClause(d)))
    }
  }

  const districts = getDistrictsForCity(whereValue)
  if (districts?.length) {
    orParts.push(`metadata.cs.${cityJson}`)
    districts.forEach((d) => orParts.push(districtEqForOrClause(d)))
  }

  if (orParts.length === 0) {
    return `metadata.cs.${cityJson},district.ilike.%${whereValue}%`
  }

  const unique = Array.from(new Set(orParts))
  return unique.join(',')
}

export async function applySmartWhereFilter(query, whereValue) {
  const orClause = await buildSmartWhereOrClause(whereValue)
  if (!orClause) return query
  return query.or(orClause)
}
