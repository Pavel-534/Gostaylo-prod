'use client'

/**
 * Catalog price pill marker — click selects pin; popup lives in CatalogMapSelectedPopup.
 * Stage 201.77 — no Popup child (cluster/pin remount must not blink the card).
 */

import { useMemo, useRef, useEffect } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { createLeafletPricePillDivIcon } from '@/lib/maps/map-provider-adapter'
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile'

/**
 * @param {object} props
 * @param {Record<string, unknown>} [props.listing]
 * @param {{ id: string, lat?: number, lng?: number, price?: number|null }} [props.pin]
 * @param {[number,number]} props.position
 * @param {string} props.priceLabel
 * @param {boolean} props.selected
 * @param {boolean} [props.hovered]
 * @param {(id: string) => void} [props.onSelect]
 * @param {number} [props.zIndexOffset]
 */
export function ListingPriceMarker({
  listing = null,
  pin = null,
  position,
  priceLabel,
  selected,
  hovered = false,
  onSelect,
  zIndexOffset = 0,
}) {
  const markerRef = useRef(null)
  const markerListing = listing || (pin ? { id: pin.id } : null)
  const listingId = String(markerListing?.id || pin?.id || '').trim()
  const gslVerified = listing ? listingQualifiesForTrustVerifiedMiniBadge(listing) : false
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
    if (isSelected) {
      pill.style.background = '#006666'
      pill.style.color = '#ffffff'
      pill.style.webkitTextFillColor = '#ffffff'
      pill.style.borderColor = '#005757'
    } else if (isHovered) {
      pill.style.background = '#f1f5f9'
      pill.style.color = '#0f172a'
      pill.style.webkitTextFillColor = '#0f172a'
      pill.style.borderColor = '#64748b'
    } else {
      pill.style.background = '#ffffff'
      pill.style.color = '#0f172a'
      pill.style.webkitTextFillColor = '#0f172a'
      pill.style.borderColor = '#cbd5e1'
    }
  }, [selected, hovered, priceLabel, icon])

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
        },
      }}
    />
  )
}
