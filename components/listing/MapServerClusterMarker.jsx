'use client'

import { useMemo } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatPrice } from '@/lib/currency'
import { leafletBoundsAroundPointMeters } from '@/lib/maps/map-provider-adapter'

/**
 * Stage 163.1 / 167.1 — server-side grid cluster (PostGIS ST_SnapToGrid).
 *
 * @param {object} props
 * @param {{ clusterId: number, count: number, lat: number, lng: number, minPrice?: number|null, cellSizeM?: number }} props.cluster
 */
export function MapServerClusterMarker({
  cluster,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
}) {
  const map = useMap()
  const count = Number(cluster?.count) || 0
  const position = [Number(cluster.lat), Number(cluster.lng)]
  const cellSizeM = Number(cluster?.cellSizeM) || 3500
  const priceHint =
    cluster?.minPrice != null && Number.isFinite(Number(cluster.minPrice))
      ? formatPrice(Number(cluster.minPrice), currency, exchangeRates, language)
      : ''

  const icon = useMemo(() => {
    const label = priceHint ? `${count}<br/><span class="text-[10px] font-medium">${priceHint}</span>` : String(count)
    return L.divIcon({
      html: `<div class="gostaylo-map-cluster gostaylo-map-cluster--mid"><span>${label}</span></div>`,
      className: 'gostaylo-map-cluster-wrap',
      iconSize: L.point(52, 52),
      iconAnchor: L.point(26, 26),
    })
  }, [count, priceHint])

  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1]) || count < 1) return null

  const zoomToCluster = () => {
    const bounds = leafletBoundsAroundPointMeters(
      L,
      { lat: position[0], lng: position[1] },
      Math.max(cellSizeM / 2, 400),
    )
    map.fitBounds(bounds, { padding: [48, 48], animate: true, maxZoom: 15 })
  }

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: zoomToCluster,
      }}
    />
  )
}
