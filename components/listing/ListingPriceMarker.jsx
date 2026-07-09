'use client'

/**
 * Маркер каталога: ценовая пилюля + Popup (**`ListingPopupCard`** или lazy **`ListingMapPopupLazy`**).
 * SSOT пилюли: **`createLeafletPricePillDivIcon`** (**`lib/maps/map-provider-adapter.js`**).
 */

import { useMemo, useState, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { createLeafletPricePillDivIcon } from '@/lib/maps/map-provider-adapter'
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'
import { ListingMapPopupLazy } from '@/components/listing/ListingMapPopupLazy'

/**
 * @param {object} props
 * @param {Record<string, unknown>} [props.listing] — полный листинг (fallback / legacy)
 * @param {{ id: string, lat?: number, lng?: number, price?: number|null }} [props.pin] — lean pin (Stage 163.1)
 * @param {[number,number]} props.position
 * @param {string} props.priceLabel
 * @param {boolean} props.approximate
 * @param {boolean} props.selected
 * @param {string} [props.language]
 * @param {(id: string) => void} [props.onSelect]
 * @param {object|null} [props.initialDates]
 * @param {string} [props.currency]
 * @param {Record<string, number>} [props.exchangeRates]
 * @param {boolean} [props.lazyPopup]
 * @param {number} [props.zIndexOffset] — extra stack above clusters (Stage 171.14)
 */
export function ListingPriceMarker({
  listing = null,
  pin = null,
  position,
  priceLabel,
  approximate,
  selected,
  language = 'ru',
  onSelect,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  lazyPopup = false,
  zIndexOffset = 0,
}) {
  const markerRef = useRef(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const markerListing = listing || (pin ? { id: pin.id } : null)
  const listingId = String(markerListing?.id || pin?.id || '').trim()
  const hasFullListing = Boolean(listing?.title)
  const useLazyPopup = lazyPopup && !hasFullListing && Boolean(listingId)

  const gslVerified = listing ? listingQualifiesForTrustVerifiedMiniBadge(listing) : false
  const icon = useMemo(
    () => createLeafletPricePillDivIcon(L, priceLabel, { selected }),
    [priceLabel, selected],
  )

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      gslVerified={gslVerified}
      zIndexOffset={(selected ? 1100 : 0) + zIndexOffset}
      eventHandlers={{
        click: () => {
          if (listingId) onSelect?.(listingId)
          markerRef.current?.openPopup()
        },
        popupopen: () => setPopupOpen(true),
        popupclose: () => setPopupOpen(false),
      }}
    >
      <Popup autoPan={false} className="map-listing-popup">
        {useLazyPopup ? (
          <ListingMapPopupLazy
            listingId={listingId}
            enabled={popupOpen}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
          />
        ) : (
          <ListingPopupCard
            listing={listing}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
          />
        )}
      </Popup>
    </Marker>
  )
}
