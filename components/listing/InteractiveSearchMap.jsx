/**
 * GoStayLo - Interactive Search Map (Airbnb-style)
 * Desktop: list ~60% / map ~40%; price pills; viewport bounds sync.
 * Stage 89.0 — кластеризация (**`leaflet.markercluster`**): ниже масштаба **zoom 13** маркеры группируются; цвет кластера по доле Verified (**`options.gslVerified`**).
 *
 * Приватность (ADR-163): fitBounds и маркеры — только server-serialized coords + `isApproximate`; без client-side 500m inflation.
 */

'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from '@changey/react-leaflet-markercluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@/components/listing/map-listing-popup.css'
import { createSearchMapClusterDivIcon } from '@/lib/maps/search-map-cluster-icon'
import { Button } from '@/components/ui/button'
import { ListingPriceMarker } from '@/components/listing/ListingPriceMarker'
import { CatalogMapSelectedPopup } from '@/components/listing/CatalogMapSelectedPopup'
import { MapServerClusterMarker } from '@/components/listing/MapServerClusterMarker'
import { getUIText } from '@/lib/translations'
import { formatPrice } from '@/lib/currency'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { formatSameCurrencyGuestDisplay } from '@/lib/pricing/same-currency-guest-display'
import { extractListingLatLng } from '@/lib/maps/map-provider-adapter'
import { configureLeafletDefaultIcons } from '@/lib/maps/leaflet-default-icon'
import { MapPolygonDrawChrome } from '@/components/search/MapPolygonDrawChrome'

configureLeafletDefaultIcons(L)

function getListingPosition(listing) {
  const ll = extractListingLatLng(listing)
  return ll ? [ll.lat, ll.lng] : null
}

/**
 * Catalog map fitBounds — server SSOT only (`latitude`/`longitude` already public-serialized).
 * Approximate (`isApproximate` / `locationPrivacyMode: fuzz`): center on fuzzed point, no 500m client pad.
 *
 * @param {object} listing — search row or pin-shaped `{ latitude, longitude, isApproximate?, locationPrivacyMode? }`
 */
function listingLocationBounds(listing) {
  const pos = getListingPosition(listing)
  if (!pos) return null
  return L.latLngBounds(pos, pos)
}

function MapSearchThisAreaButton({
  language,
  listingsLength,
  suppressBoundsUntilRef,
  appliedBboxKey,
  onSearchThisArea,
  mapBoundsLocked,
  onClearMapBounds,
  /** Stage 201.71 — catalog map chrome off by default (obstructs browsing). */
  enableAreaSearchControls = false,
}) {
  const map = useMap()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(false)
  }, [appliedBboxKey])

  useMapEvents({
    moveend: () => {
      if (!enableAreaSearchControls) return
      if (!listingsLength) return
      if (!onSearchThisArea && !mapBoundsLocked) return
      if (Date.now() < suppressBoundsUntilRef.current) return
      setDirty(true)
    },
  })

  if (!enableAreaSearchControls) return null

  const applyViewportBounds = () => {
    if (!onSearchThisArea) return
    const b = map.getBounds()
    onSearchThisArea({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    })
    setDirty(false)
  }

  const canNarrow = listingsLength > 0 && onSearchThisArea
  const showSearchThisArea = !mapBoundsLocked && dirty && canNarrow
  const showSearchEverywhere = mapBoundsLocked && typeof onClearMapBounds === 'function'
  const showUpdateArea = mapBoundsLocked && dirty && canNarrow

  if (!showSearchThisArea && !showSearchEverywhere && !showUpdateArea) return null

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-[400] flex w-[92%] max-w-md -translate-x-1/2 flex-col items-center gap-2 px-1">
      {showSearchEverywhere && (
        <Button
          type="button"
          className="h-10 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-50"
          onClick={() => {
            onClearMapBounds()
            setDirty(false)
          }}
        >
          {getUIText('mapSearch_everywhere', language)}
        </Button>
      )}
      {showUpdateArea && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full max-w-sm rounded-full border-slate-200 bg-white/95 px-5 text-sm font-semibold text-slate-800 shadow-md hover:bg-slate-50"
          onClick={applyViewportBounds}
        >
          {getUIText('mapSearch_updateArea', language)}
        </Button>
      )}
      {showSearchThisArea && (
        <Button
          type="button"
          className="h-10 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-50"
          onClick={applyViewportBounds}
        >
          {getUIText('mapSearch_thisArea', language)}
        </Button>
      )}
    </div>
  )
}

function InitialListingBoundsFit({
  listings,
  suppressBoundsUntilRef,
  mapFitResetKey,
  fallbackCenter,
  fallbackZoom,
  /** Stage 201.81 — soft-back camera restore wins over world fit. */
  skipListingFit = false,
}) {
  const map = useMap()
  const didFitListingsRef = useRef(false)
  const lastResetKeyRef = useRef(mapFitResetKey)
  const lastListingsSigRef = useRef('')

  const applyFallbackCenter = useCallback(() => {
    if (skipListingFit) return false
    if (
      !Array.isArray(fallbackCenter) ||
      fallbackCenter.length < 2 ||
      !Number.isFinite(Number(fallbackCenter[0])) ||
      !Number.isFinite(Number(fallbackCenter[1]))
    ) {
      return false
    }
    suppressBoundsUntilRef.current = Date.now() + 800
    map.setView(fallbackCenter, Number(fallbackZoom) || 6)
    return true
  }, [fallbackCenter, fallbackZoom, map, suppressBoundsUntilRef, skipListingFit])

  // Stage 200.39 — on where/filter change: pan to geo target first (ignore stale pins).
  useEffect(() => {
    if (skipListingFit) return
    if (lastResetKeyRef.current === mapFitResetKey) return
    lastResetKeyRef.current = mapFitResetKey
    didFitListingsRef.current = false
    lastListingsSigRef.current = ''
    applyFallbackCenter()
  }, [mapFitResetKey, applyFallbackCenter, skipListingFit])

  // When resolve-where centroid arrives after reset and listings not fitted yet
  useEffect(() => {
    if (skipListingFit) return
    if (didFitListingsRef.current) return
    applyFallbackCenter()
  }, [fallbackCenter, fallbackZoom, applyFallbackCenter, skipListingFit])

  // Fit once per mapFitResetKey cycle. Re-fitting when pin/cluster mode flips
  // (world catalog → local pins → clusters again) snaps the map back after cluster zoom.
  useEffect(() => {
    if (skipListingFit) {
      didFitListingsRef.current = true
      return
    }
    if (didFitListingsRef.current) return

    const ids = (listings || []).map((l) => l?.id).filter(Boolean)
    const sig = ids.slice(0, 40).join(',')
    if (!sig) return

    let bounds = null
    for (const listing of listings || []) {
      const b = listingLocationBounds(listing)
      if (!b || !b.isValid()) continue
      bounds = bounds ? bounds.extend(b) : b
    }
    if (!bounds?.isValid()) return

    lastListingsSigRef.current = sig
    didFitListingsRef.current = true
    suppressBoundsUntilRef.current = Date.now() + 1400
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
  }, [listings, map, suppressBoundsUntilRef, mapFitResetKey, skipListingFit])

  return null
}

/**
 * Stage 201.81 / 201.84 — restore soft-back map camera once (center+zoom preferred, else bbox).
 */
function CatalogMapCameraRestoreOnce({ bbox, onRestored, suppressBoundsUntilRef }) {
  const map = useMap()
  const didRef = useRef(false)

  useEffect(() => {
    if (didRef.current || !bbox) return
    const south = Number(bbox.south)
    const north = Number(bbox.north)
    const west = Number(bbox.west)
    const east = Number(bbox.east)
    if (![south, north, west, east].every((n) => Number.isFinite(n))) return
    if (!(south < north) || !(west < east)) return
    didRef.current = true
    try {
      if (suppressBoundsUntilRef) {
        suppressBoundsUntilRef.current = Date.now() + 2400
      }
      const centerLat = Number(bbox.centerLat)
      const centerLng = Number(bbox.centerLng)
      const zoom = Number(bbox.zoom)
      if (
        Number.isFinite(centerLat) &&
        Number.isFinite(centerLng) &&
        Number.isFinite(zoom)
      ) {
        map.setView([centerLat, centerLng], zoom, { animate: false })
      } else {
        map.fitBounds(
          [
            [south, west],
            [north, east],
          ],
          { padding: [40, 40], maxZoom: 16, animate: false },
        )
      }
    } catch {
      /* ignore invalid leaflet bounds */
    }
    onRestored?.()
  }, [bbox, map, onRestored, suppressBoundsUntilRef])

  return null
}

function MapViewportReporter({
  onViewportBbox,
  debounceMs = CATALOG_MAP_BBOX_EMIT_DEBOUNCE_MS,
}) {
  const map = useMap()
  const timerRef = useRef(null)

  const emitBounds = useCallback(() => {
    const b = map.getBounds()
    const c = map.getCenter()
    onViewportBbox?.({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
      centerLat: c?.lat,
      centerLng: c?.lng,
      zoom: map.getZoom(),
    })
  }, [map, onViewportBbox])

  useEffect(() => {
    const t = setTimeout(emitBounds, 80)
    return () => clearTimeout(t)
  }, [emitBounds])

  useMapEvents({
    moveend: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(emitBounds, debounceMs)
    },
  })

  return null
}

/** Clear pin selection when user clicks empty map (not a marker / popup). */
function MapBackgroundClick({ onMapBackgroundClick }) {
  useMapEvents({
    click: (e) => {
      if (typeof onMapBackgroundClick !== 'function') return
      const t = e?.originalEvent?.target
      if (t?.closest?.('.leaflet-marker-icon, .leaflet-popup, .map-listing-popup')) return
      onMapBackgroundClick()
    },
  })
  return null
}

function MapSizeInvalidator({ layoutResetKey = 0 }) {
  const map = useMap()

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false })
    })
    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
    }, 320)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [map, layoutResetKey])

  return null
}

function resolvePinLatLng(pin) {
  if (!pin || typeof pin !== 'object') return null
  const lat = pin.lat ?? pin.latitude
  const lng = pin.lng ?? pin.longitude
  if (lat == null || lng == null) return null
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat))
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng))
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return { lat: la, lng: ln }
}

function MapSelectionSync({
  selectedListingId,
  pins = [],
  listings = [],
  selectionPanMode = CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
}) {
  const map = useMap()
  const lastPanIdRef = useRef(null)

  useEffect(() => {
    if (selectionPanMode === CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY) return

    const id = String(selectedListingId || '').trim()
    if (!id) {
      lastPanIdRef.current = null
      return
    }
    if (lastPanIdRef.current === id) return

    let lat = null
    let lng = null

    const pin = (pins || []).find((p) => String(p.id) === id)
    const pinLl = pin ? resolvePinLatLng(pin) : null
    if (pinLl) {
      lat = pinLl.lat
      lng = pinLl.lng
    } else {
      const listing = (listings || []).find((l) => String(l.id) === id)
      const ll = listing ? extractListingLatLng(listing) : null
      if (ll) {
        lat = ll.lat
        lng = ll.lng
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    lastPanIdRef.current = id

    try {
      const bounds = map.getBounds()
      if (bounds?.isValid?.() && bounds.contains([lat, lng])) {
        return
      }
      const zoom = map.getZoom()
      map.flyTo(
        [lat, lng],
        Number.isFinite(zoom) ? Math.max(zoom, CATALOG_MAP_SELECT_MIN_ZOOM) : CATALOG_MAP_SELECT_MIN_ZOOM,
        {
        animate: true,
          duration: CATALOG_MAP_SELECT_FLY_DURATION_MS / 1000,
        },
      )
    } catch {
      lastPanIdRef.current = null
    }
  }, [selectedListingId, pins, listings, map, selectionPanMode])

  return null
}

function pinToFitListing(pin) {
  if (!pin?.id) return null
  return {
    id: pin.id,
    latitude: pin.lat,
    longitude: pin.lng,
    isApproximate: pin.isApproximate === true,
    locationPrivacyMode: pin.locationPrivacyMode ?? null,
  }
}

function listingToPin(listing) {
  const ll = extractListingLatLng(listing)
  if (!ll) return null
  const thb = getGuestDisplayPerNight(listing)
  return {
    id: String(listing.id),
    lat: ll.lat,
    lng: ll.lng,
    price: Number.isFinite(thb) && thb > 0 ? thb : null,
    isApproximate: listing.isApproximate === true,
    locationPrivacyMode: listing.locationPrivacyMode ?? null,
  }
}

/**
 * Sidebar listings always stay on map; API pins add viewport extras (Stage 170.11).
 * When a listing is in the sidebar, its price SSOT wins over map-pins API (card parity).
 * Cluster mode: only selected listing pin is merged (Stage 171.14).
 */
function mergeCatalogMapPins(listings, mapPins, useApiLayer) {
  const fromListings = (listings || []).map(listingToPin).filter(Boolean)
  if (!useApiLayer) return fromListings

  const byId = new Map()
  for (const pin of Array.isArray(mapPins) ? mapPins : []) {
    if (pin?.id) byId.set(String(pin.id), pin)
  }
  for (const pin of fromListings) {
    const id = String(pin.id)
    const existing = byId.get(id)
    if (existing) {
      byId.set(id, {
        ...existing,
        price: pin.price,
        isApproximate: existing.isApproximate ?? pin.isApproximate,
        locationPrivacyMode: existing.locationPrivacyMode ?? pin.locationPrivacyMode,
      })
    } else {
      byId.set(id, pin)
    }
  }
  return [...byId.values()]
}

/**
 * @param {string | null | undefined} selectedId
 * @param {object[]} listings
 * @param {object[] | null} mapPins
 */
function resolveSelectedCatalogPin(selectedId, listings, mapPins) {
  const id = String(selectedId || '').trim()
  if (!id) return null

  const listing = (listings || []).find((l) => String(l.id) === id)
  if (listing) return listingToPin(listing)

  const apiPin = (mapPins || []).find((p) => String(p.id) === id)
  return apiPin ?? null
}

function resolvePinDisplayPriceThb(pin, listing) {
  if (listing) {
    const thb = getGuestDisplayPerNight(listing)
    if (Number.isFinite(thb) && thb > 0) return thb
  }
  const fromPin = Number(pin?.price)
  return Number.isFinite(fromPin) && fromPin > 0 ? fromPin : null
}

function pinPriceLabel(pin, currency, exchangeRates, language, listing = null) {
  const sameListing = listing || (pin?.basePriceAsset
    ? {
        baseCurrency: pin.baseCurrency,
        basePriceAsset: pin.basePriceAsset,
        guestServiceFeePercent: pin.guestServiceFeePercent,
      }
    : null)
  const same = sameListing
    ? formatSameCurrencyGuestDisplay(sameListing, currency, language)
    : null
  if (same) return same
  const thb = resolvePinDisplayPriceThb(pin, listing)
  return thb != null ? formatPrice(thb, currency, exchangeRates, language) : '—'
}

export default function InteractiveSearchMap({
  listings = [],
  /** Stage 163.1 — lean pins from map-pins API */
  mapPins = null,
  mapClusters = null,
  mapMode = 'pins',
  mapPinsUseApi = false,
  onViewportBbox,
  userBookings = [],
  userId = null,
  language = 'ru',
  center = [20, 100],
  zoom = 6,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  /** Синхрон с карточками списка: даты для `CardPriceDisplay` во всплывающем окне маркера */
  initialDates = null,
  selectedListingId = null,
  hoveredListingId = null,
  onListingMarkerClick,
  onListingOpen = null,
  onListingPopupOpen = null,
  onListingPopupClose = null,
  onMapBackgroundClick = null,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
  layoutResetKey = 0,
  selectionPanMode = CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
  /** Stage 201.81 — soft-back restore of previous map bbox (one-shot). */
  cameraRestoreBbox = null,
  onCameraRestoreDone = null,
  /** Stage 201.84 — keep skipListingFit after restore bbox cleared (parent React state). */
  holdSoftBackCamera = false,
  /** Stage 177.5.1 — desktop lg+ only; never true on mobile sheet. */
  enablePolygonDraw = false,
  appliedPolygon = null,
  onPolygonEncoded = null,
  onPolygonCleared = null,
}) {
  const [mounted, setMounted] = useState(false)
  const suppressBoundsUntilRef = useRef(0)
  const softBackCameraLockRef = useRef(Boolean(cameraRestoreBbox) || Boolean(holdSoftBackCamera))

  useEffect(() => {
    if (cameraRestoreBbox || holdSoftBackCamera) softBackCameraLockRef.current = true
  }, [cameraRestoreBbox, holdSoftBackCamera])

  useEffect(() => {
    setMounted(true)
  }, [])

  const hasConfirmedBooking = useCallback(
    (listingId) => {
      if (!userId || !userBookings?.length) return false
      return userBookings.some(
        (booking) =>
          booking.listing_id === listingId &&
          (booking.status === 'CONFIRMED' || booking.status === 'PAID')
      )
    },
    [userId, userBookings]
  )

  const useServerClusters = mapPinsUseApi && mapMode === 'clusters' && (mapClusters?.length ?? 0) > 0

  const listingsById = useMemo(() => {
    const byId = new Map()
    for (const listing of listings || []) {
      if (listing?.id != null) byId.set(String(listing.id), listing)
    }
    return byId
  }, [listings])

  const effectivePins = useMemo(() => {
    if (!useServerClusters) {
      return mergeCatalogMapPins(listings, mapPins, mapPinsUseApi)
    }
    const selectedPin = resolveSelectedCatalogPin(selectedListingId, listings, mapPins)
    return selectedPin ? [selectedPin] : []
  }, [useServerClusters, mapPinsUseApi, mapPins, listings, selectedListingId])

  const renderCatalogPriceMarker = useCallback(
    (pin, { zIndexOffset = 0 } = {}) => {
      const position = [pin.lat, pin.lng]
      if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null
      const listingMatch = listingsById.get(String(pin.id)) ?? null
      const pinId = String(pin.id)
      const isSelected = Boolean(selectedListingId) && pinId === String(selectedListingId)
      const isHovered =
        !selectedListingId && Boolean(hoveredListingId) && pinId === String(hoveredListingId)
      const priceText = pinPriceLabel(
        pin,
        currency,
        exchangeRates,
        language,
        listingMatch,
      )
      return (
        <ListingPriceMarker
          key={pin.id}
          listing={listingMatch}
          pin={pin}
          position={position}
          priceLabel={priceText || '—'}
          selected={isSelected}
          hovered={isHovered}
          onSelect={onListingMarkerClick}
          zIndexOffset={zIndexOffset}
        />
      )
    },
    [
      listingsById,
      currency,
      exchangeRates,
      language,
      selectedListingId,
      hoveredListingId,
      onListingMarkerClick,
    ],
  )

  const selectedPopupPin = useMemo(
    () => resolveSelectedCatalogPin(selectedListingId, listings, mapPins),
    [selectedListingId, listings, mapPins],
  )

  const selectedPopupListing = selectedPopupPin
    ? listingsById.get(String(selectedPopupPin.id)) ?? null
    : null

  const fitListings = useMemo(() => {
    if (effectivePins.length > 0) {
      return effectivePins.map(pinToFitListing).filter(Boolean)
    }
    return listings || []
  }, [effectivePins, listings])

  const markersCount = useServerClusters
    ? mapClusters.length + effectivePins.length
    : effectivePins.length || listings.length

  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">{getUIText('mapPicker_loading', language)}</span>
      </div>
    )
  }

  return (
    <div
      className={`relative h-full w-full min-h-[300px]${
        selectedListingId ? ' catalog-map--pin-selected' : ''
      }`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className={`absolute inset-0 z-0 h-full w-full rounded-lg${
          selectedListingId ? ' catalog-map-leaflet--pin-selected' : ''
        }`}
        scrollWheelZoom
        touchZoom
        dragging
        doubleClickZoom
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapSizeInvalidator layoutResetKey={layoutResetKey} />

        {typeof onViewportBbox === 'function' && (
          <MapViewportReporter onViewportBbox={onViewportBbox} />
        )}

        {typeof onMapBackgroundClick === 'function' && (
          <MapBackgroundClick onMapBackgroundClick={onMapBackgroundClick} />
        )}

        <MapSearchThisAreaButton
          language={language}
          listingsLength={markersCount}
          suppressBoundsUntilRef={suppressBoundsUntilRef}
          appliedBboxKey={appliedBboxKey}
          onSearchThisArea={onSearchThisArea}
          mapBoundsLocked={mapBoundsLocked}
          onClearMapBounds={onClearMapBounds}
        />
        <MapPolygonDrawChrome
          language={language}
          enablePolygonDraw={enablePolygonDraw}
          appliedPolygon={appliedPolygon}
          onPolygonEncoded={onPolygonEncoded}
          onPolygonCleared={onPolygonCleared}
        />
        {cameraRestoreBbox ? (
          <CatalogMapCameraRestoreOnce
            bbox={cameraRestoreBbox}
            onRestored={onCameraRestoreDone}
            suppressBoundsUntilRef={suppressBoundsUntilRef}
          />
        ) : null}
        <InitialListingBoundsFit
          listings={fitListings}
          suppressBoundsUntilRef={suppressBoundsUntilRef}
          mapFitResetKey={mapFitResetKey}
          fallbackCenter={center}
          fallbackZoom={zoom}
          skipListingFit={
            Boolean(cameraRestoreBbox) ||
            Boolean(holdSoftBackCamera) ||
            softBackCameraLockRef.current
          }
        />

        <MapSelectionSync
          selectedListingId={selectedListingId}
          pins={effectivePins}
          listings={listings}
          selectionPanMode={selectionPanMode}
        />

        <CatalogMapSelectedPopup
          pin={selectedPopupPin}
          listing={selectedPopupListing}
          open={Boolean(selectedPopupPin)}
          language={language}
          initialDates={initialDates}
          currency={currency}
          exchangeRates={exchangeRates}
          onOpenDetails={onListingOpen}
          onClose={onMapBackgroundClick}
        />

        {useServerClusters ? (
          <>
            {mapClusters.map((cluster) => (
              <MapServerClusterMarker
                key={`cluster-${cluster.clusterId}`}
                cluster={cluster}
                language={language}
                currency={currency}
                exchangeRates={exchangeRates}
              />
            ))}
            {effectivePins.map((pin) => renderCatalogPriceMarker(pin, { zIndexOffset: 2000 }))}
          </>
        ) : (
          <>
            {/* Stage 201.89 — keep selected pin outside cluster so teal ring stays with popup. */}
            {selectedPopupPin
              ? renderCatalogPriceMarker(selectedPopupPin, { zIndexOffset: 2500 })
              : null}
            <MarkerClusterGroup
              chunkedLoading
              chunkInterval={200}
              chunkDelay={50}
              maxClusterRadius={72}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
              removeOutsideVisibleBounds={true}
              disableClusteringAtZoom={13}
              animateAddingMarkers={false}
              iconCreateFunction={(cluster) => createSearchMapClusterDivIcon(L, cluster)}
            >
              {effectivePins
                .filter((pin) => String(pin.id) !== String(selectedListingId || ''))
                .map((pin) => renderCatalogPriceMarker(pin))}
            </MarkerClusterGroup>
          </>
        )}
      </MapContainer>
    </div>
  )
}
