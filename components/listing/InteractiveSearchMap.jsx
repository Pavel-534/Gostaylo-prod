/**
 * GoStayLo - Interactive Search Map (Airbnb-style)
 * Desktop: list ~60% / map ~40%; price pills; viewport bounds sync.
 * Stage 89.0 — кластеризация (**`leaflet.markercluster`**): ниже масштаба **zoom 13** маркеры группируются; цвет кластера по доле Verified (**`options.gslVerified`**).
 *
 * Приватность: getListingLocationDisplayMode — «примерная» зона без круга, пилюля с пунктиром / ~.
 */

'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from '@changey/react-leaflet-markercluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createSearchMapClusterDivIcon } from '@/lib/maps/search-map-cluster-icon'
import { Button } from '@/components/ui/button'
import { ListingPriceMarker } from '@/components/listing/ListingPriceMarker'
import { MapServerClusterMarker } from '@/components/listing/MapServerClusterMarker'
import { getUIText } from '@/lib/translations'
import { getListingLocationDisplayMode } from '@/lib/listing-location-privacy'
import { formatPrice } from '@/lib/currency'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import {
  extractListingLatLng,
  leafletBoundsAroundPointMeters,
} from '@/lib/maps/map-provider-adapter'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function getListingPosition(listing) {
  const ll = extractListingLatLng(listing)
  return ll ? [ll.lat, ll.lng] : null
}

function listingCategorySlug(listing) {
  return listing.categorySlug ?? listing.category?.slug ?? null
}

function listingLocationBounds(listing, hasConfirmedBookingFn) {
  const pos = getListingPosition(listing)
  if (!pos) return null
  const booked = hasConfirmedBookingFn(listing.id)
  if (booked) {
    return L.latLngBounds(pos, pos)
  }
  const mode = getListingLocationDisplayMode({
    categorySlug: listingCategorySlug(listing),
    categoryId: listing.category_id ?? listing.categoryId,
  })
  if (mode === 'privacy') {
    return leafletBoundsAroundPointMeters(L, { lat: pos[0], lng: pos[1] }, 500)
  }
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
}) {
  const map = useMap()
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(false)
  }, [appliedBboxKey])

  useMapEvents({
    moveend: () => {
      if (!listingsLength) return
      if (!onSearchThisArea && !mapBoundsLocked) return
      if (Date.now() < suppressBoundsUntilRef.current) return
      setDirty(true)
    },
  })

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
  hasConfirmedBookingFn,
  suppressBoundsUntilRef,
  mapFitResetKey,
}) {
  const map = useMap()
  const didFitRef = useRef(false)
  const lastResetKeyRef = useRef(mapFitResetKey)

  useEffect(() => {
    if (lastResetKeyRef.current !== mapFitResetKey) {
      lastResetKeyRef.current = mapFitResetKey
      didFitRef.current = false
    }
  }, [mapFitResetKey])

  useEffect(() => {
    if (!listings?.length || didFitRef.current) return
    let bounds = null
    for (const listing of listings) {
      const b = listingLocationBounds(listing, hasConfirmedBookingFn)
      if (!b || !b.isValid()) continue
      bounds = bounds ? bounds.extend(b) : b
    }
    if (bounds?.isValid()) {
      suppressBoundsUntilRef.current = Date.now() + 1400
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
      didFitRef.current = true
    }
  }, [listings, map, hasConfirmedBookingFn, suppressBoundsUntilRef, mapFitResetKey])

  return null
}

function MapViewportReporter({ onViewportBbox, debounceMs = 400 }) {
  const map = useMap()
  const timerRef = useRef(null)

  const emitBounds = useCallback(() => {
    const b = map.getBounds()
    onViewportBbox?.({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
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

function MapSelectionSync({ selectedListingId, pins = [], listings = [] }) {
  const map = useMap()
  const lastPanIdRef = useRef(null)

  useEffect(() => {
    const id = String(selectedListingId || '').trim()
    if (!id || lastPanIdRef.current === id) return

    let lat = null
    let lng = null

    const pin = (pins || []).find((p) => String(p.id) === id)
    if (pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
      lat = pin.lat
      lng = pin.lng
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
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { animate: true, duration: 0.45 })
  }, [selectedListingId, pins, listings, map])

  return null
}

function pinToFitListing(pin) {
  if (!pin?.id) return null
  return {
    id: pin.id,
    latitude: pin.lat,
    longitude: pin.lng,
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
  }
}

/**
 * Sidebar listings always stay on map; API pins add viewport extras (Stage 170.11).
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
    if (!byId.has(id)) byId.set(id, pin)
  }
  return [...byId.values()]
}

function pinPriceLabel(pin, currency, exchangeRates, language, approximate) {
  const thb = pin?.price
  const text =
    thb != null && Number.isFinite(Number(thb))
      ? formatPrice(Number(thb), currency, exchangeRates, language)
      : '—'
  return (approximate ? '~' : '') + text
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
  center = [7.8804, 98.3923],
  zoom = 12,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  /** Синхрон с карточками списка: даты для `CardPriceDisplay` во всплывающем окне маркера */
  initialDates = null,
  selectedListingId = null,
  onListingMarkerClick,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
  layoutResetKey = 0,
}) {
  const [mounted, setMounted] = useState(false)
  const suppressBoundsUntilRef = useRef(0)

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

  const effectivePins = useMemo(() => {
    if (useServerClusters) return []
    return mergeCatalogMapPins(listings, mapPins, mapPinsUseApi)
  }, [useServerClusters, mapPinsUseApi, mapPins, listings])

  const fitListings = useMemo(() => {
    if (effectivePins.length > 0) {
      return effectivePins.map(pinToFitListing).filter(Boolean)
    }
    return listings || []
  }, [effectivePins, listings])

  const markersCount = useServerClusters
    ? mapClusters.length
    : effectivePins.length || listings.length

  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">{getUIText('mapPicker_loading', language)}</span>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full min-h-[300px]">
      <MapContainer
        center={center}
        zoom={zoom}
        className="absolute inset-0 z-0 h-full w-full rounded-lg"
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

        <MapSearchThisAreaButton
          language={language}
          listingsLength={markersCount}
          suppressBoundsUntilRef={suppressBoundsUntilRef}
          appliedBboxKey={appliedBboxKey}
          onSearchThisArea={onSearchThisArea}
          mapBoundsLocked={mapBoundsLocked}
          onClearMapBounds={onClearMapBounds}
        />
        <InitialListingBoundsFit
          listings={fitListings}
          hasConfirmedBookingFn={hasConfirmedBooking}
          suppressBoundsUntilRef={suppressBoundsUntilRef}
          mapFitResetKey={mapFitResetKey}
        />

        <MapSelectionSync
          selectedListingId={selectedListingId}
          pins={effectivePins}
          listings={listings}
        />

        {useServerClusters ? (
          mapClusters.map((cluster) => (
            <MapServerClusterMarker
              key={`cluster-${cluster.clusterId}`}
              cluster={cluster}
              language={language}
              currency={currency}
              exchangeRates={exchangeRates}
            />
          ))
        ) : (
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
            {effectivePins.map((pin) => {
                  const position = [pin.lat, pin.lng]
                  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null
                  const listingMatch = (listings || []).find((l) => String(l.id) === String(pin.id))
                  const priceText = pinPriceLabel(
                    pin,
                    currency,
                    exchangeRates,
                    language,
                    pin.isApproximate === true,
                  )
                  return (
                    <ListingPriceMarker
                      key={pin.id}
                      listing={listingMatch || null}
                      pin={pin}
                      position={position}
                      priceLabel={priceText || '—'}
                      approximate={pin.isApproximate === true}
                      selected={selectedListingId === pin.id}
                      language={language}
                      onSelect={onListingMarkerClick}
                      initialDates={initialDates}
                      currency={currency}
                      exchangeRates={exchangeRates}
                      lazyPopup={!listingMatch?.title}
                    />
                  )
                })}
          </MarkerClusterGroup>
        )}
      </MapContainer>
    </div>
  )
}
