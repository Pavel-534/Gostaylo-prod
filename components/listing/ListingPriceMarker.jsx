'use client'

/**
 * Маркер каталога: ценовая пилюля + Popup (**`ListingPopupCard`**).
 * SSOT пилюли: **`createLeafletPricePillDivIcon`** (**`lib/maps/map-provider-adapter.js`**).
 */

import { useMemo } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createLeafletPricePillDivIcon } from '@/lib/maps/map-provider-adapter'
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'

/**
 * @param {object} props
 * @param {Record<string, unknown>} props.listing
 * @param {[number,number]} props.position
 * @param {string} props.priceLabel
 * @param {boolean} props.approximate
 * @param {boolean} props.selected
 * @param {string} [props.language]
 * @param {(id: string) => void} [props.onSelect]
 * @param {object|null} [props.initialDates]
 * @param {string} [props.currency]
 * @param {Record<string, number>} [props.exchangeRates]
 */
export function ListingPriceMarker({
  listing,
  position,
  priceLabel,
  approximate,
  selected,
  language = 'ru',
  onSelect,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
}) {
  const map = useMap()
  const gslVerified = listingQualifiesForTrustVerifiedMiniBadge(listing)
  const icon = useMemo(
    () => createLeafletPricePillDivIcon(L, priceLabel, { selected, approximate }),
    [priceLabel, selected, approximate],
  )

  return (
    <Marker
      position={position}
      icon={icon}
      gslVerified={gslVerified}
      zIndexOffset={selected ? 1100 : 0}
      eventHandlers={{
        click: () => {
          const lid = listing?.id
          if (lid != null && lid !== '') onSelect?.(String(lid))
          map.setView(position, Math.max(map.getZoom(), 14), { animate: true })
        },
      }}
    >
      <Popup autoPan autoPanPadding={[80, 60]} className="map-listing-popup">
        <ListingPopupCard
          listing={listing}
          language={language}
          isApproximateLocation={approximate}
          initialDates={initialDates}
          currency={currency}
          exchangeRates={exchangeRates}
        />
      </Popup>
    </Marker>
  )
}
