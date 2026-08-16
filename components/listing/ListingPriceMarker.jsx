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
      // Mint + amber ring survives force-dark better than white→black inversion.
      pill.style.background = '#0D9488'
      pill.style.color = '#ffffff'
      pill.style.webkitTextFillColor = '#ffffff'
      pill.style.borderColor = '#FBBF24'
      pill.style.boxShadow = '0 0 0 3px #FBBF24, 0 4px 12px rgb(13 148 136 / 0.45)'
      pill.style.transform = 'scale(1.08)'
    } else if (isHovered) {
      pill.style.background = '#1e293b'
      pill.style.color = '#ffffff'
      pill.style.webkitTextFillColor = '#ffffff'
      pill.style.borderColor = '#64748b'
      pill.style.boxShadow = '0 2px 6px rgb(15 23 42 / 0.25)'
      pill.style.transform = ''
    } else {
      pill.style.background = '#0f172a'
      pill.style.color = '#ffffff'
      pill.style.webkitTextFillColor = '#ffffff'
      pill.style.borderColor = '#1e293b'
      pill.style.boxShadow = '0 1px 2px rgb(15 23 42 / 0.2)'
      pill.style.transform = ''
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
