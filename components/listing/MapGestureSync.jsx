'use client'

/**
 * Stage 200.31 — sync Leaflet interaction handlers after mount.
 * react-leaflet MapContainer props (dragging / touchZoom / …) often apply only once;
 * toggling cooperative-touch or pin-lock must call enable()/disable() on the live map.
 */

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * @param {{ enabled: boolean }} props
 */
export function MapGestureSync({ enabled }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const handlers = [
      map.dragging,
      map.touchZoom,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
    ]

    for (const h of handlers) {
      if (!h || typeof h.enable !== 'function' || typeof h.disable !== 'function') continue
      if (enabled) h.enable()
      else h.disable()
    }
  }, [map, enabled])

  return null
}
