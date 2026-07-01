import { normalizeAmenitySlug } from '@/lib/constants/amenities-dictionary'
import { metadataFiltersActive } from '@/lib/search/listing-metadata-filter'

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function buildTextSearchOr(q) {
  if (!q || q.trim().length < 2) return null
  const words = q.trim().split(/\s+/).filter((w) => w.length >= 2)
  if (words.length === 0) return null
  const parts = []
  for (const w of words) {
    const esc = w.replace(/'/g, "''")
    parts.push(`title.ilike.%${esc}%`, `description.ilike.%${esc}%`, `district.ilike.%${esc}%`)
  }
  return parts.join(',')
}

export function matchesAllWords(listing, words) {
  const text = `${listing.title || ''} ${listing.description || ''} ${listing.district || ''}`.toLowerCase()
  return words.every((w) => text.includes(w.toLowerCase()))
}

export function parseMapBounds(sp) {
  const south = parseFloat(sp.get('south'))
  const north = parseFloat(sp.get('north'))
  const west = parseFloat(sp.get('west'))
  const east = parseFloat(sp.get('east'))
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  if (south >= north) return null
  if (west >= east) return null
  return { south, north, west, east }
}

export function listingLatLngRaw(listing) {
  const lat = parseFloat(listing.latitude)
  const lng = parseFloat(listing.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

export function pointInBounds(lat, lng, b) {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east
}

export function firstFloatParam(sp, ...keys) {
  for (const k of keys) {
    const v = sp.get(k)
    if (v != null && v !== '') {
      const n = parseFloat(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export function firstIntParam(sp, ...keys) {
  for (const k of keys) {
    const v = sp.get(k)
    if (v != null && v !== '') {
      const n = parseInt(v, 10)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export function parseBooleanSearchParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const normalized = String(raw).trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return null
}

export function parseAmenitiesFromSearchParams(sp) {
  const raw = sp.get('amenities')
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(',')
        .map((value) => normalizeAmenitySlug(value))
        .filter(Boolean),
    ),
  ]
}

/** Transport/yacht metadata URL facets (unified registry SQL). */
export function metadataVerticalFiltersActive(metadataFilters) {
  if (!metadataFilters) return false
  return !!(
    metadataFilters.transmission ||
    metadataFilters.fuelType ||
    metadataFilters.engineCcMin != null ||
    (metadataFilters.cabinsMin != null && metadataFilters.cabinsMin > 0) ||
    metadataFilters.withCaptain === true ||
    metadataFilters.vesselType
  )
}

export function sqlMetadataFiltersActive(filters) {
  return Boolean(
    filters.instantBookingOnly ||
      (filters.amenities && filters.amenities.length > 0) ||
      (Number.isFinite(filters.bedroomsMin) && filters.bedroomsMin > 0) ||
      (Number.isFinite(filters.bathroomsMin) && filters.bathroomsMin > 0) ||
      metadataVerticalFiltersActive(filters.metadataFilters),
  )
}

export function getCacheKey(filters) {
  if (filters.checkIn || filters.checkOut || filters.lat != null || filters.lon != null) return null
  if (filters.mapBounds) return null
  if (sqlMetadataFiltersActive(filters)) return null
  if (metadataFiltersActive(filters.metadataFilters)) return null
  const where = filters.where || filters.location || filters.city || 'all'
  const sem = filters.semantic ? 'sem1' : 'sem0'
  const profile = filters.isLite === false ? 'full' : 'lite'
  return `${filters.category || 'all'}_${filters.limit}_${where}_${filters.q || ''}_${filters.minPrice || ''}_${filters.maxPrice || ''}_${sem}_${profile}`
}

export function normalizeRadiusBoundingBox(lat, lon, radiusKm) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) return null
  const deltaLat = radiusKm / 111.32
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const lonDiv = Math.max(0.01, Math.abs(cosLat))
  const deltaLon = radiusKm / (111.32 * lonDiv)
  return {
    south: lat - deltaLat,
    north: lat + deltaLat,
    west: lon - deltaLon,
    east: lon + deltaLon,
  }
}
