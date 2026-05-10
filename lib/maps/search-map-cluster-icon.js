/**
 * Stage 89.0 — SSOT иконки кластера по «плотности» verified (как **`listingQualifiesForTrustVerifiedMiniBadge`** на маркерах: **`options.gslVerified`**).
 *
 * @param {import('leaflet')} L
 * @param {import('leaflet').MarkerCluster} cluster
 * @returns {import('leaflet').DivIcon}
 */
export function createSearchMapClusterDivIcon(L, cluster) {
  const markers = cluster.getAllChildMarkers()
  const n = cluster.getChildCount()
  let verified = 0
  for (let i = 0; i < markers.length; i++) {
    if (markers[i]?.options?.gslVerified === true) verified++
  }
  const density = n > 0 ? verified / n : 0
  let tier = 'low'
  if (density > 0.5) tier = 'high'
  else if (density > 0.2) tier = 'mid'

  return L.divIcon({
    html: `<div class="gostaylo-map-cluster gostaylo-map-cluster--${tier}"><span>${n}</span></div>`,
    className: 'gostaylo-map-cluster-wrap',
    iconSize: L.point(48, 48),
    iconAnchor: L.point(24, 24),
  })
}
