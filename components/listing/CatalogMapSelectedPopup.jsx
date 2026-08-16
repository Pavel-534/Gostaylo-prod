'use client'

/**
 * Stage 201.77 — map-level listing popup host (not a child of price Marker).
 * Marker icon/cluster remounts must not destroy the open card (mobile blink root cause).
 */

import { useEffect, useMemo, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'
import { ListingMapPopupLazy } from '@/components/listing/ListingMapPopupLazy'

const HOST_ICON = L.divIcon({
  className: 'catalog-map-popup-host-icon',
  html: '',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -12],
})

/**
 * @param {object} props
 * @param {{ id: string, lat: number, lng: number, isApproximate?: boolean } | null} props.pin
 * @param {Record<string, unknown> | null} [props.listing]
 * @param {boolean} props.open
 * @param {string} [props.language]
 * @param {object|null} [props.initialDates]
 * @param {string} [props.currency]
 * @param {Record<string, number>} [props.exchangeRates]
 * @param {(id: string) => void} [props.onOpenDetails]
 * @param {() => void} [props.onClose]
 */
export function CatalogMapSelectedPopup({
  pin,
  listing = null,
  open,
  language = 'ru',
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onOpenDetails = null,
  onClose = null,
}) {
  const map = useMap()
  const markerRef = useRef(null)
  const listingId = String(pin?.id || listing?.id || '').trim()
  const position = useMemo(() => {
    if (!pin) return null
    const lat = Number(pin.lat)
    const lng = Number(pin.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return [lat, lng]
  }, [pin])

  const hasFullListing = Boolean(listing?.title)
  const useLazy = !hasFullListing && Boolean(listingId)
  const approximate = pin?.isApproximate === true

  useEffect(() => {
    if (!open || !position) {
      markerRef.current?.closePopup?.()
      return undefined
    }
    const t = window.setTimeout(() => {
      markerRef.current?.openPopup?.()
      try {
        const ll = L.latLng(position[0], position[1])
        if (typeof map.panInside === 'function') {
          map.panInside(ll, { padding: [72, 72] })
        } else if (!map.getBounds()?.contains?.(ll)) {
          map.panTo(ll, { animate: true })
        }
      } catch {
        /* map not ready */
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, position, listingId, map])

  if (!open || !position || !listingId) return null

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={HOST_ICON}
      interactive={false}
      keyboard={false}
      zIndexOffset={6000}
      eventHandlers={{
        popupclose: () => onClose?.(),
      }}
    >
      <Popup
        autoPan={false}
        keepInView={false}
        className="map-listing-popup"
        autoClose={false}
        closeOnClick={false}
        closeButton
      >
        {useLazy ? (
          <ListingMapPopupLazy
            listingId={listingId}
            enabled={open}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
            onOpenDetails={onOpenDetails}
          />
        ) : (
          <ListingPopupCard
            listing={listing}
            language={language}
            isApproximateLocation={approximate}
            initialDates={initialDates}
            currency={currency}
            exchangeRates={exchangeRates}
            onOpenDetails={onOpenDetails}
          />
        )}
      </Popup>
    </Marker>
  )
}
