'use client'

/**
 * PDP / privacy map — brand pin (SSOT: createLeafletBrandPinDivIcon).
 * Fixes broken default Leaflet marker-icon.png on bundled routes.
 */

import { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { createLeafletBrandPinDivIcon } from '@/lib/maps/map-provider-adapter'

export function ListingMapPin({ position, approximate = false, children }) {
  const icon = useMemo(
    () => createLeafletBrandPinDivIcon(L, { approximate }),
    [approximate],
  )

  return (
    <Marker position={position} icon={icon}>
      {children}
    </Marker>
  )
}
