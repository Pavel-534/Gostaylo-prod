'use client'

/**
 * Stage 201.77 — map-level listing popup host (not a child of price Marker).
 * Marker icon/cluster remounts must not destroy the open card (mobile blink root cause).
 * Stage 201.89 — ignore programmatic popupclose (open/remount) so pin ring stays while card open.
 * Stage 202.52 — soft keep-in-view pan so the card stays fully inside the map frame (desktop + mobile).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ListingPopupCard } from '@/components/listing/ListingPopupCard'
import { ListingMapPopupLazy } from '@/components/listing/ListingMapPopupLazy'
import { computeLeafletPopupKeepInViewPanBy } from '@/lib/maps/map-popup-keep-in-view'
import {
  CATALOG_MAP_POPUP_AUTOPAN_PADDING_XY,
  CATALOG_MAP_POPUP_KEEP_IN_VIEW_DURATION_S,
  CATALOG_MAP_POPUP_KEEP_IN_VIEW_MIN_PX,
  CATALOG_MAP_POPUP_PAD_DESKTOP,
  CATALOG_MAP_POPUP_PAD_MOBILE,
} from '@/lib/maps/catalog-map-ux-policy'

const HOST_ICON = L.divIcon({
  className: 'catalog-map-popup-host-icon',
  html: '',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
  popupAnchor: [0, -12],
})

/**
 * Soft pan map so `.map-listing-popup` fits in the map container (no zoom change).
 * @param {import('leaflet').Map} map
 * @param {import('@/lib/maps/map-popup-keep-in-view').MapPopupPadding} padding
 */
function panMapToKeepListingPopupInView(map, padding) {
  if (!map?.getContainer || !map.getSize || !map.panBy) return
  const container = map.getContainer()
  const popupEl = container?.querySelector?.('.leaflet-popup.map-listing-popup')
  if (!popupEl) return

  const size = map.getSize()
  const mapRect = container.getBoundingClientRect()
  const popRect = popupEl.getBoundingClientRect()
  const { x, y } = computeLeafletPopupKeepInViewPanBy({
    mapWidth: size.x,
    mapHeight: size.y,
    popupLeft: popRect.left - mapRect.left,
    popupTop: popRect.top - mapRect.top,
    popupWidth: popRect.width,
    popupHeight: popRect.height,
    padding,
    minPanPx: CATALOG_MAP_POPUP_KEEP_IN_VIEW_MIN_PX,
  })
  if (x === 0 && y === 0) return

  map.panBy([x, y], {
    animate: true,
    duration: CATALOG_MAP_POPUP_KEEP_IN_VIEW_DURATION_S,
    easeLinearity: 0.2,
  })
}

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
 * @param {boolean} [props.compactMapChrome] — mobile sheet / narrow map → larger bottom pad
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
  compactMapChrome = false,
}) {
  const map = useMap()
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
  const keepInViewPad = compactMapChrome ? CATALOG_MAP_POPUP_PAD_MOBILE : CATALOG_MAP_POPUP_PAD_DESKTOP

  const scheduleKeepInView = useCallback(() => {
    if (!open) return
    // After Leaflet open + layout / lazy card paint.
    const run = () => panMapToKeepListingPopupInView(map, keepInViewPad)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run)
    })
    window.setTimeout(run, 80)
    window.setTimeout(run, 220)
  }, [open, map, keepInViewPad])

  // Open popup; MapSelectionSync may fly pin into viewport first — keep-in-view runs after.
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
      scheduleKeepInView()
    }, 0)
    return () => {
      ignorePopupCloseRef.current = true
      window.clearTimeout(t)
    }
  }, [open, position, listingId, scheduleKeepInView])

  // Lazy card / image settle — re-measure without zoom (soft pan only if still clipped).
  useEffect(() => {
    if (!open || !listingId) return undefined
    scheduleKeepInView()
    return undefined
  }, [open, listingId, hasFullListing, useLazy, scheduleKeepInView])

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
        autoPan
        autoPanPadding={CATALOG_MAP_POPUP_AUTOPAN_PADDING_XY}
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
