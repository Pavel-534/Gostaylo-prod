'use client'

import { useMemo } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatPrice } from '@/lib/currency'

/**
 * Stage 163.1 — server-side grid cluster (PostGIS ST_SnapToGrid).
 *
 * @param {object} props
 * @param {{ clusterId: number, count: number, lat: number, lng: number, minPrice?: number|null }} props.cluster
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

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => {
          map.flyTo(position, Math.min(map.getZoom() + 2, 16), { animate: true })
        },
      }}
    />
  )
}
