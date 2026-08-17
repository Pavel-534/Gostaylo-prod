'use client'

/**
 * Stage 201.77 — map-level listing popup host (not a child of price Marker).
 * Marker icon/cluster remounts must not destroy the open card (mobile blink root cause).
 * Stage 201.89 — ignore programmatic popupclose (open/remount) so pin ring stays while card open.
 */

import { useEffect, useMemo, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
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
  const markerRef = useRef(null)
  /** Suppress selection clear when we close/reopen popup ourselves (cluster remount / open cycle). */
  const ignorePopupCloseRef = useRef(false)
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

  // Avoid pan loops on mobile: only open popup; MapSelectionSync owns pan policy.
  useEffect(() => {
    if (!open || !position) {
      ignorePopupCloseRef.current = true
      markerRef.current?.closePopup?.()
      const t = window.setTimeout(() => {
        ignorePopupCloseRef.current = false
      }, 0)
      return () => window.clearTimeout(t)
    }
    ignorePopupCloseRef.current = true
    const t = window.setTimeout(() => {
      markerRef.current?.openPopup?.()
      ignorePopupCloseRef.current = false
    }, 0)
    return () => {
      ignorePopupCloseRef.current = true
      window.clearTimeout(t)
    }
  }, [open, position, listingId])

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
        popupclose: () => {
          if (ignorePopupCloseRef.current) return
          onClose?.()
        },
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
