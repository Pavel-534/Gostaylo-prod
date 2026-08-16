'use client'

/**
 * Маркер каталога: ценовая пилюля + Popup.
 * Stage 201.76 — highlight via DOM class (no DivIcon recreate → no popup blink on list hover).
 */

import { useMemo, useState, useRef, useEffect } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { createLeafletPricePillDivIcon } from '@/lib/maps/map-provider-adapter'
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'
import { ListingMapPopupLazy } from '@/components/listing/ListingMapPopupLazy'

/**
 * @param {object} props
 * @param {Record<string, unknown>} [props.listing]
 * @param {{ id: string, lat?: number, lng?: number, price?: number|null }} [props.pin]
 * @param {[number,number]} props.position
 * @param {string} props.priceLabel
 * @param {boolean} props.approximate
 * @param {boolean} props.selected — pin with open popup / catalog selection
 * @param {boolean} [props.hovered] — list hover highlight (ignored when selected)
 * @param {string} [props.language]
 * @param {(id: string) => void} [props.onSelect]
 * @param {(id: string) => void} [props.onOpenListing]
 * @param {(id: string) => void} [props.onPopupOpen]
 * @param {(id: string) => void} [props.onPopupClose]
 * @param {object|null} [props.initialDates]
 * @param {string} [props.currency]
 * @param {Record<string, number>} [props.exchangeRates]
 * @param {boolean} [props.lazyPopup]
 * @param {number} [props.zIndexOffset]
 */
export function ListingPriceMarker({
  listing = null,
  pin = null,
  position,
  priceLabel,
  approximate,
  selected,
  hovered = false,
  language = 'ru',
  onSelect,
  onOpenListing = null,
  onPopupOpen = null,
  onPopupClose = null,
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
  // Icon identity depends only on price label — never on hover/selected (avoids setIcon blink).
  const icon = useMemo(() => createLeafletPricePillDivIcon(L, priceLabel), [priceLabel])

  useEffect(() => {
    const root = markerRef.current?.getElement?.()
    if (!root) return
    const pill = root.querySelector('.gostaylo-price-pill')
    if (!pill) return
    const isSelected = Boolean(selected)
    const isHovered = Boolean(hovered) && !isSelected
    pill.classList.toggle('gostaylo-price-pill--selected', isSelected)
    pill.classList.toggle('gostaylo-price-pill--hovered', isHovered)
  }, [selected, hovered, priceLabel, icon])

  useEffect(() => {
    if (!popupOpen || !listingId) return
    onPopupOpen?.(listingId)
  }, [popupOpen, listingId, onPopupOpen])

  // Selection moved to another pin → close this popup (no orphan ghost card).
  useEffect(() => {
    if (!popupOpen) return
    if (selected) return
    markerRef.current?.closePopup?.()
  }, [selected, popupOpen])

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
        popupclose: () => {
          setPopupOpen(false)
          if (listingId) onPopupClose?.(listingId)
        },
      }}
    >
      <Popup
        autoPan
        autoPanPadding={[56, 56]}
        keepInView={false}
        className="map-listing-popup"
        autoClose={false}
        closeOnClick={false}
      >
        {useLazyPopup ? (
          <ListingMapPopupLazy
            listingId={listingId}
            enabled={popupOpen}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
            onOpenDetails={onOpenListing}
          />
        ) : (
          <ListingPopupCard
            listing={listing}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
            onOpenDetails={onOpenListing}
          />
        )}
      </Popup>
    </Marker>
  )
}
