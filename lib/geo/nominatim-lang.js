/**
 * Stage 200.84 — Nominatim Accept-Language SSOT (wizard / guest UI lang).
 * Keep cache keys language-aware so RU and EN reverse do not collide.
 */

const SUPPORTED = new Set(['ru', 'en', 'th', 'zh'])

/**
 * @param {string|null|undefined} lang
 * @returns {'ru'|'en'|'th'|'zh'}
 */
export function normalizeNominatimLang(lang) {
  const raw = String(lang || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  const primary = raw.split('-')[0] || 'en'
  if (SUPPORTED.has(primary)) return /** @type {'ru'|'en'|'th'|'zh'} */ (primary)
  return 'en'
}

/**
 * Nominatim viewbox: left,top,right,bottom (minLon,maxLat,maxLon,minLat).
 * @param {number} lat
 * @param {number} lon
 * @param {number} [deltaDeg=0.22] ~20–25 km at mid latitudes
 */
export function cityViewboxFromCentroid(lat, lon, deltaDeg = 0.22) {
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const d = Math.min(Math.max(Number(deltaDeg) || 0.22, 0.05), 1.5)
  const left = b - d
  const right = b + d
  const top = a + d
  const bottom = a - d
  return `${left},${top},${right},${bottom}`
}

/**
 * Short street line for listings.address (not the full OSM hierarchy).
 * @param {Record<string, unknown>|null|undefined} addr
 * @param {string|null|undefined} displayName
 */
export function formatListingStreetAddress(addr, displayName) {
  const a = addr && typeof addr === 'object' ? addr : null
  if (a) {
    const road = String(a.road || a.pedestrian || a.street || a.residential || a.footway || '').trim()
    const house = String(a.house_number || '').trim()
    if (road && house) return `${road}, ${house}`
    if (road) return road
    if (house) return house
  }
  const dn = String(displayName || '').trim()
  if (!dn) return ''
  // Keep first 1–2 comma segments (street / house), drop oblast chain
  const parts = dn.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.slice(0, 2).join(', ')
}

/**
 * @param {{ label_en?: string|null, label_ru?: string|null, label_th?: string|null, label_zh?: string|null, code?: string }} row
 * @param {string} lang
 */
export function geoRowLabelForLang(row, lang) {
  if (!row) return ''
  const L = normalizeNominatimLang(lang)
  if (L === 'ru' && row.label_ru) return String(row.label_ru)
  if (L === 'th' && row.label_th) return String(row.label_th)
  if (L === 'zh' && row.label_zh) return String(row.label_zh)
  if (L === 'en' && row.label_en) return String(row.label_en)
  return String(row.label_ru || row.label_en || row.label_th || row.label_zh || row.code || '')
}
