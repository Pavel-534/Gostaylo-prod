/**
 * Map provider adapter (Stage 45.3) — priced pins & bounds without binding consumers to Leaflet.
 * Pass the Leaflet namespace (`import L from 'leaflet'`) from client-only components.
 */

/**
 * @typedef {{ lat: number, lng: number }} MapLatLng
 * @typedef {{ id: string, lat: number, lng: number, priceLabel: string, selected?: boolean, approximate?: boolean }} MapPricedPin
 */

/**
 * @param {unknown} listing
 * @returns {MapLatLng | null}
 */
export function extractListingLatLng(listing) {
  if (!listing || typeof listing !== 'object') return null
  const lat = listing.latitude ?? listing.lat
  const lng = listing.longitude ?? listing.lng
  if (lat == null || lng == null) return null
  const la = parseFloat(lat)
  const ln = parseFloat(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return { lat: la, lng: ln }
}

/**
 * @param {unknown[]} listings
 * @returns {MapPricedPin[]}
 */
export function toSearchMapPricedPins(listings, { formatPriceLabel } = {}) {
  const fmt =
    typeof formatPriceLabel === 'function'
      ? formatPriceLabel
      : (listing) => String(listing?.basePriceThb ?? listing?.base_price_thb ?? '')
  const out = []
  for (const listing of listings || []) {
    const ll = extractListingLatLng(listing)
    if (!ll) continue
    const id = String(listing.id ?? listing.listing_id ?? '')
    if (!id) continue
    out.push({
      id,
      lat: ll.lat,
      lng: ll.lng,
      priceLabel: fmt(listing),
    })
  }
  return out
}

function escapePricePillHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * @param {import('leaflet')} L — Leaflet namespace from `import L from 'leaflet'`
 * @param {string} priceText
 * @param {{ selected?: boolean, approximate?: boolean }} [options]
 */
/** Stage 88.0 — явный **`iconSize`/`iconAnchor`**: надёжный hit-area и точка привязки к координате (Leaflet без «сломанной» метрики 1×1). */
const PRICE_PILL_SLOT_W = 140
const PRICE_PILL_SLOT_H = 48

export function createLeafletPricePillDivIcon(L, priceText, options = {}) {
  const safe = escapePricePillHtml(priceText)
  const { selected = false, approximate = false } = options
  const approxClass = approximate ? ' gostaylo-price-pill--approx' : ''
  const selClass = selected ? ' gostaylo-price-pill--selected' : ''
  return L.divIcon({
    className: 'gostaylo-price-pill-icon-root',
    html: `<div class="gostaylo-price-pill-marker-slot"><div class="gostaylo-price-pill${approxClass}${selClass}">${safe}</div></div>`,
    iconSize: [PRICE_PILL_SLOT_W, PRICE_PILL_SLOT_H],
    iconAnchor: [PRICE_PILL_SLOT_W / 2, PRICE_PILL_SLOT_H],
    popupAnchor: [0, -PRICE_PILL_SLOT_H],
  })
}

/**
 * @param {import('leaflet')} L
 * @param {MapLatLng} center
 * @param {number} radiusMeters
 */
export function leafletBoundsAroundPointMeters(L, center, radiusMeters) {
  const lat = center.lat
  const lng = center.lng
  const dLat = radiusMeters / 111320
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1
  const dLng = radiusMeters / (111320 * cosLat)
  return L.latLngBounds([lat - dLat, lng - dLng], [lat + dLat, lng + dLng])
}
